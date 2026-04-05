import { discoverProjects, sortedProjects, detectProject } from '../core/projects.js';
import { projectState, relayProjectState, stateIcon, stateLabel } from '../core/state.js';
import { relaySync, relayOnlyProjects, relayFetchInsights, type RelayInsight } from '../core/relay.js';
import { lastCommitMessage, lastCommitEpoch, lastCommitTs, isDirty, hasGit, dirtySummary, gitRepoName } from '../core/git.js';
import { ago, dateHeader, toEpoch, isStale } from '../ui/format.js';
import { config } from '../core/config.js';
import { C } from '../ui/colors.js';
import { gamificationEnabled, renderFooter } from '../ui/gamification.js';
import { basename } from 'path';
import { invalidateStatusCache } from './status.js';

function stateColor(state: string): string {
  const isTTY = process.stdout.isTTY ?? false;
  const noColor = !!process.env.NO_COLOR;
  if (!isTTY || noColor) return '';
  switch (state) {
    case 'stuck': case 'waiting': return '\x1b[31m';
    case 'done': return '\x1b[32m';
    case 'working': return '\x1b[36m';
    default: return '\x1b[90m';
  }
}

/** Build the board output as a string (includes relay sync). */
export async function buildBoardOutput(): Promise<string> {
  // Invalidate status cache so prompt picks up fresh data after board/dashboard runs
  invalidateStatusCache();

  // Relay sync + fetch insights in parallel (swallow errors)
  let insightMap = new Map<string, RelayInsight>();
  try {
    const [, insights] = await Promise.all([
      relaySync().catch(() => {}),
      relayFetchInsights().catch(() => new Map<string, RelayInsight>()),
    ]);
    insightMap = insights;
  } catch { /* ignore */ }

  const allProjects = discoverProjects();
  const relayOnly = relayOnlyProjects();

  let output = '';

  if (allProjects.length === 0 && relayOnly.length === 0) {
    output += "  No tended projects found\n  Run 'tend init' inside a project to start tending it\n";
    return output;
  }

  const projects = sortedProjects();
  const reset = C.reset;

  // Header
  output += `\n  ${C.bold}TEND${reset}                               ${dateHeader()}\n\n`;

  let needs = 0;
  let ready = 0;
  let workingCount = 0;
  let idleCount = 0;
  let stuckCount = 0;
  let oldestWaitingAge = 0;
  let projectNum = 0;

  for (const project of projects) {
    const projectName = gitRepoName(project);
    projectNum++;

    let state = '';
    let msg = '';
    let ts = '';
    let durationStr = '';
    let activeCount = 0;

    const ps = projectState(project);
    if (ps) {
      state = ps.state;
      msg = ps.message;
      ts = ps.ts;
      activeCount = ps.activeCount;

      // Promote done + dirty working tree → waiting (uncommitted work)
      // Only if the done event is recent (not stale)
      if (state === 'done' && hasGit(project) && isDirty(project) && ts && !isStale(ts, config.staleThreshold)) {
        state = 'waiting';
        msg = msg || dirtySummary(project);
      }

      // For working with no message, show git context
      if (state === 'working' && !msg && hasGit(project)) {
        if (isDirty(project)) {
          msg = dirtySummary(project);
        } else {
          msg = lastCommitMessage(project) || '';
        }
      }

      // For idle with no message, check for uncommitted work then git fallback
      if (state === 'idle' && !msg && hasGit(project)) {
        if (isDirty(project)) {
          msg = dirtySummary(project);
        } else {
          msg = lastCommitMessage(project) || '';
        }
      }

      // If event msg exists but a newer git commit exists, prefer commit
      if (msg && ts && hasGit(project) && state !== 'working' && state !== 'stuck' && state !== 'waiting') {
        const commitEpoch = lastCommitEpoch(project);
        const eventEpoch = toEpoch(ts);
        if (commitEpoch && eventEpoch && commitEpoch > eventEpoch) {
          if (isDirty(project)) {
            msg = dirtySummary(project);
          } else {
            msg = lastCommitMessage(project) || msg;
          }
          ts = lastCommitTs(project) || ts;
        }
      }

      // Duration string
      if (ts) {
        const agoStr = ago(ts);
        if (state === 'working') {
          durationStr = agoStr;
        } else {
          durationStr = `${agoStr} ago`;
        }
      }
    } else {
      // No events — try git fallback
      if (hasGit(project)) {
        if (isDirty(project)) {
          state = 'idle';
          msg = dirtySummary(project);
          const commitTs = lastCommitTs(project);
          durationStr = commitTs ? `${ago(commitTs)} ago` : '';
        } else {
          const commitMsg = lastCommitMessage(project);
          if (commitMsg) {
            state = 'idle';
            msg = commitMsg;
            const commitTs = lastCommitTs(project);
            durationStr = commitTs ? `${ago(commitTs)} ago` : '';
          }
        }
      }
    }

    // Override state with LLM-inferred state when available
    // Skip when ps is null (all sessions acknowledged) or state is idle/waiting/done
    const insight = insightMap.get(projectName);
    if (ps && insight?.inferred_state && ['working', 'done', 'stuck', 'waiting', 'idle'].includes(insight.inferred_state)) {
      if (ps.state !== 'idle' && ps.state !== 'waiting' && ps.state !== 'done') {
        state = insight.inferred_state;
      }
    }

    // Count states
    switch (state) {
      case 'done': ready++; break;
      case 'stuck': stuckCount++; needs++; break;
      case 'waiting': needs++; break;
      case 'working': workingCount += activeCount > 0 ? activeCount : 1; break;
      default: idleCount++; break;
    }

    // Track age of waiting/stuck
    if ((state === 'waiting' || state === 'stuck') && ts) {
      const ageS = Math.floor(Date.now() / 1000) - toEpoch(ts);
      if (ageS > oldestWaitingAge) oldestWaitingAge = ageS;
    }

    // Render line
    const icon = stateIcon(state as any || '');
    const color = stateColor(state);
    let label = stateLabel(state as any || '');
    if (activeCount > 1 && state !== 'idle' && state !== 'done') label = `${activeCount} ${state}`;

    const displayName = projectName.padEnd(20).slice(0, 20);
    const numPrefix = String(projectNum).padStart(2) + '.';

    // Truncate detail
    const termWidth = process.stdout.columns || 80;
    const timeColWidth = durationStr ? durationStr.length + 3 : 0;
    const prefixWidth = 47;
    let maxDetail = termWidth - prefixWidth - timeColWidth;
    if (maxDetail < 10) maxDetail = 10;

    // Prefer insight over message when available
    let detail: string;
    let detailColor = '';
    if (insight) {
      detail = `${insight.summary} → ${insight.prediction}`;
      detailColor = C.amber;
    } else {
      detail = msg;
    }
    if (detail && detail.length > maxDetail) {
      detail = detail.slice(0, maxDetail - 3) + '...';
    }

    let line = `  ${numPrefix} ${displayName} ${color}${icon} ${label.padEnd(15)}${reset}`;
    if (detail) line += `${detailColor}${detail}${detailColor ? reset : ''}`;
    if (durationStr) line += `  ${C.grey}(${durationStr})${reset}`;
    output += line + '\n';
  }

  // Relay-only projects
  for (const relayProject of relayOnly) {
    const ps = relayProjectState(relayProject);
    let state = '';
    let msg = '';
    let ts = '';
    let durationStr = '';
    let activeCount = 0;

    if (ps) {
      state = ps.state;
      msg = ps.message;
      ts = ps.ts;
      activeCount = ps.activeCount;

      if (ts) {
        const agoStr = ago(ts);
        durationStr = state === 'working' ? agoStr : `${agoStr} ago`;
      }
    }

    // Override state with LLM-inferred state when available
    // Skip when ps is null (all sessions acknowledged) or state is idle/waiting/done
    const relayInsight = insightMap.get(relayProject);
    if (ps && relayInsight?.inferred_state && ['working', 'done', 'stuck', 'waiting', 'idle'].includes(relayInsight.inferred_state)) {
      if (ps.state !== 'idle' && ps.state !== 'waiting' && ps.state !== 'done') {
        state = relayInsight.inferred_state;
      }
    }

    switch (state) {
      case 'done': ready++; break;
      case 'stuck': stuckCount++; needs++; break;
      case 'waiting': needs++; break;
      case 'working': workingCount += activeCount > 0 ? activeCount : 1; break;
      default: idleCount++; break;
    }

    if ((state === 'waiting' || state === 'stuck') && ts) {
      const ageS = Math.floor(Date.now() / 1000) - toEpoch(ts);
      if (ageS > oldestWaitingAge) oldestWaitingAge = ageS;
    }

    const icon = stateIcon(state as any || '');
    const color = stateColor(state);
    let label = stateLabel(state as any || '');
    if (activeCount > 1 && state !== 'idle' && state !== 'done') label = `${activeCount} ${state}`;

    const displayName = (relayProject.slice(0, 19) + '↗').padEnd(20);

    const termWidth = process.stdout.columns || 80;
    const timeColWidth = durationStr ? durationStr.length + 3 : 0;
    let maxDetail = termWidth - 47 - timeColWidth;
    if (maxDetail < 10) maxDetail = 10;

    // Prefer insight over message when available
    let detail: string;
    let detailColor = '';
    if (relayInsight) {
      detail = `${relayInsight.summary} → ${relayInsight.prediction}`;
      detailColor = C.amber;
    } else {
      detail = msg;
    }
    if (detail && detail.length > maxDetail) {
      detail = detail.slice(0, maxDetail - 3) + '...';
    }

    let line = `     ${displayName} ${color}${icon} ${label.padEnd(15)}${reset}`;
    if (detail) line += `${detailColor}${detail}${detailColor ? reset : ''}`;
    if (durationStr) line += `  ${C.grey}(${durationStr})${reset}`;
    output += line + '\n';
  }

  // Footer
  output += '\n';
  const footerParts: string[] = [];
  if (needs > 0) footerParts.push(`${C.amber}${needs} needs attention${C.reset}`);
  if (ready > 0) footerParts.push(`${ready} done`);
  if (workingCount > 0) footerParts.push(`${C.cyan}${workingCount} working${C.reset}`);
  if (idleCount > 0) footerParts.push(`${C.grey}${idleCount} idle${C.reset}`);
  output += `  ${footerParts.join(' · ')}\n\n`;

  // Gamification footer
  if (gamificationEnabled()) {
    output += renderFooter() + '\n\n';
  }

  return output;
}

export async function cmdBoard(): Promise<void> {
  const isTTY = process.stderr.isTTY ?? false;
  const spinFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let spinIdx = 0;
  let spinner: ReturnType<typeof setInterval> | undefined;
  if (isTTY) {
    spinner = setInterval(() => {
      process.stderr.write(`\r  ${spinFrames[spinIdx++ % spinFrames.length]} scanning projects…`);
    }, 80);
  }

  const output = await buildBoardOutput();

  if (spinner) {
    clearInterval(spinner);
    process.stderr.write('\r\x1b[2K');
  }

  process.stdout.write(output);
}
