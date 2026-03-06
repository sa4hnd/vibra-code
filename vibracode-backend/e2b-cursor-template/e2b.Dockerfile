# Custom E2B template for VibraCode with bun and Expo template (Cursor Agent version)
FROM e2bdev/code-interpreter:latest

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

USER root

# Update system and install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    unzip \
    ca-certificates \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Bun via official script (installs to ~/.bun)
# Then create symlinks in /usr/local/bin for global access
# Make bun accessible to all users by fixing permissions on root's .bun
RUN curl -fsSL https://bun.sh/install | bash && \
    chmod 755 /root /root/.bun /root/.bun/bin && \
    chmod 755 /root/.bun/bin/bun /root/.bun/bin/bunx && \
    ln -sf /root/.bun/bin/bun /usr/local/bin/bun && \
    ln -sf /root/.bun/bin/bunx /usr/local/bin/bunx

# Install OpenSSL 1.1 for Watchman compatibility (Watchman binary requires libcrypto.so.1.1)
RUN curl -LO http://archive.ubuntu.com/ubuntu/pool/main/o/openssl/libssl1.1_1.1.1f-1ubuntu2_amd64.deb && \
    dpkg -i libssl1.1_1.1.1f-1ubuntu2_amd64.deb && \
    rm libssl1.1_1.1.1f-1ubuntu2_amd64.deb

# Install Watchman from official release (for Metro bundler)
RUN cd /tmp && \
    curl -LO https://github.com/facebook/watchman/releases/download/v2024.01.22.00/watchman-v2024.01.22.00-linux.zip && \
    unzip watchman-v2024.01.22.00-linux.zip && \
    cd watchman-v2024.01.22.00-linux && \
    mkdir -p /usr/local/{bin,lib} /usr/local/var/run/watchman && \
    cp bin/* /usr/local/bin && \
    cp lib/* /usr/local/lib && \
    chmod 755 /usr/local/bin/watchman && \
    chmod 2777 /usr/local/var/run/watchman && \
    cd / && rm -rf /tmp/watchman*

# Install Jupyter Lab
RUN pip3 install jupyterlab

# Install Anthropic Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Add Claude MCP context7
ARG CONTEXT7_API_KEY
RUN claude mcp add --transport http context7 https://mcp.context7.com/mcp --header "CONTEXT7_API_KEY:${CONTEXT7_API_KEY}"

# Install Cursor Agent for root
RUN curl https://cursor.com/install -fsS | bash

# Add Cursor Agent to PATH for root
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && \
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc

# Create user and install Cursor Agent for user (if not already exists)
RUN id -u user >/dev/null 2>&1 || useradd -m -s /bin/bash user && \
    usermod -aG sudo user && \
    echo 'user ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers

# Install Cursor Agent for user
RUN su - user -c "curl https://cursor.com/install -fsS | bash"

# Add Cursor Agent to PATH for user
RUN echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/user/.bashrc && \
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> /home/user/.zshrc && \
    sed -i 's/source /. /g' /home/user/.bashrc 2>/dev/null || true

# Verify installations (bun is globally installed via npm)
RUN node --version && npm --version && bun --version

# Create working directory and set ownership for user
WORKDIR /vibe0
RUN chown user:user /vibe0

# Create bun cache directory for user (bun install needs this)
RUN mkdir -p /home/user/.bun/install/cache && \
    chown -R user:user /home/user/.bun

# Cache bust - change this value to force fresh clone
ARG CACHEBUST=42

# Switch to user for all project operations (prevents permission issues)
USER user

# Set BUN_INSTALL_CACHE_DIR to user's cache
ENV BUN_INSTALL_CACHE_DIR=/home/user/.bun/install/cache

# Clone the Expo template repository
# Override TEMPLATE_REPO_URL with your own template repo when building
ARG TEMPLATE_REPO_URL=https://github.com/sa4hnd/expo-template.git
RUN GIT_TERMINAL_PROMPT=0 git clone ${TEMPLATE_REPO_URL} .

# Remove .git folder - sandbox should be a clean slate, not tied to the template repo
RUN rm -rf /vibe0/.git

# Install dependencies with bun (much faster than npm)
RUN bun install

# ============================================================================
# PRE-WARM METRO BUNDLE CACHE
# This is the magic that makes first bundle load fast!
# We start Metro, request bundles for all platforms, then kill it.
# The cache persists in .metro-cache directory.
# ============================================================================

# Run the pre-warming script (from repo) to build and cache all bundles
# Output is NOT suppressed so you can see progress during build
RUN echo "========================================" && \
    echo "STARTING METRO PRE-WARM" && \
    echo "========================================" && \
    cd /vibe0 && node scripts/prewarm-bundle.js && \
    echo "========================================" && \
    echo "PRE-WARM COMPLETE" && \
    echo "========================================"

# Verify cache was created and show its size
RUN echo "=== Metro Cache Status ===" && \
    ls -la /vibe0/.metro-cache 2>/dev/null && \
    du -sh /vibe0/.metro-cache 2>/dev/null && \
    echo "=== Cache file count ===" && \
    find /vibe0/.metro-cache -type f | wc -l || echo "Warning: .metro-cache not found"

# Ensure cache directory has correct permissions
RUN chmod -R 777 /vibe0/.metro-cache 2>/dev/null || true

# Switch back to root for system-level operations
USER root

# Store API configuration in root-only file (not in the proxy script)
# Values are injected via build args - pass them when building the template
ARG OPENAI_PROXY_HOST=https://api.openai.com
ARG OPENAI_API_KEY
ARG ANTHROPIC_PROXY_HOST=https://api.anthropic.com
ARG ANTHROPIC_API_KEY
ARG GROK_PROXY_HOST=https://api.x.ai
ARG GROK_API_KEY
RUN echo "{\
  \"openai\": {\
    \"host\": \"${OPENAI_PROXY_HOST}\",\
    \"key\": \"${OPENAI_API_KEY}\",\
    \"authHeader\": \"Authorization\",\
    \"authPrefix\": \"Bearer \"\
  },\
  \"anthropic\": {\
    \"host\": \"${ANTHROPIC_PROXY_HOST}\",\
    \"key\": \"${ANTHROPIC_API_KEY}\",\
    \"authHeader\": \"x-api-key\",\
    \"authPrefix\": \"\",\
    \"extraHeaders\": {\"anthropic-version\": \"2023-06-01\"}\
  },\
  \"grok\": {\
    \"host\": \"${GROK_PROXY_HOST}\",\
    \"key\": \"${GROK_API_KEY}\",\
    \"authHeader\": \"Authorization\",\
    \"authPrefix\": \"Bearer \"\
  }\
}" > /root/.api_config.json && chmod 600 /root/.api_config.json

# Multi-API proxy server
# Place your api-proxy.js in this directory before building, or remove the proxy references
# COPY api-proxy.js /root/api-proxy.js
# RUN chmod 700 /root/api-proxy.js

# Ensure full permissions for user (already owned by user from npm install)
RUN chmod -R 777 /vibe0

# Create a startup script
RUN echo '#!/bin/bash\n\
\n\
# Source shell configuration\n\
. ~/.bashrc 2>/dev/null || true\n\
\n\
# Navigate to working directory\n\
cd /vibe0\n\
\n\
echo "========================================"\n\
echo "SANDBOX STARTUP DIAGNOSTICS"\n\
echo "========================================"\n\
\n\
# Check Metro cache status\n\
echo ""\n\
echo "=== METRO CACHE STATUS ==="\n\
if [ -d "/vibe0/.metro-cache" ]; then\n\
  CACHE_SIZE=$(du -sh /vibe0/.metro-cache 2>/dev/null | cut -f1)\n\
  CACHE_FILES=$(find /vibe0/.metro-cache -type f 2>/dev/null | wc -l)\n\
  echo "Cache directory: EXISTS"\n\
  echo "Cache size: $CACHE_SIZE"\n\
  echo "Cache files: $CACHE_FILES"\n\
  ls -la /vibe0/.metro-cache/ 2>/dev/null | head -10\n\
else\n\
  echo "Cache directory: NOT FOUND"\n\
  echo "WARNING: Metro cache missing - bundling will be slow!"\n\
fi\n\
echo ""\n\
\n\
# Save cache status to file for later inspection\n\
echo "Cache check at: $(date)" > /vibe0/cache_status.txt\n\
if [ -d "/vibe0/.metro-cache" ]; then\n\
  echo "Status: EXISTS" >> /vibe0/cache_status.txt\n\
  du -sh /vibe0/.metro-cache >> /vibe0/cache_status.txt 2>/dev/null\n\
  find /vibe0/.metro-cache -type f | wc -l >> /vibe0/cache_status.txt\n\
else\n\
  echo "Status: MISSING" >> /vibe0/cache_status.txt\n\
fi\n\
\n\
# Configure git globally for root (for system operations)\n\
git config --global --add safe.directory /vibe0\n\
git config --global user.email "vibracode@app.com"\n\
git config --global user.name "Vibra Code"\n\
git config --global init.defaultBranch main\n\
\n\
# Configure git for user (for agent operations)\n\
su - user -c "git config --global --add safe.directory /vibe0"\n\
su - user -c "git config --global user.email vibracode@app.com"\n\
su - user -c "git config --global user.name Vibra Code"\n\
su - user -c "git config --global init.defaultBranch main"\n\
\n\
# Get PROJECT_ID from E2B environment variable\n\
export EXPO_PUBLIC_PROJECT_ID=${E2B_SANDBOX_ID:-local}\n\
\n\
# Start Multi-API proxy (creates token in /vibe0/.session_token)\n\
node /root/api-proxy.js &\n\
echo "Multi-API proxy started"\n\
\n\
# Wait for proxy to create session token (fast - proxy creates it immediately)\n\
sleep 0.5\n\
\n\
# Read the session token from /vibe0/.session_token\n\
if [ -f /vibe0/.session_token ]; then\n\
  export EXPO_PUBLIC_SESSION_TOKEN=$(cat /vibe0/.session_token)\n\
  echo "Session token loaded"\n\
else\n\
  echo "ERROR: Session token not found"\n\
fi\n\
\n\
# Store env vars in files for the Expo app\n\
echo "export EXPO_PUBLIC_PROJECT_ID=$EXPO_PUBLIC_PROJECT_ID" > /vibe0/.expo_env\n\
echo "export EXPO_PUBLIC_SESSION_TOKEN=$EXPO_PUBLIC_SESSION_TOKEN" >> /vibe0/.expo_env\n\
chown user:user /vibe0/.expo_env\n\
\n\
echo "EXPO_PUBLIC_PROJECT_ID=$EXPO_PUBLIC_PROJECT_ID" > /vibe0/.env.local\n\
echo "EXPO_PUBLIC_SESSION_TOKEN=$EXPO_PUBLIC_SESSION_TOKEN" >> /vibe0/.env.local\n\
chown user:user /vibe0/.env.local\n\
\n\
# Log token info for debugging (first 8 chars only)\n\
echo "Project ID: $EXPO_PUBLIC_PROJECT_ID"\n\
echo "Session token: ${EXPO_PUBLIC_SESSION_TOKEN:0:8}..."\n\
\n\
# Print versions\n\
echo "Node: $(node --version)"\n\
echo "Bun: $(bun --version)"\n\
echo "Claude: $(claude --version 2>/dev/null || echo not found)"\n\
echo "Cursor: $(cursor-agent --version 2>/dev/null || echo not found)"\n\
\n\
echo "========================================"\n\
echo "STARTUP COMPLETE"\n\
echo "========================================"\n\
\n\
# Start Jupyter Lab in background (as root)\n\
jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root --NotebookApp.token="" --NotebookApp.password="" &\n\
echo "Jupyter Lab started"\n\
\n\
# Start the development server AS USER with auto-restart on crash\n\
# Running as user ensures any files created have correct ownership\n\
echo "Starting Expo dev server as user with auto-restart..."\n\
(\n\
  while true; do\n\
    echo "[$(date)] Starting dev server..."\n\
    su - user -c "cd /vibe0 && . /vibe0/.expo_env && bun run dev" || true\n\
    echo "[$(date)] Dev server stopped. Restarting in 3 seconds..."\n\
    sleep 3\n\
  done\n\
) &\n\
echo "Dev server started on port 3000 (auto-restart enabled, running as user)"\n\
\n\
# Start backend server if it exists (Hono/tRPC on port 5000)\n\
# Logs saved to /vibe0/backend_logs.txt\n\
if [ -f /vibe0/backend/hono.ts ]; then\n\
  echo "Starting backend server on port 5000..."\n\
  echo "=== Backend Server Started: $(date -Iseconds) ===" > /vibe0/backend_logs.txt\n\
  (\n\
    while true; do\n\
      echo "[$(date -Iseconds)] Starting backend server..." | tee -a /vibe0/backend_logs.txt\n\
      su - user -c "cd /vibe0 && bun run backend" 2>&1 | tee -a /vibe0/backend_logs.txt || true\n\
      echo "[$(date -Iseconds)] Backend server stopped. Restarting in 3 seconds..." | tee -a /vibe0/backend_logs.txt\n\
      sleep 3\n\
    done\n\
  ) &\n\
  echo "Backend server started on port 5000 (logs: /vibe0/backend_logs.txt)"\n\
  \n\
  # Start Prisma Studio if schema exists (on port 5555, bound to 0.0.0.0)\n\
  # Logs saved to /vibe0/prisma_logs.txt\n\
  if [ -f /vibe0/backend/prisma/schema.prisma ]; then\n\
    echo "Starting Prisma Studio on port 5555..."\n\
    echo "=== Prisma Studio Started: $(date -Iseconds) ===" > /vibe0/prisma_logs.txt\n\
    # Generate Prisma client and push schema if needed\n\
    su - user -c "cd /vibe0 && bun run db:generate" 2>&1 | tee -a /vibe0/prisma_logs.txt || true\n\
    if [ ! -f /vibe0/backend/prisma/dev.db ]; then\n\
      echo "Creating database..." | tee -a /vibe0/prisma_logs.txt\n\
      su - user -c "cd /vibe0 && bun run db:push" 2>&1 | tee -a /vibe0/prisma_logs.txt || true\n\
    fi\n\
    (\n\
      while true; do\n\
        echo "[$(date -Iseconds)] Starting Prisma Studio (0.0.0.0:5555)..." | tee -a /vibe0/prisma_logs.txt\n\
        su - user -c "cd /vibe0 && bun run db:studio" 2>&1 | tee -a /vibe0/prisma_logs.txt || true\n\
        echo "[$(date -Iseconds)] Prisma Studio stopped. Restarting in 3 seconds..." | tee -a /vibe0/prisma_logs.txt\n\
        sleep 3\n\
      done\n\
    ) &\n\
    echo "Prisma Studio started on port 5555 (logs: /vibe0/prisma_logs.txt)"\n\
  fi\n\
else\n\
  echo "No backend/hono.ts found - skipping backend server"\n\
fi\n\
\n\
# Start Convex if schema exists (on ports 3210, 3211, 6790, 6792)\n\
# Logs saved to /vibe0/convex_logs.txt\n\
if [ -f /vibe0/convex/schema.ts ]; then\n\
  echo "Starting Convex in agent mode..."\n\
  echo "=== Convex Started: $(date -Iseconds) ===" > /vibe0/convex_logs.txt\n\
  \n\
  # Read project ID for dashboard patching and URL override\n\
  PROJECT_ID=$(grep EXPO_PUBLIC_PROJECT_ID /vibe0/.env.local | cut -d'=' -f2)\n\
  \n\
  # Start Convex dev server FIRST (it downloads the dashboard)\n\
  (\n\
    while true; do\n\
      echo "[$(date -Iseconds)] Starting Convex dev server..." | tee -a /vibe0/convex_logs.txt\n\
      su - user -c "cd /vibe0 && CONVEX_AGENT_MODE=anonymous npx convex dev" 2>&1 | tee -a /vibe0/convex_logs.txt || true\n\
      echo "[$(date -Iseconds)] Convex dev server stopped. Restarting in 3 seconds..." | tee -a /vibe0/convex_logs.txt\n\
      sleep 3\n\
    done\n\
  ) &\n\
  \n\
  # Wait for Convex to start and download dashboard\n\
  echo "Waiting for Convex to start and download dashboard..." | tee -a /vibe0/convex_logs.txt\n\
  sleep 10\n\
  \n\
  # NOW patch the dashboard (after it has been downloaded)\n\
  if [ -d /home/user/.cache/convex/dashboard/out ]; then\n\
    echo "Patching Convex dashboard for remote access..." | tee -a /vibe0/convex_logs.txt\n\
    cd /home/user/.cache/convex/dashboard/out\n\
    # Patch ALL files recursively (including _next/static/chunks/)\n\
    find . -type f \\( -name \"*.js\" -o -name \"*.html\" \\) -exec sed -i \"s|http://127\\.0\\.0\\.1:6791|https://6792-${PROJECT_ID}.e2b.app|g\" {} +\n\
    cd /vibe0\n\
    echo "Dashboard patched successfully" | tee -a /vibe0/convex_logs.txt\n\
  else\n\
    echo "WARNING: Dashboard not found at /home/user/.cache/convex/dashboard/out" | tee -a /vibe0/convex_logs.txt\n\
  fi\n\
  \n\
  # Override EXPO_PUBLIC_CONVEX_URL to use the API proxy tunnel URL (not localhost)\n\
  if [ -f /vibe0/.env.local ]; then\n\
    # Remove old EXPO_PUBLIC_CONVEX_URL if it exists\n\
    sed -i '/^EXPO_PUBLIC_CONVEX_URL=/d' /vibe0/.env.local\n\
    # Add the tunnel URL via API proxy\n\
    echo \"EXPO_PUBLIC_CONVEX_URL=https://6792-${PROJECT_ID}.e2b.app\" >> /vibe0/.env.local\n\
    echo "Updated EXPO_PUBLIC_CONVEX_URL to use tunnel URL" | tee -a /vibe0/convex_logs.txt\n\
  fi\n\
  \n\
  # Start API proxy\n\
  (\n\
    while true; do\n\
      echo "[$(date -Iseconds)] Starting Convex API proxy..." | tee -a /vibe0/convex_logs.txt\n\
      su - user -c "cd /vibe0 && node scripts/convex-api-proxy.js" 2>&1 | tee -a /vibe0/convex_logs.txt || true\n\
      echo "[$(date -Iseconds)] Convex API proxy stopped. Restarting in 3 seconds..." | tee -a /vibe0/convex_logs.txt\n\
      sleep 3\n\
    done\n\
  ) &\n\
  \n\
  echo "Convex started (logs: /vibe0/convex_logs.txt)"\n\
  echo "Dashboard: https://6790-${PROJECT_ID}.e2b.app" | tee -a /vibe0/convex_logs.txt\n\
  echo "Backend API: https://3210-${PROJECT_ID}.e2b.app" | tee -a /vibe0/convex_logs.txt\n\
fi\n\
\n\
# Keep the container running forever\n\
tail -f /dev/null' > /root/startup.sh && \
    chmod +x /root/startup.sh

# Expose ports
EXPOSE 3000 8888 8080 5000 4000 3001 8000 9000 6790 3210 3211 6792 5555

# Set the startup command
CMD ["/root/startup.sh"]