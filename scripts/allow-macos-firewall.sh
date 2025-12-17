#!/usr/bin/env bash
set -euo pipefail

# Allow the current Node.js binary through the macOS Application Firewall
# so Vite/Next/Node dev servers can accept inbound LAN connections without
# an interactive prompt.
#
# Usage:
#   npm run allow:firewall
# or
#   bash scripts/allow-macos-firewall.sh
#
# Note: You will be prompted for your admin password (uses sudo).

NODE_PATH="$(command -v node || true)"
if [[ -z "${NODE_PATH}" ]]; then
  echo "Error: node not found in PATH. Install Node.js and try again." >&2
  exit 1
fi

echo "Detected Node at: ${NODE_PATH}"
echo "Requesting firewall exception (you may be prompted for your password)..."

# Add and unblock the Node binary
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "${NODE_PATH}" || true
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp "${NODE_PATH}" || true

# Show current status for verification
/usr/libexec/ApplicationFirewall/socketfilterfw --listapps | grep -i "${NODE_PATH}" || true

echo "Done. If you switch Node versions (nvm, volta, etc.), rerun this script for the new path."