#!/usr/bin/env bash
set -e

# ─────────────────────────────────────────────────────────────────────────────
#  TEN Document Studio — macOS Build Script
#  Run once from the project folder:  bash BUILD.sh
#  Output: release/TEN Document Studio-1.0.0.dmg
# ─────────────────────────────────────────────────────────────────────────────

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "  ==========================================================="
echo "   TEN Document Studio  |  macOS Build"
echo "  ==========================================================="
echo ""

# ─── Step 0: Prerequisites ────────────────────────────────────────────────────
echo -e "${BOLD}[1/5] Checking prerequisites...${NC}"

if ! command -v node &>/dev/null; then
  echo -e "${RED}"
  echo "  ERROR: Node.js is not installed."
  echo "  Install it from: https://nodejs.org  (LTS version)"
  echo "  Or via Homebrew:  brew install node"
  echo -e "${NC}"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo -e "${RED}"
  echo "  ERROR: Python 3 is not installed."
  echo "  Install it from: https://python.org  (Python 3.10+)"
  echo "  Or via Homebrew:  brew install python"
  echo -e "${NC}"
  exit 1
fi

echo "  > Node:   $(node -v)"
echo "  > Python: $(python3 --version)"
echo ""

# ─── Step 1: npm install ──────────────────────────────────────────────────────
echo -e "${BOLD}[2/5] Installing Node dependencies...${NC}"
npm install --legacy-peer-deps

# Ensure the Electron binary was downloaded (postinstall can fail silently)
if [ ! -d "node_modules/electron/dist" ]; then
  echo "  > Electron binary not found, downloading now..."
  node node_modules/electron/install.js
fi
echo ""

# ─── Step 2: Install PyInstaller ─────────────────────────────────────────────
echo -e "${BOLD}[3/5] Installing PyInstaller...${NC}"
python3 -m pip install pyinstaller --quiet --break-system-packages 2>/dev/null \
  || python3 -m pip install pyinstaller --quiet
echo "  > Done."
echo ""

# ─── Step 3: Build Python binary via PyInstaller ──────────────────────────────
echo -e "${BOLD}[4/5] Building Python generator binary...${NC}"
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
echo "  > Python binary built: resources/generate_report/generate_report"
echo ""

# ─── Step 4: Build the Electron app ──────────────────────────────────────────
echo -e "${BOLD}[5/5] Building TEN Document Studio (Vite + electron-builder)...${NC}"

# Strip extended attributes (quarantine/resource fork metadata) from the
# Electron binary — macOS codesign refuses to sign files that have these.
echo "  > Stripping extended attributes from Electron binary..."
xattr -cr node_modules/electron/ 2>/dev/null || true

# Clean any leftover build artifacts from previous failed runs —
# they carry xattrs that codesign will reject.
echo "  > Cleaning previous build artifacts..."
rm -rf dist/mac dist/mac-arm64 dist/mac-x64 dist/linux* dist/win* 2>/dev/null || true

CSC_IDENTITY_AUTO_DISCOVERY=false npm run build

echo ""
echo -e "${GREEN}  ==========================================================="
echo "   BUILD COMPLETE!"
echo -e "  ===========================================================${NC}"
echo ""
echo "  Your installer is ready at:"
echo ""
echo "    release/TEN Document Studio-1.0.0.dmg"
echo ""
echo "  Open that .dmg, drag TEN Document Studio to Applications,"
echo "  and launch it from your Applications folder or Dock."
echo ""
echo -e "${YELLOW}  NOTE: First launch may show a Gatekeeper warning"
echo "  (\"unverified developer\"). To allow it:"
echo "    System Settings → Privacy & Security → scroll down → Open Anyway${NC}"
echo ""
