import { TEND_VERSION } from '../core/config.js';

export function cmdVersion(): void {
  process.stdout.write(`tend ${TEND_VERSION}\n`);
}
