import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('init', () => {
  it('creates .tend/ directory with events and TODO', () => {
    const dir = ctx.makeProject('alpha');
    ctx.tend(['init'], { cwd: dir });
    expect(existsSync(join(dir, '.tend', 'events'))).toBe(true);
    expect(existsSync(join(dir, '.tend', 'TODO'))).toBe(true);
  });

  it('creates AGENTS.md with tend integration', () => {
    const dir = ctx.makeProject('bravo');
    ctx.tend(['init'], { cwd: dir });
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);
    const content = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('Tend Integration');
    expect(content).toContain('tend emit');
    expect(content).toContain('.tend/events');
  });

  it('appends to existing AGENTS.md', () => {
    const dir = ctx.makeProject('charlie');
    const agentsFile = join(dir, 'AGENTS.md');
    require('fs').writeFileSync(agentsFile, '# My Agent Rules\nBe nice.\n');
    ctx.tend(['init'], { cwd: dir });
    const content = readFileSync(agentsFile, 'utf-8');
    expect(content).toContain('My Agent Rules');
    expect(content).toContain('Tend Integration');
  });

  it('is idempotent for AGENTS.md', () => {
    const dir = ctx.makeProject('delta');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['init'], { cwd: dir });
    const content = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    const count = (content.match(/Tend Integration/g) || []).length;
    expect(count).toBe(1);
  });

  it('registers project in ~/.tend/projects', () => {
    const dir = ctx.makeProject('echo-proj');
    ctx.tend(['init'], { cwd: dir });
    const registry = join(ctx.home, '.tend', 'projects');
    expect(existsSync(registry)).toBe(true);
    const content = readFileSync(registry, 'utf-8');
    expect(content).toContain(dir);
  });

  it('does not duplicate registry entry', () => {
    const dir = ctx.makeProject('foxtrot');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['init'], { cwd: dir });
    const content = readFileSync(join(ctx.home, '.tend', 'projects'), 'utf-8');
    const count = content.split('\n').filter(l => l.includes(dir)).length;
    expect(count).toBe(1);
  });

  it('adds shell integration to .zshrc', () => {
    const dir = ctx.makeProject('golf');
    ctx.tend(['init'], { cwd: dir });
    const zshrc = readFileSync(join(ctx.home, '.zshrc'), 'utf-8');
    expect(zshrc).toContain('_tend_precmd');
    expect(zshrc).toContain('RPROMPT');
  });

  it('shell integration is idempotent', () => {
    const dir = ctx.makeProject('hotel');
    ctx.tend(['init'], { cwd: dir });
    ctx.tend(['init'], { cwd: dir });
    const zshrc = readFileSync(join(ctx.home, '.zshrc'), 'utf-8');
    const count = (zshrc.match(/Tend status indicator/g) || []).length;
    expect(count).toBe(1);
  });

  it('gitignores machine-local files', () => {
    const dir = ctx.makeProject('bravo2');
    ctx.tend(['init'], { cwd: dir });
    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
    expect(gitignore).toContain('.tend/events');
    expect(gitignore).toContain('.tend/hook_debug.log');
    expect(gitignore).not.toContain('.github/hooks/');
    expect(gitignore).toContain('.scratch/');
  });

  it('removes stale .github/hooks/ gitignore entry', () => {
    const dir = ctx.makeProject('bravo2b');
    require('fs').appendFileSync(join(dir, '.gitignore'), '.github/hooks/\n');
    ctx.tend(['init'], { cwd: dir });
    const gitignore = readFileSync(join(dir, '.gitignore'), 'utf-8');
    expect(gitignore).not.toContain('.github/hooks/');
  });

  it('creates .github/hooks/tend.json', () => {
    const dir = ctx.makeProject('charlie2');
    ctx.tend(['init'], { cwd: dir });
    const hooksFile = join(dir, '.github', 'hooks', 'tend.json');
    expect(existsSync(hooksFile)).toBe(true);
    const content = readFileSync(hooksFile, 'utf-8');
    expect(content).toContain('SessionStart');
    expect(content).toContain('UserPromptSubmit');
    expect(content).toContain('Stop');
  });
});
