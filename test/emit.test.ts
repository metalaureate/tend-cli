import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('emit', () => {
  it('accepts all valid states', () => {
    const dir = ctx.makeProject('india');
    ctx.tend(['init'], { cwd: dir });

    for (const state of ['working', 'done', 'stuck', 'waiting', 'idle']) {
      ctx.tend(['emit', state, `test ${state}`], { cwd: dir });
    }

    const events = readFileSync(join(dir, '.tend', 'events'), 'utf-8');
    const lines = events.trim().split('\n');
    expect(lines.length).toBe(5);
    expect(lines[lines.length - 1]).toContain('idle test idle');
  });

  it('rejects invalid state', () => {
    const dir = ctx.makeProject('juliet');
    ctx.tend(['init'], { cwd: dir });

    const r1 = ctx.tend(['emit', 'running', 'test'], { cwd: dir });
    expect(r1.exitCode).toBe(1);

    const r2 = ctx.tend(['emit', 'error', 'test'], { cwd: dir });
    expect(r2.exitCode).toBe(1);
  });

  it('fails without .tend/ init', () => {
    const dir = ctx.makeProject('kilo');
    const r = ctx.tend(['emit', 'working', 'test'], { cwd: dir });
    expect(r.exitCode).toBe(1);
  });
});
