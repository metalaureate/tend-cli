import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

let ctx: TestContext;

beforeEach(() => { ctx = createTestContext(); });
afterEach(() => { ctx.cleanup(); });

describe('remove', () => {
  it('removes .tend/ directory with --yes', () => {
    const dir = ctx.makeProject('alpha');
    ctx.tend(['init'], { cwd: dir });
    expect(existsSync(join(dir, '.tend'))).toBe(true);

    const r = ctx.tend(['remove', '--yes'], { cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(dir, '.tend'))).toBe(false);
    expect(r.stdout).toContain('Removed .tend/');
  });

  it('removes AGENTS.md when it only has tend content', () => {
    const dir = ctx.makeProject('bravo');
    ctx.tend(['init'], { cwd: dir });
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(true);

    ctx.tend(['remove', '--yes'], { cwd: dir });
    expect(existsSync(join(dir, 'AGENTS.md'))).toBe(false);
  });

  it('preserves non-tend content in AGENTS.md', () => {
    const dir = ctx.makeProject('charlie');
    const agentsFile = join(dir, 'AGENTS.md');
    writeFileSync(agentsFile, '# My Rules\nBe helpful.\n');
    ctx.tend(['init'], { cwd: dir });
    expect(readFileSync(agentsFile, 'utf-8')).toContain('Tend Integration');

    ctx.tend(['remove', '--yes'], { cwd: dir });
    expect(existsSync(agentsFile)).toBe(true);
    const content = readFileSync(agentsFile, 'utf-8');
    expect(content).toContain('My Rules');
    expect(content).not.toContain('Tend Integration');
  });

  it('removes .github/hooks/tend.json', () => {
    const dir = ctx.makeProject('delta');
    ctx.tend(['init'], { cwd: dir });
    expect(existsSync(join(dir, '.github', 'hooks', 'tend.json'))).toBe(true);

    ctx.tend(['remove', '--yes'], { cwd: dir });
    expect(existsSync(join(dir, '.github', 'hooks', 'tend.json'))).toBe(false);
  });

  it('unregisters from ~/.tend/projects', () => {
    const dir = ctx.makeProject('echo-proj');
    ctx.tend(['init'], { cwd: dir });
    const registry = join(ctx.home, '.tend', 'projects');
    expect(readFileSync(registry, 'utf-8')).toContain('echo-proj');

    ctx.tend(['remove', '--yes'], { cwd: dir });
    expect(readFileSync(registry, 'utf-8')).not.toContain('echo-proj');
  });

  it('requires confirmation without --yes', () => {
    const dir = ctx.makeProject('foxtrot');
    ctx.tend(['init'], { cwd: dir });

    // Provide 'n' via stdin
    const r = ctx.tend(['remove'], { cwd: dir, stdin: 'n\n' });
    expect(r.stdout).toContain('Cancelled');
    expect(existsSync(join(dir, '.tend'))).toBe(true);
  });

  it('accepts y confirmation', () => {
    const dir = ctx.makeProject('golf');
    ctx.tend(['init'], { cwd: dir });

    const r = ctx.tend(['remove'], { cwd: dir, stdin: 'y\n' });
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(dir, '.tend'))).toBe(false);
  });

  it('accepts project name argument', () => {
    const dir = ctx.makeProject('hotel');
    ctx.tend(['init'], { cwd: dir });

    const r = ctx.tend(['remove', 'hotel', '--yes']);
    expect(r.exitCode).toBe(0);
    expect(existsSync(join(dir, '.tend'))).toBe(false);
  });

  it('fails if no .tend/ exists', () => {
    const dir = ctx.makeProject('india');
    const r = ctx.tend(['remove', '--yes'], { cwd: dir });
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('no .tend/');
  });
});
