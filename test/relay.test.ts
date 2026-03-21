import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestContext, type TestContext } from './helpers.js';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
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

  it('debug shows not configured when no token', () => {
    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Token:      not configured');
    expect(r.stdout).toContain('No relay sessions seen yet.');
  });

  it('debug shows session count from relay cache', () => {
    const cacheDir = join(ctx.home, '.tend', 'relay_cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'proj-a'), '2026-03-14T14:00:00 agent-1 working doing stuff\n');
    writeFileSync(join(cacheDir, 'proj-b'), '2026-03-14T14:05:00 agent-2 done finished\n2026-03-14T14:10:00 agent-1 idle\n');

    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Projects:   2');
    expect(r.stdout).toContain('Sessions:   2');
    expect(r.stdout).toContain('agent-1');
    expect(r.stdout).toContain('agent-2');
  });

  it('debug shows zero sessions when cache has no session ids', () => {
    const cacheDir = join(ctx.home, '.tend', 'relay_cache');
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, 'old-proj'), '2026-03-14T14:00:00 working legacy event\n');

    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Projects:   1');
    expect(r.stdout).toContain('Sessions:   0');
    expect(r.stdout).toContain('No relay sessions seen yet.');
  });

  it('debug shows configured token when relay token is set', () => {
    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'abcdef1234567890');

    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Token:      configured');
    expect(r.stdout).toContain('abcdef12');
    expect(r.stdout).toContain('Token src:  file');
    expect(r.stdout).toContain("tend relay link");
  });

  it('debug shows env token source when TEND_RELAY_TOKEN env var is set', () => {
    const r = ctx.tend(['relay', 'debug'], { env: { TEND_RELAY_TOKEN: 'tnd_envtoken1234' } });
    expect(r.stdout).toContain('Token:      configured');
    expect(r.stdout).toContain('Token src:  env (TEND_RELAY_TOKEN)');
    expect(r.stdout).not.toContain('cloud agents need TEND_RELAY_TOKEN');
  });

  it('debug performs live relay check when token is configured', () => {
    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'abcdef1234567890');

    // Point to a local port that is not listening so the connection fails fast
    const r = ctx.tend(['relay', 'debug'], { env: { TEND_RELAY_URL: 'http://127.0.0.1:19999' } });
    expect(r.stdout).toContain('Checking relay...');
    expect(r.stdout).toContain('Relay:      ✗');
  });

  it('debug skips live relay check when no token configured', () => {
    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).not.toContain('Checking relay...');
    expect(r.stdout).toContain('No relay sessions seen yet.');
  });

  it('debug shows none token source when no token configured', () => {
    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Token src:  none');
  });

  it('debug shows emit mode as local when no token', () => {
    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Emit mode:  local');
  });

  it('debug shows emit mode as relay when file token is configured', () => {
    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'abcdef1234567890');

    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Emit mode:  relay →');
  });

  it('debug shows emit mode as relay when env token is configured', () => {
    const r = ctx.tend(['relay', 'debug'], { env: { TEND_RELAY_TOKEN: 'tnd_envtoken1234' } });
    expect(r.stdout).toContain('Emit mode:  relay →');
  });

  it('debug shows session id when TEND_SESSION_ID is set', () => {
    const r = ctx.tend(['relay', 'debug'], { env: { TEND_SESSION_ID: 'my-agent-42' } });
    expect(r.stdout).toContain('Session ID: my-agent-42');
  });

  it('debug shows session id as not set when TEND_SESSION_ID is not set', () => {
    const r = ctx.tend(['relay', 'debug']);
    expect(r.stdout).toContain('Session ID: not set');
  });

  it('usage includes debug subcommand', () => {
    const r = ctx.tend(['relay']);
    expect(r.stdout).toContain('debug');
  });

  it('usage includes link subcommand', () => {
    const r = ctx.tend(['relay']);
    expect(r.stdout).toContain('link');
  });

  it('relay link writes token to project .tend directory', () => {
    const dir = ctx.makeProject('link-proj');
    ctx.tend(['init'], { cwd: dir });

    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'tnd_globaltoken123');

    const r = ctx.tend(['relay', 'link'], { cwd: dir });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('Token written to');
    expect(r.stdout).toContain('.tend/relay_token');

    const written = readFileSync(join(dir, '.tend', 'relay_token'), 'utf-8').trim();
    expect(written).toBe('tnd_globaltoken123');
  });

  it('relay link fails when no token configured', () => {
    const dir = ctx.makeProject('link-notoken-proj');
    const r = ctx.tend(['relay', 'link'], { cwd: dir });
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain("relay setup");
  });

  it('relay link fails when not in a git project', () => {
    // testDir has no .git, so detectProject returns null
    const r = ctx.tend(['relay', 'link'], {
      env: { TEND_RELAY_TOKEN: 'tnd_sometoken123' },
    });
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('not inside a git project');
  });

  it('debug reads token from project-level .tend/relay_token', () => {
    const dir = ctx.makeProject('proj-token-proj');
    mkdirSync(join(dir, '.tend'), { recursive: true });
    writeFileSync(join(dir, '.tend', 'relay_token'), 'tnd_projtoken456');

    const r = ctx.tend(['relay', 'debug'], { cwd: dir });
    expect(r.stdout).toContain('Token:      configured');
    expect(r.stdout).toContain('tnd_proj');
    expect(r.stdout).toContain('Token src:  file');
    expect(r.stdout).toContain('.tend/relay_token');
  });

  it('debug shows no hint when project file token is configured', () => {
    const dir = ctx.makeProject('proj-nohint-proj');
    mkdirSync(join(dir, '.tend'), { recursive: true });
    writeFileSync(join(dir, '.tend', 'relay_token'), 'tnd_projtoken789');

    const r = ctx.tend(['relay', 'debug'], { cwd: dir });
    expect(r.stdout).not.toContain("tend relay link");
  });

  it('project-level relay token takes precedence over global token', () => {
    const dir = ctx.makeProject('priority-proj');
    mkdirSync(join(dir, '.tend'), { recursive: true });
    writeFileSync(join(dir, '.tend', 'relay_token'), 'tnd_projecttoken');

    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'tnd_globaltoken');

    const r = ctx.tend(['relay', 'debug'], { cwd: dir });
    expect(r.stdout).toContain('tnd_proj');
    expect(r.stdout).not.toContain('tnd_glob');
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

  it('relay status shows board URL when token is configured', () => {
    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'tnd_statustoken1234');

    const r = ctx.tend(['relay', 'status']);
    expect(r.stdout).toContain('Board URL:');
    expect(r.stdout).toContain('10.cx/tnd_statustoken1234');
  });

  it('relay token shows board URL', () => {
    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'tnd_tokentoken5678');

    const r = ctx.tend(['relay', 'token']);
    expect(r.stdout).toContain('Board URL:');
    expect(r.stdout).toContain('10.cx/tnd_tokentoken5678');
  });

  it('relay debug shows board URL when token is configured', () => {
    const tendDir = join(ctx.home, '.tend');
    mkdirSync(tendDir, { recursive: true });
    writeFileSync(join(tendDir, 'relay_token'), 'tnd_debugtoken9999');

    const r = ctx.tend(['relay', 'debug'], { env: { TEND_RELAY_URL: 'http://127.0.0.1:19999' } });
    expect(r.stdout).toContain('Board URL:');
    expect(r.stdout).toContain('10.cx/tnd_debugtoken9999');
  });

  it('emit dual-writes to local when relay token is set but relay unreachable', () => {
    const dir = ctx.makeProject('dual-write-proj');
    ctx.tend(['init'], { cwd: dir });

    // Point to unreachable relay, events should still land locally
    ctx.tend(['emit', 'working', 'local task'], {
      cwd: dir,
      env: { TEND_RELAY_URL: 'http://127.0.0.1:19999', TEND_RELAY_TOKEN: 'tnd_sometoken' },
    });

    const events = require('fs').readFileSync(join(dir, '.tend', 'events'), 'utf-8');
    expect(events).toContain('working');
    expect(events).toContain('local task');
  });
});
