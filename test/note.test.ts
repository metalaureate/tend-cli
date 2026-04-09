import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('note', () => {
  it('sets a note file in .tend/', () => {
    const dir = ctx.makeProject('alpha');
    ctx.tend(['init'], { cwd: dir });

    const r = ctx.tend(['note', 'check the auth flow'], { cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('note: check the auth flow');

    const noteFile = join(dir, '.tend', 'note');
    expect(existsSync(noteFile)).toBe(true);
    expect(readFileSync(noteFile, 'utf-8').trim()).toBe('check the auth flow');
  });

  it('clears the note with --clear', () => {
    const dir = ctx.makeProject('bravo');
    ctx.tend(['init'], { cwd: dir });

    ctx.tend(['note', 'temporary note'], { cwd: dir });
    expect(existsSync(join(dir, '.tend', 'note'))).toBe(true);

    const r = ctx.tend(['note', '--clear'], { cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('note cleared');
    expect(existsSync(join(dir, '.tend', 'note'))).toBe(false);
  });

  it('emit clears the note automatically', () => {
    const dir = ctx.makeProject('charlie');
    ctx.tend(['init'], { cwd: dir });

    ctx.tend(['note', 'will be cleared'], { cwd: dir });
    expect(existsSync(join(dir, '.tend', 'note'))).toBe(true);

    ctx.tend(['emit', 'working', 'new task'], { cwd: dir });
    expect(existsSync(join(dir, '.tend', 'note'))).toBe(false);
  });

  it('note shows on the board instead of message', () => {
    const dir = ctx.makeProject('delta');
    ctx.tend(['init'], { cwd: dir });

    ctx.tend(['emit', 'working', 'coding stuff'], { cwd: dir });
    ctx.tend(['note', 'review PR #42'], { cwd: dir });

    const board = ctx.tend([], { cwd: dir });
    expect(board.stdout).toContain('» review PR #42');
    expect(board.stdout).not.toContain('coding stuff');
  });

  it('shows usage on no args', () => {
    const dir = ctx.makeProject('echo');
    ctx.tend(['init'], { cwd: dir });

    const r = ctx.tend(['note'], { cwd: dir });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('Usage');
  });

  it('fails outside a tended project', () => {
    const dir = ctx.makeProject('foxtrot');
    // no init
    const r = ctx.tend(['note', 'something'], { cwd: dir });
    expect(r.exitCode).toBe(1);
    expect(r.stderr).toContain('not inside a tended project');
  });
});
