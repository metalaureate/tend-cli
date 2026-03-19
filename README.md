# Tend

**Run more agents. Know when they need you.**

You want to run as many agents as possible, across every kind of work — from set-it-and-forget-it builds to hands-on development that demands your judgment at every turn. More agents means more throughput, more leverage, more of what AI actually promises.

The bottleneck isn't the agents. It's knowing when they need you — without it taking over your day.

Tend is lightweight attention infrastructure. Works with any agent framework — Copilot, Claude, Codex, or your own — on any machine, local or remote.

---

## Quick Start

```bash
cd ~/projects/my-app
tend init
```

That's it. `tend init` sets up everything: `.tend/` directory, AGENTS.md integration, shell prompt indicator, and project registry.

Now run `td` from anywhere:

```
% td                                                 ◐1 ◉1

  TEND                               Wed Mar 18, 19:08

   1. tend-cli             ◉ done           copy: drop 'conductor' thesis block  (2m ago)
   2. first100             ◌ idle           7 files changed  (46m ago)
   3. hestia               ◉ done           changes in .gitignore  (1d ago)
   4. product-discovery    ◌ idle           changes in research/20260311_120000_n...  (1d ago)
   5. dramatis-api         ◌ idle           changes in AGENTS.md  (2d ago)
   6. story-world-editor   ◌ idle           changes in .gitignore  (3d ago)

  2 done · 4 idle

  ──────────────────────────────────────────────────
  24/24h active  ·  55 done today  ·  58 this week  ·  1 open TODO
  💡 6 idle + 1 open TODO — queue overnight work?
```

```bash
td                           # the board — everything at a glance
td 1                         # drill into project 1 — session log, recent git
td #3                        # jump to project 3 in your editor

td add "migrate to Stripe"   # add a TODO to the current project
td add 3 "fix auth"          # add a TODO to project 3
td add                       # see all TODOs across all projects
```

`td` is a symlink to `tend` — use either.

---

## Install

```bash
curl -sSL https://raw.githubusercontent.com/metalaureate/tend-cli/main/install.sh | sh
```

Downloads the latest release binary for your platform (macOS arm64/x64, Linux x64/arm64). Installs to `/usr/local/bin` with a `td` symlink.

Or build from source:

```bash
git clone https://github.com/metalaureate/tend-cli && cd tend-cli
make install
```

No config files. No database. No daemon.

---

## Commands

| Command | Description |
|---|---|
| `td` | Show the board |
| `td -` | Live dashboard (auto-refreshes every minute) |
| `td <project>` | Project detail + sessions |
| `td <N>` | Project detail by board number |
| `td #<N>` | Switch to project N |
| `td init [project]` | Initialize `.tend/`, AGENTS.md, shell prompt |
| `td add [project] "msg"` | Add a TODO |
| `td add [project]` | Show & manage TODOs (enter # to remove) |
| `td switch <project>` | Focus the editor window (or `td #N`) |
| `td emit <state> "msg"` | Emit an event (used by agents, not humans) |
| `td ack [project]` | Clear done/stuck/waiting → idle |
| `td status` | Status indicator: `○` or `?N ◐N ◉N` |
| `td remove [project]` | Remove tend from a project (with confirmation) |
| `td relay <subcmd>` | Manage relay connection (see below) |

---

## How It Works

Agents emit state changes to `.tend/events` — a one-line-per-event append-only log:

```
2026-03-18T14:20:00 _cli working refactoring auth module
2026-03-18T14:45:00 _cli done refactored auth module (PR #204)
2026-03-18T14:46:00 _cli stuck tool approval needed: npm test
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

## TODOs — Super Lightweight Cross-Agent Backlog

`.tend/TODO` is a plain-text file committed to each project. Agents read it on session start; humans manage it from the terminal.

```bash
td add "fix auth regression"        # add to current project
td add my-app "refactor models"     # add to a specific project

td add                              # show all TODOs across all projects
td add my-app                       # show TODOs for one project
```

When you run `td add` with no message, you get a numbered list across every registered project:

```
TODO (my-app):
  1. fix auth regression
  2. refactor models
TODO (other-project):
  3. update deps

Enter to dismiss, or #s to remove (e.g. 1,3):
```

Type comma-separated numbers to remove completed items, or press Enter to dismiss. That's the entire interface — no boards, no drag-and-drop, no status fields.

Agents pick up TODOs automatically via the `SessionStart` lifecycle hook, which reads `.tend/TODO` and proposes backlog items to the developer. The file is just lines of text, so any agent can read or append to it.

---

## Relay — Remote Agent Support

Local agents write to `.tend/events` directly — no network, no accounts, plain text. But agents increasingly run elsewhere: Codex in the cloud, CI pipelines, SSH sessions, remote worktrees. Each environment has its own access patterns. Without a common protocol, the developer maintains per-environment solutions.

The relay is a lightweight hosted service at `relay.tend.dev`. The agent never touches it directly. The command is always the same:

```bash
tend emit working "building auth scaffold"
```

On a local machine, that writes to `.tend/events`. On a remote machine with `TEND_RELAY_TOKEN` set, the CLI posts to the relay instead. The agent's AGENTS.md instructions don't change. The developer sets a token on the remote environment and the CLI handles the rest.

### Setup

```bash
# On your laptop — one-time setup
td relay setup
# → Gets a token from relay.tend.dev
# → Stores it in ~/.tend/relay_token
# → Prints the token for you to copy

# On each remote environment — set the token
export TEND_RELAY_TOKEN="tnd_abc123..."
```

No accounts. No passwords. No signup. Just a token.

### What Happens

```bash
# Remote agent uses tend normally
tend emit working "building auth scaffold"
tend emit done "auth scaffold complete (PR #204)"

# Back on your laptop — events appear on the board
td
#   TEND                                       Wed Mar 18, 19:02
#
#   my-app               ◐ working          building auth scaffold    (3m)
#   other-project↗       ◌ idle             update deps               (2h ago)
```

Remote projects show a `↗` indicator. `td <project>` shows per-session breakdown with source tags (local vs relay).

### Relay Commands

| Subcommand | Description |
|---|---|
| `td relay setup` | Register with relay, store token in `~/.tend/relay_token` |
| `td relay status` | Show masked token, relay URL, cache info |
| `td relay pull` | Force-refresh event cache from relay |
| `td relay token` | Print raw token (for copying to remote envs) |

### Performance

- `td status` (shell prompt) reads from local cache only — never hits the network, stays under 100ms
- `td` (board) refreshes the relay cache on each invocation, then renders from cache
- No daemon. No background sync.

### The Relay is Optional

Local agents still just write to a file. If you never set up a relay token, everything works exactly the same. The relay is what makes one board possible when your agents are spread across environments.

---

## Why Tend Exists

You want to run as many agents as possible — across code, docs, ops, research — at every level of autonomy. Some run for hours unattended. Others need your judgment every few minutes. The mix changes constantly.

The unsolved problem is knowing when they need you, without that knowledge becoming a second job. Dashboards are a permanent invitation to break focus. Notification badges are interrupts. They add vigilance, not concentration.

Tend uses a different model. You stay in your train of thought. When you reach a natural stopping point — the agent is running, you've finished a thought, you need a break — you glance at the board. It shows you what needs you, what's running fine, and what's been idle. You handle what needs handling and get back to work.

The shell prompt indicator (`○` / `?N` / `◐N` / `◉N`) means you often don't even need the board. It's already in your visual field after every command. When it says `○`, nothing needs you. The uncertainty — which is what drives compulsive tab-switching — is gone.

### Design Principles

- **Pull, not push.** No notifications, no badges, no live updates. Tend speaks only when spoken to.
- **Scan, don't read.** The board is a 3-second glance. Status icons are the primary signal.
- **Act or jump.** `td add` to tee up a new task. `td switch` to jump to the right window.
- **Then disappear.** No persistent UI. No daemon. No background process.


### Lifecycle Hooks

`td init` creates `.github/hooks/tend.json`, which wires three hooks into VS Code's agent lifecycle (also compatible with Claude Code):

| Hook | What it does |
|---|---|
| `SessionStart` | Reads `.tend/TODO` and recent git history, proposes backlog items |
| `UserPromptSubmit` | Emits `working` to `.tend/events` each time the user sends a prompt |
| `Stop` | Emits `idle` to `.tend/events` when the agent session ends |

Hooks are powered by `td hook <subcommand>` — the same CLI, no separate scripts. They work anywhere `tend` is on the PATH.

The `.github/hooks/` location is loaded by default in VS Code — no settings changes needed.

---

## Releasing

Push a version tag to trigger the release workflow:

```bash
make bump              # patch version in package.json
git add -A && git commit -m "v$(jq -r .version package.json)"
git tag "v$(jq -r .version package.json)"
git push && git push --tags
```

GitHub Actions builds binaries for macOS (arm64, x64) and Linux (x64, arm64), then creates a release at `github.com/metalaureate/tend-cli/releases`. The install script pulls from the latest release.

---

## License

MIT
