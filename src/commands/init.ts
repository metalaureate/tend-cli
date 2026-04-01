import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { resolveProjectPath, registerProject } from '../core/projects.js';
import { hasGit, gitRepoName } from '../core/git.js';
import { homedir } from 'os';

const HOOKS_JSON = JSON.stringify({
  hooks: {
    SessionStart: [{ type: 'command', command: 'tend hook session-start' }],
    UserPromptSubmit: [{ type: 'command', command: 'tend hook user-prompt' }],
    Stop: [{ type: 'command', command: 'tend hook stop' }],
  },
}, null, 2);

const AGENTS_TEMPLATE = `## Tend Integration

This project uses [Tend](https://github.com/metalaureate/tend-cli) for workflow coordination.

### Setup

If \`tend\` is not on PATH, install it:

\`\`\`bash
curl -sSL https://raw.githubusercontent.com/metalaureate/tend-cli/main/bin/tend -o /usr/local/bin/tend && chmod +x /usr/local/bin/tend
\`\`\`

### On Startup

1. Read \`.tend/TODO\` — propose pending items to the developer and ask what to work on.
2. Review recent git history for context on what's already been done.

### During Work

- \`tend emit working "<description>"\` — automatically emitted by hooks on each prompt, but emit manually when switching tasks.
- \`tend emit done "<summary>"\` — **IMPORTANT: always emit when you finish a task.** This is the primary signal that work completed.
- \`tend emit stuck "<what you need>"\` — emit when you cannot proceed without human input (e.g., need a decision, credentials, access, or clarification).
- \`tend emit waiting "<what you're waiting for>"\` — emit when blocked on an external dependency (e.g., CI, deployment, API response).

### On Completion

- Emit \`tend emit done "<summary of what you accomplished>"\` before going idle.
- If there are items in \`.tend/TODO\`, note the next item but wait for the developer to assign it (do not auto-start).

### Relay (Cloud Monitoring)

If \`TEND_RELAY_TOKEN\` is set in your environment, \`tend emit\` automatically posts events to the relay so the developer can monitor your progress in real-time.

Verify relay connectivity at startup:

\`\`\`bash
echo "TEND_RELAY_TOKEN=\${TEND_RELAY_TOKEN:-NOT SET}"
tend relay debug
\`\`\`

If the token is not set and you are running in a remote or cloud environment, inform the developer so they can provide \`TEND_RELAY_TOKEN\` for your session.

### Event Format

If \`tend\` is not available, append a single line to \`.tend/events\`:

\`\`\`
<ISO-8601-timestamp> <session-id> <state> <message>
\`\`\`

Use \`$TEND_SESSION_ID\` as the session ID if set, otherwise use \`_cli\`.

States: \`working\`, \`done\`, \`stuck\`, \`waiting\`, \`idle\`.

Example:
\`\`\`
2026-03-13T14:20:00 _cli working refactoring narrative engine
2026-03-13T14:45:00 _cli done refactored narrative engine (PR #204)
2026-03-13T14:46:00 _cli stuck needs database credentials for staging
\`\`\`
`;

const TEND_MARKER = '## Tend Integration';

const GITIGNORE_ENTRIES = ['.tend/events', '.tend/hook_debug.log', '.scratch/'];

export function cmdInit(args: string[]): void {
  let projectPath: string;
  if (args[0]) {
    try {
      projectPath = resolveProjectPath(args[0]);
    } catch (e) {
      process.stderr.write(`tend: ${(e as Error).message}\n`);
      process.exit(1);
    }
  } else {
    // For init, use cwd directly (don't require .git for resolveProjectPath)
    projectPath = process.cwd();
  }

  // Require git to be initialized
  if (!hasGit(projectPath)) {
    process.stderr.write('tend: this directory is not a git repository.\n');
    process.stderr.write('Tend is a companion to git. Please initialize your git repo first:\n');
    process.stderr.write('  git init\n');
    process.exit(1);
  }

  const projectName = gitRepoName(projectPath);
  const tendDir = join(projectPath, '.tend');
  if (!hasGit(projectPath)) {
    process.stderr.write('tend: this directory is not a git repository.\n');
    process.stderr.write('Tend is a companion to git. Please initialize your git repo first:\n');
    process.stderr.write('  git init\n');
    process.exit(1);
  }

  // Create .tend/ directory
  mkdirSync(tendDir, { recursive: true });

  // Create events and TODO files
  for (const file of ['events', 'TODO']) {
    const filePath = join(tendDir, file);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, '');
    }
  }

  // Update .gitignore
  const gitignore = join(projectPath, '.gitignore');
  for (const entry of GITIGNORE_ENTRIES) {
    if (!existsSync(gitignore) || !readFileSync(gitignore, 'utf-8').split('\n').includes(entry)) {
      appendFileSync(gitignore, entry + '\n');
    }
  }

  // Remove stale .github/hooks/ gitignore entry
  if (existsSync(gitignore)) {
    const content = readFileSync(gitignore, 'utf-8');
    if (content.split('\n').includes('.github/hooks/')) {
      const updated = content.split('\n').filter(l => l !== '.github/hooks/').join('\n');
      writeFileSync(gitignore, updated);
    }
  }

  // Handle AGENTS.md
  const agentsFile = join(projectPath, 'AGENTS.md');
  if (!existsSync(agentsFile)) {
    writeFileSync(agentsFile, AGENTS_TEMPLATE);
    process.stdout.write(`✓ Created AGENTS.md with tend integration in ${projectName}\n`);
  } else {
    const content = readFileSync(agentsFile, 'utf-8');
    if (!content.includes(TEND_MARKER)) {
      appendFileSync(agentsFile, '\n' + AGENTS_TEMPLATE);
      process.stdout.write(`✓ Added tend integration to AGENTS.md in ${projectName}\n`);
    } else if (!content.includes('always emit when you finish') || !content.includes('TEND_RELAY_TOKEN')) {
      // Outdated block — replace it
      replaceAgentsBlock(agentsFile);
      process.stdout.write(`✓ Updated tend integration in AGENTS.md in ${projectName}\n`);
    } else {
      process.stdout.write(`✓ AGENTS.md already has tend integration in ${projectName}\n`);
    }
  }

  // Register project
  registerProject(projectPath);

  // Setup shell prompt
  setupShell();

  // Create VS Code hooks config
  const hooksDir = join(projectPath, '.github', 'hooks');
  const hooksFile = join(hooksDir, 'tend.json');
  if (!existsSync(hooksFile)) {
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(hooksFile, HOOKS_JSON + '\n');
  }

  // Create Claude Code hooks config
  const claudeDir = join(projectPath, '.claude');
  const claudeFile = join(claudeDir, 'settings.local.json');
  if (!existsSync(claudeFile)) {
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(claudeFile, HOOKS_JSON + '\n');
  } else {
    const existing = JSON.parse(readFileSync(claudeFile, 'utf-8'));
    if (!existing.hooks) {
      existing.hooks = JSON.parse(HOOKS_JSON).hooks;
      writeFileSync(claudeFile, JSON.stringify(existing, null, 2) + '\n');
    }
  }

  process.stdout.write('✓ Installed agent hooks (Copilot + Claude Code)\n');
  process.stdout.write(`✓ Initialized .tend/ in ${projectName}\n`);
}

function replaceAgentsBlock(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const output: string[] = [];
  let inTendBlock = false;

  for (const line of lines) {
    if (line.startsWith('## Tend Integration')) {
      inTendBlock = true;
      output.push(AGENTS_TEMPLATE);
      continue;
    }
    if (inTendBlock) {
      if (line.startsWith('## ')) {
        inTendBlock = false;
        output.push(line);
      }
      continue;
    }
    output.push(line);
  }

  writeFileSync(filePath, output.join('\n'));
}

function setupShell(): void {
  const marker = '# --- Tend status indicator ---';
  let didSetup = false;

  // zsh
  const zshrc = join(homedir(), '.zshrc');
  if (existsSync(zshrc)) {
    const content = readFileSync(zshrc, 'utf-8');
    if (!content.includes(marker)) {
      const snippet = `
${marker}
if [[ "$GIT_EDITOR" != ":" && -z "$CLAUDE" && "$TEND_NO_PROMPT" != "1" ]]; then
  setopt PROMPT_SUBST
  _TEND_FAILURES=0
  _tend_precmd() {
    if (( _TEND_FAILURES >= 3 )); then _TEND_S=""; return; fi
    _TEND_S="$(command tend status 2>/dev/null &; _tp=$!; { sleep 0.2; kill $_tp 2>/dev/null; } &>/dev/null &; wait $_tp 2>/dev/null)"
    if [[ $? -ne 0 ]]; then _TEND_S=""; (( _TEND_FAILURES++ )); else _TEND_FAILURES=0; fi
  }
  precmd_functions+=(_tend_precmd)
  RPROMPT='$_TEND_S'
fi
`;
      appendFileSync(zshrc, snippet);
      didSetup = true;
      process.stdout.write('✓ Added tend status to ~/.zshrc (shows in right prompt)\n');
    }
  }

  // bash
  for (const rcName of ['.bashrc', '.bash_profile']) {
    const rcFile = join(homedir(), rcName);
    if (existsSync(rcFile)) {
      const content = readFileSync(rcFile, 'utf-8');
      if (!content.includes(marker)) {
        const snippet = `
${marker}
if [[ "$GIT_EDITOR" != ":" && -z "$CLAUDE" && "$TEND_NO_PROMPT" != "1" ]]; then
  _TEND_FAILURES=0
  _tend_prompt() {
    if (( _TEND_FAILURES >= 3 )); then return; fi
    _TEND_S="$(command tend status 2>/dev/null &; _tp=$!; { sleep 0.2; kill $_tp 2>/dev/null; } &>/dev/null &; wait $_tp 2>/dev/null)"
    if [[ $? -ne 0 ]]; then _TEND_S=""; (( _TEND_FAILURES++ )); else _TEND_FAILURES=0; fi
    PS1="\${PS1%\\$ *}$_TEND_S \\$ "
  }
  PROMPT_COMMAND="_tend_prompt\${PROMPT_COMMAND:+;\$PROMPT_COMMAND}"
fi
`;
        appendFileSync(rcFile, snippet);
        didSetup = true;
        process.stdout.write(`✓ Added tend status to ~/${rcName}\n`);
      }
    }
  }

  if (didSetup) {
    process.stdout.write('  Restart your shell or run: source ~/.zshrc\n');
  }
}
