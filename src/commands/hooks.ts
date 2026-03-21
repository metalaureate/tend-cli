import { resolveProjectPath } from '../core/projects.js';
import { appendEvent, sanitizeUserTag, stripUserTag } from '../core/events.js';
import { tsLocal } from '../ui/format.js';
import { config } from '../core/config.js';
import { gitUserEmail } from '../core/git.js';
import { relayEmit, relayToken } from '../core/relay.js';
import { existsSync, readFileSync, appendFileSync } from 'fs';
import { join, basename } from 'path';
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

  const sessionId = extractSessionId(input, projectPath);
  const prompt = extractPrompt(input);
  const ts = tsLocal();

  // Always write locally first
  if (existsSync(join(projectPath, '.tend'))) {
    const eventsFile = join(projectPath, '.tend', 'events');

    // Deduplicate: skip if the last event for this session is already "working" with the same prompt
    let isDuplicate = false;
    if (sessionId && existsSync(eventsFile)) {
      const content = readFileSync(eventsFile, 'utf-8').trimEnd();
      const lines = content.split('\n');
      const baseId = stripUserTag(sessionId);
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes(` ${baseId} `) || lines[i].includes(` ${baseId}@`)) {
          const parts = lines[i].split(/\s+/);
          if (parts.length >= 3 && parts[2] === 'working' && parts.slice(3).join(' ') === prompt) {
            isDuplicate = true;
          }
          break;
        }
      }
    }

    if (!isDuplicate) {
      if (sessionId) {
        appendEvent(eventsFile, ts, sessionId, 'working', prompt);
      } else {
        appendFileSync(eventsFile, `${ts} working${prompt ? ' ' + prompt : ''}\n`);
      }
      invalidateStatusCache();
    }
  }

  // Also send to relay if a token is configured (best-effort)
  if (relayToken()) {
    const projectName = basename(projectPath);
    await relayEmit(projectName, 'working', prompt, sessionId);
  }
}

/** Read the last state for a session from a local events file */
function readLastState(eventsFile: string, sessionId: string): string {
  if (!existsSync(eventsFile)) return '';
  const content = readFileSync(eventsFile, 'utf-8').trimEnd();
  const lines = content.split('\n');
  if (sessionId) {
    const baseId = stripUserTag(sessionId);
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes(` ${baseId} `) || lines[i].includes(` ${baseId}@`)) {
        const parts = lines[i].split(/\s+/);
        if (parts.length >= 3) return parts[2];
        break;
      }
    }
  } else {
    const lastLine = lines[lines.length - 1] || '';
    const parts = lastLine.split(/\s+/);
    if (parts.length >= 3 && ['working', 'done', 'stuck', 'waiting', 'idle'].includes(parts[2])) {
      return parts[2];
    } else if (parts.length >= 2) {
      return parts[1];
    }
  }
  return '';
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

  const sessionId = extractSessionId(input, projectPath);
  const ts = tsLocal();
  const eventsFile = join(projectPath, '.tend', 'events');

  // Only demote to idle if current state is "working".
  // Preserve intentional terminal states (done, stuck, waiting).
  const lastState = readLastState(eventsFile, sessionId);
  if (lastState === 'done' || lastState === 'stuck' || lastState === 'waiting' || lastState === 'idle') return;

  // Always write locally first
  if (existsSync(join(projectPath, '.tend'))) {
    // Emit idle (not done) — the stop hook fires between turns, not just at session end.
    // "done" should only come from explicit `tend emit done` or agent instructions.
    if (sessionId) {
      appendEvent(eventsFile, ts, sessionId, 'idle', '');
    } else {
      appendFileSync(eventsFile, `${ts} idle\n`);
    }
    invalidateStatusCache();
  }

  // Also send to relay if a token is configured (best-effort)
  if (relayToken()) {
    const projectName = basename(projectPath);
    await relayEmit(projectName, 'idle', '', sessionId);
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
