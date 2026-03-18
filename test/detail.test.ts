import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { appendFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('detail view', () => {
  it('shows project detail', () => {
    const dir = ctx.makeProject('romeo');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'building feature'], { cwd: dir });
    ctx.tend(['add', 'add tests'], { cwd: dir });
    const r = ctx.tend(['romeo']);
    expect(r.stdout).toContain('ROMEO');
    expect(r.stdout).toContain('building feature');
    expect(r.stdout).toContain('add tests');
  });

  it('shows per-session breakdown', () => {
    const dir = ctx.makeProject('peek-proj');
    ctx.tend(['init'], { cwd: dir });
    const now = Date.now();
    const ts1 = new Date(now - 120000).toISOString().slice(0, 19);
    const ts2 = new Date(now - 60000).toISOString().slice(0, 19);
    appendFileSync(join(dir, '.tend', 'events'), `${ts1} sess-A working building auth\n`);
    appendFileSync(join(dir, '.tend', 'events'), `${ts2} sess-B working running tests\n`);
    const r = ctx.tend(['peek-proj']);
    expect(r.stdout).toContain('PEEK-PROJ');
    expect(r.stdout).toContain('working');
    expect(r.stdout).toContain('building auth');
    expect(r.stdout).toContain('running tests');
  });
});

describe('project name resolution', () => {
  it('resolves by exact, prefix, and substring', () => {
    const dir = ctx.makeProject('my-cool-app');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'coding'], { cwd: dir });

    // Exact match
    const r1 = ctx.tend(['my-cool-app']);
    expect(r1.stdout).toContain('MY-COOL-APP');

    // Prefix match
    const r2 = ctx.tend(['my-cool']);
    expect(r2.stdout).toContain('MY-COOL-APP');

    // Substring match
    const r3 = ctx.tend(['cool-app']);
    expect(r3.stdout).toContain('MY-COOL-APP');
  });

  it('resolves numeric project reference', () => {
    const dir1 = ctx.makeProject('alpha-proj');
    ctx.tend(['init'], { cwd: dir1 });
    ctx.tend(['emit', 'working', 'building alpha'], { cwd: dir1 });
    const dir2 = ctx.makeProject('beta-proj');
    ctx.tend(['init'], { cwd: dir2 });
    ctx.tend(['emit', 'working', 'building beta'], { cwd: dir2 });

    const r1 = ctx.tend(['1']);
    expect(r1.stdout).toContain('PROJ');
    const r2 = ctx.tend(['2']);
    expect(r2.stdout).toContain('PROJ');
  });
});

describe('nested project', () => {
  it('discovers nested project via registry', () => {
    const nested = join(ctx.testDir, 'parent', 'child', 'grandchild');
    ctx.makeProject('grandchild', nested);
    ctx.tend(['init'], { cwd: nested });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('grandchild');
  });
});


