import { NavbarClient, HeroReveal, ScrollReveal, GlyphDemo, HeroPromptGlyph, GithubIconExport, ArrowRightIconExport } from './components'

const board = [
  { icon: '?', name: 'payments-api', state: 'stuck', msg: 'needs database credentials for staging', time: '', color: 'text-ember', env: '', insight: 'blocked on creds, 2nd try → ask devops for keys' },
  { icon: '◉', name: 'mobile-app', state: 'done', msg: 'PR #847 ready for review', time: '2m ago', color: 'text-ember', env: '', insight: 'auth refactor landed → review PR, merge' },
  { icon: '◐', name: 'strategy-doc', state: 'working', msg: 'drafting Q2 roadmap', time: '8m', color: 'text-patina', env: '', insight: '' },
  { icon: '◐', name: 'data-pipeline', state: 'working', msg: 'building ETL for analytics', time: '23m', color: 'text-patina', env: '↗', insight: 'ETL schema pass 2 → test w/ prod data' },
  { icon: '?', name: 'auth-service', state: 'waiting', msg: 'changes in src/auth', time: '45m ago', color: 'text-ember', env: '↗', insight: 'dirty worktree post-fix → commit or stash' },
  { icon: '◌', name: 'support-triage', state: 'idle', msg: 'customer tickets triaged', time: '3h ago', color: 'text-smoke/50', env: '', insight: '' },
]

const helpCommands = [
  ['td', 'Show the status board'],
  ['td watch', 'Live dashboard (auto-refreshes every minute)'],
  ['td <project>', 'Project detail + agent sessions'],
  ['td init [project]', 'Initialize .tend/ in a project'],
  ['td clear [project]', 'Clear events history for a project'],
  ['td add [project] "msg"', 'Queue a TODO for the agent\'s next session'],
  ['td ack [project]', 'Clear done/stuck/waiting → idle'],
  ['td dispatch', 'Pick a TODO and dispatch as a GitHub issue'],
  ['td relay <subcmd>', 'Relay management (setup|status|pull|token|share)'],
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
              Tend your agents.<br />
              <span className="text-smoke">Stay in flow.</span>
            </h1>

            <p className="hero-el font-body text-smoke text-base md:text-lg mt-6 max-w-xl leading-relaxed">
              I built Tend so I could maximize the number of projects I work on simultaneously without burning out from context-switching between them, checking who needs me, and keeping them all stoked wherever they are. One board shows every agent across every project: who&apos;s working, who&apos;s done, who needs me.
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
                <div className="space-y-0">
                  {board.map((row, i) => (
                    <div key={i} className="flex">
                      <span className={`${row.color} w-4 shrink-0`}>{row.icon}</span>
                      <span className="text-parchment/70 w-30 md:w-36 shrink-0 truncate ml-1">{row.name}</span>
                      <span className={`${row.color} w-16 shrink-0`}>{row.state}</span>
                      <span className={`truncate hidden sm:block ${row.insight ? 'text-amber-500/80' : 'text-smoke/50'}`}>{row.insight || row.msg}</span>
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
              <span className="font-mono text-xs text-amber-500/60">AI insights</span>
              <span className="text-smoke/20">·</span>
              <span className="font-mono text-xs text-smoke/40">No daemon</span>
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
              Pull, not push.
            </h2>

            <p className="why-el font-mono text-xs text-smoke/70 mt-4">For developers running 2+ AI agents across projects.</p>

            <div className="why-el mt-8 font-body text-smoke text-base md:text-lg leading-relaxed space-y-5 max-w-2xl">
              <p>
                Running multiple AI agents simultaneously is the new normal. Some finish in minutes, others run for hours. The problem isn&apos;t the agents — it&apos;s knowing when each one needs you without that knowledge becoming a second job.
              </p>
              <p>
                Dashboards are a permanent invitation to break focus. Notification badges are interrupts. They add vigilance, not concentration.
              </p>
              <p>
                Tend uses a different model: you glance at the board when you&apos;re ready, not when a badge demands it. When it says <span className="font-mono">○</span>, nothing needs you. The uncertainty that drives compulsive tab-switching is gone.
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
              When it says <span className="font-mono text-parchment">○</span>, nothing needs you. The uncertainty
              that drives compulsive checking is gone.
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

            <p className="inst-el font-body text-smoke/50 text-xs mt-4 leading-relaxed max-w-2xl">
              macOS and Linux only. Windows users: install{' '}
              <a href="https://learn.microsoft.com/en-us/windows/wsl/install" target="_blank" rel="noopener noreferrer" className="underline hover:text-smoke/80 transition-colors">WSL</a>
              {' '}first, then run the install command from a WSL terminal.
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

      {/* AI INSIGHTS */}
      <section id="insights" className="py-20 md:py-28 px-6 bg-parchment">
        <ScrollReveal triggerClassName="ai-el">
          <div className="max-w-3xl mx-auto">
            <p className="ai-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">AI insights</p>

            <h2 className="ai-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
              Know what each agent is really doing.<br />
              <span className="text-smoke">And what comes next.</span>
            </h2>

            <p className="ai-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              Every time an agent reports state, Tend reads its recent event trail, project README, and TODO backlog — then generates two lines: what&apos;s happening and what&apos;s likely next. No dashboards to configure. No prompts to write. It just shows up on your board.
            </p>

            {/* Before/after demo */}
            <div className="ai-el mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-anvil rounded-2xl p-5">
                <p className="font-mono text-[10px] text-smoke/40 uppercase tracking-widest mb-3">Without insights</p>
                <div className="font-mono text-xs space-y-1.5">
                  <div className="flex gap-2"><span className="text-ember">◐</span><span className="text-parchment/70 w-24 shrink-0">payments-api</span><span className="text-smoke/50 truncate">building auth scaffold</span></div>
                  <div className="flex gap-2"><span className="text-patina">◉</span><span className="text-parchment/70 w-24 shrink-0">mobile-app</span><span className="text-smoke/50 truncate">PR #847 ready for review</span></div>
                  <div className="flex gap-2"><span className="text-ember">?</span><span className="text-parchment/70 w-24 shrink-0">auth-service</span><span className="text-smoke/50 truncate">changes in src/auth</span></div>
                </div>
                <p className="text-smoke/40 text-[10px] mt-3 italic">Raw event messages. You parse the meaning.</p>
              </div>
              <div className="bg-anvil rounded-2xl p-5 ring-1 ring-amber-500/30">
                <p className="font-mono text-[10px] text-amber-500/70 uppercase tracking-widest mb-3">With insights</p>
                <div className="font-mono text-xs space-y-1.5">
                  <div className="flex gap-2"><span className="text-ember">◐</span><span className="text-parchment/70 w-24 shrink-0">payments-api</span><span className="text-amber-500/80 truncate">3rd auth pass → run tests, PR</span></div>
                  <div className="flex gap-2"><span className="text-patina">◉</span><span className="text-parchment/70 w-24 shrink-0">mobile-app</span><span className="text-amber-500/80 truncate">refactor landed → merge if green</span></div>
                  <div className="flex gap-2"><span className="text-ember">?</span><span className="text-parchment/70 w-24 shrink-0">auth-service</span><span className="text-amber-500/80 truncate">dirty worktree → commit or stash</span></div>
                </div>
                <p className="text-amber-500/50 text-[10px] mt-3 italic">Context + trajectory. You route yourself instantly.</p>
              </div>
            </div>

            {/* How it works */}
            <div className="ai-el mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-anvil/5 border border-anvil/10 rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">Reads the trail</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Last 25 events, project README, and pending TODOs. The model understands what your project is and what the agent has been doing.
                </p>
              </div>
              <div className="bg-anvil/5 border border-anvil/10 rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">Predicts next</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Infers the likely action from work trajectory — not the TODO list. If the agent is debugging auth, it predicts &ldquo;run tests&rdquo; — not an unrelated backlog item.
                </p>
              </div>
              <div className="bg-anvil/5 border border-anvil/10 rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">Costs nothing</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  ~$0.00005 per insight via <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-anvil underline hover:text-smoke">OpenRouter</a>. Only fires on state changes, not on views. Content-hashed: if nothing changed, no call is made. Enabled automatically on the hosted relay.
                </p>
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
              You&apos;re deep in one project and think of something for another. Don&apos;t context-switch to write it down. Type it from where you are. The agent picks it up on its next session.
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
      <section id="relay" className="bg-anvil py-20 md:py-28 px-6">
        <ScrollReveal triggerClassName="relay-el">
          <div className="max-w-3xl mx-auto">
            <p className="relay-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">The relay</p>

            <h2 className="relay-el font-heading font-bold text-2xl md:text-4xl text-parchment leading-tight">
              Your board in the browser.<br />
              <span className="text-smoke">Readable by humans and machines.</span>
            </h2>

            <p className="relay-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              One command gives you a live web board at <span className="font-mono text-parchment">relay.tend.cx</span>. Check on your agents from your phone, another machine, or share the link with your team. Every board also exposes a structured <span className="font-mono text-parchment">/llms.txt</span> endpoint — so other agents can read your board and take action on your behalf.
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
                <div className="mt-3 text-smoke/50">Your board is live at:</div>
                <div className="text-parchment/80 ml-2">https://relay.tend.cx/tnd_281w29...392t</div>
                <div className="mt-2 text-smoke/50">Structured agent view:</div>
                <div className="text-parchment/80 ml-2">https://relay.tend.cx/tnd_281w29...392t/llms.txt</div>
              </div>
            </div>

            {/* Four cards */}
            <div className="relay-el mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">Live web board</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  See all your agents from any browser. Auto-refreshes every 60 seconds. No login, no app — just your token in the URL.
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">AI insights</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Each project gets a terse summary and next-action prediction, generated from the event trail, README, and TODO list. Powered by <a href="https://openrouter.ai" target="_blank" rel="noopener noreferrer" className="text-parchment/80 underline hover:text-parchment">OpenRouter</a>. Enabled automatically on the hosted relay. Self-hosted: add your API key as a Worker secret.
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">Agent-readable</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Every board serves <span className="font-mono text-parchment/60">/llms.txt</span> — structured Markdown that orchestrator agents can fetch to triage, route, or act on stuck projects.
                </p>
              </div>
              <div className="bg-white/5 rounded-2xl p-5">
                <p className="font-heading font-bold text-parchment text-sm">No accounts. One token.</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Run <span className="font-mono text-parchment">td relay setup</span> once.
                  Commit the token or set it as an env var. Local and remote agents on one board.
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* RELAY API */}
      <section id="api" className="bg-anvil py-20 md:py-28 px-6 border-t border-white/5">
        <ScrollReveal triggerClassName="api-el">
          <div className="max-w-3xl mx-auto">
            <p className="api-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Relay API</p>

            <h2 className="api-el font-heading font-bold text-2xl md:text-4xl text-parchment leading-tight">
              HTTP API for agents and integrations.
            </h2>

            <p className="api-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              Base URL: <span className="font-mono text-parchment">https://relay.tend.cx</span>. All <span className="font-mono text-parchment/60">/v1/*</span> routes require a <span className="font-mono text-parchment/60">Bearer tnd_...</span> token (except register). Responses are JSON.
            </p>

            {/* API Table */}
            <div className="api-el mt-8 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
              <div className="divide-y divide-white/5">
                {/* Register */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-patina/20 text-patina px-2 py-0.5 rounded">POST</span>
                    <span className="font-mono text-sm text-parchment">/v1/register</span>
                    <span className="text-smoke/40 text-xs ml-auto">no auth</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">Create a new relay token. Returns <span className="font-mono text-parchment/50">{`{ token: "tnd_..." }`}</span></p>
                </div>

                {/* Emit */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-patina/20 text-patina px-2 py-0.5 rounded">POST</span>
                    <span className="font-mono text-sm text-parchment">/v1/events</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">
                    Emit a state event. Body: <span className="font-mono text-parchment/50">{`{ project, state, message?, session_id?, timestamp? }`}</span>
                  </p>
                  <p className="font-body text-smoke/40 text-xs mt-1">
                    States: <span className="font-mono">working</span> · <span className="font-mono">done</span> · <span className="font-mono">stuck</span> · <span className="font-mono">waiting</span> · <span className="font-mono">idle</span>
                  </p>
                </div>

                {/* Get Events */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">GET</span>
                    <span className="font-mono text-sm text-parchment">/v1/events/:project</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">
                    Fetch event history. Query params: <span className="font-mono text-parchment/50">since</span>, <span className="font-mono text-parchment/50">limit</span>
                  </p>
                </div>

                {/* Projects */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">GET</span>
                    <span className="font-mono text-sm text-parchment">/v1/projects</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">List all projects with events for this token.</p>
                </div>

                {/* Todos */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-patina/20 text-patina px-2 py-0.5 rounded">POST</span>
                    <span className="font-mono text-sm text-parchment">/v1/todos</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">
                    Create a TODO. Body: <span className="font-mono text-parchment/50">{`{ message, project? }`}</span>
                  </p>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">GET</span>
                    <span className="font-mono text-sm text-parchment">/v1/todos</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">
                    List TODOs. Query params: <span className="font-mono text-parchment/50">status</span>, <span className="font-mono text-parchment/50">project</span>
                  </p>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">PATCH</span>
                    <span className="font-mono text-sm text-parchment">/v1/todos/:id</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">
                    Update status. Body: <span className="font-mono text-parchment/50">{`{ status, issue_url? }`}</span>. Flow: pending → dispatched → done
                  </p>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-ember/20 text-ember px-2 py-0.5 rounded">DELETE</span>
                    <span className="font-mono text-sm text-parchment">/v1/todos/:id</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">Delete a TODO.</p>
                </div>

                {/* Board Token */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-patina/20 text-patina px-2 py-0.5 rounded">POST</span>
                    <span className="font-mono text-sm text-parchment">/v1/board-token</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">
                    Create a read-only board token (<span className="font-mono text-parchment/50">tnb_...</span>) for sharing.
                  </p>
                </div>

                {/* Board views */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">GET</span>
                    <span className="font-mono text-sm text-parchment">/:token</span>
                    <span className="text-smoke/40 text-xs ml-auto">no auth</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">HTML board view. Works with <span className="font-mono text-parchment/50">tnd_</span> or <span className="font-mono text-parchment/50">tnb_</span> tokens in the URL.</p>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">GET</span>
                    <span className="font-mono text-sm text-parchment">/:token/llms.txt</span>
                    <span className="text-smoke/40 text-xs ml-auto">no auth</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">Structured Markdown for agents. Project states, messages, insights, and backlog.</p>
                </div>

                {/* Insights */}
                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">GET</span>
                    <span className="font-mono text-sm text-parchment">/v1/insights</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">LLM-generated summaries and next-action predictions for all projects.</p>
                </div>

                <div className="px-5 py-4">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">GET</span>
                    <span className="font-mono text-sm text-parchment">/v1/insights/:project</span>
                  </div>
                  <p className="font-body text-smoke/60 text-xs mt-2">Insight for a single project. Returns summary, prediction, and cache timestamp.</p>
                </div>
              </div>
            </div>

            {/* Quick example */}
            <div className="api-el mt-8 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">quick start</span>
              </div>
              <div className="p-5 font-mono text-xs space-y-2">
                <div className="text-smoke/50"># 1. Register</div>
                <div><span className="text-smoke/50">$ </span><span className="text-parchment/80">curl -X POST https://relay.tend.cx/v1/register</span></div>
                <div className="text-smoke/50 ml-2">{`→ { "token": "tnd_abc123..." }`}</div>
                <div className="text-smoke/50 mt-3"># 2. Emit state</div>
                <div><span className="text-smoke/50">$ </span><span className="text-parchment/80">{`curl -X POST https://relay.tend.cx/v1/events \\`}</span></div>
                <div className="text-parchment/80 ml-4">{`-H "Authorization: Bearer tnd_abc123..." \\`}</div>
                <div className="text-parchment/80 ml-4">{`-d '{"project":"my-app","state":"working","message":"building auth"}'`}</div>
                <div className="text-smoke/50 mt-3"># 3. View your board</div>
                <div><span className="text-smoke/50">$ </span><span className="text-parchment/80">open https://relay.tend.cx/tnd_abc123...</span></div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* PERFORMANCE */}
      <section className="py-20 md:py-28 px-6">
        <ScrollReveal triggerClassName="perf-el">
          <div className="max-w-3xl mx-auto">
            <p className="perf-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Performance</p>

            <h2 className="perf-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
              26ms per Enter.<br />
              <span className="text-smoke">Same as git.</span>
            </h2>

            <p className="perf-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
              The shell prompt indicator reads from a local cache file and returns immediately. Background refresh happens in a detached process — you never wait for it.
            </p>

            {/* Benchmark terminal */}
            <div className="perf-el mt-10 bg-anvil rounded-[1.25rem] overflow-hidden shadow-xl">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
                <span className="font-mono text-[11px] text-smoke/40 ml-2">$ hyperfine — 200 runs, Apple Silicon</span>
              </div>
              <div className="p-5 font-mono text-xs space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-parchment w-48 shrink-0">tend status</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-patina/60 rounded-full" style={{ width: '52%' }} />
                  </div>
                  <span className="text-patina w-16 text-right">26ms</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-parchment w-48 shrink-0">git branch --show-current</span>
                  <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-patina/60 rounded-full" style={{ width: '50%' }} />
                  </div>
                  <span className="text-patina w-16 text-right">25ms</span>
                </div>
                <div className="mt-2 pt-3 border-t border-white/5 text-smoke/40">
                  Statistically equivalent. No perceptible difference.
                </div>
              </div>
            </div>

            {/* Safeguards */}
            <div className="perf-el mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-anvil/5 border border-anvil/10 rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">Cache-first</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  Prompt reads a local file. Computation happens in a detached background process for the next prompt.
                </p>
              </div>
              <div className="bg-anvil/5 border border-anvil/10 rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">200ms timeout</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  If the binary ever hangs, the shell kills it. After 3 failures, the hook auto-disables for the session.
                </p>
              </div>
              <div className="bg-anvil/5 border border-anvil/10 rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">No network</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  <span className="font-mono text-anvil">td status</span> never contacts the relay. Network calls only on explicit board or relay commands.
                </p>
              </div>
              <div className="bg-anvil/5 border border-anvil/10 rounded-2xl p-5">
                <p className="font-heading font-bold text-anvil text-sm">No daemon</p>
                <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
                  No background process, no watcher, no polling. The binary runs, prints, and exits.
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
              <a href="#api" className="text-smoke hover:text-anvil transition-colors link-lift">API</a>
            </div>
            <span className="font-mono text-[11px] text-smoke/50">© 2026 Wallet Labs LLC · MIT License</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
