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

### Shell Prompt Setup (the anxiety killer)

Add the Tend indicator to your shell prompt. It shows `○` when nothing needs you and `●N` when N projects need attention — no polling required.

```bash
# zsh — add to ~/.zshrc
PROMPT='%~ $(tend prompt) %# '

# bash — add to ~/.bashrc
export PS1='\w $(tend prompt) \$ '
```

### Configuration

```bash
# Set your projects root (default: ~/projects)
export TEND_ROOT=~/projects

# Optional: short alias
alias td="tend"
```

No config files. No database. No daemon.

---

## Quick Start

```bash
# Initialize tend in a project
cd ~/projects/my-app
tend init

# Tell tend what you're working on
tend emit working "building auth scaffold"

# Check the board from anywhere
tend
#   TEND                               Thu Mar 13, 14:32
#
#   ◐ my-app               agent working  building auth scaffold (3m)
#   ○ other-project         idle           last commit: update deps (2h ago)
#
#   0 needs you · 1 working · 1 idle

# Drill into a project
tend my-app

# Queue a message for an agent
tend say my-app "when you're done, pick up the token bridge FAQ next"

# Capture a TODO
tend todo "refactor the model layer"

# Log a completion
tend done "shipped v2.1 to TestFlight"

# Jump to a project's VSCode window
tend switch my-app
```

---

## Commands

| Command | Description |
|---|---|
| `tend` | Show the departures board — all projects at a glance |
| `tend <project>` | Drill into a project — recent events, TODOs, notes |
| `tend init [project]` | Initialize `.tend/` directory in a project |
| `tend emit <state> "msg"` | Emit an event: `working`, `done`, `stuck`, `waiting`, `idle` |
| `tend prompt` | Shell prompt indicator: `○` or `●N` |
| `tend say <project> "msg"` | Queue a message for an agent |
| `tend todo [project] "msg"` | Add a TODO (no message = show TODOs) |
| `tend done [project] "msg"` | Log a completion |
| `tend note [project] "msg"` | Capture a note or decision |
| `tend switch <project>` | Focus the VSCode window for a project (macOS) |
| `tend approve <project>` | Approve a stuck agent's pending request |
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

Any agent can emit events. Add this to your project's `AGENTS.md`:

```markdown
## Tend Integration

On startup, read `.tend/queue` for queued instructions. Execute them, then clear the file.
Read `.tend/TODO` for the current backlog and `.tend/NOTES` for project context.

Emit state changes:
- `tend emit working "<what you're starting>"`
- `tend emit done "<summary of what you completed>"`
- `tend emit stuck "<what you need from the human>"`
- `tend emit idle` (when finished and waiting for assignment)
```

---

## File Structure

```
project-root/
├── .tend/
│   ├── events    # Append-only event log (the core protocol)
│   ├── queue     # Messages from `tend say` (consumed by agent)
│   ├── TODO      # Ordered backlog
│   ├── DONE      # Timestamped completions
│   └── NOTES     # Context, decisions, lessons
```

All files are plain text. Timestamps use ISO 8601. No YAML, no JSON.

---

## How It Works

**Three detection layers**, in priority order:

1. **Event protocol** — `tail -1 .tend/events` gives precise, agent-reported state
2. **Git fallback** — `git log` infers activity for projects without events
3. **Process detection** — (planned) detect running agent processes

Projects with no `.tend/` directory still appear on the board via git fallback.

**`tend prompt` is events-only.** No git, no network, no process checks. It reads the last line of each project's events file and counts needs-attention states. Must complete in under 100ms.

---

## Design Philosophy

- **Pull, not push.** Tend never interrupts. No notifications, no badges, no live updates.
- **Scan, don't read.** The board is designed for a 3-second glance.
- **Then disappear.** No persistent UI. No daemon. No background process.

---

## License

MIT
