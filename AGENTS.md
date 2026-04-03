## Tend Integration

This project uses Tend for workflow coordination.

### Command Resolution

- For automated lifecycle hooks, use the executable path written into `.github/hooks/tend.json` or `.claude/settings.local.json`.
- Do not assume `tend` is on PATH inside non-interactive shells spawned by editors or agents.
- If you need to emit manually and `tend` is unavailable, append directly to `.tend/events` as documented below.

### On Startup

1. Read `.tend/TODO` to understand the current backlog.

### Emitting State Changes

- `tend emit working "<description>"` — automatically emitted by hooks on each prompt, but emit manually when switching tasks.
- `tend emit done "<summary>"` — **IMPORTANT: always emit when you finish a task.** This is the primary signal that work completed.
- `tend emit stuck "<what you need>"` — emit when you cannot proceed without human input (e.g., need a decision, credentials, access, or clarification).
- `tend emit waiting "<what you're waiting for>"` — emit when blocked on an external dependency (e.g., CI, deployment, API response).

> **Relay**: If `TEND_RELAY_TOKEN` is set in your bash environment, `tend emit` posts events to the relay so the developer sees them on their board. Verify with:
> ```bash
> echo "TEND_RELAY_TOKEN=${TEND_RELAY_TOKEN:-NOT SET}"
> tend relay debug
> ```

If `tend` is not on PATH, append directly:
```bash
echo "$(date +%Y-%m-%dT%H:%M:%S) ${TEND_SESSION_ID:-_cli} done <summary>" >> .tend/events
```

### On Completion

- Emit `tend emit done "<summary of what you accomplished>"` before going idle.
- If there are items in `.tend/TODO`, note the next item but wait for the developer to assign it.

## Testing

Run the test suite before committing any changes to the `tend` script:

```bash
make test
```

This writes full output to `.scratch/test_results.txt` and prints the summary.

- Tests use isolated temp directories — no impact on real projects or shell config.
- If you add a new command or change behavior, add a corresponding test file under `test/` (e.g. `test/myfeature.test.ts`).
- Tests are written in TypeScript using [Vitest](https://vitest.dev/).
- Tests should be self-contained: each test calls `createTestContext()` in `beforeEach` and `ctx.cleanup()` in `afterEach`.
- Use Vitest's built-in assertions: `expect(x).toBe(y)`, `expect(x).toContain(y)`, `expect(x).toMatch(/pattern/)`, etc.
- See `test/helpers.ts` for the `createTestContext()` helper and the `TestContext` interface.

## Terminal Output (VS Code)

VS Code's integrated terminal swallows stdout. **Always** redirect output to a workspace file and read it back with `read_file`:

```bash
npx vitest run > .scratch/tests.txt 2>&1; echo "EXIT:$?" >> .scratch/tests.txt
```

Then use the `read_file` tool on `.scratch/tests.txt` to see results. Tests take ~45 seconds — use a 120-second timeout.

**Never do these — output will be lost:**
- Read terminal output directly (it gets swallowed)
- Use `cat`, `tail`, `head`, or `grep` in the terminal to view the file
- Pipe output (`| tail`, `| tee`)
- Chain `sleep` commands to wait (they get interrupted)
- Write to `/tmp` (requires manual approval each time)

**One command, one `read_file` — that's it.**
