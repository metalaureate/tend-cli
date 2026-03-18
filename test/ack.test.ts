import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('ack', () => {
  it('clears done state to idle', () => {
    const dir = ctx.makeProject('india2');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'done', 'finished feature'], { cwd: dir });
    const r = ctx.tend(['ack'], { cwd: dir });
    expect(r.stdout).toContain('Acknowledged india2');
    const lastEvent = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').pop()!;
    expect(lastEvent).toContain('idle');
  });

  it('works with explicit project name', () => {
    const dir1 = ctx.makeProject('juliet2');
    const dir2 = ctx.makeProject('kilo2');
    ctx.tend(['init'], { cwd: dir1 });
    ctx.tend(['emit', 'done', 'PR ready'], { cwd: dir1 });
    ctx.tend(['init'], { cwd: dir2 });
    const r = ctx.tend(['ack', 'juliet2']);
    expect(r.stdout).toContain('Acknowledged juliet2');
    const lastEvent = readFileSync(join(dir1, '.tend', 'events'), 'utf-8').trim().split('\n').pop()!;
    expect(lastEvent).toContain('idle');
  });

  it('reduces attention count', () => {
    const dir = ctx.makeProject('lima2');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'stuck', 'need approval'], { cwd: dir });
    const before = ctx.tend(['status']);
    expect(before.stdout.trim()).toBe('?1');
    ctx.tend(['ack'], { cwd: dir });
    const after = ctx.tend(['status']);
    expect(after.stdout.trim()).toBe('○');
  });

  it('resets all sessions', () => {
    const dir = ctx.makeProject('tango2');
    ctx.tend(['init'], { cwd: dir });
    const ts = new Date().toISOString().slice(0, 19);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-1 done built auth\n`);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-2 stuck need API key\n`);
    ctx.tend(['ack'], { cwd: dir });
    const r = ctx.tend(['status']);
    expect(r.stdout.trim()).toBe('○');
  });
});

describe('multi-session', () => {
  it('aggregates multiple sessions correctly', () => {
    const dir = ctx.makeProject('romeo2');
    ctx.tend(['init'], { cwd: dir });
    const ts = new Date().toISOString().slice(0, 19);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-1 working building auth\n`);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-2 working writing tests\n`);
    const status = ctx.tend(['status']);
    expect(status.stdout.trim()).toBe('◐2');
    const board = ctx.tend([]);
    expect(board.stdout).toContain('working');
    expect(board.stdout).toContain('2 working');
  });

  it('stays working when one session finishes', () => {
    const dir = ctx.makeProject('sierra2');
    ctx.tend(['init'], { cwd: dir });
    const ts = new Date().toISOString().slice(0, 19);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-1 working building auth\n`);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-2 working writing tests\n`);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-1 done\n`);
    const r = ctx.tend([]);
    expect(r.stdout).toContain('working');
  });

  it('handles old event format (backward compat)', () => {
    const dir = ctx.makeProject('uniform2');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'old style event'], { cwd: dir });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('working');
    expect(r.stdout).toContain('old style');
  });
});
