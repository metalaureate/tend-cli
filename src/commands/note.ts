import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { resolveProjectPath, resolveProjectName } from '../core/projects.js';
import { relayToken } from '../core/relay.js';
import { config } from '../core/config.js';

/** Read the note for a project (returns empty string if none) */
export function readNote(projectPath: string): string {
  const noteFile = join(projectPath, '.tend', 'note');
  try {
    if (existsSync(noteFile)) {
      return readFileSync(noteFile, 'utf-8').trim();
    }
  } catch { /* ignore */ }
  return '';
}

/** Clear the note for a project */
export function clearNote(projectPath: string): void {
  const noteFile = join(projectPath, '.tend', 'note');
  try { unlinkSync(noteFile); } catch { /* ignore */ }
}

/** Set or clear a note for the current project */
export async function cmdNote(args: string[]): Promise<void> {
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stderr.write('Usage: tend note <message>   Set a sticky note (replaces prediction)\n');
    process.stderr.write('       tend note --clear     Clear the note\n');
    process.stderr.write('\nThe note is shown in the message column on the board,\n');
    process.stderr.write('taking priority over the AI prediction. The next emit clears it.\n');
    process.exit(args.length === 0 ? 1 : 0);
  }

  let projectPath: string;
  try {
    projectPath = resolveProjectPath();
  } catch {
    process.stderr.write('tend: not inside a tended project (run tend init first)\n');
    process.exit(1);
    return;
  }

  const tendDir = join(projectPath, '.tend');
  if (!existsSync(tendDir)) {
    process.stderr.write('tend: not inside a tended project (run tend init first)\n');
    process.exit(1);
    return;
  }

  const clearing = args[0] === '--clear' || args[0] === '-c';

  if (clearing) {
    clearNote(projectPath);
    process.stdout.write('note cleared\n');
  } else {
    const message = args.join(' ');
    writeFileSync(join(tendDir, 'note'), message + '\n');
    process.stdout.write(`note: ${message}\n`);
  }

  // Sync to relay if configured
  const token = relayToken();
  if (token) {
    const projectName = resolveProjectName();
    try {
      if (clearing) {
        await fetch(`${config.relayUrl}/v1/notes/${encodeURIComponent(projectName)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
          signal: AbortSignal.timeout(10000),
        });
      } else {
        const message = args.join(' ');
        await fetch(`${config.relayUrl}/v1/notes/${encodeURIComponent(projectName)}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ note: message }),
          signal: AbortSignal.timeout(10000),
        });
      }
    } catch {
      // Relay is best-effort
    }
  }
}
