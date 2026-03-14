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
| `tend say <project> "msg"` | Send a message to an agent without switching |
| `tend sync [project]` | Generate a reconciliation prompt |
| `tend emit <state> "msg"` | Emit an event (used by agents, not humans) |
| `tend ack [project]` | Clear done/stuck/waiting → idle |
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
├── queue     # Inbound messages from the developer (gitignored)
└── TODO      # Ordered backlog (committed)
```

Plain text. ISO 8601 timestamps. No YAML, no JSON.

---

## Why Tend Exists

Builders today are less like lone coders and more like a master blacksmith tending an ever-growing workshop of agents — or a head chef running a large kitchen of cooks. The scarce resource isn't code. It's the attention of the person in charge.

Every tool for managing these agents builds a dashboard. Live panels, notification badges, real-time streaming. They assume agents run autonomously and you check in when they're done.

Some do. But the reality is a distribution. On any given day you might have two or three projects where you're actively collaborating with an agent — steering it every 5-15 minutes, reviewing its work, making judgment calls on tricky details inside a large codebase. A couple more where you're grooming a spec or a plan, kicking off revisions and checking back when the agent has a new draft for you to review. Another two where the agent can run for longer stretches before it needs you. And a couple more — cloud refactors, test suites, research jobs, or agents running actual lines of business such as customer support or sales — that might run for hours and only need you if they get stuck.

As AI agents and tooling improves, five simultaneous projects will become ten, then twenty — expanding into all roles — to fill the only truly scarce resource: the attention of the person in charge, the one responsible for success and failure.

The unsolved problem is attention management: the projects where you and the agent are working together at varying cadences, and you need to stay in your train of thought while still being reachable by the others. A dashboard doesn't help here. It's a permanent invitation to break focus. A notification badge is an interrupt. They add vigilance, not concentration.

This isn't just an efficiency problem. The builder's span of control shrinks. Five projects that could be ten. And the constant low-grade anxiety of not knowing what's happening elsewhere becomes chronic.

### The Departures Board

Tend uses a different model. You stay in your train of thought. When you reach a natural stopping point — the agent is running, you've finished a thought, you need a break — you glance at the departures board. It shows you what needs you, what's running fine, and what's been idle. You handle what needs handling and get back to work.

That's `tend`. One command, one glance, then back.

The shell prompt indicator (`○` / `●N`) means you often don't even need the board. It's already in your visual field after every command. When it says `○`, nothing needs you. The uncertainty — which is what drives compulsive project-switching — is gone.

### Design Principles

- **Pull, not push.** No notifications, no badges, no live updates. Tend speaks only when spoken to.
- **Scan, don't read.** The board is a 3-second glance. Status icons are the primary signal.
- **Act or jump.** `tend todo` to tee up a new task. `tend switch` to jump to the right window,
- **Then disappear.** No persistent UI. No daemon. No background process.


### `tend say` — Talk to Agents Without Switching

`tend say my-app "try the auth approach from PR #192"` sends a message to the agent on another project without leaving your current train of thought. The message lands in `.tend/queue`, and the agent picks it up at its next stopping point.

With VS Code agent hooks or Claude Code hooks, delivery is automatic — the agent sees queued messages the moment it finishes its current turn. `tend init` generates the hook configuration at `.github/hooks/tend.json`.

### Lifecycle Hooks

`tend init` creates `.github/hooks/tend.json`, which wires three hooks into VS Code's agent lifecycle (also compatible with Claude Code):

| Hook | What it does |
|---|---|
| `SessionStart` | Reads `.tend/queue` and `.tend/TODO`, injects them as context |
| `PostToolUse` | Checks `.tend/queue` for new messages mid-session |
| `Stop` | Emits `idle` to `.tend/events` when the agent finishes |

Hooks are powered by `tend hook <subcommand>` — the same CLI, no separate scripts. They work anywhere `tend` is on the PATH.

The `.github/hooks/` location is loaded by default in VS Code — no settings changes needed.

## Coming Soon

### `tend relay` — Remote Agent Support

Local agents write to `.tend/events` directly — no network, no accounts, plain text. But agents increasingly run elsewhere: Codex in the cloud, CI pipelines, SSH sessions, remote worktrees. Each is a different environment with its own access patterns. Without a common protocol, the developer is back to maintaining per-environment solutions.

The relay is a lightweight hosted service — but the agent never touches it directly. The command is always the same:

```bash
tend emit working "building auth scaffold"
```

On a local machine, that writes to `.tend/events`. On a remote machine with `TEND_RELAY_TOKEN` set, the CLI posts to `relay.tend.dev` instead. The agent's AGENTS.md instructions don't change. The developer sets a token on the remote environment and the CLI handles the rest.

`tend` pulls relay events alongside local `.tend/events` files. The board doesn't change. The shell prompt doesn't change. `ps` doesn't care where the process is running — neither does tend.

The relay is optional. Local agents still just write to a file. But when your agents are spread across environments, the relay is what makes one board possible.

---

## License

MIT
