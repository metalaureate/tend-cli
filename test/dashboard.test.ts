import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('dashboard', () => {
  it('outputs board content in non-TTY mode', () => {
    const dir = ctx.makeProject('dash-alpha');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'testing dashboard'], { cwd: dir });
    const r = ctx.tend(['watch']);
    expect(r.stdout).toContain('TEND');
    expect(r.stdout).toContain('dash-alpha');
    expect(r.stdout).toContain('working');
    expect(r.exitCode).toBe(0);
  });

  it('shows no-projects message in non-TTY mode', () => {
    const r = ctx.tend(['watch']);
    expect(r.stdout).toContain('No tended projects');
    expect(r.exitCode).toBe(0);
  });

  it('is documented in help', () => {
    const r = ctx.tend(['help']);
    expect(r.stdout).toContain('tend watch');
    expect(r.stdout).toContain('dashboard');
  });
});
