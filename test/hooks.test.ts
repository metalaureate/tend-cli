import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

let ctx: TestContext;

const GIT_ENV = {
  PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
  GIT_AUTHOR_NAME: 'Test', GIT_COMMITTER_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_EMAIL: 'test@test.com',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
};

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('hooks', () => {
  it('session-start reads TODO and recent git', () => {
    const dir = ctx.makeProject('delta2');
    ctx.tend(['init'], { cwd: dir });
    appendFileSync(join(dir, '.tend', 'TODO'), 'fix the auth bug\n');
    execFileSync('git', ['add', '-A'], { cwd: dir, env: GIT_ENV });
    execFileSync('git', ['commit', '-m', 'initial', '--allow-empty', '-q'], { cwd: dir, env: GIT_ENV });
    const r = ctx.tend(['hook', 'session-start'], { cwd: dir, stdin: '{}' });
    expect(r.stdout).toContain('auth bug');
    expect(r.stdout).toContain('propose');
  });

  it('user-prompt emits working with session ID', () => {
    const dir = ctx.makeProject('echo2');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['hook', 'user-prompt'], {
      cwd: dir,
      stdin: '{"sessionId":"sess-test1"}',
    });
    const lastEvent = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').pop()!;
    expect(lastEvent).toContain('working');
    expect(lastEvent).toContain('sess-test1');
  });

  it('user-prompt handles session_id (snake_case)', () => {
    const dir = ctx.makeProject('echo3');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['hook', 'user-prompt'], {
      cwd: dir,
      stdin: '{"session_id":"sess-snake1","hook_event_name":"UserPromptSubmit"}',
    });
    const lastEvent = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').pop()!;
    expect(lastEvent).toContain('working');
    expect(lastEvent).toContain('sess-snake1');
  });

  it('stop emits idle (not done) when session was working', () => {
    const dir = ctx.makeProject('golf2');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'building feature'], { cwd: dir });
    ctx.tend(['hook', 'stop'], {
      cwd: dir,
      stdin: '{"stop_hook_active": false}',
    });
    const lastEvent = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').pop()!;
    // Stop hook should emit idle, not done — done only comes from explicit `tend emit done`
    expect(lastEvent).toContain('idle');
    expect(lastEvent).not.toContain('done');
  });

  it('user-prompt deduplicates identical prompts', () => {
    const dir = ctx.makeProject('dedup1');
    ctx.tend(['init'], { cwd: dir });
    const stdin = '{"session_id":"sess-dedup","prompt":"fix the bug"}';
    ctx.tend(['hook', 'user-prompt'], { cwd: dir, stdin });
    ctx.tend(['hook', 'user-prompt'], { cwd: dir, stdin });
    const lines = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').filter(l => l.includes('sess-dedup'));
    expect(lines).toHaveLength(1);
  });

  it('stop skips when stop_hook_active is true', () => {
    const dir = ctx.makeProject('hotel2');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'building feature'], { cwd: dir });
    const beforeCount = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').length;
    ctx.tend(['hook', 'stop'], {
      cwd: dir,
      stdin: '{"stop_hook_active": true}',
    });
    const afterCount = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').length;
    expect(afterCount).toBe(beforeCount);
  });

  it('stop includes session ID', () => {
    const dir = ctx.makeProject('hotel3');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['hook', 'stop'], {
      cwd: dir,
      stdin: '{"sessionId":"sess-stop1","stop_hook_active":false}',
    });
    const lastEvent = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').pop()!;
    expect(lastEvent).toContain('sess-stop1');
    expect(lastEvent).toContain('idle');
  });

  it('stop preserves done state', () => {
    const dir = ctx.makeProject('hotel4');
    ctx.tend(['init'], { cwd: dir });
    const ts = new Date().toISOString().slice(0, 19);
    appendFileSync(join(dir, '.tend', 'events'), `${ts} sess-done1 done feature complete\n`);
    const beforeCount = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').length;
    ctx.tend(['hook', 'stop'], {
      cwd: dir,
      stdin: '{"sessionId":"sess-done1","stop_hook_active":false}',
    });
    const afterCount = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').length;
    expect(afterCount).toBe(beforeCount);
    const lastEvent = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').pop()!;
    expect(lastEvent).toContain('done');
  });

  it('session-start does not emit events', () => {
    const dir = ctx.makeProject('papa2');
    ctx.tend(['init'], { cwd: dir });
    const beforeCount = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').filter(l => l).length;
    ctx.tend(['hook', 'session-start'], {
      cwd: dir,
      stdin: '{"sessionId":"sess-abc123","hookEventName":"SessionStart"}',
    });
    const afterCount = readFileSync(join(dir, '.tend', 'events'), 'utf-8').trim().split('\n').filter(l => l).length;
    expect(afterCount).toBe(beforeCount);
  });
});
