import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('version', () => {
  it('shows version string', () => {
    const r = ctx.tend(['version']);
    expect(r.stdout).toMatch(/tend 0\.\d+\.\d+/);
    expect(r.exitCode).toBe(0);
  });
});

describe('help', () => {
  it('shows usage', () => {
    const r = ctx.tend(['help']);
    expect(r.stdout).toContain('Usage:');
    expect(r.stdout).toContain('tend init');
    expect(r.stdout).toContain('tend status');
  });

  it('-h matches help', () => {
    const help = ctx.tend(['help']);
    const h = ctx.tend(['-h']);
    expect(h.stdout).toBe(help.stdout);
  });

  it('--help matches help', () => {
    const help = ctx.tend(['help']);
    const hh = ctx.tend(['--help']);
    expect(hh.stdout).toBe(help.stdout);
  });
});

describe('unknown command', () => {
  it('shows error for unknown command', () => {
    const r = ctx.tend(['nonexistent']);
    expect(r.stderr).toContain('unknown command');
    expect(r.exitCode).toBe(1);
  });
});
