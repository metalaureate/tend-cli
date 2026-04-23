import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('clear', () => {
  it('clears local events file', () => {
    const dir = ctx.makeProject('myproj');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'working', 'on stuff'], { cwd: dir });
    
    const eventsFile = join(dir, '.tend', 'events');
    expect(existsSync(eventsFile)).toBe(true);
    const before = readFileSync(eventsFile, 'utf-8');
    expect(before).toContain('working');
    
    const r = ctx.tend(['clear'], { cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Cleared');
    
    // Events file should be empty or reset
    const after = readFileSync(eventsFile, 'utf-8');
    expect(after).not.toContain('working');
  });

  it('clears by project name', () => {
    const dir = ctx.makeProject('myproj');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['emit', 'done', 'finished task'], { cwd: dir });
    
    const r = ctx.tend(['clear', 'myproj']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Cleared');
  });

  it('reports no events when events file missing', () => {
    const dir = ctx.makeProject('emptyproj');
    ctx.tend(['init'], { cwd: dir });
    // No emit — just the init, which doesn't create events
    
    const r = ctx.tend(['clear', 'emptyproj']);
    // Should either say "No events" or succeed cleanly
    expect(r.exitCode).toBe(0);
  });

  it('handles relay-only project name gracefully without relay', () => {
    // A project name that doesn't exist locally — without relay token it should still not crash
    const r = ctx.tend(['clear', 'ghost-project-name']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('No events to clear');
  });
});
