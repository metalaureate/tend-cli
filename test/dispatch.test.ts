import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('dispatch', () => {
  it('prints error when relay is not configured', () => {
    const dir = ctx.makeProject('dispatch-test');
    ctx.tend(['init'], { cwd: dir });
    const r = ctx.tend(['dispatch'], { cwd: dir });
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('relay not configured');
  });

  it('shows help for dispatch in help output', () => {
    const r = ctx.tend(['help']);
    expect(r.stdout).toContain('dispatch');
    expect(r.stdout).toContain('Pick a TODO');
  });

  it('shows relay share in help output', () => {
    const r = ctx.tend(['help']);
    expect(r.stdout).toContain('share');
  });
});
