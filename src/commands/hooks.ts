import { resolveProjectPath } from '../core/projects.js';
import { appendEvent } from '../core/events.js';
import { tsLocal, toEpoch } from '../ui/format.js';
import { config } from '../core/config.js';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';

/** Extract session_id or sessionId from JSON input */
function extractSessionId(input: string): string {
  // Try snake_case first, then camelCase
  const snakeMatch = input.match(/"session_id"\s*:\s*"([^"]*)"/);
  if (snakeMatch) return snakeMatch[1];
  const camelMatch = input.match(/"sessionId"\s*:\s*"([^"]*)"/);
  if (camelMatch) return camelMatch[1];
  return '';
}

/** Escape a string for JSON output */
function jsonEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

function hookDebug(hookName: string, input: string): void {
  if (!config.hookDebug) return;
  let projectPath: string;
  try {
    projectPath = resolveProjectPath();
  } catch {
    return;
  }
  const log = join(projectPath, '.tend', 'hook_debug.log');
  try {
    appendFileSync(log, `${tsLocal()} [${hookName}] ${input}\n`);
  } catch {
    // ignore
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function hookSessionStart(): void {
  // Read stdin but we don't need it for session-start
  // We just need to output context
  let projectPath: string;
  try {
    projectPath = resolveProjectPath();
  } catch {
    return;
  }

  let context = '';
  const todoFile = join(projectPath, '.tend', 'TODO');
  if (existsSync(todoFile)) {
    const content = readFileSync(todoFile, 'utf-8').trim();
    if (content) {
      context = `Current backlog (.tend/TODO) — propose these to the developer:\\n${jsonEscape(content)}`;
    }
  }

  // Include recent git activity
  try {
    const result = Bun.spawnSync(['git', '-C', projectPath, 'log', '--oneline', '-10', '--format=%h %s (%ar)']);
    const gitLog = result.stdout.toString().trim();
    if (gitLog) {
      if (context) context += '\\n\\n';
      context += `Recent commits:\\n${jsonEscape(gitLog)}`;
    }
  } catch {
    // ignore
  }

  if (context) {
    process.stdout.write(`{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"${context}"}}\n`);
  }
}

async function hookUserPrompt(): Promise<void> {
  const input = await readStdin();
  hookDebug('user-prompt', input);

  let projectPath: string;
  try {
    projectPath = resolveProjectPath();
  } catch {
    return;
  }

  if (existsSync(join(projectPath, '.tend'))) {
    const sessionId = extractSessionId(input);
    const ts = tsLocal();
    if (sessionId) {
      appendEvent(join(projectPath, '.tend', 'events'), ts, sessionId, 'working', '');
    } else {
      appendFileSync(join(projectPath, '.tend', 'events'), `${ts} working\n`);
    }
  }
}

async function hookStop(): Promise<void> {
  const input = await readStdin();
  hookDebug('stop', input);

  // Check if stop_hook_active is true (another stop hook is handling this)
  if (/"stop_hook_active"\s*:\s*true/.test(input)) return;

  let projectPath: string;
  try {
    projectPath = resolveProjectPath();
  } catch {
    return;
  }

  if (!existsSync(join(projectPath, '.tend'))) return;

  const sessionId = extractSessionId(input);
  const ts = tsLocal();
  const eventsFile = join(projectPath, '.tend', 'events');

  // Only demote to idle if current state is "working".
  // Preserve intentional terminal states (done, stuck, waiting).
  let lastState = '';
  let firstWorkingTs = '';
  let workingCount = 0;
  if (existsSync(eventsFile)) {
    const content = readFileSync(eventsFile, 'utf-8').trimEnd();
    const lines = content.split('\n');

    if (sessionId) {
      // Find last event and first working event for this session
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes(` ${sessionId} `)) {
          const parts = lines[i].split(/\s+/);
          if (parts.length >= 3) {
            if (!lastState) lastState = parts[2];
            if (parts[2] === 'working') {
              workingCount++;
              firstWorkingTs = parts[0];
            }
          }
        }
      }
    } else {
      // No session — check last line
      const lastLine = lines[lines.length - 1] || '';
      const parts = lastLine.split(/\s+/);
      if (parts.length >= 2) lastState = parts[1];
    }
  }

  if (lastState === 'done' || lastState === 'stuck' || lastState === 'waiting') return;

  // Infer stuck: if the session only had 1 prompt (working event) and
  // lasted less than 90 seconds, the agent likely hit a wall
  const BRIEF_SESSION_THRESHOLD = 90; // seconds
  if (lastState === 'working' && firstWorkingTs && workingCount <= 1) {
    const elapsed = toEpoch(ts) - toEpoch(firstWorkingTs);
    if (elapsed >= 0 && elapsed < BRIEF_SESSION_THRESHOLD) {
      if (sessionId) {
        appendEvent(eventsFile, ts, sessionId, 'stuck', 'session ended abruptly');
      } else {
        appendFileSync(eventsFile, `${ts} stuck session ended abruptly\n`);
      }
      return;
    }
  }

  if (sessionId) {
    appendEvent(eventsFile, ts, sessionId, 'idle', 'session ended');
  } else {
    appendFileSync(eventsFile, `${ts} idle session ended\n`);
  }
}

export async function cmdHook(args: string[]): Promise<void> {
  const subcmd = args[0];
  switch (subcmd) {
    case 'session-start':
      hookSessionStart();
      break;
    case 'user-prompt':
      await hookUserPrompt();
      break;
    case 'stop':
      await hookStop();
      break;
    default:
      process.stderr.write('Usage: tend hook <session-start|user-prompt|stop>\n');
      process.exit(1);
  }
}
