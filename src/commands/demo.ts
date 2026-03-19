import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { registerProject } from '../core/projects.js';
import { buildBoardOutput } from './board.js';
import { formatTs } from '../ui/format.js';
import { C } from '../ui/colors.js';

const DEMO_DIR = join(homedir(), '.tend', 'demo');

interface DemoProject {
  name: string;
  events: string[];
}

function demoTs(offsetSeconds: number): string {
  return formatTs(new Date(Date.now() - offsetSeconds * 1000));
}

const DEMO_PROJECTS: DemoProject[] = [
  {
    name: 'api-gateway',
    events: [
      // Session started 8 min ago, actively working
      `${demoTs(480)} demo-1 working refactoring auth middleware`,
      `${demoTs(300)} demo-1 working updating JWT validation logic`,
      `${demoTs(120)} demo-1 working writing unit tests`,
    ],
  },
  {
    name: 'frontend-app',
    events: [
      // Session completed 15 min ago
      `${demoTs(900)} demo-2 working implementing dark mode toggle`,
      `${demoTs(600)} demo-2 working updating Tailwind config`,
      `${demoTs(300)} demo-2 done dark mode toggle complete — 3 components updated`,
    ],
  },
  {
    name: 'data-pipeline',
    events: [
      // Stuck — needs input
      `${demoTs(1200)} demo-3 working processing customer CSV exports`,
      `${demoTs(600)} demo-3 stuck need schema for orders table — which columns should be included?`,
    ],
  },
];

function createDemoProject(project: DemoProject): string {
  const projectDir = join(DEMO_DIR, project.name);
  const tendDir = join(projectDir, '.tend');

  mkdirSync(tendDir, { recursive: true });

  const eventsContent = project.events.join('\n') + '\n';
  writeFileSync(join(tendDir, 'events'), eventsContent);
  writeFileSync(join(tendDir, 'TODO'), '');

  return projectDir;
}

export async function cmdDemo(args: string[]): Promise<void> {
  const cleanup = args.includes('--cleanup') || args.includes('clean');

  if (cleanup) {
    if (existsSync(DEMO_DIR)) {
      rmSync(DEMO_DIR, { recursive: true, force: true });
      process.stdout.write('✓ Demo projects removed\n');
    } else {
      process.stdout.write('  No demo projects to remove\n');
    }
    return;
  }

  // Create demo projects
  const paths: string[] = [];
  for (const project of DEMO_PROJECTS) {
    const projectDir = createDemoProject(project);
    paths.push(projectDir);
    registerProject(projectDir);
  }

  process.stdout.write('\n');
  process.stdout.write(`  ${C.bold}Tend demo${C.reset} — three demo projects with live event data\n\n`);

  const output = await buildBoardOutput();
  process.stdout.write(output);

  process.stdout.write(`  ${C.grey}Demo projects created in ${DEMO_DIR}${C.reset}\n`);
  process.stdout.write(`  Run ${C.bold}td${C.reset} any time to see the board, or ${C.bold}tend demo clean${C.reset} to remove them.\n\n`);
  process.stdout.write(`  ${C.bold}Next:${C.reset} run ${C.bold}tend init${C.reset} inside a real project to start tending it.\n\n`);
}
