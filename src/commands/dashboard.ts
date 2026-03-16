import { buildBoardOutput } from './board.js';
import { C } from '../ui/colors.js';

const REFRESH_SECS = 60;
const ESC = '\x1b';

function formatTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function countdown(secs: number): string {
  if (secs <= 0) return 'refreshing…';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

/** Strip ANSI escape codes to measure visible width. */
function visibleLen(s: string): number {
  return s.replace(/\x1b\[[^m]*m/g, '').length;
}

function renderHeaderLines(lastUpdated: string, secsLeft: number): string {
  const w = process.stdout.columns || 80;
  const left = `  ${C.bold}tend${C.reset} dashboard  ·  updated ${lastUpdated}  ·  next refresh in ${countdown(secsLeft)}`;
  const right = `  q to quit  `;
  const pad = Math.max(0, w - visibleLen(left) - right.length);
  const line1 = left + ' '.repeat(pad) + right;
  const divider = '─'.repeat(w);
  return line1 + '\n' + divider;
}

export async function cmdDashboard(): Promise<void> {
  const isTTY = process.stdout.isTTY ?? false;

  if (!isTTY) {
    // Non-interactive: output board once and exit
    process.stdout.write(await buildBoardOutput());
    return;
  }

  // Enter alternate screen buffer, hide cursor
  process.stdout.write(`${ESC}[?1049h${ESC}[?25l`);

  let boardContent = '';
  let lastUpdated = '--:--:--';
  let secsLeft = 0;
  let refreshing = false;
  let ticker: ReturnType<typeof setInterval> | undefined;

  function restore(): void {
    if (ticker) clearInterval(ticker);
    process.stdout.write(`${ESC}[?25h${ESC}[?1049l`);
    process.exit(0);
  }

  process.on('SIGINT', restore);
  process.on('SIGTERM', restore);

  // Handle 'q' / Ctrl+C keypress in raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (key: string) => {
      if (key === 'q' || key === 'Q' || key === '\x03') restore();
    });
  }

  /** Overwrite just the top two header lines without touching the board body. */
  function updateHeader(): void {
    const w = process.stdout.columns || 80;
    const statusLine = renderHeaderLines(lastUpdated, secsLeft).split('\n')[0];
    const divider = '─'.repeat(w);
    // Move to row 1, clear it, write status; move to row 2, clear it, write divider
    process.stdout.write(`${ESC}[1;1H${ESC}[2K${statusLine}\n${ESC}[2K${divider}`);
  }

  /** Full screen redraw: clear, write header, then board content. */
  function fullDraw(): void {
    process.stdout.write(`${ESC}[2J${ESC}[H`);
    process.stdout.write(renderHeaderLines(lastUpdated, secsLeft) + '\n');
    process.stdout.write(boardContent);
  }

  async function doRefresh(): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    try {
      boardContent = await buildBoardOutput();
      lastUpdated = formatTime(new Date());
      secsLeft = REFRESH_SECS;
      fullDraw();
    } finally {
      refreshing = false;
    }
  }

  // Initial load
  await doRefresh();

  // Ticker: count down every second, trigger refresh when it hits zero
  ticker = setInterval(() => {
    secsLeft = Math.max(0, secsLeft - 1);
    if (secsLeft === 0) {
      doRefresh().catch((err: unknown) => {
        // Surface refresh errors as a brief notice in the header area
        const msg = err instanceof Error ? err.message : String(err);
        lastUpdated = `error: ${msg.slice(0, 40)}`;
        updateHeader();
      });
    } else {
      updateHeader();
    }
  }, 1000);
}
