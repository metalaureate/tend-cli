import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { join } from 'path';

let ctx: TestContext;

const GIT_ENV = {
  PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
  GIT_AUTHOR_NAME: 'Test', GIT_COMMITTER_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@test.com', GIT_COMMITTER_EMAIL: 'test@test.com',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
};

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

/** Format a Date as local ISO-8601 (matching tend's tsLocal format) */
function localTs(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

describe('board', () => {
  it('shows numbered projects', () => {
    const dir = ctx.makeProject('papa');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'coding'], { cwd: dir });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('papa');
    expect(r.stdout).toContain('working');
    expect(r.stdout).toContain('coding');
    expect(r.stdout).toContain('1.');
  });

  it('shows message when no projects', () => {
    const r = ctx.tend([]);
    expect(r.stdout).toContain('No tended projects');
  });

  it('marks stale working as idle', () => {
    const dir = ctx.makeProject('quebec');
    ctx.tend(['init'], { cwd: dir });
    // Write a stale event (2 hours ago)
    const staleTs = localTs(new Date(Date.now() - 2 * 3600 * 1000));
    writeFileSync(join(dir, '.tend', 'events'), `${staleTs} working old task\n`);
    const r = ctx.tend([]);
    expect(r.stdout).toContain('idle');
  });

  it('shows dirty summary for idle project', () => {
    const dir = ctx.makeProject('uniform');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'idle'], { cwd: dir });
    writeFileSync(join(dir, 'newfile.txt'), 'wip');
    const r = ctx.tend([]);
    // dirtySummary extracts a topic from changed files instead of generic "uncommitted changes"
    expect(r.stdout).toMatch(/changes in|files? changed/);
    expect(r.stdout).not.toContain('initial commit');
  });

  it('shows last commit when working tree clean', () => {
    const dir = ctx.makeProject('whiskey');
    ctx.tend(['init'], { cwd: dir });
    execFileSync('git', ['add', '-A'], { cwd: dir, env: GIT_ENV });
    execFileSync('git', ['commit', '-q', '-m', 'add tend integration'], { cwd: dir, env: GIT_ENV });
    ctx.tend(['emit', 'idle'], { cwd: dir });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('add tend integration');
    expect(r.stdout).not.toContain('uncommitted');
  });

  it('newer commit message replaces stale event message', () => {
    const dir = ctx.makeProject('xray');
    ctx.tend(['init'], { cwd: dir });
    execFileSync('git', ['add', '-A'], { cwd: dir, env: GIT_ENV });
    execFileSync('git', ['commit', '-q', '-m', 'old commit'], { cwd: dir, env: GIT_ENV });
    ctx.tend(['emit', 'done', 'old done message'], { cwd: dir });
    // Make a newer commit after the done event
    writeFileSync(join(dir, 'feature.txt'), 'new work');
    execFileSync('git', ['add', '-A'], { cwd: dir, env: GIT_ENV });
    // Sleep to ensure newer timestamp
    execFileSync('sleep', ['1']);
    execFileSync('git', ['commit', '-q', '-m', 'newer commit after done'], { cwd: dir, env: GIT_ENV });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('newer commit after done');
    expect(r.stdout).not.toContain('old done message');
  });

  it('sorts projects by most recent first', () => {
    const dir1 = ctx.makeProject('aaa-old');
    const dir2 = ctx.makeProject('zzz-new');
    ctx.tend(['init'], { cwd: dir1 });
    // Old event
    const oldTs = localTs(new Date(Date.now() - 2 * 3600 * 1000));
    writeFileSync(join(dir1, '.tend', 'events'), `${oldTs} working old task\n`);
    ctx.tend(['init'], { cwd: dir2 });
    ctx.tend(['emit', 'working', 'new task'], { cwd: dir2 });
    const r = ctx.tend([]);
    const lines = r.stdout.split('\n');
    const posNew = lines.findIndex(l => l.includes('zzz-new'));
    const posOld = lines.findIndex(l => l.includes('aaa-old'));
    expect(posNew).toBeLessThan(posOld);
  });

  it('shows dirty summary for done project that went idle', () => {
    const dir = ctx.makeProject('victor');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'done', 'finished task'], { cwd: dir });
    ctx.tend(['emit', 'idle'], { cwd: dir });
    writeFileSync(join(dir, 'newfile.txt'), 'wip');
    const r = ctx.tend([]);
    expect(r.stdout).toMatch(/changes in|files? changed/);
  });

  it('infers waiting when idle after working without done', () => {
    const dir = ctx.makeProject('wait-infer');
    ctx.tend(['init'], { cwd: dir });
    const ts = localTs(new Date());
    // working → idle with no done in between → should infer waiting
    writeFileSync(join(dir, '.tend', 'events'),
      `${ts} sess1 working building feature\n${ts} sess1 idle session ended\n`);
    const r = ctx.tend([]);
    // The project line should show waiting, not idle
    const projectLine = r.stdout.split('\n').find(l => l.includes('wait-infer'));
    expect(projectLine).toContain('waiting');
    expect(projectLine).not.toContain('idle');
  });

  it('demotes stale waiting to idle', () => {
    const dir = ctx.makeProject('wait-stale');
    ctx.tend(['init'], { cwd: dir });
    // Write events 2 hours ago → waiting should expire to idle
    const staleTs = localTs(new Date(Date.now() - 2 * 3600 * 1000));
    writeFileSync(join(dir, '.tend', 'events'),
      `${staleTs} sess1 working building feature\n${staleTs} sess1 idle session ended\n`);
    const r = ctx.tend([]);
    expect(r.stdout).toContain('idle');
  });

  it('stays idle when done precedes idle', () => {
    const dir = ctx.makeProject('done-clean');
    ctx.tend(['init'], { cwd: dir });
    const ts = localTs(new Date());
    // working → done → idle → clean completion, stays idle
    writeFileSync(join(dir, '.tend', 'events'),
      `${ts} sess1 working building\n${ts} sess1 done finished\n${ts} sess1 idle session ended\n`);
    const r = ctx.tend([]);
    expect(r.stdout).toContain('idle');
  });

  it('shows sessions from multiple users on board', () => {
    const dir = ctx.makeProject('bravo-iso');
    ctx.tend(['init'], { cwd: dir });

    // User alice emits working
    execFileSync('git', ['config', 'user.email', 'alice@example.com'], { cwd: dir, env: GIT_ENV });
    ctx.tend(['emit', 'working', 'feature work'], { cwd: dir });

    // User bob emits done
    execFileSync('git', ['config', 'user.email', 'bob@example.com'], { cwd: dir, env: GIT_ENV });
    ctx.tend(['emit', 'done', 'bug fixed'], { cwd: dir });

    // Board must show the highest-priority aggregated state
    // (working > done), proving alice's session is still visible
    const r = ctx.tend([]);
    expect(r.stdout).toContain('working');
  });

  it('user ack does not clear other users\' sessions', () => {
    const dir = ctx.makeProject('charlie-iso');
    ctx.tend(['init'], { cwd: dir });

    // User alice emits done
    execFileSync('git', ['config', 'user.email', 'alice@example.com'], { cwd: dir, env: GIT_ENV });
    ctx.tend(['emit', 'done', 'feature done'], { cwd: dir });

    // User bob emits working
    execFileSync('git', ['config', 'user.email', 'bob@example.com'], { cwd: dir, env: GIT_ENV });
    ctx.tend(['emit', 'working', 'still working'], { cwd: dir });

    // Alice acks — should only clear alice's session
    execFileSync('git', ['config', 'user.email', 'alice@example.com'], { cwd: dir, env: GIT_ENV });
    ctx.tend(['ack'], { cwd: dir });

    // Bob's working state should be preserved
    execFileSync('git', ['config', 'user.email', 'bob@example.com'], { cwd: dir, env: GIT_ENV });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('working');
  });
});
