# TEN Document Studio — Electron Desktop App

This project has been migrated from a Next.js/Vercel web app to a **packaged Electron desktop app (.exe)**.

---

## Quick Start (Development)

```bash
# 1. Install dependencies (run once)
npm install

# 2. Start Electron in dev mode (hot reload)
npm run dev
```

This launches Vite on port 5173 and opens Electron pointing to it.

---

## Build the .exe Installer (Windows only)

### Prerequisites

On the Windows machine where you'll build:
- Node.js 20+
- Python 3.10+ with pip
- Run: `npm install` to get all Node deps

### Step 1 — Compile Python → standalone binary

```bash
pip install pyinstaller python-pptx pillow

cd scripts/generate_report

pyinstaller generator.py \
  --onefile \
  --name generate_report \
  --distpath ../../resources/generate_report \
  --add-data "slides;slides" \
  --hidden-import python-pptx \
  --hidden-import PIL
```

This creates: `resources/generate_report/generate_report.exe`

### Step 2 — Build the installer

```bash
cd ../..   # back to project root
npm run build
```

Output: `release/TEN Document Studio Setup 1.0.0.exe`

That `.exe` is the final deliverable. It contains:
- The React UI (compiled by Vite)
- The Electron runtime
- The Python binary (compiled by PyInstaller with all deps bundled)

End users run the installer, get a desktop shortcut, and they're done. Zero setup required.

---

## Architecture

| Layer | Old (Vercel/Next.js) | New (Electron) |
|---|---|---|
| UI | Next.js React | Vite + React (same components) |
| API routes | Next.js `/api/*` | `electron/main.js` IPC handlers |
| File uploads | Multipart HTTP | Native `dialog.showOpenDialog` |
| Python execution | `child_process` on Vercel | `child_process` in Electron main |
| Python runtime | Vercel's Python | **PyInstaller binary** bundled |
| Output download | HTTP download URL | `dialog.showSaveDialog` → local file |
| Packaging | Vercel deploy | **electron-builder** → `.exe` NSIS |

---

## File Structure

```
├── electron/
│   ├── main.js          ← Main process (replaces ALL Next.js API routes)
│   └── preload.js       ← Context bridge (IPC + file path resolution)
├── src/
│   ├── main.tsx         ← Vite entry point
│   ├── App.tsx          ← Page router (home / reports)
│   ├── components/      ← All adapted React components (no Next.js deps)
│   │   ├── ReportWizard.tsx   ← Key change: HTTP → IPC, File → local paths
│   │   ├── Navbar.tsx         ← Removed next-auth, uses simple page state
│   │   ├── Hero.tsx           ← next/image → <img>
│   │   ├── SectionCard.tsx    ← next/link removed, uses onCta callback
│   │   └── Footer.tsx
│   └── styles/
│       └── globals.css
├── scripts/generate_report/   ← Python scripts (unchanged)
├── resources/generate_report/ ← PyInstaller .exe goes here at build time
├── index.html                 ← Vite HTML entry
├── vite.config.ts
├── electron-builder.config.js
└── package.json               ← "main": "electron/main.js"
```

---

## Key Changes from Web Version

### 1. File Inputs → Native Dialogs
`ElectronFileDropZone` (in ReportWizard) calls `window.electronAPI.openFile()` instead of
`<input type="file">`. This opens the native OS file picker and returns a **local path string**.

### 2. Gallery Photos
Gallery photos still use `<input type="file">` for drag-and-drop UX, but also call
`window.electronAPI.getPathForFile(file)` to get the real filesystem path. This path
is passed to Python instead of uploading the file.

### 3. Generate → IPC
The `generate()` function:
1. Opens a native **save dialog** to pick where the ZIP goes
2. Registers a progress listener via `window.electronAPI.onProgress()`
3. Calls `window.electronAPI.startGenerate(payload)` — runs Python locally
4. When done, shows the saved ZIP path (no download needed)

### 4. Authentication Removed
The desktop app is single-user, no auth needed. `next-auth`, OneDrive sync, and
analytics pages are not included in the Electron build.

---

## Notes

- **Fonts:** Currently loaded from Google Fonts CDN. For offline use, download
  Bebas Neue + Inter into `public/fonts/` and update `src/styles/globals.css` with
  `@font-face` declarations.

- **PyInstaller must run on Windows** to produce a Windows binary. For Mac/Linux
  dev testing, the app falls back to running `python3 -m scripts.generate_report.generator`
  directly (see `isDev` check in `electron/main.js`).

- **Vercel env vars are no longer needed** — the desktop app has no server, no OneDrive
  integration, and no authentication. The env vars shown in Vercel (ONEDRIVE_REFRESH_TOKEN,
  NEXTAUTH_URL, AUTH_SECRET, AZURE_CLIENT_ID, etc.) are only relevant to the legacy web app.
