# Tend

**A pull-based CLI for developers running multiple AI agents.**

*`ps` for cognitive work. What's running? What needs me?*

---

## Install

```bash
# Clone and install
git clone <repo-url> && cd tend-cli
make install

# Or just copy the script
cp tend /usr/local/bin/tend
```

No config files. No database. No daemon.

---

## Quick Start

```bash
# Initialize tend in a project (sets up .tend/, AGENTS.md, shell prompt)
cd ~/projects/my-app
tend init

# Check the board from anywhere
tend
#   TEND                               Thu Mar 13, 14:32
#
#   ◐ my-app               working        building auth scaffold (3m)
#   ○ other-project         idle           update deps (2h ago)
#
#   0 needs you · 1 working · 1 idle

# Drill into a project
tend my-app

# Capture a TODO
tend todo "refactor the model layer"

# Jump to a project's editor window
tend switch my-app
```

---

## Commands

| Command | Description |
|---|---|
| `tend` | Show the departures board — all projects at a glance |
| `tend <project>` | Drill into a project — recent events, TODOs |
| `tend init [project]` | Initialize `.tend/`, configure AGENTS.md and shell prompt |
| `tend emit <state> "msg"` | Emit an event: `working`, `done`, `stuck`, `waiting`, `idle` |
| `tend status` | Status indicator: `○` or `●N` |
| `tend todo [project] "msg"` | Add a TODO (no message = show TODOs) |
| `tend switch <project>` | Focus the editor window for a project |
| `tend sync [project]` | Generate a reconciliation prompt (pipe to agent or clipboard) |

---

## The Event Protocol

Tend's core is a one-line-per-event append-only log at `.tend/events`:

```
2026-03-13T14:20:00 working refactoring narrative engine
2026-03-13T14:45:00 done refactored narrative engine (PR #204)
2026-03-13T14:46:00 stuck tool approval needed: npm test
```

Five states: `working`, `done`, `stuck`, `waiting`, `idle`.

`tend init` automatically adds the event protocol to your project's `AGENTS.md`, so agents know how to emit state changes.

---

## What `tend init` Does

1. Creates `.tend/` with `events` and `TODO` files
2. Adds a `## Tend Integration` block to your project's `AGENTS.md` (creates it if missing, appends if it exists, skips if already present)
3. Adds `.tend/events` to `.gitignore` (events are local state, TODO is committed)
4. Registers the project in `~/.tend/projects` for board discovery
5. Adds a shell prompt indicator (`○` / `●N`) to your zshrc or bashrc

---

## File Structure

```
project-root/
├── .tend/
│   ├── events    # Append-only event log (gitignored)
│   └── TODO      # Ordered backlog (committed)
```

All files are plain text. Timestamps use ISO 8601. No YAML, no JSON.

---

## How It Works

**Two detection layers**, in priority order:

1. **Event protocol** — `tail -1 .tend/events` gives precise, agent-reported state
2. **Git fallback** — `git log` infers activity for projects without events

**Staleness detection:** If a `working` event is older than 30 minutes (configurable via `TEND_STALE_THRESHOLD`), the project shows as `unknown` instead.

**`tend status` is events-only.** No git, no network, no process checks. It reads the last line of each project's events file and counts needs-attention states. Must complete in under 100ms.

---

## Design Philosophy

- **Pull, not push.** Tend never interrupts. No notifications, no badges, no live updates.
- **Scan, don't read.** The board is designed for a 3-second glance.
- **Then disappear.** No persistent UI. No daemon. No background process.

---

## License

MIT
