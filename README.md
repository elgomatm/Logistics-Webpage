# TEN Document Studio

Internal tool for The Exotics Network — automates generating event partner reports as polished PowerPoint presentations.

---

## Install (macOS)

### Requirements — install these first if you don't have them

| Tool | Download |
|------|----------|
| **Node.js** (LTS) | https://nodejs.org — click the big LTS button |
| **Python 3** | https://python.org/downloads — click the top download button |

Both are standard `.pkg` installers — just click through them.

---

### One-command install

1. **Download this repo** — click the green **Code** button above → **Download ZIP**, then unzip it somewhere (Desktop is fine).

2. Open **Terminal** — press `Cmd + Space`, type `Terminal`, hit Enter.

3. Drag the unzipped folder into the Terminal window (this fills in the path), then run:
   ```bash
   cd <drag folder here>
   bash install.sh
   ```

4. The script takes ~2 minutes. When it finishes, a `.dmg` opens automatically — drag **TEN Document Studio** into **Applications**.

5. Launch from Applications or your Dock. **Done.**

---

### First launch: macOS security warning

Because this app isn't on the Mac App Store, macOS may block it the first time:

> *"TEN Document Studio can't be opened because it's from an unidentified developer."*

**Fix:** Open **System Settings → Privacy & Security**, scroll down, click **Open Anyway**.

---

### Signing in

Uses your `@theexoticsnetwork.com` Microsoft account — same one as Teams. Click **Sign In**, a browser window opens, you log in, browser closes, you're in.

> **One-time Azure setup (account owner only):** See `AZURE_SETUP.md` — takes about 2 minutes.

---

## For developers

```bash
npm run dev       # dev mode with hot reload
bash BUILD.sh     # full production build → release/*.dmg
```
