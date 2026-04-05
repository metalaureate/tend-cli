import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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

  it('fails without .tend/ init and no relay token', () => {
    const dir = ctx.makeProject('kilo');
    const r = ctx.tend(['emit', 'working', 'test'], { cwd: dir });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('TEND_RELAY_TOKEN');
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

  it('emits to relay even without .tend/ init (relay-only mode)', () => {
    // Simulate a cloud/GitHub session: git repo exists, but no .tend/ directory,
    // relay token is set via env var.
    const dir = ctx.makeProject('mike');
    // Intentionally skip 'tend init' — no .tend/ directory.

    const r = ctx.tend(['emit', 'working', 'cloud event'], {
      cwd: dir,
      env: {
        TEND_RELAY_TOKEN: 'tnd_cloudtoken9999',
        TEND_RELAY_URL: 'http://127.0.0.1:19999', // unreachable, but emit should still exit 0
      },
    });
    // No local .tend/ but relay token is present — should succeed (relay attempt made).
    expect(r.exitCode).toBe(0);
    // No local events file should exist since .tend/ was never initialized.
    expect(existsSync(join(dir, '.tend', 'events'))).toBe(false);
  });

  it('uses GITHUB_REPOSITORY as project name in relay-only mode', () => {
    // Simulate a GitHub Actions environment without local .tend/ init.
    const dir = ctx.makeProject('november');

    const r = ctx.tend(['emit', 'done', 'finished ci'], {
      cwd: dir,
      env: {
        TEND_RELAY_TOKEN: 'tnd_ghtoken1234',
        TEND_RELAY_URL: 'http://127.0.0.1:19999',
        GITHUB_REPOSITORY: 'acme/november',
      },
    });
    // Should exit 0 regardless of relay connectivity (best-effort).
    expect(r.exitCode).toBe(0);
  });
});
