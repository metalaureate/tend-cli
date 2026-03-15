# Tend

**A pull-based CLI for developers running multiple AI agents.**

*`ps` for cognitive work. What's running? What needs me?*

---

## The Problem

AI coding agents have created a new cognitive bottleneck that no existing tool addresses correctly.

Expert developers — people who work inside large, established codebases and use agents as prosthetic extensions of their own judgment — now routinely run 4-8 concurrent projects. Each project has one or more AI agents (Copilot, Claude Code, Codex, etc.) executing tasks: building features, running refactors, working through bugs, doing research.

The developer's optimal state is deep immersion in a single project. But because agents take 5-30 minutes per task and frequently need human input (tool approvals, course corrections, next-task assignment), the developer is pulled into a **compulsive polling loop**: checking each project to see if its agent is done, stuck, or drifting off course.

This polling behavior is:

- **Triggered by uncertainty, not necessity.** The developer checks because they *can't know* agent state from their current terminal. There is no signal. The absence of information creates anxiety, and the anxiety creates the check.
- **Self-reinforcing.** Each check is a context switch. Each context switch degrades focus. Degraded focus makes deep work harder, which makes polling feel more productive by comparison. The developer ends up project-managing instead of building.
- **Disproportionately expensive for certain cognitive profiles.** Developers with high-inertia focus patterns (including those with ADHD, dyslexia, or similar neurodivergent profiles) pay an outsized cost per context switch. Their focus operates like a freight train — powerful but expensive to stop and restart. Polling forces dozens of stops per day.

The result: developers who should be spending 80% of their time in deep, expert-level work inside one project are instead spending 80% of their time in shallow supervisory mode across many projects. Throughput goes up (more things moving), but *quality and satisfaction collapse*.

### Why This Matters Now

This problem didn't exist before 2025. Unix process management tells you if something is running or dead. But "is my AI agent done with its cognitive task and does it need my judgment to continue?" is a semantic question that sits above process state. The entire developer tooling ecosystem — from tmux to IDE extensions — was built for a world where the human was always the one doing the work.

### What Exists Today

The market has noticed the multi-agent coordination problem but is solving it wrong. Every existing tool builds a **dashboard** — a push-model interface that shows real-time agent state:

- **Mozzie** — desktop GUI to orchestrate multiple agents from a single workspace
- **1Code** — Electron wrapper managing Claude Code + Codex with a unified GUI
- **Agent View** — tmux session manager with real-time status and notifications
- **CLI Manager** — single dashboard for multiple CLI agents
- **Warp** — terminal with built-in multi-agent management
- **VSCode Agent Sessions** — unified view of local, background, and cloud sessions

All of these are **mission control**. They assume the developer wants to *watch* their agents work. They provide live panels, notification badges, real-time streaming, visual progress indicators.

For the developer we're designing for, these tools make the problem worse. A dashboard is a permanent invitation to poll. A notification badge is an interrupt. A live-updating panel is a tmux layout with better typography — it still pulls your eye to movement and breaks flow.

---

## The Insight

**The developer doesn't need a dashboard. They need a departures board they only look at when they walk into the station.**

The metaphor is public transit, not mission control:

- You're on a train (deep work in one project).
- The train reaches a station (natural pause: agent is running, you've finished a thought, you need a break).
- You step onto the platform and glance at the departures board (run one command).
- The board shows you: what's arrived (agents done), what's delayed (agents stuck), what's departing (agents running fine).
- You handle what needs handling — approve a tool request, steer an agent, assign a next task.
- You get back on a train.

**Key properties:**

1. **Pull, not push.** The tool never interrupts. No notifications. No badges. No live updates. It speaks only when spoken to.
2. **Ambient certainty.** A single glyph in your shell prompt (`○` / `●N`) tells you whether anything needs attention. You never have to wonder. The uncertainty — which is what drives compulsive polling — is gone.
3. **Single command, any terminal.** You don't navigate to a project to check its status. You run `tend` from wherever you are and see everything.
4. **Scan, don't read.** The output is designed for a 3-second glance. What needs me? What's fine? What's done? The answer should be visually obvious without reading sentences.
5. **Act inline or jump precisely.** Some things can be handled from where you are — queue a message with `tend say`, assign a next task with `tend add`. When you do need to go to a project, `tend switch` takes you directly to the right VSCode window and Space. No hunting. No guessing.
6. **Then disappear.** The tool has no persistent UI. No daemon. No background process. It runs, shows you the state, and exits.

---

## The User

Tend is for a specific developer profile:

- **Expert, not novice.** They know their codebases deeply. They don't need agents to plan — they need agents to execute while they focus elsewhere. The analogy is a chef running a kitchen, not a project manager reading Gantt charts.
- **Craftsman, not supervisor.** Their best work happens in long, uninterrupted sessions of deep engagement with code. Managing agents is overhead they tolerate, not their job.
- **Multiple concurrent projects.** Typically 4-8, with 2-3 getting active attention on any given day and the rest being tended periodically. Projects vary from multi-week builds to research spikes to personal side projects.
- **VSCode + terminal native.** They work in VSCode with AI agents running in integrated terminals or via CLI tools. They are comfortable with the command line but don't want to live in a tmux grid.
- **High switching cost.** Whether due to neurodivergent wiring or simply the nature of complex work, context switches are expensive. Every unnecessary switch reduces output quality.

Tend is *not* for developers who:

- Are building greenfield toy projects where the entire codebase fits in context
- Use heavy upfront planning and task decomposition before any agent runs
- Want real-time visibility into agent execution as a primary workflow
- Need multi-user collaboration features (this is a single-developer tool)

---

## Architecture

### Agent State Detection

Tend needs to know what each agent is doing without requiring the developer to manually log status.

**Event protocol (primary).** Agents emit single-line events to `.tend/events`. One line, one state change. The format is minimal and universal:

```
2026-03-13T14:20:00 working refactoring narrative engine
2026-03-13T14:45:00 done refactored narrative engine (PR #204)
2026-03-13T14:46:00 stuck tool approval needed: npm test
```

Five states: `working`, `done`, `stuck`, `waiting`, `idle`.

That's the entire protocol. Any agent, in any runtime, can emit this. A single line in AGENTS.md — "when you change what you're doing, append a line to `.tend/events` in the format `timestamp state message`" — is enough. Tend reads the last line per project to determine current status.

The event protocol is also the foundation for Tend as infrastructure. Other tools can consume the same events. The format is intentionally simple enough to become a standard.

For agents that can't or won't emit events, two fallback layers provide degraded but functional awareness:

**Git-based inference (fallback).** Most agent work produces git artifacts. Tend reads git state to infer activity:

- New commits on a feature branch since last check → agent has been working
- PR opened or updated → agent completed a unit of work
- CI passing/failing → work is verified or needs attention
- No new commits for >N minutes on an active branch → agent may be stuck or waiting

**Process-based inference (secondary fallback).** For agents running as local processes:

- Process running → agent is active
- Process exited → agent finished or crashed
- Process waiting for input (stdin) → agent needs approval or guidance

The three layers are complementary. The event protocol gives precise, reliable state. Git inference works for any agent without configuration. Process detection adds real-time awareness for local agents. A project with all three gets the richest status; a project with none still appears on the board (as "unknown — no signal").

### Project Discovery

Tend auto-discovers projects. Configuration is minimal:

- `TEND_ROOT` env var (default: `~/projects`) — directory containing project subdirectories
- Each subdirectory with a `.git` directory is a project
- Optional `.tend/config` per project for overrides (agent type, branch naming conventions, etc.)

No global config file. No setup wizard. No database.

### Data Flow

```
[Agent runtimes]          [Git repos]           [Status files]
       |                      |                       |
       v                      v                       v
   process state          git log/status          file contents
       |                      |                       |
       +----------+-----------+----------+------------+
                  |
            Tend CLI
                  |
         Aggregated view
                  |
              Developer
           (when they ask)
```

---

## Commands

### `tend` (or `td`)

The primary command. Run it anywhere. Shows the departures board.

```
$ tend

  TEND                               Thu Mar 13, 14:32

  ● tari-universe        agent done     PR #847 ready for review
  ◐ fable                agent working  refactoring narrative engine (12m)
  ⊘ social-scanner       agent stuck    tool approval needed
  ◐ hestia               agent working  building auth scaffold (3m)
  ○ dead-internet        idle           last: updated landing copy (2h ago)
  ○ clawzempic           idle           last: benchmark suite passing (1d ago)

  1 needs you · 1 ready for review · 2 working · 2 idle
```

Design principles for this output:

- **Status icons are the primary signal.** ● = needs you (done/ready), ◐ = working (leave it alone), ⊘ = stuck (needs you), ○ = idle (ignore). A 1-second glance at the left column tells you everything.
- **Color reinforces icons.** Needs-you states in amber/yellow. Working in blue/cyan. Idle in dim/grey.
- **One line per project.** Never wraps. Never expands. If you need detail, you ask for it.
- **Summary footer.** "1 needs you" — the only number that matters.
- **Duration/recency gives context.** "12m" tells you the agent is mid-task. "2h ago" tells you nothing is happening. "1d ago" tells you this project is cold.

### `tend <project>` (or `td <project>`)

Drill into one project. Shows recent activity, current agent state, and actionable items.

```
$ tend fable

  FABLE                               ◐ agent working

  Current: refactoring narrative engine
  Started: 14:20 (12 minutes ago)
  Branch:  feat/narrative-refactor
  Commits: 3 since start

  Recent:
    14:20  agent started refactoring narrative engine
    13:45  PR #203 merged (onboarding flow fix)
    13:10  agent completed onboarding flow fix
    11:30  you: "focus on the state machine transitions"

  TODO:
    1. Add ADHD-friendly prompt templates
    2. Revisit token usage on long journals

  Notes:
    Always test prompt changes against 10 real journals before shipping
```

### `tend say <project> "message"`

Queue a message for an agent without switching to its terminal. The message is appended to the project's tend file, which the agent reads on its next cycle.

```
$ tend say tari "when you're done with the dashboard, pick up the token bridge FAQ next"
✓ Queued for tari-universe
```

This is the "shout across the kitchen" command. You don't walk over to the agent's terminal. You leave a note.

### `tend add "message"` / `tend add <project> "message"`

Capture a thought. If you're inside a project directory, it auto-detects. If not, specify the project.

```
$ tend add "refactor the model layer"
✓ Added to fable/TODO

$ tend add hestia "research Supabase vs Firebase for auth"
✓ Added to hestia/TODO
```

### `tend done "message"` / `tend done <project> "message"`

Log a completion. Can also be written by agents.

```
$ tend done "shipped v2.1 to TestFlight"
✓ Logged to fable/DONE
```

### `tend note "message"` / `tend note <project> "message"`

Capture context, a decision, a lesson — anything the agent (or future you) should know.

```
$ tend note "the old API returns dates as strings, not timestamps — don't trust the types"
✓ Added to tari-universe/NOTES
```

### `tend approve <project>`

If an agent is waiting for tool approval, approve it from wherever you are. (Implementation depends on agent runtime — may require IPC with the agent process, or may write to a file the agent polls.)

```
$ tend approve tari
⊘ tari-universe: agent wants to run `npm test` — approve? [y/n]
```

### `tend sync <project>`

Generate a reconciliation prompt. Reviews git history against TODO/DONE and produces a structured prompt you can pipe to an agent to clean up drift.

```
$ tend sync fable | pbcopy
✓ Sync prompt copied to clipboard (pipe to your agent)
```

### `tend switch <project>` (or `td sw <project>`)

The return half of the round trip. The board tells you what needs attention. Switch takes you there.

```
$ tend switch fable
▶ Focused: fable (VSCode)
```

On macOS, this uses AppleScript to find the VSCode window whose title contains the project name, bring it to front, and switch Spaces if needed. The developer doesn't hunt through Ctrl-Down, the Window menu, or a grid of identical VSCode icons. They type the project name and they're looking at it.

```bash
# What tend switch does internally (macOS):
osascript -e '
tell application "Visual Studio Code"
    activate
    set targetWindow to first window whose name contains "fable"
    set index of targetWindow to 1
end tell'
```

This is critical for the sub-10-second station stop. The full cycle is:

1. Prompt shows `●2` → something needs you
2. `tend` → scan the board (2 seconds)
3. `tend switch tari` → you're looking at the project (1 second)
4. Handle whatever needs handling
5. `tend switch fable` → back to your deep work project (1 second)

Without this, the developer falls back to the exact behavior Tend is trying to eliminate: Ctrl-Down, scan a wall of window thumbnails, guess which one is which, click. That's the context-switch tax. `tend switch` is a named jump, not a visual search.

### `tend init <project>`

Set up tend files for a new project. Creates `.tend/` directory with events, TODO, DONE, NOTES files.

### `tend emit <state> "message"`

Emit an event to the current project's event log. This is the command agents call (via AGENTS.md instructions) to report state changes. Also usable by the developer.

```
$ tend emit working "refactoring narrative engine"
$ tend emit done "refactored narrative engine (PR #204)"
$ tend emit stuck "tool approval needed: npm test"
```

States: `working`, `done`, `stuck`, `waiting`, `idle`.

This is the write side of the event protocol. `tend` (the board) is the read side. They communicate through a single file (`.tend/events`), which means the agent emitting events and the developer reading them never need to be in the same terminal, the same process, or even the same tool.

### Shell Prompt Indicator

The most important anti-polling feature in Tend. A single glyph in your shell prompt that shows whether anything across all projects needs your attention:

```bash
# Nothing needs you — stay on the train
~/projects/fable main ○ $

# Two projects need attention — check when you're ready
~/projects/fable main ●2 $
```

This is the bridge between "never interrupt" and "never anxious." The indicator is:

- **Already in your visual field.** You see your prompt after every command. Zero cost to glance at it.
- **One bit of information.** Not "which project" or "what's wrong" — just "something needs you" or "nothing needs you." Detail is for when you run `tend`.
- **Pull, not push.** It doesn't flash, beep, or animate. It's static text that updates when your prompt redraws.
- **The anxiety killer.** The reason you compulsively poll is that you *can't know* without checking. The indicator removes the uncertainty. When it says `○`, you have permission to stay deep.

Implementation: a shell function that Tend provides, added to `PS1` / `PROMPT`:

```bash
# Add to .bashrc / .zshrc
export PS1='... $(tend prompt) $ '
```

`tend prompt` reads the latest event from each project's `.tend/events` file, counts how many are in a needs-attention state (`done`, `stuck`, `waiting`), and outputs either `○` or `●N`. It must complete in under 100ms — it runs on every prompt redraw. This means: no git operations, no process checks, no network calls. Events-file-only.

---

## File Architecture

Per project:

```
project-root/
├── .tend/
│   ├── events          # Append-only event log (the core protocol)
│   ├── queue           # Messages from `tend say` (read by agent)
│   ├── TODO            # Ordered backlog
│   ├── DONE            # Timestamped completions
│   └── NOTES           # Context, decisions, lessons
├── AGENTS.md           # Agent behavior policy (already standard)
└── lessons.md          # Error memory (already standard)
```

### Why `.tend/` not project root

- Keeps the project root clean — no collision with existing files
- Easy to gitignore (`.tend/` in one line) or commit (for shared context with collaborators)
- Clear namespace — everything tend-related is in one place
- Agents can be told "read .tend/ for your instructions and status" in AGENTS.md

### File Formats

All files are plain text. Timestamps use ISO 8601. No YAML, no JSON, no structure beyond what's human-readable in `cat`.

**events** — append-only log, one event per line (the core protocol):
```
2026-03-13T14:20:00 working refactoring narrative engine
2026-03-13T14:45:00 done refactored narrative engine (PR #204)
2026-03-13T14:46:00 working starting on prompt templates
```
Tend reads the last line to determine current state. The full log provides history. `tend prompt` (the shell indicator) reads only the last line of each project's events file — this is why it's fast.

**queue** — appended, consumed by agent, cleared after reading:
```
[2026-03-13T14:35:00] when you're done with the dashboard, pick up the token bridge FAQ next
```

**TODO** — ordered list, one item per line:
```
[2026-03-13T09:00:00] refactor hero journey state machine
[2026-03-13T11:30:00] add ADHD-friendly prompt templates
```

**DONE** — append-only log:
```
[2026-03-13T13:45:00] fixed onboarding flow drop-off (PR #203)
[2026-03-13T08:20:00] shipped v2.1 to TestFlight
```

**NOTES** — append-only, freeform:
```
[2026-03-13T14:00:00] the old API returns dates as strings, not timestamps — don't trust the types
[2026-03-12T16:30:00] always test prompt changes against 10 real journals before shipping
```

---

## Agent Integration

### The Contract

Tend establishes a lightweight contract between the developer and their agents. This is codified in each project's `AGENTS.md`:

```markdown
## Tend Integration

This project uses Tend for workflow coordination.

On startup:
- Read `.tend/queue` for any queued instructions. Execute them, then clear the file.
- Read `.tend/TODO` to understand the current backlog.
- Read `.tend/NOTES` for project context and known gotchas.
- Emit: `tend emit working "<description of what you're starting>"`

During work:
- When you complete a task: `tend emit done "<summary>"`
- When you start a new task: `tend emit working "<description>"`
- When you need human input: `tend emit stuck "<what you need>"`
- When you complete a task, also append to `.tend/DONE` with a timestamp.

On completion:
- Emit: `tend emit idle`
- If there are items in `.tend/TODO`, note the next item but wait for
  the developer to assign it (do not auto-start).
```

This contract is optional. Tend works without it — git-based detection provides baseline awareness. But projects that adopt it get richer status in the departures board.

### Trust Model

Agents are unreliable self-reporters. Tend's design accounts for this:

1. **Events are the fast signal, git is the source of truth.** If an agent emits `working` but hasn't committed in 30 minutes, Tend flags it as potentially stuck. Events tell you what the agent *thinks* it's doing. Git tells you what it *actually did*.
2. **Fallback layers provide baseline coverage.** Even if an agent never emits an event, git inference ensures the project shows up on the board with approximate status.
3. **`tend sync` exists for reconciliation.** When TODO and DONE drift out of sync (and they will), the sync command generates a prompt that reviews actual git history and proposes corrections.

---

## What Tend Is Not

- **Not an orchestration framework.** It doesn't start, stop, or configure agents. Agents run in whatever framework the developer uses (VSCode, Claude Code, Codex, etc.). Tend observes them through the event protocol and git inference. It never reaches into agent processes.
- **Not a dashboard.** It has no persistent UI, no live updates, no background process.
- **Not a project management tool.** No sprints, no story points, no assignments, no Gantt charts.
- **Not a notification system.** It never interrupts. It never pushes. It speaks only when asked. (The shell prompt indicator is pull — it's in your visual field, but it doesn't flash, beep, or demand attention.)
- **Not a replacement for git, CI, or PR review.** It reads from these systems. It doesn't duplicate them.
- **Not a planning tool.** It doesn't help you decompose work. It assumes you already know what needs doing — because you're the expert — and helps you track the state of things you've already set in motion.

---

## Implementation

### Language

Bash for v0. Zero dependencies beyond git and standard Unix tools. Runs on any Mac/Linux terminal.

If the scope grows (especially agent process detection or cross-platform support), rewrite in Rust or Go for a single static binary. But start with bash to validate the design.

### Installation

```bash
# Copy to PATH
cp tend /usr/local/bin/tend

# Optional: short alias
alias td="tend"

# Set root if not ~/projects
export TEND_ROOT=~/projects

# Add prompt indicator (the anxiety killer)
# bash:
export PS1='... $(tend prompt) $ '
# zsh:
PROMPT='... $(tend prompt) $ '
```

No package manager. No runtime. No config file.

### Performance

Two performance budgets, both non-negotiable:

**`tend prompt` must complete in under 100ms.** It runs on every shell prompt redraw. It reads only `.tend/events` files (last line of each), counts needs-attention states, and outputs a single glyph. No git operations. No process checks. No network calls. If it's slow, developers will remove it from their prompt, and the anxiety killer is gone.

**`tend` (the board) must complete in under 1 second.** It's called from flow-state transitions — any latency breaks the "quick glance" contract. This means:

- Event file reads are the fast path. `tail -1` per project.
- Git operations (for fallback inference) use `git log --oneline -1` not `git log --all`.
- Process detection uses `pgrep` / `ps`, not polling.
- No network calls in the default view. PR status is cached from last `tend sync`.

---

## Success Criteria

1. **The polling stops.** The developer checks agents deliberately at natural pause points, not compulsively from anxiety. The shell prompt indicator (`○` / `●N`) eliminates uncertainty without requiring active checking.
2. **Sub-10-second round trip.** Prompt shows `●2` → `tend` to scan → `tend switch` to jump → handle it → `tend switch` back to deep work. The entire station stop, including acting on what needs attention, is under a minute. The board scan alone is under 3 seconds.
3. **Zero setup per project.** Drop a `.tend/` directory (or don't — git inference works without it) and the project appears on the board.
4. **Agents stay informed.** The `tend say` command means the developer never has to switch terminals just to tell an agent what to do next.
5. **It disappears.** When you're on the train and the prompt shows `○`, Tend doesn't exist. No background process. No memory usage. No visual presence beyond a single character.

---

## Open Questions for Product Discovery

1. **Is the "polling anxiety" problem universal or niche?** Is this specific to neurodivergent developers, or does every developer running multiple agents experience it? The bet is that it's universal — variable-reward checking behavior is a well-documented human pattern — but it needs validation.

2. **How do people currently cope?** Are they using tmux? Multiple monitors? Dedicated "check" times? Or are they just suffering?

3. **Does the pull model actually work?** The risk is that developers *say* they want pull-based but in practice can't resist checking. The shell prompt indicator mitigates this — `○` provides ambient certainty that nothing needs attention — but it needs real-world validation.

4. **Event protocol adoption.** Will agent runtimes adopt the Tend event format natively, or will it always require AGENTS.md instructions? If major runtimes (Copilot, Claude Code, Codex) added native Tend event emission, the tool becomes much more powerful. Is this worth pursuing as a standard?

5. **VSCode status bar.** Should Tend provide a minimal VSCode extension that shows `○` / `●N` in the status bar? This would complement the shell prompt indicator for developers who don't always have a terminal prompt visible. Risk: slippery slope to a dashboard.

6. **`tend approve` feasibility.** Approving tool requests from outside the agent's terminal requires IPC with the agent process. This may be trivial (write to a file the agent polls) or impossible (agent expects stdin input in its own PTY). Needs investigation per runtime.

7. **Team use.** Is this inherently single-developer, or is there a version where collaborators can also see the board? If the tend files are committed to git, the data is shared. But the *view* is personal.

8. **Market positioning.** Every competitor is building mission control. Tend is deliberately anti-dashboard. Is "we do less" a viable pitch for open source adoption, or does it look underpowered? The bet: developers who actually use agents at scale will immediately recognize the problem Tend solves, because they're living it.

---

## Long-Term Vision: `ps` for Cognitive Work

Tend v1 solves a specific problem: managing AI coding agents across multiple projects. But the underlying abstraction is more general.

**Tend is asynchronous work telemetry.** Any task that runs in the background, takes time, and might need human judgment is a candidate for the Tend event protocol:

- AI coding agents (v1)
- CI/CD pipelines
- Long-running test suites
- Research jobs (web scraping, data analysis)
- Background builds and deployments
- Cowork-style automation tasks (legal research, apartment hunting)

The event protocol — `timestamp state message` — is intentionally not agent-specific. A CI pipeline can emit `working running integration tests` and `done all tests passed` just as easily as a coding agent can. A research job can emit `stuck hit rate limit on API` and appear on the same board.

The long-term positioning is: **Tend is the Unix `ps` for cognitive work.** `ps` tells you what processes are running on your machine. Tend tells you what *thinking tasks* are running across your projects — whether those tasks are being done by AI agents, automated pipelines, or background scripts.

This positions Tend as infrastructure, not an application. The CLI is the reference implementation. The event protocol is the product. Other tools — IDE extensions, web dashboards, mobile apps — can consume Tend events and present them however they want. Tend doesn't compete with dashboards; it provides the data layer that dashboards read from.

The five-word pitch: **What's running? What needs me?**

---

## Name

**Tend** — because:

- It's the verb of what you're doing: tending a forge, tending a kitchen, tending multiple things at different temperatures
- Some things roast for hours, some simmer for minutes, some need constant attention — just like projects
- The developer is the smith (or the chef), not the supervisor
- `tend` / `td` is four characters, no collisions with existing tools
- Typing `tend` and seeing the board reads as natural English: you asked what needs tending, it told you
- "Forge" as a binary name is taken by Atlassian, Laravel, Electron, and others. "Tend" is clean

---

## Appendix: The Chef, Not the Manager

A note on who this tool is for, because it shapes every design decision.

The heavy-planning approach to agentic development — detailed task graphs, work breakdown structures, multi-step orchestration — exists because many developers using AI agents don't deeply know the codebases they're working in. They need the plan because they can't improvise. The agent is their primary intelligence; they're managing it like a contractor.

Tend's user is the opposite. They are the domain expert. They know what the dish should taste like. The agent is a pair of extra hands, not a consultant. The workflow is more like a chef calling orders in a kitchen than a project manager tracking a Gantt chart — fast, intuitive, based on judgment and taste, not documentation and process.

This means Tend doesn't help you plan. It doesn't decompose work. It doesn't suggest what to do next. It assumes you already know — because you're the expert — and it simply keeps track of where all the pans are on the stove so you don't burn anything while your attention is on the dish that matters most right now.