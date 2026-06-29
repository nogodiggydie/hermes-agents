#!/bin/bash
# deploy/setup-ec2.sh
# Provision EC2 instance for Hermes Agent Service
# Run on the EC2 instance as ubuntu user

set -euo pipefail

# Configuration
REPO_URL="${REPO_URL:-}"
REPO_DIR="/home/ubuntu/hermes-agents"
NODE_VERSION="22"
PYTHON_VERSION="3.11"
SERVICE_NAME="hermes-agent"

echo "=== Hermes Agent Service EC2 Setup ==="
if [ -n "$REPO_URL" ]; then
    echo "Repository: $REPO_URL"
else
    echo "Repository: (local copy - REPO_URL not set)"
fi
echo "Install directory: $REPO_DIR"
echo "Node version: $NODE_VERSION"
echo "Python version: $PYTHON_VERSION"
echo ""

# Update system
echo "=== Updating system packages ==="
sudo apt-get update -y
sudo apt-get upgrade -y

# Install base dependencies
echo "=== Installing base dependencies ==="
sudo apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    python3-venv \
    sqlite3 \
    htop \
    jq \
    unzip

# Install Node.js via NodeSource
echo "=== Installing Node.js $NODE_VERSION ==="
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installations
echo "=== Verifying installations ==="
node --version
npm --version
python3 --version
pip3 --version

# Clone repository or copy local files
echo "=== Setting up repository ==="
if [ -d "$REPO_DIR" ]; then
    echo "Repository already exists, pulling latest..."
    cd "$REPO_DIR"
    if [ -n "$REPO_URL" ]; then
        git pull
    fi
else
    if [ -n "$REPO_URL" ]; then
        git clone "$REPO_URL" "$REPO_DIR"
        cd "$REPO_DIR"
    else
        echo "REPO_URL not set. Please copy the project to $REPO_DIR first, or set REPO_URL environment variable."
        echo "Example: REPO_URL=https://github.com/your-org/hermes-agents.git $0"
        exit 1
    fi
fi

# Install agent-service dependencies
echo "=== Installing agent-service dependencies ==="
cd "$REPO_DIR/agent-service"
npm ci

# Build TypeScript
echo "=== Building TypeScript ==="
npm run build

# Create data directory
echo "=== Creating data directory ==="
mkdir -p "$REPO_DIR/agent-service/data"

# Install Python dependencies for agent templates
echo "=== Setting up Python environment ==="
cd "$REPO_DIR/agent-service/agents/python"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
if [ -f requirements.txt ]; then
    pip install -r requirements.txt
fi
deactivate

# Install systemd service
echo "=== Installing systemd service ==="
sudo cp "$REPO_DIR/deploy/systemd/hermes-agent.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

# Start service
echo "=== Starting service ==="
sudo systemctl start "$SERVICE_NAME"

# Check status
echo "=== Service status ==="
sudo systemctl status "$SERVICE_NAME" --no-pager

# Configure firewall (if ufw is available)
if command -v ufw &> /dev/null; then
    echo "=== Configuring firewall ==="
    sudo ufw allow 22/tcp comment "SSH"
    sudo ufw --force enable
    echo "Firewall enabled. Only SSH (port 22) is open."
    echo "The agent service runs on port 3001 but is only accessible via SSH tunnel."
fi

# Print summary
echo ""
echo "=== Setup Complete ==="
echo "Agent service is running as systemd service: $SERVICE_NAME"
echo "Service logs: sudo journalctl -u $SERVICE_NAME -f"
echo "Service status: sudo systemctl status $SERVICE_NAME"
echo ""
echo "To access the dashboard, run on your laptop:"
echo "  ssh -L 3001:localhost:3001 aws"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
echo "Useful commands:"
echo "  Restart service: sudo systemctl restart $SERVICE_NAME"
echo "  View logs:       sudo journalctl -u $SERVICE_NAME -f"
echo "  Stop service:    sudo systemctl stop $SERVICE_NAME"