/**
 * electron/main.js
 *
 * Electron main process — replaces ALL Next.js API routes.
 *
 * IPC channels exposed to renderer (via preload.js):
 *   dialog:openFile   → native open-file dialog
 *   dialog:saveFile   → native save-file dialog
 *   generate:start    → runs Python batch generator, streams progress back
 *   auth:getStatus    → returns { loggedIn, user? }
 *   auth:login        → interactive PKCE login → { loggedIn, user }
 *   auth:logout       → clears token cache → { loggedIn: false }
 *
 * IPC events pushed to renderer:
 *   generate:progress → { partner, pct, step } | { overall } | { done, outputPath } | { error }
 *   auth:changed      → { loggedIn, user? }
 */

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const { spawn }  = require('child_process')
const path       = require('path')
const fs         = require('fs')
const os         = require('os')
const archiver   = require('archiver')
const auth       = require('./auth')
const graph      = require('./graph')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Window ──────────────────────────────────────────────────────────────────────

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1300,
    height: 900,
    minWidth:  900,
    minHeight: 640,
    webPreferences: {
      preload:           path.join(__dirname, 'preload.js'),
      contextIsolation:  true,
      nodeIntegration:   false,
      webSecurity:       false,   // Allow file:// image src for local gallery previews
    },
    titleBarStyle: 'default',
    backgroundColor: '#070707',
    show: false,
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Uncomment to open DevTools in development:
    // mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Helper: broadcast to renderer ──────────────────────────────────────────────
function broadcast(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ── IPC: File dialogs ───────────────────────────────────────────────────────────

ipcMain.handle('dialog:openFile', async (_event, options) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow
  const result = await dialog.showOpenDialog(win, options)
  return result   // { filePaths: string[], canceled: boolean }
})

ipcMain.handle('dialog:saveFile', async (_event, options) => {
  const win = BrowserWindow.getFocusedWindow() || mainWindow
  const result = await dialog.showSaveDialog(win, options)
  return result   // { filePath: string, canceled: boolean }
})

// ── IPC: Auth ───────────────────────────────────────────────────────────────────

ipcMain.handle('auth:getStatus', async () => {
  return await auth.getAuthStatus()
})

ipcMain.handle('auth:login', async () => {
  try {
    const result = await auth.interactiveLogin((url) => shell.openExternal(url))
    broadcast('auth:changed', result)
    // After browser auth completes, bring the app window back to the front
    if (result.loggedIn && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
    return result
  } catch (err) {
    return { loggedIn: false, error: err.message }
  }
})

ipcMain.handle('auth:logout', async () => {
  const result = await auth.logout()
  broadcast('auth:changed', result)
  return result
})

// ── Helpers: generation ─────────────────────────────────────────────────────────

function sanitize(s) {
  return String(s).replace(/[^\w\s-]/g, '').trim()
}

/** Resolve the Python generator binary (packaged binary or dev python script). */
function resolvePyBinary() {
  if (app.isPackaged) {
    // PyInstaller produces a plain binary on macOS/Linux, .exe on Windows
    const binaryName = process.platform === 'win32' ? 'generate_report.exe' : 'generate_report'
    return {
      bin:  path.join(process.resourcesPath, 'generate_report', binaryName),
      args: [],
    }
  }
  // Development: run the Python module directly
  return {
    bin:  process.platform === 'win32' ? 'python' : 'python3',
    args: ['-m', 'scripts.generate_report.generator'],
  }
}

/**
 * Run the Python report generator for a single partner.
 * Progress lines from stdout: "[XX%] message text"
 */
function runGenerator(manifest, outputPath, templatePath, coverPhotoPath, titlePngPath, masterHeaderPath, masterHeaderFocusX, masterHeaderFocusY, masterHeaderZoom, onProgress) {
  return new Promise((resolve, reject) => {
    const tmpManifest = path.join(
      os.tmpdir(),
      `ten_manifest_${Date.now()}_${Math.random().toString(36).slice(2)}.json`
    )
    fs.writeFileSync(tmpManifest, JSON.stringify(manifest, null, 2))

    const { bin, args } = resolvePyBinary()
    const fullArgs = [
      ...args,
      '--manifest', tmpManifest,
      '--template', templatePath,
      '--output',   outputPath,
    ]
    if (coverPhotoPath)    fullArgs.push('--cover-photo',    coverPhotoPath)
    if (titlePngPath)      fullArgs.push('--title-png',      titlePngPath)
    if (masterHeaderPath)  fullArgs.push('--master-header',  masterHeaderPath)
    if (masterHeaderFocusX !== null && masterHeaderFocusX !== undefined) {
      fullArgs.push('--master-header-focus-x', String(masterHeaderFocusX))
    }
    if (masterHeaderFocusY !== null && masterHeaderFocusY !== undefined) {
      fullArgs.push('--master-header-focus-y', String(masterHeaderFocusY))
    }
    if (masterHeaderZoom !== null && masterHeaderZoom !== undefined) {
      fullArgs.push('--master-header-zoom', String(masterHeaderZoom))
    }

    const cwd  = app.isPackaged ? process.resourcesPath : process.cwd()

    // macOS: ensure the binary is executable (Gatekeeper can strip the bit)
    if (app.isPackaged && process.platform !== 'win32') {
      try { fs.chmodSync(bin, 0o755) } catch {}
    }

    const proc = spawn(bin, fullArgs, { cwd })

    const stderrLines = []

    proc.stdout.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        const m = line.match(/^\[\s*(\d+)%\]\s+(.+)/)
        if (m) onProgress(m[2].trim(), parseInt(m[1], 10))
      }
    })

    proc.stderr.on('data', (chunk) => {
      // Capture stderr so we can include it in error messages
      stderrLines.push(chunk.toString())
      // Also log to Electron console for devtools visibility
      process.stderr.write(chunk)
    })

    proc.on('close', (code) => {
      try { fs.unlinkSync(tmpManifest) } catch {}
      if (code === 0) {
        resolve()
      } else {
        const stderrText = stderrLines.join('').trim()
        // Extract the most useful line from the traceback (last non-empty line)
        const usefulLine = stderrText.split('\n').filter(l => l.trim()).pop() || ''
        reject(new Error(`Generator exited with code ${code}${usefulLine ? ': ' + usefulLine : ''}`))
      }
    })
  })
}

/**
 * CPU-aware concurrency pool.
 * Runs `factories` (functions that return Promises) with at most `limit` in
 * flight at any one time, then resolves with an array of results.
 */
function runWithPool(factories, limit) {
  return new Promise((resolve, reject) => {
    const results = new Array(factories.length)
    let idx = 0, running = 0, done = 0

    function next() {
      while (running < limit && idx < factories.length) {
        const i = idx++
        running++
        factories[i]()
          .then((val) => {
            results[i] = val
            running--
            done++
            if (done === factories.length) resolve(results)
            else next()
          })
          .catch((err) => reject(err))
      }
    }

    if (factories.length === 0) { resolve([]); return }
    next()
  })
}

/** Zip an array of { path, name } into outputZip. */
function zipFiles(files, outputZip) {
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(outputZip)
    const archive = archiver('zip', { zlib: { level: 6 } })
    archive.on('error', reject)
    output.on('close', resolve)
    archive.pipe(output)
    for (const f of files) archive.file(f.path, { name: f.name })
    archive.finalize()
  })
}

// ── IPC: Batch generate ─────────────────────────────────────────────────────────

/**
 * Payload shape:
 * {
 *   eventBase:    { ...all manifest fields except partner-specific ones },
 *   partners:     { name: string, logo_path: string|null, include_guests: boolean }[],
 *   templatePath: string,
 *   coverPath:    string | null,
 *   titlePngPath: string | null,
 *   outputPath:   string,  ← where to save the final ZIP
 * }
 */
ipcMain.handle('generate:start', async (event, payload) => {
  const {
    eventBase,
    partners,
    templatePath,
    coverPath          = null,
    titlePngPath       = null,
    masterHeaderPath   = null,
    masterHeaderFocusX = null,
    masterHeaderFocusY = null,
    masterHeaderZoom   = null,
    outputPath,
  } = payload

  // Validate template exists
  const resolvedTemplate = fs.existsSync(templatePath)
    ? templatePath
    : path.join(process.cwd(), 'template', 'report_template.pptx')

  if (!fs.existsSync(resolvedTemplate)) {
    throw new Error(`Template not found: ${templatePath}`)
  }

  const tmpDir    = os.tmpdir()
  const sessionId = `ten_batch_${Date.now()}`
  const outDir    = path.join(tmpDir, sessionId)
  fs.mkdirSync(outDir, { recursive: true })

  // Per-partner progress tracking
  const progress = {}
  for (const p of partners) progress[p.name] = 0

  const calcOverall = () => {
    const vals = Object.values(progress)
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  const send = (data) => {
    try { event.sender.send('generate:progress', data) } catch {}
  }

  const generatedFiles = []

  // CPU-aware concurrency: leave one core free for UI/system
  const concurrency = Math.max(1, Math.min(partners.length, os.cpus().length - 1))
  console.log(`[generate] Running ${partners.length} partners with concurrency=${concurrency}`)

  try {
    const factories = partners.map((partner) => () => {
      const { name, logo_path, include_guests } = typeof partner === 'string'
        ? { name: partner, logo_path: null, include_guests: true }
        : partner

      const manifest = {
        ...eventBase,
        partner_name:      name,
        partner_logo_path: logo_path ?? null,
        include_guests:    include_guests !== false,
      }
      const safeEvent  = sanitize(eventBase.event_name || 'Report')
      const safeName   = sanitize(name)
      const filename   = `${safeEvent} - Report for ${safeName}.pptx`
      const pptxPath   = path.join(outDir, filename)

      return runGenerator(
        manifest,
        pptxPath,
        resolvedTemplate,
        coverPath,
        titlePngPath,
        masterHeaderPath,
        masterHeaderFocusX,
        masterHeaderFocusY,
        masterHeaderZoom,
        (step, pct) => {
          progress[name] = pct
          send({ partner: name, pct, step })
          send({ overall: calcOverall() })
        }
      ).then(() => {
        generatedFiles.push({ path: pptxPath, name: filename })
      })
    })

    await runWithPool(factories, concurrency)

    // Zip everything
    send({ overall: 95, partner: 'all', pct: 95, step: 'Zipping reports…' })
    await zipFiles(generatedFiles, outputPath)

    // Clean up individual PPTX files
    for (const f of generatedFiles) {
      try { fs.unlinkSync(f.path) } catch {}
    }
    try { fs.rmdirSync(outDir) } catch {}

    send({ overall: 100, partner: 'all', pct: 100, step: 'Done.' })
    send({ done: true, outputPath })

    return { success: true, outputPath }

  } catch (err) {
    try { fs.rmSync(outDir, { recursive: true, force: true }) } catch {}
    const msg = err instanceof Error ? err.message : String(err)
    send({ error: `Generation failed: ${msg}` })
    throw new Error(`Generation failed: ${msg}`)
  }
})

// ── Graph: in-memory cache ───────────────────────────────────────────────────

let _plannerCache  = null   // last PlannerSyncResult
let _onedriveCache = null   // last OneDriveSyncResult
let _syncTimer     = null   // setInterval handle

const SYNC_INTERVAL_MS = 39 * 60 * 1000  // 39 minutes

async function doSync() {
  try {
    const token = await auth.getAccessToken()
    const [planner, onedrive] = await Promise.allSettled([
      graph.syncPlanner(token),
      graph.syncOneDrive(token),
    ])
    if (planner.status  === 'fulfilled') _plannerCache  = planner.value
    if (onedrive.status === 'fulfilled') _onedriveCache = onedrive.value

    broadcast('sync:updated', {
      planner:  _plannerCache,
      onedrive: _onedriveCache,
    })

    console.log(`[sync] Completed at ${new Date().toLocaleTimeString()}`)
  } catch (err) {
    console.warn('[sync] Skipped (not authenticated):', err.message)
  }
}

// Start sync loop after auth is ready
app.whenReady().then(() => {
  // Initial sync fires 2s after window is ready (auth may not be cached yet)
  setTimeout(doSync, 2000)
  _syncTimer = setInterval(doSync, SYNC_INTERVAL_MS)
})

app.on('quit', () => { if (_syncTimer) clearInterval(_syncTimer) })

// ── IPC: Planner ─────────────────────────────────────────────────────────────

/** Manual sync — called on login or user-triggered refresh */
ipcMain.handle('planner:sync', async () => {
  await doSync()
  return _plannerCache || { plans: [], buckets: [], tasks: [], syncedAt: null }
})

/** Get cached planner data immediately (no network call) */
ipcMain.handle('planner:getCache', () => {
  return _plannerCache || { plans: [], buckets: [], tasks: [], categories: [], syncedAt: null }
})

// ── IPC: Full Team Planner (all plans, all members) ───────────────────────────

let _fullPlannerCache = null

/** Fetch full team planner on demand — not part of the background sync loop */
ipcMain.handle('planner:syncFull', async () => {
  try {
    const token = await auth.getAccessToken()
    _fullPlannerCache = await graph.syncFullPlanner(token)
    return _fullPlannerCache
  } catch (err) {
    return { plans: [], buckets: [], tasks: [], categories: [], members: [], syncedAt: null, error: err.message }
  }
})

/** Return last fetched full-planner data immediately (no network call) */
ipcMain.handle('planner:getCacheFull', () => {
  return _fullPlannerCache || { plans: [], buckets: [], tasks: [], categories: [], members: [], syncedAt: null }
})

/** Toggle task completion: percentComplete 100 = done, 0 = not started */
ipcMain.handle('planner:updateTask', async (_event, { taskId, percentComplete }) => {
  try {
    const token = await auth.getAccessToken()
    await graph.updateTaskCompletion(taskId, percentComplete, token)
    // Refresh cache in background
    doSync().catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/** Add a new Planner task with optional category labels */
ipcMain.handle('planner:addTask', async (_event, { planId, bucketId, title, assigneeIds, categoryKeys }) => {
  try {
    const token = await auth.getAccessToken()
    const task  = await graph.createTask(planId, bucketId, title, assigneeIds || [], categoryKeys || [], token)
    doSync().catch(() => {})
    return { success: true, task }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

/** Toggle a checklist item (subtask) */
ipcMain.handle('planner:updateChecklist', async (_event, { taskId, checklistItemId, isChecked }) => {
  try {
    const token = await auth.getAccessToken()
    await graph.updateChecklistItem(taskId, checklistItemId, isChecked, token)
    doSync().catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: OneDrive ─────────────────────────────────────────────────────────────

/** Manual OneDrive sync */
ipcMain.handle('onedrive:sync', async () => {
  try {
    const token = await auth.getAccessToken()
    _onedriveCache = await graph.syncOneDrive(token)
    return _onedriveCache
  } catch (err) {
    return { total: 0, used: 0, remaining: 0, topFolders: [], syncedAt: null, error: err.message }
  }
})

/** Get cached OneDrive data immediately */
ipcMain.handle('onedrive:getCache', () => {
  return _onedriveCache || { total: 0, used: 0, remaining: 0, topFolders: [], syncedAt: null }
})

/** Full OneDrive analytics — fetched on demand when modal opens */
ipcMain.handle('onedrive:getDetails', async () => {
  try {
    const token = await auth.getAccessToken()
    return await graph.getOneDriveDetails(token)
  } catch (err) {
    return { total: 0, used: 0, remaining: 0, deleted: 0, folders: [], fileTypes: [], recentFiles: [], syncedAt: null, error: err.message }
  }
})
