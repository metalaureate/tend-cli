import { NavbarClient, HeroReveal, ScrollReveal, GlyphDemo, HeroPromptGlyph, GithubIconExport, ArrowRightIconExport, DashboardLive } from './components'

const board = [
  { icon: '?', name: 'payments-api', state: 'stuck', msg: 'tool approval needed: npm test', time: '', color: 'text-ember', env: '' },
  { icon: '◉', name: 'mobile-app', state: 'done', msg: 'PR #847 ready for review', time: '', color: 'text-ember', env: '' },
  { icon: '◐', name: 'strategy-doc', state: 'working', msg: 'drafting Q2 roadmap', time: '8m', color: 'text-patina', env: '↗' },
  { icon: '◐', name: 'data-pipeline', state: 'working', msg: 'building ETL for analytics', time: '23m', color: 'text-patina', env: '↗' },
  { icon: '◌', name: 'support-triage', state: 'idle', msg: 'customer tickets triaged', time: '1h', color: 'text-smoke/50', env: '' },
  { icon: '◌', name: 'market-research', state: 'idle', msg: 'competitor analysis complete', time: '3h', color: 'text-smoke/50', env: '↗' },
]

const helpCommands = [
  ['td', 'Show the status board'],
  ['td -', 'Live dashboard (auto-refreshes every minute)'],
  ['td <project>', 'Project detail + agent sessions'],
  ['td init [project]', 'Initialize .tend/ in a project'],
  ['td clear [project]', 'Clear events history for a project'],
  ['td add [project] "msg"', 'Queue a TODO for the agent\'s next session'],
  ['td ack [project]', 'Clear done/stuck/waiting → idle'],
  ['td relay <subcmd>', 'Relay management (setup|status|pull|token)'],
  ['td version', 'Show version'],
  ['td help', 'Show this help'],
]

const trainSteps = [
  { step: 'Stay on your mind train.', desc: 'Deep in one conversation. The prompt is silent. Nothing needs you.' },
  { step: 'Reach a station.', desc: 'You finished a turn. The agent is working. You have a natural gap.' },
  { step: 'Glance at the board.', desc: 'Type td. 3-second scan. Route yourself to the next conversation. Back on the train.' },
]

export default function Page() {
  return (
    <div className="min-h-screen">
      {/* NAVBAR */}
      <NavbarClient />

      {/* HERO */}
      <section className="bg-anvil pt-28 pb-20 md:pt-36 md:pb-28 px-6">
        <HeroReveal>
          <div className="max-w-3xl mx-auto">
            <h1 className="hero-el font-heading font-bold text-parchment text-3xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight">
              Your agents never sleep.<br />
              <span className="text-smoke">Make sure they never wait.</span>
            </h1>

            <p className="hero-el font-body text-smoke text-base md:text-lg mt-6 max-w-xl leading-relaxed">
              Lightweight attention infrastructure for humans and agents. Works with any agent framework — Copilot, Claude, Codex, or your own — on any machine, local or remote.
            </p>

            {/* The Board */}
            <div className="hero-el mt-10 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">$ td</span>
              </div>
              <div className="px-4 md:px-5 py-4 font-mono text-[11px] md:text-xs leading-relaxed">
                <div className="text-smoke/40 mb-3 flex justify-between">
                  <span className="tracking-widest text-parchment/60 font-medium">TEND</span>
                  <span>Fri Mar 14, 14:32</span>
                </div>
                <div className="space-y-1">
                  {board.map((row, i) => (
                    <div key={i} className="flex">
                      <span className={`${row.color} w-4 shrink-0`}>{row.icon}</span>
                      <span className="text-parchment/70 w-30 md:w-36 shrink-0 truncate ml-1">{row.name}</span>
                      <span className={`${row.color} w-16 shrink-0`}>{row.state}</span>
                      <span className="text-smoke/50 truncate hidden sm:block">{row.msg}</span>
                      {row.time && <span className="text-smoke/30 ml-auto pl-2 shrink-0">({row.time})</span>}
                      {row.env && <span className="text-parchment/30 ml-auto pl-2 shrink-0">{row.env}</span>}
                    </div>
                  ))}
                </div>
                <div className="text-smoke/30 mt-4 pt-3 border-t border-white/5">
                  2 need you · 2 working · 2 idle &nbsp;<span className="text-parchment/30">↗ = relay</span>
                </div>
                <HeroPromptGlyph />
              </div>
            </div>

            {/* Sub-proof */}
            <div className="hero-el flex flex-wrap items-center gap-x-4 gap-y-2 mt-6">
              <span className="font-mono text-xs text-smoke/40">Single binary</span>
              <span className="text-smoke/20">·</span>
              <span className="font-mono text-xs text-smoke/40">Any agent framework</span>
              <span className="text-smoke/20">·</span>
              <span className="font-mono text-xs text-smoke/40">Local or remote</span>
              <span className="text-smoke/20">·</span>
              <span className="font-mono text-xs text-smoke/40">No daemon</span>
              <span className="text-smoke/20">·</span>
              <span className="font-mono text-xs text-smoke/40">No database</span>
            </div>

            {/* CTA */}
            <div className="hero-el mt-8 flex flex-col sm:flex-row items-center gap-4">
              <a
                href="#get-started"
                className="btn-magnetic inline-flex items-center gap-2 bg-ember text-parchment px-5 py-2.5 rounded-full font-heading font-medium text-sm"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Get Started <ArrowRightIconExport />
                </span>
                <span className="btn-bg bg-parchment/20 rounded-full" />
              </a>
              <a
                href="https://github.com/metalaureate/tend-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="link-lift font-mono text-sm text-smoke/60 hover:text-parchment transition-colors flex items-center gap-1.5"
              >
                <GithubIconExport /> View source
              </a>
            </div>
          </div>
        </HeroReveal>
      </section>

      {/* WHY TEND EXISTS */}
      <section id="problem" className="py-20 md:py-28 px-6">
        <ScrollReveal triggerClassName="why-el">
          <div className="max-w-3xl mx-auto">
            <p className="why-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Why Tend exists</p>

            <h2 className="why-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
              The scarce resource isn&apos;t output.<br />
              <span className="text-smoke">It&apos;s your attention.</span>
            </h2>

            <div className="why-el mt-8 font-body text-smoke text-base md:text-lg leading-relaxed space-y-5 max-w-2xl">
              <p>
                All of your work is done by agents now — code, research, ops, support, content. Maybe 20% is fire-and-forget: grooming plans, kicking off builds, long-running jobs. The other 80% is conversational: you and an agent working turn by turn, with gaps that range from seconds to minutes and arrive unpredictably.
              </p>
              <p>
                Every conversation turn creates a micro-gap. You make a request, the agent works, and for thirty seconds to a few minutes you&apos;re waiting, killing your flow.
              </p>
            </div>

            {/* The cost */}
            <div className="why-el mt-12 bg-parchment border border-chalk rounded-3xl p-6 md:p-8">
              <p className="font-heading font-bold text-lg md:text-xl text-anvil">
                The goal is total flow — never idle, never hunting.
              </p>
              <p className="font-body text-smoke mt-3 leading-relaxed">
                You finish a turn in one project and instantly know where to go next. No scanning tabs. No checking dashboards. No wondering which agent finished while you weren&apos;t looking. Just a glance at the terminal you&apos;re already in.
              </p>
            </div>

            <div className="why-el mt-8 font-body text-smoke text-base md:text-lg leading-relaxed space-y-5 max-w-2xl">
              <p>
                A dashboard doesn&apos;t solve this — it&apos;s another surface pulling attention, another tab to watch. And it assumes a desk. But you might be on a laptop over breakfast, in a cloud session from your phone, at a café with barely room for a coffee. You need something at the speed of thought, in the place you already are: the terminal.
              </p>
            </div>

            {/* The thesis */}
            <div className="why-el mt-12 md:mt-16">
              <h3>
                <span className="font-display text-anvil text-3xl md:text-5xl lg:text-6xl italic">
                  Tend doesn&apos;t build a better dashboard.
                </span>
                <br />
                <span className="font-display text-ember text-3xl md:text-5xl lg:text-6xl italic">
                  It removes the need for one.
                </span>
              </h3>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* THE PROMPT GLYPH */}
      <section className="bg-anvil py-20 md:py-28 px-6">
        <ScrollReveal triggerClassName="glyph-el">
          <div className="max-w-3xl mx-auto">
            <p className="glyph-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">The insight</p>

            <h2 className="glyph-el font-heading font-bold text-2xl md:text-4xl text-parchment leading-tight">
              A single dot in your prompt.<br />
              <span className="text-smoke">Ambient certainty.</span>
            </h2>

            <p className="glyph-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              The shell prompt indicator updates after every command you run. It&apos;s already in your visual field.
              When it says <span className="font-mono text-parchment">○</span>, nothing needs you. The uncertainty — which
              is what drives the compulsive checking — is gone.
            </p>

            <GlyphDemo />

            {/* The train metaphor */}
            <div className="glyph-el mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              {trainSteps.map((item, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-5">
                  <p className="font-heading font-bold text-parchment text-sm">{item.step}</p>
                  <p className="font-body text-smoke text-sm mt-2 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <p className="glyph-el font-body text-smoke/60 text-sm mt-8 max-w-xl leading-relaxed">
              Stay in flow by batching interruptions into pull-based station stops. Stay on your mind train, check the board at natural pauses, route yourself to the next conversation that needs you.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* INSTALL */}
      <section id="get-started" className="py-20 md:py-28 px-6">
        <ScrollReveal triggerClassName="inst-el">
          <div className="max-w-3xl mx-auto">
            <p className="inst-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Get started</p>

            <h2 className="inst-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
              One command to install. One to set up.
            </h2>

            {/* Install terminal */}
            <div className="inst-el mt-10 bg-anvil rounded-[1.25rem] overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-ember/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-patina/40" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">install</span>
              </div>
              <div className="p-5 font-mono text-sm space-y-1.5">
                <div><span className="text-smoke/50">$ </span><span className="text-parchment">curl -sSL https://raw.githubusercontent.com/metalaureate/tend-cli/main/install.sh | sh</span></div>
                <div className="text-patina text-xs mt-3 pt-3 border-t border-white/5">
                  Installing tend v0.1.132 (darwin/arm64)...<br />
                  ✓ Installed tend to /usr/local/bin/tend<br />
                  ✓ Symlinked td → tend
                </div>
              </div>
            </div>

            {/* Setup terminal */}
            <div className="inst-el mt-6 bg-anvil rounded-[1.25rem] overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-ember/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-patina/40" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">setup</span>
              </div>
              <div className="p-5 font-mono text-sm space-y-1.5">
                <div><span className="text-smoke/50">$ </span><span className="text-parchment">cd ~/projects/my-app && td init</span></div>
                <div className="text-patina text-xs mt-3 pt-3 border-t border-white/5">
                  ✓ Created .tend/ directory<br />
                  ✓ Installed agent hooks (Copilot + Claude Code)<br />
                  ✓ Added protocol to AGENTS.md<br />
                  ✓ Registered project
                </div>
              </div>
            </div>

            <p className="inst-el font-body text-smoke text-sm mt-6 leading-relaxed max-w-2xl">
              <span className="font-mono text-anvil">td init</span> creates the event log, installs agent hooks for both Copilot and Claude Code, and writes the protocol to AGENTS.md. Run <span className="font-mono text-anvil">td</span> from anywhere to see your board.
            </p>

            {/* Help output */}
            <div className="inst-el mt-10 bg-anvil rounded-[1.25rem] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">$ td help</span>
              </div>
              <div className="p-5 font-mono text-[11px] md:text-xs leading-relaxed">
                <div className="text-parchment/80 mb-3">td — Your agents never sleep. Make sure they never wait.</div>
                <div className="text-smoke/40 mb-2">Usage:</div>
                <div className="space-y-0.5 text-smoke/60">
                  {helpCommands.map(([cmd, desc]) => (
                    <div key={cmd} className="flex">
                      <span className="text-parchment/70 w-52 md:w-60 shrink-0">{cmd}</span>
                      <span className="text-smoke/60">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* TODO */}
      <section className="py-20 md:py-28 px-6 bg-parchment">
        <ScrollReveal triggerClassName="todo-el">
          <div className="max-w-3xl mx-auto">
            <p className="todo-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Backlog</p>

            <h2 className="todo-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
              Queue work without switching context.
            </h2>

            <p className="todo-el font-body text-smoke text-sm mt-6 leading-relaxed max-w-2xl">
              You&apos;re deep in one project and think of something for another. Don&apos;t context-switch to write it down. Type it from where you are — the agent picks it up on its next session.
            </p>

            {/* Terminal demo */}
            <div className="todo-el mt-10 bg-anvil rounded-[1.25rem] overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-ember/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-patina/40" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">terminal — working in northstar</span>
              </div>
              <div className="p-5 font-mono text-sm space-y-1.5">
                <div><span className="text-smoke/50">$ </span><span className="text-parchment">td add atlas-api &quot;fix auth regression on /users endpoint&quot;</span></div>
                <div className="text-patina text-xs mt-2">✓ Added to atlas-api</div>
              </div>
            </div>

            {/* What happens next */}
            <div className="todo-el mt-6 bg-anvil rounded-[1.25rem] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">next session in atlas-api</span>
              </div>
              <div className="p-5 font-mono text-xs space-y-2">
                <div className="text-smoke/50"># Agent reads .tend/TODO on session start:</div>
                <div className="text-parchment/80 mt-2">Pending TODOs for atlas-api:</div>
                <div className="text-parchment/60 ml-2">1. fix auth regression on /users endpoint</div>
                <div className="text-parchment/60 ml-2">2. add rate limiting to public API</div>
                <div className="text-smoke/50 mt-2">Proposing item #1 to the developer...</div>
              </div>
            </div>

            <p className="todo-el font-body text-smoke/60 text-sm mt-8 max-w-xl leading-relaxed">
              Plain text. Committed to the repo. No app to open, no board to drag. Just lines in a file that agents read automatically.
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* RELAY */}
      <section className="bg-anvil py-20 md:py-28 px-6">
        <ScrollReveal triggerClassName="relay-el">
          <div className="max-w-3xl mx-auto">
            <p className="relay-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Remote agents</p>

            <h2 className="relay-el font-heading font-bold text-2xl md:text-4xl text-parchment leading-tight">
              One board. Every agent.<br />
              <span className="text-smoke">Wherever they run.</span>
            </h2>

            <p className="relay-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              Local agents write to <span className="font-mono text-parchment">.tend/events</span> directly — no network, no accounts, plain text. But agents increasingly run elsewhere: Codex in the cloud, CI pipelines, SSH sessions, remote worktrees. Without a common protocol, you&apos;re back to maintaining per-environment solutions.
            </p>

            <p className="relay-el font-body text-smoke text-base md:text-lg mt-4 leading-relaxed max-w-2xl">
              The relay solves this. One command to set up:
            </p>

            {/* Relay setup demo */}
            <div className="relay-el mt-8 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">terminal</span>
              </div>
              <div className="p-5 font-mono text-xs space-y-2">
                <div>
                  <span className="text-smoke/50">$ </span>
                  <span className="text-parchment">td relay setup</span>
                </div>
                <div className="text-smoke/50">Registering with relay at https://relay.tend.cx...</div>
                <div className="text-patina mt-1">✓ Token stored in ~/.tend/relay_token</div>
                <div className="mt-2 text-smoke/50">Your relay token:</div>
                <div className="text-parchment/80 ml-2">tnd_281w29...392t</div>
                <div className="mt-2 text-smoke/50">Set this on remote environments:</div>
                <div className="text-parchment/80 ml-2">export TEND_RELAY_TOKEN=&quot;tnd_281w29...392t&quot;</div>
              </div>
            </div>

            {/* How it ties together */}
            <div className="relay-el mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">Setup: one token</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Run <span className="font-mono text-parchment">td relay setup</span> on your laptop.
                  Copy the token to each remote environment as <span className="font-mono text-parchment">TEND_RELAY_TOKEN</span>.
                  No accounts. No passwords. No signup.
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">Agents don&apos;t change</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  The agent&apos;s AGENTS.md instructions stay the same. The developer sets a token on the remote environment and the CLI handles the rest. The relay is invisible plumbing.
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">No daemon. No sync.</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  <span className="font-mono text-parchment">td</span> reads from local cache — never hits the network, stays under 100ms.
                  The board refreshes the cache on each invocation, then renders from cache.
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">The relay is optional</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Local agents still just write to a file. If you never set up a relay token, everything works exactly the same. The relay is what makes one board possible when your agents are spread across environments.
                </p>
              </div>
            </div>

            {/* Board with relay indicator */}
            <div className="relay-el mt-10 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">$ td</span>
              </div>
              <div className="px-4 md:px-5 py-4 font-mono text-[11px] md:text-xs leading-relaxed">
                <div className="text-smoke/40 mb-3 flex justify-between">
                  <span className="tracking-widest text-parchment/60 font-medium">TEND</span>
                  <span>Fri Mar 14, 14:32</span>
                </div>
                <div className="space-y-1">
                  <div className="flex">
                    <span className="text-patina w-4 shrink-0">◐</span>
                    <span className="text-parchment/70 w-30 md:w-36 shrink-0 truncate ml-1">my-app</span>
                    <span className="text-patina w-16 shrink-0">working</span>
                    <span className="text-smoke/50 truncate hidden sm:block">building auth scaffold</span>
                    <span className="text-smoke/30 ml-auto pl-2 shrink-0">(3m)</span>
                  </div>
                  <div className="flex">
                    <span className="text-ember w-4 shrink-0">◉</span>
                    <span className="text-parchment/70 w-30 md:w-36 shrink-0 truncate ml-1">cloud-refactor</span>
                    <span className="text-ember w-16 shrink-0">done</span>
                    <span className="text-smoke/50 truncate hidden sm:block">migration complete (PR #12)</span>
                    <span className="text-parchment/40 ml-auto pl-2 shrink-0">↗</span>
                  </div>
                  <div className="flex">
                    <span className="text-smoke/50 w-4 shrink-0">◌</span>
                    <span className="text-parchment/70 w-30 md:w-36 shrink-0 truncate ml-1">deep-search</span>
                    <span className="text-smoke/50 w-16 shrink-0">idle</span>
                    <span className="text-smoke/50 truncate hidden sm:block">analysis complete</span>
                    <span className="text-parchment/40 ml-auto pl-2 shrink-0">↗</span>
                  </div>
                </div>
                <div className="text-smoke/30 mt-4 pt-3 border-t border-white/5">
                  1 needs you · 1 working · 1 idle &nbsp; <span className="text-parchment/30">↗ = relay</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* DASHBOARD */}
      <section id="dashboard" className="py-20 md:py-28 px-6 bg-parchment">
        <ScrollReveal triggerClassName="dash-el">
          <div className="max-w-3xl mx-auto">
            <p className="dash-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Dashboard</p>

            <h2 className="dash-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
              And if you really want a dashboard,<br />
              <span className="text-smoke">there&apos;s a flag for that.</span>
            </h2>

            <p className="dash-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              <span className="font-mono text-anvil">td -</span> gives you a persistent full-screen board that auto-refreshes every minute. Uses the alternate screen buffer so your terminal history stays clean. Press <span className="font-mono text-anvil">q</span> to exit.
            </p>

            {/* Live dashboard demo */}
            <div className="dash-el">
              <DashboardLive />
            </div>

            {/* Pull vs push comparison */}
            <div className="dash-el mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-chalk rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">tend &nbsp;<span className="font-mono font-normal text-smoke/60">(pull)</span></p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Type <span className="font-mono text-anvil">td</span> at any natural pause. 3-second scan. Handle what needs you. Back to work. The default — and the fastest path back to flow.
                </p>
              </div>
              <div className="bg-white border border-chalk rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">tend - &nbsp;<span className="font-mono font-normal text-smoke/60">(dashboard)</span></p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Persistent full-screen view. Auto-refreshes every 60 seconds. Ideal for a second monitor, an always-on terminal pane, or coordinating a large fleet of long-running agents.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* FOOTER */}
      <footer className="pt-16 pb-8 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://github.com/metalaureate/tend-cli"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-magnetic inline-flex items-center gap-2 bg-ember text-parchment px-6 py-3 rounded-full font-heading font-medium text-sm"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <GithubIconExport /> View on GitHub <ArrowRightIconExport />
                </span>
                <span className="btn-bg bg-anvil rounded-full" />
              </a>
            </div>
          </div>

          <div className="border-t border-chalk pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-mono text-anvil text-sm">tend | td</span>
              <a href="https://github.com/metalaureate/tend-cli" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-anvil transition-colors link-lift">GitHub</a>
              <a href="https://github.com/metalaureate/tend-cli/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-anvil transition-colors link-lift">Docs</a>
            </div>
            <span className="font-mono text-[11px] text-smoke/50">MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
