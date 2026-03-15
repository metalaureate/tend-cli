import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('todo / add', () => {
  it('adds items', () => {
    const dir = ctx.makeProject('tango');
    ctx.tend(['init'], { cwd: dir });
    const r = ctx.tend(['add', 'refactor model layer'], { cwd: dir });
    expect(r.stdout).toContain('Added to tango/TODO');
    const content = readFileSync(join(dir, '.tend', 'TODO'), 'utf-8');
    expect(content).toContain('refactor model layer');
  });

  it('shows items when no message', () => {
    const dir = ctx.makeProject('uniform');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['add', 'item one'], { cwd: dir });
    ctx.tend(['add', 'item two'], { cwd: dir });
    const r = ctx.tend(['add', 'uniform']);
    expect(r.stdout).toContain('item one');
    expect(r.stdout).toContain('item two');
  });

  it('treats single non-project arg as message', () => {
    const dir = ctx.makeProject('whiskey2');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['add', 'refactor the auth layer'], { cwd: dir });
    const content = readFileSync(join(dir, '.tend', 'TODO'), 'utf-8');
    expect(content).toContain('refactor the auth layer');
  });
});
