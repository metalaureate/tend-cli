#!/bin/sh
set -e

# Tend installer — downloads the latest release binary for your platform.
# Usage: curl -sSL https://raw.githubusercontent.com/metalaureate/tend-cli/main/install.sh | sh

REPO="metalaureate/tend-cli"
INSTALL_DIR="${TEND_INSTALL_DIR:-/usr/local/bin}"

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)
    echo "Error: Unsupported OS: $OS" >&2
    echo "Tend supports macOS and Linux. Windows users: install via WSL." >&2
    exit 1
    ;;
esac

case "$ARCH" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64)  arch="x64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

BINARY="tend-${os}-${arch}"

# Get latest release tag
LATEST=$(curl -sSf "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/')

if [ -z "$LATEST" ]; then
  echo "Error: Could not determine latest release." >&2
  echo "Check https://github.com/${REPO}/releases" >&2
  exit 1
fi

URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY}"

echo "Installing tend ${LATEST} (${os}/${arch})..."

# Download
TMPFILE=$(mktemp)
HTTP_CODE=$(curl -sSL -o "$TMPFILE" -w '%{http_code}' "$URL")
if [ "$HTTP_CODE" != "200" ]; then
  rm -f "$TMPFILE"
  echo "Error: Download failed (HTTP $HTTP_CODE)" >&2
  echo "URL: $URL" >&2
  echo "Check https://github.com/${REPO}/releases for available binaries." >&2
  exit 1
fi

chmod +x "$TMPFILE"

# Install — try the target dir, fall back to ~/bin
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMPFILE" "${INSTALL_DIR}/tend"
elif command -v sudo >/dev/null 2>&1; then
  sudo mv "$TMPFILE" "${INSTALL_DIR}/tend"
  sudo chmod +x "${INSTALL_DIR}/tend"
else
  INSTALL_DIR="$HOME/bin"
  mkdir -p "$INSTALL_DIR"
  mv "$TMPFILE" "${INSTALL_DIR}/tend"
fi

# Create td symlink
ln -sf "${INSTALL_DIR}/tend" "${INSTALL_DIR}/td" 2>/dev/null || true

echo "✓ Installed tend to ${INSTALL_DIR}/tend"
echo "✓ Symlinked td → tend"

# Check PATH
case ":$PATH:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    echo ""
    echo "Note: ${INSTALL_DIR} is not in your PATH."
    echo "Add it: export PATH=\"${INSTALL_DIR}:\$PATH\""
    ;;
esac

echo ""
echo "Get started:"
echo "  cd ~/your-project && td init"
