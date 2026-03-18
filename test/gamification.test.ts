import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { writeFileSync, appendFileSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function nowTs(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

describe('gamification', () => {
  it('is shown on the board by default', () => {
    const dir = ctx.makeProject('gami-alpha');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'coding away'], { cwd: dir });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('working');
    expect(r.stdout).toContain('done today');
  });

  it('TEND_NO_GAMIFICATION=1 suppresses gamification', () => {
    const dir = ctx.makeProject('gami-beta');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'coding away'], { cwd: dir });
    const r = ctx.tend([], { env: { TEND_NO_GAMIFICATION: '1' } });
    expect(r.stdout).not.toContain('done today');
  });

  it('counts today done events', () => {
    const dir = ctx.makeProject('gami-gamma');
    ctx.tend(['init'], { cwd: dir });
    const today = todayStr();
    writeFileSync(join(dir, '.tend', 'events'), [
      `${today}T10:00:00 done finished task one`,
      `${today}T11:00:00 done finished task two`,
      `${today}T12:00:00 working on next task`,
    ].join('\n') + '\n');
    const r = ctx.tend([]);
    expect(r.stdout).toContain('2 done today');
  });

  it('shows active hours and utilization level', () => {
    const dir = ctx.makeProject('gami-delta');
    ctx.tend(['init'], { cwd: dir });
    const ts = nowTs();
    writeFileSync(join(dir, '.tend', 'events'), [
      `${ts} sess1 working on something`,
      `${ts} sess1 done completed something`,
    ].join('\n') + '\n');
    const r = ctx.tend([]);
    expect(r.stdout).toContain('/24h active');
    expect(r.stdout).toMatch(/warm|humming|full burn/);
  });

  it('shows working for working agents', () => {
    const dir = ctx.makeProject('gami-zeta');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'building feature'], { cwd: dir });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('working');
  });

  it('shows idle when no agents active', () => {
    const dir = ctx.makeProject('gami-eta');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'idle'], { cwd: dir });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('idle');
  });

  it('counts open TODOs', () => {
    const dir = ctx.makeProject('gami-theta');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['add', 'fix the login bug'], { cwd: dir });
    ctx.tend(['add', 'add unit tests'], { cwd: dir });
    ctx.tend(['emit', 'working', 'coding'], { cwd: dir });
    const r = ctx.tend([]);
    expect(r.stdout).toContain('2 open TODOs');
  });

  it('shows waiting for waiting agents', () => {
    const dir = ctx.makeProject('gami-epsilon');
    ctx.tend(['init'], { cwd: dir });
    const old = new Date(Date.now() - 20 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    const oldTs = `${old.getFullYear()}-${pad(old.getMonth() + 1)}-${pad(old.getDate())}T${pad(old.getHours())}:${pad(old.getMinutes())}:${pad(old.getSeconds())}`;
    writeFileSync(join(dir, '.tend', 'events'), `${oldTs} waiting blocked on review\n`);
    const r = ctx.tend([]);
    expect(r.stdout).toContain('waiting');
  });

});

