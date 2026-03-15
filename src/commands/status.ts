import { discoverProjects } from '../core/projects.js';
import { projectState, relayProjectState } from '../core/state.js';
import { relayOnlyProjects } from '../core/relay.js';

/** Output compact status indicator for shell prompt: ○ or ▲N ◉N ◆N */
export function cmdStatus(): void {
  let hot = 0;
  let working = 0;
  let doneCount = 0;

  const projects = discoverProjects();
  for (const project of projects) {
    const ps = projectState(project);
    if (!ps) continue;
    switch (ps.state) {
      case 'stuck':
      case 'waiting':
        hot++;
        break;
      case 'working':
        working += ps.activeCount > 0 ? ps.activeCount : 1;
        break;
      case 'done':
        doneCount++;
        break;
    }
  }

  // Also count relay-only projects (from cache, no network)
  for (const rp of relayOnlyProjects()) {
    const ps = relayProjectState(rp);
    if (!ps) continue;
    switch (ps.state) {
      case 'stuck':
      case 'waiting':
        hot++;
        break;
      case 'working':
        working += ps.activeCount > 0 ? ps.activeCount : 1;
        break;
      case 'done':
        doneCount++;
        break;
    }
  }

  // Use stderr TTY check for colors (prompt output via $(...))
  const noColor = !!process.env.NO_COLOR;
  const useColor = !noColor && (process.stderr.isTTY || !!process.env.TEND_FORCE_COLOR);
  const r = useColor ? '\x1b[0m' : '';
  const red = useColor ? '\x1b[31m' : '';
  const cyan = useColor ? '\x1b[36m' : '';
  const green = useColor ? '\x1b[32m' : '';

  const parts: string[] = [];
  if (hot > 0) parts.push(`${red}▲${hot}${r}`);
  if (working > 0) parts.push(`${cyan}◉${working}${r}`);
  if (doneCount > 0) parts.push(`${green}◆${doneCount}${r}`);

  if (parts.length === 0) {
    process.stdout.write('○\n');
  } else {
    process.stdout.write(parts.join(' ') + '\n');
  }
}
