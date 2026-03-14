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

## Why Tend Exists

AI agents take 5–30 minutes per task and frequently need human input — tool approvals, course corrections, next-task assignment. Without a signal, the developer falls into a **compulsive polling loop**: checking each project to see if its agent is done, stuck, or drifting. Not because it's time, but because they *can't know* without looking.

This polling is triggered by uncertainty, not necessity. Each check is a context switch. Each context switch degrades focus. The developer who should be spending 80% of their time in deep, expert-level work inside one project ends up spending 80% in shallow supervisory mode across many.

Every existing tool solves this by building a **dashboard** — a persistent UI with live panels, notification badges, and real-time streaming. For developers with high switching costs, this makes it worse. A dashboard is a permanent invitation to poll. A notification badge is an interrupt.

### The Departures Board

Tend uses a different metaphor: **public transit, not mission control.**

- You're on a train (deep work in one project).
- The train reaches a station (natural pause: agent is running, you've finished a thought, you need a break).
- You glance at the departures board (run `tend`).
- The board shows you: what's arrived, what's delayed, what's departing on time.
- You handle what needs handling, and get back on a train.

The shell prompt indicator (`○` / `●N`) is the bridge between "never interrupt" and "never anxious." It's already in your visual field after every command. When it says `○`, you have permission to stay deep. The uncertainty — which is what drives the polling — is gone.

### The Chef, Not the Manager

Before agents, the chef could only cook one dish at a time. Now they have extra hands at every station — but the hands need tasting notes, course corrections, and the occasional "no, not that spice." The restaurant serves almost no fixed menu; every dish is custom, called in by someone who wants something specific. The chef can't hand off judgment — they *are* the judgment.

Tend keeps track of which stations need the chef's palate right now.

It doesn't help you plan. It doesn't decompose work. It doesn't suggest what to do next. It assumes you already know — because you're the expert — and keeps track of where all the pans are on the stove so you don't burn anything while your attention is on the dish that matters most.

### Design Principles

- **Pull, not push.** No notifications, no badges, no live updates. Tend speaks only when spoken to.
- **Scan, don't read.** The board is a 3-second glance. Status icons are the primary signal.
- **Then disappear.** No persistent UI. No daemon. No background process.
- **Sub-10-second round trip.** Prompt shows `●2` → `tend` to scan → `tend switch` to jump → handle it → back to deep work.

---

## License

MIT
