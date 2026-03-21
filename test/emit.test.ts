import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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

  it('uses relay when relay_token file is configured', () => {
    const dir = ctx.makeProject('lima');
    ctx.tend(['init'], { cwd: dir });

    // Write a relay token file (pointing to an unreachable URL so it falls back to local)
    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'tnd_filetoken1234');

    const r = ctx.tend(['emit', 'working', 'relayed event'], {
      cwd: dir,
      env: { TEND_RELAY_URL: 'http://127.0.0.1:19999' },
    });
    // Relay attempt was made (fell back to local on connection error) — process exits 0
    // and the local events file has the event written as fallback
    expect(r.exitCode).toBe(0);
    const events = readFileSync(join(dir, '.tend', 'events'), 'utf-8');
    expect(events).toContain('relayed event');
  });
});
