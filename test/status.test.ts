import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('status', () => {
  it('shows ◐N when only working agents', () => {
    const dir = ctx.makeProject('lima');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'building'], { cwd: dir });
    const r = ctx.tend(['status']);
    expect(r.stdout.trim()).toBe('◐1');
  });

  it('shows per-state icons for done/stuck', () => {
    const dir1 = ctx.makeProject('mike');
    const dir2 = ctx.makeProject('november');
    ctx.tend(['init'], { cwd: dir1 });
    ctx.tend(['emit', 'done', 'PR ready'], { cwd: dir1 });
    ctx.tend(['init'], { cwd: dir2 });
    ctx.tend(['emit', 'stuck', 'approval needed'], { cwd: dir2 });
    const r = ctx.tend(['status']);
    expect(r.stdout).toContain('?1');
    expect(r.stdout).toContain('◉1');
  });

  it('shows ◐N for working (not attention)', () => {
    const dir = ctx.makeProject('oscar');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'building'], { cwd: dir });
    const r = ctx.tend(['status']);
    expect(r.stdout.trim()).toBe('◐1');
  });

  it('shows ○ when no active projects', () => {
    const r = ctx.tend(['status']);
    expect(r.stdout.trim()).toBe('○');
  });
});
