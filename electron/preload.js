/**
 * electron/preload.js
 *
 * Context bridge — safely exposes Electron APIs to the React renderer.
 * Only what's listed here is available via window.electronAPI.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {

  // ── File dialogs ─────────────────────────────────────────────────────────────
  /** Open a native file-picker. Returns { filePaths: string[], canceled: boolean } */
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

  /** Open a native save-path picker. Returns { filePath: string, canceled: boolean } */
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // ── File path resolution ─────────────────────────────────────────────────────
  /**
   * Get the real filesystem path for a File object (from <input type="file">).
   * Uses Electron's webUtils.getPathForFile (Electron 32+).
   * Falls back to the non-standard file.path property for older Electron.
   */
  getPathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return file.path || ''
    }
  },

  // ── Report generation ────────────────────────────────────────────────────────
  /**
   * Start batch generation. Returns Promise<{ success: boolean, outputPath: string }>.
   * Progress events are pushed via onProgress.
   *
   * Payload:
   *   eventBase    — all manifest fields except partner_name
   *   partners     — string[]
   *   templatePath — string (local file path)
   *   coverPath    — string | null
   *   titlePngPath — string | null
   *   outputPath   — string (where to save the ZIP)
   */
  startGenerate: (payload) => ipcRenderer.invoke('generate:start', payload),

  /**
   * Start batch guide generation (no template upload needed).
   * Payload: { manifest: GuideManifest, tenLogoPath: string|null, outputPath: string }
   */
  startGuideGenerate: (payload) => ipcRenderer.invoke('generate:guide:start', payload),

  // ── Progress listeners ───────────────────────────────────────────────────────
  /** Register a callback for generate:progress events. */
  onProgress: (cb) => ipcRenderer.on('generate:progress', (_event, data) => cb(data)),

  /** Register a callback for generate:guide:progress events. */
  onGuideProgress: (cb) => ipcRenderer.on('generate:guide:progress', (_event, data) => cb(data)),

  /** Remove all listeners for a given channel. */
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // ── Authentication ───────────────────────────────────────────────────────────
  /**
   * Check current auth status (silent token refresh on every call).
   * Returns { loggedIn: boolean, user?: { name, email, id } }
   */
  getAuthStatus: () => ipcRenderer.invoke('auth:getStatus'),

  /**
   * Trigger interactive Microsoft sign-in (opens system browser → PKCE loopback).
   * Returns { loggedIn: boolean, user?: { name, email, id }, error?: string }
   */
  login: () => ipcRenderer.invoke('auth:login'),

  /**
   * Sign out and clear the stored token cache.
   * Returns { loggedIn: false }
   */
  logout: () => ipcRenderer.invoke('auth:logout'),

  /**
   * Register a callback for auth state changes pushed from main (e.g. after login/logout).
   * The callback receives { loggedIn: boolean, user?: { name, email, id } }
   */
  onAuthChanged: (cb) => ipcRenderer.on('auth:changed', (_event, data) => cb(data)),

  // ── Planner ──────────────────────────────────────────────────────────────────
  /** Force a fresh sync with Teams Planner. Returns PlannerSyncResult. */
  plannerSync: () => ipcRenderer.invoke('planner:sync'),

  /** Return the last cached planner data immediately (no network). */
  plannerGetCache: () => ipcRenderer.invoke('planner:getCache'),

  /** Toggle task completion. Returns { success, error? }. */
  plannerUpdateTask: (args) => ipcRenderer.invoke('planner:updateTask', args),

  /** Create a new task. Returns { success, task?, error? }. */
  plannerAddTask: (args) => ipcRenderer.invoke('planner:addTask', args),

  /** Toggle a checklist item (subtask). */
  plannerUpdateChecklist: (args) => ipcRenderer.invoke('planner:updateChecklist', args),

  /** Fetch full team planner — all plans, all members (no person filter). */
  plannerSyncFull: () => ipcRenderer.invoke('planner:syncFull'),

  /** Return last fetched full planner cache immediately (no network). */
  plannerGetCacheFull: () => ipcRenderer.invoke('planner:getCacheFull'),

  // ── OneDrive ─────────────────────────────────────────────────────────────────
  /** Force a fresh OneDrive storage sync. Returns OneDriveSyncResult. */
  onedriveSync: () => ipcRenderer.invoke('onedrive:sync'),

  /** Return last cached OneDrive data immediately. */
  onedriveGetCache:    () => ipcRenderer.invoke('onedrive:getCache'),
  onedriveGetDetails:  () => ipcRenderer.invoke('onedrive:getDetails'),

  /** Register a callback for background sync:updated pushes. */
  onSyncUpdated: (cb) => ipcRenderer.on('sync:updated', (_event, data) => cb(data)),

})
