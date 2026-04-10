/**
 * electron-builder configuration
 * Run: npm run build  →  release/TEN Document Studio-1.0.0.dmg
 */

const { execSync } = require('child_process')

module.exports = {
  appId:       "com.ten.document-studio",
  productName: "TEN Document Studio",

  // Strip extended attributes AFTER packing but BEFORE codesign runs.
  // Without this, macOS codesign fails with "resource fork detritus not allowed"
  // on Electron binaries downloaded from the internet.
  afterPack: async (context) => {
    try {
      execSync(`xattr -cr "${context.appOutDir}"`, { stdio: 'pipe' })
      console.log('  • stripped xattrs from', context.appOutDir)
    } catch {}
  },

  directories: {
    output: "release",
  },

  files: [
    "dist/**/*",        // Vite-compiled React UI
    "electron/**/*",    // Main process + preload
  ],

  // Bundle the PyInstaller binary alongside the app
  extraResources: [
    {
      from: "resources/generate_report",
      to:   "generate_report",
      filter: ["**/*"],
    },
  ],

  mac: {
    target: [
      { target: "dmg" },
    ],
    icon:       "public/icon.png",
    category:   "public.app-category.productivity",
    identity:   null,   // skip code signing — no Apple Developer cert needed for internal use
  },

  dmg: {
    title:   "TEN Document Studio",
    icon:    "public/icon.png",
    window:  { width: 540, height: 380 },
    contents: [
      { x: 150, y: 185, type: "file" },
      { x: 390, y: 185, type: "link", path: "/Applications" },
    ],
  },
}
