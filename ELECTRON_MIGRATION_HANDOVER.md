# Electron Desktop App Migration — Handover Plan
## TEN Document Studio — Report Generator

---

## CONTEXT: What This Is

This is an internal tool for **The Exotics Network (TEN)** that generates branded partner event reports as `.pptx` files. A user fills out an 8-step wizard (event name, partners, stats, photos, testimonials, etc.), hits Generate, and the tool produces one polished PowerPoint per partner — all from a previous event's PPTX as a base template.

**Current state:** Next.js 14 web app deployed on Vercel. It works end-to-end but hits Vercel's 4.5 MB upload limit and 10s default timeout for large PPTX + photo uploads. The decision has been made to migrate to a **packaged Electron desktop app (.exe)** — same exact UI, no server, no internet required, no setup for end users.

**Codebase location:** `https://github.com/elgomatm/Logistics-Webpage`

---

## TARGET: What To Build

A Windows `.exe` installer that:
- Users double-click to install (or run directly)
- Opens a desktop window showing the **exact same React UI** (same fonts, same champagne gold theme, same 8-step wizard, same gallery crop editor — pixel for pixel)
- Runs the Python report generation scripts **locally** as a child process
- Saves the output ZIP directly to the user's chosen folder
- Requires **zero setup** — no Python install, no Node, no VSCode, nothing

---

## Architecture Decision

| Layer | Current (Web) | New (Electron) |
|---|---|---|
| UI | Next.js React | Vite + React (same components) |
| API routes | Next.js `/api/*` | Electron `ipcMain` handlers |
| File uploads | Multipart HTTP to `/tmp` | Native file dialog → direct path |
| Python execution | `child_process.spawn` on Vercel | `child_process.spawn` in Electron main |
| Python runtime | Vercel's server Python | **PyInstaller binary** bundled in app |
| Output download | HTTP download URL | `dialog.showSaveDialog` → write to disk |
| Packaging | Vercel deploy | **electron-builder** → `.exe` NSIS installer |

---

## Tech Stack

```
electron                  # Desktop shell
vite + @vitejs/plugin-react  # Frontend bundler (replaces Next.js)
electron-builder          # Packages everything into .exe installer
PyInstaller               # Compiles Python scripts → standalone binary
```

---

## Repository Structure After Migration

```
ten-document-studio/
├── electron/
│   ├── main.js           # Electron main process (replaces all Next.js API routes)
│   ├── preload.js        # Context bridge (exposes IPC to renderer)
│   └── python-bridge.js  # Spawns the PyInstaller binary, streams progress
├── src/
│   ├── main.tsx          # Vite entry point
│   ├── App.tsx           # Replaces app/page.tsx — renders Navbar + wizard router
│   ├── components/       # COPY DIRECTLY from current components/
│   │   ├── ReportWizard.tsx   # ← minimal changes needed
│   │   ├── Navbar.tsx
│   │   ├── Hero.tsx
│   │   ├── Footer.tsx
│   │   └── ...all others
│   ├── styles/
│   │   └── globals.css   # COPY DIRECTLY from app/globals.css
│   └── index.html
├── scripts/
│   └── generate_report/  # COPY DIRECTLY — zero changes to Python
│       ├── generator.py
│       ├── manifest.py
│       ├── slides/
│       └── ...
├── resources/
│   └── generate_report/  # PyInstaller output goes here at build time
│       └── generate_report.exe  # the compiled Python binary
├── package.json
├── vite.config.ts
└── electron-builder.config.js
```

---

## Step-by-Step Migration Plan

### PHASE 1 — Project Scaffold

1. Create a new folder (or new branch): `ten-desktop`
2. Init the project:
   ```bash
   npm create vite@latest ten-desktop -- --template react-ts
   cd ten-desktop
   npm install
   npm install --save-dev electron electron-builder concurrently wait-on
   ```
3. Copy these files/folders verbatim from the current repo:
   - `components/` → `src/components/`
   - `app/globals.css` → `src/styles/globals.css`
   - `scripts/generate_report/` → `scripts/generate_report/`
   - `public/` → `public/` (logo, favicon, etc.)

---

### PHASE 2 — Electron Main Process (`electron/main.js`)

This replaces ALL Next.js API routes. Key responsibilities:

```javascript
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

// ── Window creation ──────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',  // clean look
    backgroundColor: '#f5f5f7',
  })
  
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// ── IPC: Open file dialog ─────────────────────────────────────────
// Replaces: file <input type="file"> uploads
ipcMain.handle('dialog:openFile', async (_, options) => {
  const result = await dialog.showOpenDialog(options)
  return result  // { filePaths: [...], canceled: bool }
})

// ── IPC: Save dialog ──────────────────────────────────────────────
// Replaces: the download URL / HTTP download
ipcMain.handle('dialog:saveFile', async (_, options) => {
  const result = await dialog.showSaveDialog(options)
  return result  // { filePath: '...', canceled: bool }
})

// ── IPC: Generate reports ─────────────────────────────────────────
// Replaces: POST /api/batch-generate
// Spawns the PyInstaller binary and streams progress back via IPC events
ipcMain.handle('generate:start', async (event, { manifest, outputDir, templatePath, coverPath, titlePngPath }) => {
  const pyBin = app.isPackaged
    ? path.join(process.resourcesPath, 'generate_report', 'generate_report.exe')
    : path.join(__dirname, '../scripts/generate_report/generator.py')

  const args = app.isPackaged
    ? [JSON.stringify(manifest), outputDir]
    : [path.join(__dirname, '../scripts/generate_report/generator.py'),
       JSON.stringify(manifest), outputDir]

  const proc = app.isPackaged
    ? spawn(pyBin, args)
    : spawn('python', args)

  proc.stdout.on('data', (data) => {
    // Parse SSE-style progress lines from Python stdout
    // Python prints: {"partner":"COTA","pct":45,"step":"Building slides..."}
    try {
      const lines = data.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        const msg = JSON.parse(line)
        event.sender.send('generate:progress', msg)
      }
    } catch {}
  })

  proc.stderr.on('data', (data) => {
    event.sender.send('generate:error', data.toString())
  })

  return new Promise((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0) resolve({ success: true })
      else reject(new Error(`Generator exited with code ${code}`))
    })
  })
})

app.whenReady().then(createWindow)
```

---

### PHASE 3 — Preload Bridge (`electron/preload.js`)

```javascript
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openFile:  (options) => ipcRenderer.invoke('dialog:openFile', options),
  saveFile:  (options) => ipcRenderer.invoke('dialog:saveFile', options),
  
  // Generation
  startGenerate: (payload) => ipcRenderer.invoke('generate:start', payload),
  onProgress:    (cb) => ipcRenderer.on('generate:progress', (_, data) => cb(data)),
  onError:       (cb) => ipcRenderer.on('generate:error', (_, msg) => cb(msg)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
```

---

### PHASE 4 — Update `ReportWizard.tsx` (minimal changes)

The UI stays **100% identical**. Only the data-flow wiring changes:

#### 4a. Replace `<input type="file">` with native dialog

**Current (web):**
```tsx
// FileDropZone uses <input type="file" ref={inputRef} onChange={...} />
```

**New (Electron):**
```tsx
// Call window.electronAPI.openFile() on button click
const handleBrowse = async () => {
  const result = await window.electronAPI.openFile({
    filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
    properties: ['openFile'],
  })
  if (!result.canceled && result.filePaths[0]) {
    onFile(result.filePaths[0])  // pass the local path string, not a File object
  }
}
```

> **Key difference:** In Electron, `onFile` receives a **string path** instead of a `File` object. The Python script gets the path directly — no temp copying needed.

#### 4b. Replace the `generate()` function

**Current (web):**
```tsx
// Step A: POST /api/upload-assets (multipart)
// Step B: POST /api/batch-generate (SSE stream)
// Step C: Download from URL
```

**New (Electron):**
```tsx
async function generate() {
  // Step A: Ask where to save output
  const saveResult = await window.electronAPI.saveFile({
    defaultPath: `${state.event_name}_reports.zip`,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  })
  if (saveResult.canceled) return

  // Step B: Wire up progress listener
  window.electronAPI.onProgress((msg) => {
    // update partnerProgress state — same logic as current SSE handler
  })

  // Step C: Kick off generation (paths are already local, no upload needed)
  await window.electronAPI.startGenerate({
    manifest:     buildManifest(state, "__placeholder__", galleryPhotoPaths),
    outputPath:   saveResult.filePath,
    templatePath: assets.template,   // already a local path string
    coverPath:    assets.cover ?? null,
    titlePngPath: assets.title_png ?? null,
  })
}
```

#### 4c. TypeScript types — add to the top of ReportWizard.tsx

```tsx
declare global {
  interface Window {
    electronAPI: {
      openFile:   (opts: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
      saveFile:   (opts: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
      startGenerate: (payload: GeneratePayload) => Promise<{ success: boolean }>
      onProgress: (cb: (msg: ProgressMessage) => void) => void
      onError:    (cb: (msg: string) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}
```

---

### PHASE 5 — Python: Update `generator.py` for CLI mode

The Python scripts are **unchanged** internally. Just add a CLI entry point so the Electron main process can call it:

At the bottom of `scripts/generate_report/generator.py`, add:

```python
if __name__ == "__main__":
    import sys, json

    manifest_json = sys.argv[1]
    output_path   = sys.argv[2]

    manifest = manifest_from_dict(json.loads(manifest_json))
    
    # Progress callback that prints JSON lines to stdout
    # (Electron main.js reads these and forwards to renderer via IPC)
    def progress_cb(partner, pct, step):
        print(json.dumps({"partner": partner, "pct": pct, "step": step}), flush=True)

    generate(manifest, output_path, progress_cb=progress_cb)
```

---

### PHASE 6 — Bundle Python with PyInstaller

Run this **once** on a Windows machine before building the installer:

```bash
pip install pyinstaller
cd scripts/generate_report

pyinstaller generator.py \
  --onefile \
  --name generate_report \
  --distpath ../../resources/generate_report \
  --add-data "slides;slides" \
  --hidden-import python-pptx \
  --hidden-import PIL
```

This creates `resources/generate_report/generate_report.exe` — a single self-contained binary that bundles Python + all dependencies. `electron-builder` picks it up and includes it in the installer.

---

### PHASE 7 — `electron-builder.config.js`

```javascript
module.exports = {
  appId:       "com.ten.document-studio",
  productName: "TEN Document Studio",
  directories: {
    output: "release",
  },
  files: [
    "dist/**/*",       // Vite build output
    "electron/**/*",   // Main + preload
  ],
  extraResources: [
    {
      from: "resources/generate_report",
      to:   "generate_report",
      filter: ["**/*"],
    },
  ],
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
    icon:   "public/icon.ico",
  },
  nsis: {
    oneClick:        false,
    allowToChangeInstallationDirectory: true,
    installerIcon:   "public/icon.ico",
    shortcutName:    "TEN Document Studio",
    createDesktopShortcut: true,
  },
}
```

---

### PHASE 8 — `package.json` scripts

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev":   "concurrently \"vite\" \"wait-on http://localhost:5173 && electron .\"",
    "build": "vite build && electron-builder build --win",
    "pack":  "electron-builder --dir"
  }
}
```

---

### PHASE 9 — `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',   // ← critical for Electron file:// loading
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist',
  },
})
```

---

## Summary of Files to Copy Verbatim (Zero Changes)

These move directly from the current Next.js repo into the Electron project with no modifications:

| Source | Destination |
|---|---|
| `components/*.tsx` | `src/components/*.tsx` |
| `app/globals.css` | `src/styles/globals.css` |
| `scripts/generate_report/**` | `scripts/generate_report/**` |
| `public/**` | `public/**` |

---

## Files That Need Modification

| File | What Changes |
|---|---|
| `ReportWizard.tsx` | File inputs → `electronAPI.openFile()`, generate fn → IPC call, add `Window` type declaration |
| `generator.py` | Add `if __name__ == "__main__"` CLI entry point at bottom |
| (new) `electron/main.js` | Write from scratch per Phase 2 above |
| (new) `electron/preload.js` | Write from scratch per Phase 3 above |
| (new) `vite.config.ts` | Write from scratch per Phase 9 |
| (new) `electron-builder.config.js` | Write from scratch per Phase 7 |
| (new) `src/main.tsx` | Vite entry — imports App.tsx, injects globals.css |
| (new) `src/App.tsx` | Top-level router: renders Navbar + ReportWizard (replaces app/page.tsx) |

---

## Build Instructions (Final .exe)

On a Windows machine with Node.js installed:

```bash
# 1. Install dependencies
npm install

# 2. Build Python binary (requires Python + pip installed on THIS machine only)
pip install pyinstaller python-pptx pillow
cd scripts/generate_report
pyinstaller generator.py --onefile --name generate_report --distpath ../../resources/generate_report
cd ../..

# 3. Build the installer
npm run build
# → release/TEN Document Studio Setup 1.0.0.exe
```

The `.exe` in `release/` is the final deliverable. It contains:
- The React UI (compiled by Vite)
- The Electron runtime
- The Python binary (compiled by PyInstaller)
- All Python dependencies (bundled by PyInstaller)

End users get one installer. They run it, get a desktop shortcut, and they're done.

---

## Important Notes for the AI Picking This Up

1. **Do NOT rewrite the UI.** The React components and CSS are already polished and correct. Copy them as-is. The only component that needs real changes is `ReportWizard.tsx` and only in its file-handling and generate functions.

2. **The Python scripts are complete and working.** Do not touch them except adding the `__main__` entry point to `generator.py`.

3. **The gallery photo crop editor** (drag-to-reposition, `object-position` CSS, 7 slots per slide) must be preserved exactly. It's all in `ReportWizard.tsx` already.

4. **Gallery photos in Electron:** Instead of `File` objects with `URL.createObjectURL()`, use `file://` paths. The preload bridge should expose a helper to read a file path and return a `blob:` URL for the preview, OR keep using `<input type="file">` for gallery photos only (since those are used purely for preview + the path is needed for Python anyway).

5. **The PyInstaller step must be run on Windows** to produce a Windows binary. If building on Mac/Linux for testing, run the Python directly via `python generator.py` — the `app.isPackaged` check in `main.js` handles this.

6. **Fonts:** The app uses Google Fonts (Bebas Neue + Inter). In production/offline mode, bundle the font files locally in `public/fonts/` and update the CSS `@font-face` declarations instead of relying on the Google Fonts CDN.
