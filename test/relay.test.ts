import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('relay', () => {
  it('shows usage when no subcommand', () => {
    const r = ctx.tend(['relay']);
    expect(r.stdout).toContain('setup');
    expect(r.stdout).toContain('pull');
  });

  it('shows not configured when no token', () => {
    const r = ctx.tend(['relay', 'status']);
    expect(r.stdout).toContain('not configured');
  });

  it('board shows relay-only projects from cache', () => {
    const dir = ctx.makeProject('local-proj');
    ctx.tend(['init'], { cwd: dir });
    writeFileSync(join(dir, '.tend', 'events'), '2026-03-14T14:00:00 working building\n');

    // Create relay cache with a relay-only project
    const cacheDir = join(ctx.home, '.tend', 'relay_cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'remote-proj'), '2026-03-14T14:10:00 working remote task\n');

    const r = ctx.tend([]);
    expect(r.stdout).toContain('local-proj');
    expect(r.stdout).toContain('remote-proj');
  });

  it('status counts relay cache projects', () => {
    // Create relay cache with a done project
    const cacheDir = join(ctx.home, '.tend', 'relay_cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'remote-done'), '2026-03-14T14:10:00 done task complete\n');

    const r = ctx.tend(['status']);
    expect(r.stdout).toContain('◉1');
  });

  it('detail shows both local and relay sessions', () => {
    const dir = ctx.makeProject('mixed-proj');
    ctx.tend(['init'], { cwd: dir });
    writeFileSync(join(dir, '.tend', 'events'), '2026-03-14T14:00:00 local-sess working local task\n');

    const cacheDir = join(ctx.home, '.tend', 'relay_cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'mixed-proj'), '2026-03-14T14:05:00 cloud-sess working cloud task\n');

    const r = ctx.tend(['mixed-proj']);
    expect(r.stdout).toContain('local task');
    expect(r.stdout).toContain('cloud task');
    expect(r.stdout).toContain('↗');
  });

  it('project state merges local and relay events', () => {
    const dir = ctx.makeProject('merge-proj');
    ctx.tend(['init'], { cwd: dir });
    writeFileSync(join(dir, '.tend', 'events'), '2026-03-14T14:00:00 local-sess working local work\n');

    const cacheDir = join(ctx.home, '.tend', 'relay_cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'merge-proj'), '2026-03-14T14:05:00 cloud-sess stuck need approval\n');

    const r = ctx.tend(['status']);
    // stuck is needs-attention, should show ?
    expect(r.stdout).toContain('?');
  });
});
