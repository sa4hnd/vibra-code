/**

- Direct E2B Configuration
- Replaces Vibekit with direct E2B SDK usage
  */

import { Sandbox } from '@e2b/code-interpreter';
import { Octokit } from '@octokit/rest';
import crypto from 'crypto';

export interface E2BSandboxConfig {
templateId?: string;
apiKey?: string;
envVars?: Record<string, string>;
timeout?: number;
}

export interface GitHubConfig {
token: string;
repository: string;
}

/**

- Create a new E2B sandbox with native auto-pause enabled
  */
  export async function createE2BSandbox(config: E2BSandboxConfig = {}): Promise<Sandbox> {
  const {
  templateId = "YOUR_E2B_TEMPLATE_ID", // Use template ID instead of name
  apiKey = process.env.E2B_API_KEY,
  envVars = {},
  timeout = parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000') // Use env var or default to 15 minutes
  } = config;

if (!apiKey) {
throw new Error('E2B_API_KEY environment variable is required');
}

console.log(`🆕 Creating E2B sandbox with template: ${templateId} (auto-pause enabled, ${timeout/1000}s timeout from AUTO_PAUSE_TIMEOUT_MS)`);

// Use betaCreate with native auto-pause
const sandbox = await Sandbox.betaCreate(templateId, {
apiKey,
envs: envVars,
autoPause: true, // Enable native auto-pause
timeoutMs: timeout
});

console.log(`✅ E2B sandbox created with auto-pause: ${sandbox.sandboxId}`);

// Note: /vibe0/ is the sandbox working directory path baked into the E2B template image
// Wait for startup script to finish generating session token
// Use fast polling (200ms) since proxy creates token immediately
let sessionToken = '';
for (let i = 0; i < 25; i++) { // 25 * 200ms = 5s max
  try {
    const result = await sandbox.commands.run('cat /vibe0/.session_token 2>/dev/null');
    sessionToken = result.stdout.trim();
    if (sessionToken && sessionToken.length >= 32) break;
  } catch {}
  await new Promise(r => setTimeout(r, 200)); // Fast polling
}

if (!sessionToken || sessionToken.length < 32) {
  console.log('⚠️ Session token not found, generating one...');
  sessionToken = crypto.randomBytes(32).toString('hex');
  await sandbox.files.write('/vibe0/.session_token', sessionToken);
}

// Check if startup.sh already wrote env files (avoid duplicate writes)
let needsEnvWrite = true;
try {
  const existing = await sandbox.commands.run('cat /vibe0/.env.local 2>/dev/null');
  if (existing.stdout.includes(sandbox.sandboxId) && existing.stdout.includes(sessionToken)) {
    needsEnvWrite = false;
    console.log('📝 Env files already configured by startup script');
  }
} catch {}

if (needsEnvWrite) {
  const envContent = `EXPO_PUBLIC_PROJECT_ID=${sandbox.sandboxId}\nEXPO_PUBLIC_SESSION_TOKEN=${sessionToken}`;
  const expoEnvContent = `export EXPO_PUBLIC_PROJECT_ID=${sandbox.sandboxId}\nexport EXPO_PUBLIC_SESSION_TOKEN=${sessionToken}`;
  await sandbox.files.write('/vibe0/.env.local', envContent);
  await sandbox.files.write('/vibe0/.expo_env', expoEnvContent);
  console.log(`📝 Injected sandbox ID into .env.local and .expo_env: ${sandbox.sandboxId}`);
}

return sandbox;
}

/**

- Execute a command in the sandbox with streaming support
  */
  export async function executeCommand(
  sandbox: Sandbox,
  command: string,
  options: {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  background?: boolean;
  cwd?: string;
  envVars?: Record<string, string>;
  } = {}
  ): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  }> {
  console.log(`🚀 Executing command: ${command.substring(0, 100)}...`);
  console.log(`📁 Working directory: ${options.cwd || 'default'}`);

// Always ensure we're in the correct directory by prefixing with cd command
const finalCommand = options.cwd ? `cd ${options.cwd} && ${command}` : command;
console.log(`🔧 Final command: ${finalCommand.substring(0, 150)}...`);

const result = await sandbox.commands.run(finalCommand, {
onStdout: options.onStdout,
onStderr: options.onStderr,
background: options.background || false,
timeoutMs: 0, // Disable timeout for long-running commands
requestTimeoutMs: 900000, // 15 minutes for HTTP request timeout
envs: options.envVars
});

// Handle both CommandResult and CommandHandle
if ('exitCode' in result) {
// CommandResult
console.log(`✅ Command completed with exit code: ${result.exitCode}`);
return {
stdout: result.stdout,
stderr: result.stderr,
exitCode: result.exitCode || 0
};
} else {
// CommandHandle - for background commands
console.log(`✅ Command started in background with PID: ${(result as any).pid}`);
return {
stdout: '',
stderr: '',
exitCode: 0 // Background commands don't have immediate exit codes
};
}
}

/**

- Execute Claude agent command
  */
  export async function executeClaudeAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  isFirstMessage?: boolean;
  model?: string;
  mcpConfig?: Record<string, any>;
  } = {}
  ): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  }> {
  // Use provided model or default to opus
  const claudeModel = options.model || 'claude-opus-4-5-20251101';
  // Skip --continue flag for first message to start fresh session
  const continueFlag = options.isFirstMessage ? '' : '--continue';
  // Use base64 encoding to safely pass the prompt without shell escaping issues (backticks, quotes, etc.)
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');

  // Build MCP config flag if provided
  let mcpFlag = '';
  if (options.mcpConfig && Object.keys(options.mcpConfig).length > 0) {
    const mcpConfigJson = JSON.stringify(options.mcpConfig);
    const mcpConfigBase64 = Buffer.from(mcpConfigJson, 'utf8').toString('base64');
    // Use base64 to avoid shell escaping issues with JSON
    mcpFlag = `--mcp-config "$(echo '${mcpConfigBase64}' | base64 -d)"`;
  }

  const anthropicKey = process.env.ANTHROPIC_SANDBOX_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  if (!anthropicKey) throw new Error('ANTHROPIC_SANDBOX_API_KEY environment variable is required');
  const claudeCommand = `export ANTHROPIC_API_KEY='${anthropicKey}' && export ANTHROPIC_BASE_URL='${anthropicBaseUrl}' && echo '${promptBase64}' | base64 -d | claude -p --output-format stream-json --verbose --dangerously-skip-permissions ${mcpFlag} ${continueFlag} --model ${claudeModel}`;

return executeCommand(sandbox, claudeCommand, { ...options, cwd: '/vibe0' });
}

/**

- Execute Cursor agent command
  */
  export async function executeCursorAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  isFirstMessage?: boolean;
  } = {}
  ): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  }> {
  // Use base64 encoding to safely pass the prompt without shell escaping issues
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
  // Skip --resume flag for first message to start fresh session
  const resumeFlag = options.isFirstMessage ? '' : '--resume=vibracode';
  const cursorApiKey = process.env.CURSOR_AGENT_API_KEY;
  if (!cursorApiKey) throw new Error('CURSOR_AGENT_API_KEY environment variable is required');
  const cursorCommand = `echo '${promptBase64}' | base64 -d | cursor-agent --api-key ${cursorApiKey} -p --output-format stream-json --force --model auto ${resumeFlag}`;

return executeCommand(sandbox, cursorCommand, { ...options, cwd: '/vibe0' });
}

/**

- Execute Gemini agent command
  */
  export async function executeGeminiAgent(
  sandbox: Sandbox,
  prompt: string,
  options: {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  } = {}
  ): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
  }> {
  // Use base64 encoding to safely pass the prompt without shell escaping issues (backticks, quotes, etc.)
  const promptBase64 = Buffer.from(prompt, 'utf8').toString('base64');
  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) throw new Error('GEMINI_API_KEY environment variable is required');
  const geminiCommand = `export GEMINI_API_KEY='${geminiApiKey}' && echo '${promptBase64}' | base64 -d | gemini --output-format stream-json --yolo`;

return executeCommand(sandbox, geminiCommand, { ...options, cwd: '/vibe0' });
}

/**

- Create GitHub pull request using direct GitHub API
  */
  export async function createGitHubPullRequest(config: GitHubConfig): Promise<any> {
  const { token, repository } = config;

if (!token) {
throw new Error('GitHub token is required');
}

const [owner, repo] = repository.split('/');
if (!owner || !repo) {
throw new Error('Invalid repository format. Expected "owner/repo"');
}

console.log(`🔄 Creating GitHub PR for ${repository}`);

const octokit = new Octokit({ auth: token });

const pr = await octokit.rest.pulls.create({
owner,
repo,
title: "🖖 VibraCode",
head: "vibracode",
base: "main",
body: "Pull request created by VibraCode"
});

console.log(`✅ GitHub PR created: ${pr.data.html_url}`);
return pr.data;
}

/**

- Get sandbox host URL for a specific port
  */
  export async function getSandboxHost(sandbox: Sandbox, port: number): Promise<string> {
  const host = await sandbox.getHost(port);
  // E2B getHost returns just the hostname, so we need to add https://
  return `https://${host}`;
  }

/**

- Check if sandbox is running
  */
  export async function isSandboxRunning(sandbox: Sandbox): Promise<boolean> {
  try {
  return await sandbox.isRunning();
  } catch (error) {
  console.error('Error checking sandbox status:', error);
  return false;
  }
  }

/**

- Kill sandbox
  */
  export async function killSandbox(sandbox: Sandbox): Promise<void> {
  console.log(`🔄 Killing sandbox: ${sandbox.sandboxId}`);
  await sandbox.kill();
  console.log(`✅ Sandbox killed: ${sandbox.sandboxId}`);
  }

/**

- E2B Manager class for comprehensive sandbox management
  */
  export class E2BManager {
  private sandbox: Sandbox | null = null;
  private sandboxId: string | null = null;

constructor(private config: E2BSandboxConfig = {}) {}

async createSandbox(): Promise<Sandbox> {
if (this.sandbox) {
console.log('⚠️ Sandbox already exists, returning existing sandbox');
return this.sandbox;
}

this.sandbox = await createE2BSandbox(this.config);
this.sandboxId = this.sandbox.sandboxId;
return this.sandbox;

}

async connectToSandbox(sandboxId: string): Promise<Sandbox> {
if (this.sandbox && this.sandboxId === sandboxId) {
console.log('⚠️ Already connected to this sandbox');
return this.sandbox;
}

console.log(`🔄 Connecting to existing sandbox: ${sandboxId}`);

// Import Sandbox here to avoid circular dependencies
const { Sandbox } = await import('@e2b/code-interpreter');

    // Connect to the sandbox - this auto-resumes if paused
    const timeoutMs = parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000');
    this.sandbox = await Sandbox.connect(sandboxId, {
      timeoutMs: timeoutMs
    });

    // Explicitly reset the sandbox timeout after connecting
    // This ensures the auto-pause timer is properly reset
    try {
      await this.sandbox.setTimeout(timeoutMs);
      console.log(`⏱️ Sandbox timeout reset to ${timeoutMs/1000}s`);
    } catch (timeoutError) {
      console.warn('⚠️ Failed to reset sandbox timeout:', timeoutError);
    }

this.sandboxId = sandboxId;

// OPTIMIZATION: Skip session token and env file checks on resume
// These were already set when the sandbox was first created.
// Re-checking them adds 3-6 seconds of unnecessary delay.
// If token/env is missing, the app will handle it gracefully.

console.log(`✅ Connected to sandbox: ${sandboxId}`);
return this.sandbox;

}

async executeAgent(
prompt: string,
agentType: 'claude' | 'cursor' | 'gemini' = 'claude',
options: {
onStdout?: (data: string) => void;
onStderr?: (data: string) => void;
isFirstMessage?: boolean;
model?: string;
mcpConfig?: Record<string, any>;
} = {}
): Promise<{
stdout: string;
stderr: string;
exitCode: number;
}> {
if (!this.sandbox) {
throw new Error('Sandbox not created. Call createSandbox() first.');
}

if (agentType === 'claude') {
  return executeClaudeAgent(this.sandbox, prompt, options);
} else if (agentType === 'gemini') {
  return executeGeminiAgent(this.sandbox, prompt, options);
} else {
  return executeCursorAgent(this.sandbox, prompt, options);
}

}

async executeCommand(
command: string,
options: {
onStdout?: (data: string) => void;
onStderr?: (data: string) => void;
background?: boolean;
cwd?: string;
envVars?: Record<string, string>;
} = {}
): Promise<{
stdout: string;
stderr: string;
exitCode: number;
}> {
if (!this.sandbox) {
throw new Error('Sandbox not created. Call createSandbox() first.');
}

// Default to /vibe0 directory if no cwd specified
const finalOptions = {
  ...options,
  cwd: options.cwd || '/vibe0'
};

return executeCommand(this.sandbox, command, finalOptions);

}

async getHost(port: number): Promise<string> {
if (!this.sandbox) {
throw new Error('Sandbox not created. Call createSandbox() first.');
}

return getSandboxHost(this.sandbox, port);

}

async isRunning(): Promise<boolean> {
if (!this.sandbox) {
return false;
}

return isSandboxRunning(this.sandbox);

}

async kill(): Promise<void> {
if (this.sandbox) {
await killSandbox(this.sandbox);
this.sandbox = null;
this.sandboxId = null;
}
}

async pause(): Promise<void> {
if (this.sandbox) {
console.log(`🔄 Pausing sandbox: ${this.sandboxId}`);
await this.sandbox.betaPause();
console.log(`✅ Sandbox paused: ${this.sandboxId}`);
}
}

async resume(): Promise<void> {
if (this.sandbox) {
console.log(`🔄 Resuming sandbox: ${this.sandboxId}`);
this.sandbox = await this.sandbox.connect({ timeoutMs: parseInt(process.env.AUTO_PAUSE_TIMEOUT_MS || '900000') });
console.log(`✅ Sandbox resumed: ${this.sandboxId}`);
}
}

getSandboxId(): string | null {
return this.sandboxId;
}

getSandbox(): Sandbox | null {
return this.sandbox;
}

/**
 * Initialize git repository in the sandbox
 */
async initializeGit(): Promise<void> {
  if (!this.sandbox) {
    throw new Error('Sandbox not created. Call createSandbox() first.');
  }

  console.log('🔧 Initializing git repository...');

  // Run all git init commands in a single atomic script to ensure state persists
  // Remove existing .git to ensure fresh repo without old commit history
  // Add safe.directory to fix ownership issues in sandbox
  const initScript = `
    cd /vibe0
    rm -rf .wh..git .wh.* 2>/dev/null || true
    rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true
    git config --global --add safe.directory /vibe0
    git config --global user.email "vibracode@app.com"
    git config --global user.name "Vibra Code"
    git config --global init.defaultBranch main
    git init
    echo "Git initialized successfully"
  `;

  await executeCommand(this.sandbox, initScript, { cwd: '/vibe0' });

  console.log('✅ Git repository initialized');
}

/**
 * Commit all changes and push to GitHub
 * @param isInitialPush - If true, deletes .git and force pushes. If false, adds a new commit.
 */
async commitAndPush(
  githubToken: string,
  repository: string,
  commitMessage: string,
  isInitialPush: boolean = false
): Promise<{ success: boolean; error?: string }> {
  if (!this.sandbox) {
    throw new Error('Sandbox not created');
  }

  try {
    console.log(`🚀 Pushing to GitHub: ${repository} (isInitialPush: ${isInitialPush})`);

    // Set up remote with token authentication
    const remoteUrl = `https://${githubToken}@github.com/${repository}.git`;
    const escapedMessage = commitMessage.replace(/"/g, '\\"').replace(/\$/g, '\\$');

    // Generate README content for initial push
    const repoName = repository.split('/')[1] || repository;
    const appStoreLink = 'https://apps.apple.com/us/app/vibra-code-ai-app-builder/id6752743077';
    const readmeContent = `# ${repoName}

> Mobile app built with [Vibra Code](${appStoreLink}) - The AI-powered mobile app builder

[![Download on the App Store](https://img.shields.io/badge/Download-App%20Store-blue?logo=apple&logoColor=white)](${appStoreLink})
[![Built with Expo](https://img.shields.io/badge/Built%20with-Expo-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)

## About

This mobile application was created using **Vibra Code**, an AI-powered mobile app builder that lets you build React Native apps with natural language. Just describe what you want, and AI builds it for you.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (\`npm install -g expo-cli\`)
- iOS Simulator (Mac) or Android Emulator

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/${repository}.git
cd ${repoName}

# Install dependencies
npm install

# Start the development server
npm run dev
\`\`\`

### Running the App

- **iOS Simulator**: Press \`i\` in the terminal
- **Android Emulator**: Press \`a\` in the terminal
- **Physical Device**: Scan the QR code with Expo Go app

## Tech Stack

| Technology | Description |
|------------|-------------|
| [React Native](https://reactnative.dev) | Cross-platform mobile framework |
| [Expo](https://expo.dev) | React Native development platform |
| [TypeScript](https://typescriptlang.org) | Type-safe JavaScript |
| [NativeWind](https://nativewind.dev) | Tailwind CSS for React Native |

## Build Your Own App

Want to build your own mobile app with AI? Download Vibra Code:

[![Download Vibra Code](https://img.shields.io/badge/Download%20Vibra%20Code-App%20Store-0D96F6?style=for-the-badge&logo=apple&logoColor=white)](${appStoreLink})

## License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ using <a href="${appStoreLink}">Vibra Code</a> - AI Mobile App Builder</sub>
</p>
`;

    let pushScript: string;

    if (isInitialPush) {
      // Initial push: Delete .git, init fresh, add README, force push
      console.log('📦 Initial push - creating fresh git repository with README');
      pushScript = `
        cd /vibe0

        # Remove Docker whiteout files and stale .git
        rm -rf .wh..git .wh.* 2>/dev/null || true
        rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true

        # Create README.md
        cat > README.md << 'READMEEOF'
${readmeContent}
READMEEOF

        git config --global --add safe.directory /vibe0
        git config --global user.email "vibracode@app.com"
        git config --global user.name "Vibra Code"
        git config --global init.defaultBranch main
        git init

        # Add gitignore to exclude problematic files
        echo '.wh.*' >> .gitignore
        echo 'node_modules/' >> .gitignore
        echo '.env.local' >> .gitignore

        git remote add origin "${remoteUrl}"
        git add .
        git commit -m "${escapedMessage}"
        git push -u origin main --force 2>&1
      `;
    } else {
      // Subsequent push: Preserve git history, add new commit on top
      console.log('📝 Subsequent push - adding new commit to existing history');
      pushScript = `
        cd /vibe0

        # Remove Docker whiteout files and stale .git
        rm -rf .wh..git .wh.* 2>/dev/null || true
        rm -rf .git 2>/dev/null || sudo rm -rf .git 2>/dev/null || true

        # Create README.md if it doesn't exist
        if [ ! -f "README.md" ]; then
          cat > README.md << 'READMEEOF'
${readmeContent}
READMEEOF
        fi

        git config --global --add safe.directory /vibe0
        git config --global user.email "vibracode@app.com"
        git config --global user.name "Vibra Code"
        git config --global init.defaultBranch main

        # Initialize fresh git repo
        git init

        # Add gitignore to exclude problematic files
        echo '.wh.*' >> .gitignore
        echo 'node_modules/' >> .gitignore
        echo '.env.local' >> .gitignore

        git remote add origin "${remoteUrl}"

        # Fetch remote history and merge it
        git fetch origin main 2>/dev/null || true

        # Reset to remote history (keeps working directory unchanged)
        # This makes our next commit build on top of existing history
        git reset origin/main 2>/dev/null || true

        # Add all files (excluding .gitignore patterns)
        git add .

        # Create commit on top of existing history
        git commit -m "${escapedMessage}"

        # Push (no --force needed since we're building on existing history)
        git push origin main 2>&1 || git push origin main --force 2>&1
      `;
    }

    const result = await this.sandbox.commands.run(pushScript, {
      timeoutMs: 120000, // 2 minutes timeout for push
    });

    console.log('📝 Git stdout:', result.stdout);
    console.log('📝 Git stderr:', result.stderr);
    console.log('📝 Git exit code:', result.exitCode);

    // Check for success indicators in output
    const output = result.stdout + result.stderr;
    const isSuccess = result.exitCode === 0 ||
      output.includes('-> main') ||
      output.includes('Everything up-to-date') ||
      output.includes('Nothing to commit') ||
      output.includes('Push completed');

    if (!isSuccess) {
      return { success: false, error: result.stderr || result.stdout || 'Push failed' };
    }

    console.log('✅ Successfully pushed to GitHub');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Git push error:', error);
    // Try to extract stderr from error result if available
    const errorMessage = error.result?.stderr || error.result?.stdout || error.message || 'Unknown error';
    console.error('📝 Error details:', errorMessage);

    // Check if this is actually a success case (nothing to commit, already pushed)
    if (errorMessage.includes('nothing to commit') ||
        errorMessage.includes('Everything up-to-date') ||
        errorMessage.includes('-> main')) {
      console.log('✅ Already up to date, treating as success');
      return { success: true };
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
}