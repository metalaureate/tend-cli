import { config } from '../core/config.js';

const isTTY = process.stdout.isTTY ?? false;
const useColors = isTTY && !config.noColor;

function code(ansi: string): string {
  return useColors ? ansi : '';
}

export const C = {
  reset: code('\x1b[0m'),
  bold: code('\x1b[1m'),
  dim: code('\x1b[2m'),
  amber: code('\x1b[33m'),
  cyan: code('\x1b[36m'),
  green: code('\x1b[32m'),
  red: code('\x1b[31m'),
  grey: code('\x1b[90m'),
};

// For `tend status` which outputs to a prompt context — uses stderr TTY check
export function statusColors() {
  const use = !config.noColor && (process.stderr.isTTY || config.forceColor);
  const c = (ansi: string) => use ? ansi : '';
  return {
    reset: c('\x1b[0m'),
    red: c('\x1b[31m'),
    cyan: c('\x1b[36m'),
    green: c('\x1b[32m'),
  };
}
