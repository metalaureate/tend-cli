import { NavbarClient, HeroReveal, ScrollReveal, GlyphDemo, HeroPromptGlyph, GithubIconExport, ArrowRightIconExport } from './components'

const board = [
  { icon: '?', name: 'payments-api', state: 'stuck', msg: 'tool approval needed: npm test', time: '', color: 'text-ember', env: '' },
  { icon: '◉', name: 'mobile-app', state: 'done', msg: 'PR #847 ready for review', time: '2m ago', color: 'text-ember', env: '' },
  { icon: '◐', name: 'strategy-doc', state: 'working', msg: 'drafting Q2 roadmap', time: '8m', color: 'text-patina', env: '' },
  { icon: '◐', name: 'data-pipeline', state: 'working', msg: 'building ETL for analytics', time: '23m', color: 'text-patina', env: '↗' },
  { icon: '?', name: 'auth-service', state: 'waiting', msg: 'changes in src/auth', time: '45m ago', color: 'text-ember', env: '↗' },
  { icon: '◌', name: 'support-triage', state: 'idle', msg: 'customer tickets triaged', time: '3h ago', color: 'text-smoke/50', env: '' },
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

const flowSteps = [
  { step: '1. Finish a turn.', desc: 'You hit enter. The agent is working. You have a natural gap.' },
  { step: '2. Glance at the prompt.', desc: 'It says ○. Nothing needs you. Stay focused where you are.' },
  { step: '3. Or it says ?2 ◐3.', desc: '2 agents need you, 3 working. Type td. 3-second scan. Route yourself.' },
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
              Run more agents.<br />
              <span className="text-smoke">Know when they need you.</span>
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
                  1 needs attention · 1 done · 2 working · 1 idle &nbsp;<span className="text-parchment/30">↗ = relay</span>
                </div>
                <div className="text-smoke/25 mt-1">
                  18/24h active  ·  5 done today  ·  12 this week  ·  2 open TODOs
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
              The scarce resource isn&apos;t compute.<br />
              <span className="text-smoke">It&apos;s your attention.</span>
            </h2>

            <p className="why-el font-mono text-xs text-smoke/40 mt-4">For developers running 2+ AI agents across projects.</p>

            <div className="why-el mt-8 font-body text-smoke text-base md:text-lg leading-relaxed space-y-5 max-w-2xl">
              <p>
                You want to run as many agents as possible, across every kind of work — from set-it-and-forget-it builds to hands-on development that demands your judgment at every turn. More agents means more throughput, more leverage, more of what AI actually promises.
              </p>
              <p>
                The bottleneck isn&apos;t the agents. It&apos;s knowing when they need you — without it taking over your day.
              </p>
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

            {/* The flow */}
            <div className="glyph-el mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              {flowSteps.map((item, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-5">
                  <p className="font-heading font-bold text-parchment text-sm">{item.step}</p>
                  <p className="font-body text-smoke text-sm mt-2 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
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
                <div className="text-parchment/80 mb-3">td — attention infrastructure for humans running AI agents</div>
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
              Local agents write to <span className="font-mono text-parchment">.tend/events</span> — plain text, no network. But when agents run elsewhere (Codex, CI, SSH, remote worktrees), set one token and the relay brings them onto your board.
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
                <div className="mt-2 text-smoke/50">Set this on remote environments:</div>
                <div className="text-parchment/80 ml-2">export TEND_RELAY_TOKEN=&quot;tnd_281w29...392t&quot;</div>
              </div>
            </div>

            {/* Two cards only */}
            <div className="relay-el mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">No accounts. One token.</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Run <span className="font-mono text-parchment">td relay setup</span> on your laptop.
                  Copy the token to each remote environment.
                  That&apos;s it. Agents don&apos;t change — same AGENTS.md instructions everywhere.
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">Completely optional</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Local agents just write to a file. No relay needed. If your agents are all local, everything works without it. The relay only matters when agents are spread across machines.
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
