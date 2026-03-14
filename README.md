# Tend

**A pull-based CLI for developers running multiple AI agents.**

*What's running? What needs me?*

---

## Quick Start

```bash
cd ~/projects/my-app
tend init
```

That's it. `tend init` sets up everything: `.tend/` directory, AGENTS.md integration, shell prompt indicator, and project registry.

Now run `tend` from anywhere:

```
TEND                               Thu Mar 13, 14:32

◐ my-app               working        building auth scaffold (3m)
○ other-project         idle           update deps (2h ago)

0 needs you · 1 working · 1 idle
```

```bash
tend my-app          # drill into a project
tend todo "fix auth"  # queue work for the agent
tend switch my-app   # focus the editor window
```

---

## Install

```bash
git clone <repo-url> && cd tend-cli
make install
```

No config files. No database. No daemon.

---

## Commands

| Command | Description |
|---|---|
| `tend` | Show the departures board |
| `tend <project>` | Drill into a project |
| `tend init [project]` | Initialize `.tend/`, AGENTS.md, shell prompt |
| `tend todo [project] "msg"` | Add a TODO (no message = show TODOs) |
| `tend switch <project>` | Focus the editor window |
| `tend sync [project]` | Generate a reconciliation prompt |
| `tend emit <state> "msg"` | Emit an event (used by agents, not humans) |
| `tend status` | Status indicator: `○` or `●N` |

---

## How It Works

Agents emit state changes to `.tend/events` — a one-line-per-event append-only log:

```
2026-03-13T14:20:00 working refactoring narrative engine
2026-03-13T14:45:00 done refactored narrative engine (PR #204)
2026-03-13T14:46:00 stuck tool approval needed: npm test
```

Five states: `working`, `done`, `stuck`, `waiting`, `idle`.

`tend init` adds the protocol to your project's AGENTS.md so agents emit automatically. For projects without events, tend falls back to `git log` to infer activity.

If a `working` event is older than 30 minutes, the project shows as `unknown` (configurable via `TEND_STALE_THRESHOLD`).

### File Structure

```
.tend/
├── events    # Append-only event log (gitignored)
└── TODO      # Ordered backlog (committed)
```

Plain text. ISO 8601 timestamps. No YAML, no JSON.

---

## Design Philosophy

- **Pull, not push.** No notifications, no badges, no live updates.
- **Scan, don't read.** The board is a 3-second glance.
- **Then disappear.** No persistent UI. No daemon. No background process.

---

## License

MIT
