#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  TEN Document Studio — One-Click Installer
#  Usage: bash install.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

BOLD='\033[1m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo ""
echo "  ┌──────────────────────────────────────────┐"
echo "  │     TEN Document Studio — Installer      │"
echo "  └──────────────────────────────────────────┘"
echo ""

# ── 1. Check prerequisites ────────────────────────────────────────────────────
echo -e "${BOLD}Checking requirements...${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}"
  echo "  ✗  Node.js is not installed."
  echo "     Install it from: https://nodejs.org  (click the LTS button)"
  echo "     Then re-run this script."
  echo -e "${NC}"; exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}"
  echo "  ✗  Python 3 is not installed."
  echo "     Install it from: https://python.org/downloads"
  echo "     Then re-run this script."
  echo -e "${NC}"; exit 1
fi

echo "  ✓  Node  $(node -v)"
echo "  ✓  Python  $(python3 --version)"
echo ""

# ── 2. Install Node dependencies ──────────────────────────────────────────────
echo -e "${BOLD}Installing dependencies...${NC}"
npm install --legacy-peer-deps --silent

# Make sure the Electron binary is present (postinstall can fail silently)
if [ ! -d "node_modules/electron/dist" ]; then
  node node_modules/electron/install.js
fi
echo "  ✓  Node modules ready"
echo ""

# ── 3. Install PyInstaller ────────────────────────────────────────────────────
echo -e "${BOLD}Setting up Python tools...${NC}"
python3 -m pip install pyinstaller --quiet --break-system-packages 2>/dev/null \
  || python3 -m pip install pyinstaller --quiet
echo "  ✓  PyInstaller ready"
echo ""

# ── 4. Build Python binary ────────────────────────────────────────────────────
echo -e "${BOLD}Building report generator...${NC}"
mkdir -p resources/generate_report

python3 -m PyInstaller \
  --onefile \
  --name generate_report \
  --distpath resources/generate_report \
  --workpath build/_pyinstaller \
  --specpath build/_pyinstaller \
  --noconfirm \
  --log-level WARN \
  scripts/generate_report/generator.py

chmod +x resources/generate_report/generate_report
echo "  ✓  Report generator built"
echo ""

# ── 5. Build the Electron app ─────────────────────────────────────────────────
echo -e "${BOLD}Building TEN Document Studio...${NC}"
echo "  (this takes about 1–2 minutes)"
echo ""

xattr -cr node_modules/electron/ 2>/dev/null || true
rm -rf dist/mac dist/mac-arm64 dist/mac-x64 2>/dev/null || true
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build

# ── 6. Open the installer ─────────────────────────────────────────────────────
DMG=$(ls release/*.dmg 2>/dev/null | head -1)

echo ""
echo -e "${GREEN}  ┌──────────────────────────────────────────┐"
echo "  │           BUILD COMPLETE! 🎉              │"
echo -e "  └──────────────────────────────────────────┘${NC}"
echo ""

if [ -n "$DMG" ]; then
  echo "  Opening installer now..."
  echo ""
  open "$DMG"
  echo -e "${YELLOW}  ➜  Drag 'TEN Document Studio' into the Applications folder"
  echo "     then launch it from Applications or your Dock."
  echo ""
  echo "  ⚠  First launch: macOS may show an 'unverified developer' warning."
  echo "     Go to: System Settings → Privacy & Security → scroll down → Open Anyway${NC}"
else
  echo "  Your installer is in the release/ folder."
  echo "  Open the .dmg, drag the app to Applications, and launch."
fi

echo ""
