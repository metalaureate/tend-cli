import { execFileSync, type ExecFileSyncOptions } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, existsSync, appendFileSync, rmSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEND_BIN = resolve(ROOT, 'bin', 'tend');

if (!existsSync(TEND_BIN)) {
  throw new Error(`Compiled binary not found at ${TEND_BIN}. Run: bun build src/cli.ts --compile --outfile bin/tend-ts`);
}

const GIT_ENV = {
  GIT_AUTHOR_NAME: 'Test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@test.com',
  GIT_COMMITTER_EMAIL: 'test@test.com',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
};

export interface TendResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface TestContext {
  testDir: string;
  home: string;
  tend: (args?: string[], opts?: TendOpts) => TendResult;
  makeProject: (name: string, dir?: string) => string;
  cleanup: () => void;
}

interface TendOpts {
  cwd?: string;
  stdin?: string;
  env?: Record<string, string>;
}

export function createTestContext(): TestContext {
  const testDir = mkdtempSync(join(tmpdir(), 'tend-test-'));
  const home = join(testDir, 'fakehome');
  mkdirSync(home, { recursive: true });
  writeFileSync(join(home, '.zshrc'), '');

  const baseEnv: Record<string, string> = {
    TEND_ROOT: testDir,
    HOME: home,
    NO_COLOR: '1',
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
    ...GIT_ENV,
  };

  function tend(args: string[] = [], opts: TendOpts = {}): TendResult {
    const mergedEnv = { ...baseEnv, ...opts.env };
    const execOpts: ExecFileSyncOptions = {
      cwd: opts.cwd || testDir,
      env: mergedEnv,
      timeout: 15000,
      encoding: 'utf-8' as const,
      stdio: ['pipe', 'pipe', 'pipe'],
    };
    if (opts.stdin !== undefined) {
      (execOpts as any).input = opts.stdin;
    }
    try {
      const stdout = execFileSync(TEND_BIN, args, execOpts) as unknown as string;
      return { stdout, stderr: '', exitCode: 0 };
    } catch (e: any) {
      return {
        stdout: e.stdout?.toString() || '',
        stderr: e.stderr?.toString() || '',
        exitCode: e.status ?? 1,
      };
    }
  }

  const gitExecEnv = {
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: home,
    ...GIT_ENV,
  };

  function makeProject(name: string, dir?: string): string {
    const projectDir = dir || join(testDir, name);
    mkdirSync(projectDir, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: projectDir, encoding: 'utf-8', env: gitExecEnv });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: projectDir, encoding: 'utf-8', env: gitExecEnv });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: projectDir, encoding: 'utf-8', env: gitExecEnv });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'initial commit', '-q'], {
      cwd: projectDir,
      encoding: 'utf-8',
      env: gitExecEnv,
    });
    return projectDir;
  }

  function cleanup() {
    try { rmSync(testDir, { recursive: true, force: true }); } catch {}
  }

  return { testDir, home, tend, makeProject, cleanup };
}
