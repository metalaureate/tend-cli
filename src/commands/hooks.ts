import { resolveProjectPath } from '../core/projects.js';
import { appendEvent, sanitizeUserTag, stripUserTag } from '../core/events.js';
import { tsLocal } from '../ui/format.js';
import { config } from '../core/config.js';
import { gitUserEmail } from '../core/git.js';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join } from 'path';
import { invalidateStatusCache } from './status.js';

/** Extract session_id or sessionId from JSON input, tagged with git user email */
function extractSessionId(input: string, projectPath?: string): string {
  // Try snake_case first, then camelCase
  const snakeMatch = input.match(/"session_id"\s*:\s*"([^"]*)"/);
  const raw = snakeMatch ? snakeMatch[1] : (() => {
    const camelMatch = input.match(/"sessionId"\s*:\s*"([^"]*)"/);
    return camelMatch ? camelMatch[1] : '';
  })();
  if (!raw) return '';
  // Tag with git user email, same as emit.ts
  const email = projectPath ? gitUserEmail(projectPath) : '';
  return email ? `${raw}@${sanitizeUserTag(email)}` : raw;
}

/** Extract the first line of the user's prompt from hook JSON input */
function extractPrompt(input: string): string {
  const match = input.match(/"prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return '';
  // Unescape JSON string, take first line, trim whitespace
  const raw = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const firstLine = raw.split('\n')[0].trim();
  // Truncate to keep event lines reasonable
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '...' : firstLine;
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
    const sessionId = extractSessionId(input, projectPath);
    const prompt = extractPrompt(input);
    const ts = tsLocal();
    if (sessionId) {
      appendEvent(join(projectPath, '.tend', 'events'), ts, sessionId, 'working', prompt);
    } else {
      appendFileSync(join(projectPath, '.tend', 'events'), `${ts} working${prompt ? ' ' + prompt : ''}\n`);
    }
    invalidateStatusCache();
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

  const sessionId = extractSessionId(input, projectPath);
  const ts = tsLocal();
  const eventsFile = join(projectPath, '.tend', 'events');

  // Only demote to idle if current state is "working".
  // Preserve intentional terminal states (done, stuck, waiting).
  let lastState = '';
  if (existsSync(eventsFile)) {
    const content = readFileSync(eventsFile, 'utf-8').trimEnd();
    const lines = content.split('\n');

    if (sessionId) {
      // Find last event for this session (match by base UUID, ignoring user tag)
      const baseId = stripUserTag(sessionId);
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes(` ${baseId} `) || lines[i].includes(` ${baseId}@`)) {
          const parts = lines[i].split(/\s+/);
          if (parts.length >= 3) {
            lastState = parts[2];
            break;
          }
        }
      }
    } else {
      // No session — check last line (may or may not have a session ID)
      const lastLine = lines[lines.length - 1] || '';
      const parts = lastLine.split(/\s+/);
      // Event format: <ts> [sessionId] <state> [message...]
      // With session: parts = [ts, sessionId, state, ...]
      // Without session: parts = [ts, state, ...]
      if (parts.length >= 3 && ['working', 'done', 'stuck', 'waiting', 'idle'].includes(parts[2])) {
        lastState = parts[2];
      } else if (parts.length >= 2) {
        lastState = parts[1];
      }
    }
  }

  if (lastState === 'done' || lastState === 'stuck' || lastState === 'waiting') return;

  if (sessionId) {
    if (lastState === 'working') {
      // Session had work — emit done (not idle, so the board shows "done")
      appendEvent(eventsFile, ts, sessionId, 'done', 'session completed');
    } else {
      appendEvent(eventsFile, ts, sessionId, 'idle', 'session ended');
    }
  } else {
    if (lastState === 'working') {
      appendFileSync(eventsFile, `${ts} done session completed\n`);
    } else {
      appendFileSync(eventsFile, `${ts} idle session ended\n`);
    }
  }
  invalidateStatusCache();
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
