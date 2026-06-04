#!/bin/bash
# Exit on error
set -e

DEPLOY_DIR="/servers/tickerclash"
REPO_DIR="/home/gemini/repos/ticker-clash"

# Find Node.js path (default to NVM directory if not in current PATH)
NODE_EXEC=$(which node || echo "/home/gemini/.nvm/versions/node/v24.16.0/bin/node")
NODE_BIN=$(dirname "$NODE_EXEC")

echo "=== Starting Deployment ==="
echo "Node binary directory: $NODE_BIN"

# Ensure NVM node directory is at the front of PATH so npm works correctly
export PATH="$NODE_BIN:$PATH"

# Build the project
echo "Building project in $REPO_DIR..."
cd "$REPO_DIR"
npm run build

# Prepare deploy folder
echo "Preparing deploy folder at $DEPLOY_DIR..."
if [ ! -d "$DEPLOY_DIR" ]; then
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown -R gemini:gemini "$DEPLOY_DIR"
fi

# Copy built files and package files
echo "Copying files to $DEPLOY_DIR..."
mkdir -p "$DEPLOY_DIR/src/game/dist"
mkdir -p "$DEPLOY_DIR/dist"

cp -R dist/* "$DEPLOY_DIR/dist/"
cp -R src/game/dist/* "$DEPLOY_DIR/src/game/dist/"
cp server.cjs "$DEPLOY_DIR/"
cp package.json package-lock.json "$DEPLOY_DIR/"

# Clean up old database instances if they exist
rm -f "$DEPLOY_DIR/ticker_clash_4010.db" "$DEPLOY_DIR/ticker_clash_7080.db" "$DEPLOY_DIR/ticker_clash_7090.db"

# Install production dependencies
echo "Installing production node modules in $DEPLOY_DIR..."
cd "$DEPLOY_DIR"
npm ci --omit=dev

# Clean up old single or legacy multi-port services if they exist
echo "Cleaning up legacy service instances..."
sudo systemctl stop tickerclash tickerclash@7080 tickerclash@7090 2>/dev/null || true
sudo systemctl disable tickerclash tickerclash@7080 tickerclash@7090 2>/dev/null || true
sudo rm -f "/etc/systemd/system/tickerclash.service"

# Write systemd template service file
echo "Configuring systemd template service..."
SERVICE_FILE="/etc/systemd/system/tickerclash@.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Ticker Clash Game Service on port %I
After=network.target

[Service]
Type=simple
User=gemini
WorkingDirectory=$DEPLOY_DIR
ExecStart=$NODE_BIN/node server.cjs
Restart=on-failure
Environment=NODE_ENV=production BACKEND_PORT=%I DATABASE_PATH=$DEPLOY_DIR/ticker_clash.db
Environment="PATH=$NODE_BIN:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

[Install]
WantedBy=multi-user.target
EOF

# Reload and restart service instance
echo "Reloading systemd and restarting tickerclash@4010 service..."
sudo systemctl daemon-reload
sudo systemctl enable tickerclash@4010
sudo systemctl restart tickerclash@4010

echo "=== Deployment Finished Successfully ==="
