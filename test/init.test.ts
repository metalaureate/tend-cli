import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

let ctx: TestContext;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEND_BIN = join(ROOT, 'bin', 'tend');

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

  it('AGENTS.md includes relay instructions with TEND_RELAY_TOKEN', () => {
    const dir = ctx.makeProject('bravo3');
    ctx.tend(['init'], { cwd: dir });
    const content = readFileSync(join(dir, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('TEND_RELAY_TOKEN');
    expect(content).toContain('tend relay debug');
    expect(content).toContain('Relay');
  });

  it('updates stale AGENTS.md block missing relay instructions', () => {
    const dir = ctx.makeProject('bravo4');
    const agentsFile = join(dir, 'AGENTS.md');
    // Simulate an old AGENTS.md block that has the marker and "always emit when you finish"
    // but lacks relay instructions
    writeFileSync(agentsFile, '## Tend Integration\n\n**IMPORTANT: always emit when you finish** a task.\n');
    ctx.tend(['init'], { cwd: dir });
    const content = readFileSync(agentsFile, 'utf-8');
    expect(content).toContain('TEND_RELAY_TOKEN');
    expect(content).toContain('tend relay debug');
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
    expect(content).toContain(`${TEND_BIN} hook session-start`);
    expect(content).not.toContain('"command": "tend hook session-start"');
  });

  it('updates stale .github/hooks/tend.json commands on rerun', () => {
    const dir = ctx.makeProject('charlie3');
    const hooksDir = join(dir, '.github', 'hooks');
    require('fs').mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'tend.json'), JSON.stringify({
      hooks: {
        SessionStart: [{ type: 'command', command: 'tend hook session-start' }],
        UserPromptSubmit: [{ type: 'command', command: 'tend hook user-prompt' }],
        Stop: [{ type: 'command', command: 'tend hook stop' }],
      },
    }, null, 2));

    ctx.tend(['init'], { cwd: dir });

    const content = readFileSync(join(hooksDir, 'tend.json'), 'utf-8');
    expect(content).toContain(`${TEND_BIN} hook session-start`);
    expect(content).not.toContain('"command": "tend hook session-start"');
  });

  it('creates .claude/settings.local.json with hooks', () => {
    const dir = ctx.makeProject('claude1');
    ctx.tend(['init'], { cwd: dir });
    const claudeFile = join(dir, '.claude', 'settings.local.json');
    expect(existsSync(claudeFile)).toBe(true);
    const content = readFileSync(claudeFile, 'utf-8');
    expect(content).toContain('SessionStart');
    expect(content).toContain(`${TEND_BIN} hook`);
  });

  it('merges hooks into existing .claude/settings.local.json', () => {
    const dir = ctx.makeProject('claude2');
    const claudeDir = join(dir, '.claude');
    require('fs').mkdirSync(claudeDir, { recursive: true });
    require('fs').writeFileSync(join(claudeDir, 'settings.local.json'), JSON.stringify({ permissions: { allow: ['Read'] } }, null, 2));
    ctx.tend(['init'], { cwd: dir });
    const content = JSON.parse(readFileSync(join(claudeDir, 'settings.local.json'), 'utf-8'));
    expect(content.hooks).toBeDefined();
    expect(content.hooks.SessionStart).toBeDefined();
    expect(content.permissions.allow).toContain('Read');
    expect(content.hooks.SessionStart[0].command).toContain(`${TEND_BIN} hook session-start`);
  });

  it('updates stale Claude hook commands while preserving other settings', () => {
    const dir = ctx.makeProject('claude3');
    const claudeDir = join(dir, '.claude');
    require('fs').mkdirSync(claudeDir, { recursive: true });
    require('fs').writeFileSync(join(claudeDir, 'settings.local.json'), JSON.stringify({
      permissions: { allow: ['Read'] },
      hooks: {
        SessionStart: [{ type: 'command', command: 'tend hook session-start' }],
      },
    }, null, 2));

    ctx.tend(['init'], { cwd: dir });

    const content = JSON.parse(readFileSync(join(claudeDir, 'settings.local.json'), 'utf-8'));
    expect(content.permissions.allow).toContain('Read');
    expect(content.hooks.SessionStart[0].command).toContain(`${TEND_BIN} hook session-start`);
    expect(content.hooks.UserPromptSubmit[0].command).toContain(`${TEND_BIN} hook user-prompt`);
    expect(content.hooks.Stop[0].command).toContain(`${TEND_BIN} hook stop`);
  });

  it('fails without git repo', () => {
    const dir = join(ctx.testDir, 'no-git');
    require('fs').mkdirSync(dir, { recursive: true });
    const result = ctx.tend(['init'], { cwd: dir });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('not a git repository');
    expect(result.stderr).toContain('companion to git');
  });
});
