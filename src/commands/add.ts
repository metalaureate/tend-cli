import { resolveProjectPath, sortedProjects } from '../core/projects.js';
import { existsSync, readFileSync, appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tsLocal } from '../ui/format.js';
import { C } from '../ui/colors.js';
import { gitRepoName } from '../core/git.js';
import { createInterface } from 'readline';
import { relayAddTodo, relayListTodos, relayDeleteTodo } from '../core/relay.js';

interface TodoEntry {
  projectPath: string;
  rawLine: string;
  display: string;
}

export async function cmdAdd(args: string[]): Promise<void> {
  let projectName: string | undefined;
  let rest = [...args];

  // With 2+ args, try first arg as project name
  if (rest.length >= 2) {
    try {
      resolveProjectPath(rest[0]);
      projectName = rest.shift();
    } catch {
      // first arg isn't a project — treat everything as message
    }
  } else if (rest.length === 1) {
    // Single arg: project name (show TODOs) or message (add to current)
    try {
      resolveProjectPath(rest[0]);
      projectName = rest[0];
      rest = [];
    } catch {
      // not a project — treat as message
    }
  }

  const message = rest.join(' ');

  if (!message) {
    // No message: show TODOs and prompt for removal
    const projects = projectName
      ? [resolveProjectPath(projectName)]
      : sortedProjects();

    if (projects.length === 0) {
      process.stdout.write('No projects registered\n');
      return;
    }

    const todos = collectTodos(projects);
    if (todos.length === 0) {
      process.stdout.write(projectName ? `No TODOs for ${projectName}\n` : 'No TODOs across any projects\n');
      return;
    }

    printTodos(todos, projects);

    // Non-interactive (piped) — just print and exit
    if (!process.stdin.isTTY) return;

    const answer = await prompt(`${C.dim}Enter to dismiss, or #s to remove (e.g. 1,3):${C.reset} `);
    const trimmed = answer.trim();
    if (!trimmed) return;

    const indices = trimmed.split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= todos.length);

    if (indices.length === 0) return;

    removeTodos(todos, indices);
    // Best-effort relay sync — delete matching TODOs from relay
    syncRelayRemovals(todos, indices).catch(() => {});
    const label = indices.length === 1 ? 'todo' : 'todos';
    process.stdout.write(`✓ Removed ${indices.length} ${label}\n`);
    return;
  }

  let projectPath: string;
  try {
    projectPath = resolveProjectPath(projectName);
  } catch (e) {
    process.stderr.write(`tend: ${(e as Error).message}\n`);
    process.exit(1);
  }
  const pName = gitRepoName(projectPath);

  if (!existsSync(join(projectPath, '.tend'))) {
    process.stderr.write(`tend: .tend/ not initialized in ${pName}. Run 'tend init ${pName}' first.\n`);
    process.exit(1);
  }

  const ts = tsLocal();
  appendFileSync(join(projectPath, '.tend', 'TODO'), `[${ts}] ${message}\n`);
  process.stdout.write(`✓ Added to ${pName}/TODO\n`);

  // Best-effort dual-write to relay
  relayAddTodo(pName, message).catch(() => {});
}

/** Collect all TODO entries across projects with global numbering */
function collectTodos(projects: string[]): TodoEntry[] {
  const todos: TodoEntry[] = [];
  for (const projectPath of projects) {
    const todoFile = join(projectPath, '.tend', 'TODO');
    if (!existsSync(todoFile)) continue;
    const content = readFileSync(todoFile, 'utf-8').trim();
    if (!content) continue;
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      let display = line;
      if (display.startsWith('[')) {
        display = display.replace(/^\[[^\]]*\]\s*/, '');
      }
      todos.push({ projectPath, rawLine: line, display });
    }
  }
  return todos;
}

/** Print numbered TODOs grouped by project */
function printTodos(todos: TodoEntry[], projects: string[]): void {
  let n = 0;
  for (const projectPath of projects) {
    const projectTodos = todos.filter(t => t.projectPath === projectPath);
    if (projectTodos.length === 0) continue;
    const pName = gitRepoName(projectPath);
    process.stdout.write(`${C.bold}TODO (${pName}):${C.reset}\n`);
    for (const todo of projectTodos) {
      n++;
      process.stdout.write(`  ${n}. ${todo.display}\n`);
    }
  }
}

/** Remove TODOs by their 1-based global indices */
function removeTodos(todos: TodoEntry[], indices: number[]): void {
  const toRemove = new Set(indices.map(i => i - 1)); // convert to 0-based
  // Group removals by project file
  const byFile = new Map<string, Set<string>>();
  for (const idx of toRemove) {
    const todo = todos[idx];
    if (!todo) continue;
    const file = join(todo.projectPath, '.tend', 'TODO');
    if (!byFile.has(file)) byFile.set(file, new Set());
    byFile.get(file)!.add(todo.rawLine);
  }

  for (const [file, linesToRemove] of byFile) {
    const content = readFileSync(file, 'utf-8');
    const kept = content.split('\n').filter(line => !linesToRemove.has(line));
    writeFileSync(file, kept.join('\n'));
  }
}

/** Sync TODO removals to relay by matching project + message */
async function syncRelayRemovals(todos: TodoEntry[], indices: number[]): Promise<void> {
  const relayTodos = await relayListTodos();
  if (relayTodos.length === 0) return;

  for (const idx of indices) {
    const todo = todos[idx - 1]; // 1-based to 0-based
    if (!todo) continue;
    const project = gitRepoName(todo.projectPath);
    const match = relayTodos.find(rt => rt.project === project && rt.message === todo.display);
    if (match) {
      await relayDeleteTodo(match.id);
    }
  }
}

function prompt(msg: string): Promise<string> {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(msg, answer => {
      rl.close();
      resolve(answer);
    });
  });
}
