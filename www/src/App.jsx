import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, Github } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NAVBAR
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out
        px-5 py-2.5 rounded-xl flex items-center gap-6
        ${scrolled
          ? 'bg-parchment/80 backdrop-blur-xl border border-chalk shadow-lg text-anvil'
          : 'bg-anvil/60 backdrop-blur-md text-parchment border border-white/10'
        }`}
    >
      <a href="#" className="font-heading text-sm font-bold tracking-tight">tend <span className="text-smoke/40 font-normal">|</span> td</a>
      <div className="hidden sm:flex items-center gap-5 text-sm">
        <a href="#problem" className="link-lift opacity-70 hover:opacity-100 transition-opacity">Why</a>
        <a href="#get-started" className="link-lift opacity-70 hover:opacity-100 transition-opacity">Install</a>
      </div>
      <a
        href="https://github.com/metalaureate/tend-cli"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-magnetic inline-flex items-center gap-1.5 bg-ember text-parchment px-3.5 py-1.5 rounded-lg text-sm font-medium ml-2"
      >
        <span className="relative z-10 flex items-center gap-1.5">
          <Github size={14} /> GitHub
        </span>
        <span className="btn-bg bg-anvil rounded-lg" />
      </a>
    </nav>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HERO — The product IS the hero visual
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Hero() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-el', {
        y: 30,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.08,
        delay: 0.2,
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  const board = [
    { icon: '◉', name: 'atlas-api', state: 'done', msg: 'PR #847 ready for review', time: '', color: 'text-ember' },
    { icon: '◐', name: 'northstar', state: 'working', msg: 'refactoring narrative engine', time: '12m', color: 'text-patina' },
    { icon: '?', name: 'beacon', state: 'stuck', msg: 'tool approval needed', time: '', color: 'text-ember' },
    { icon: '◐', name: 'sextant', state: 'working', msg: 'building auth scaffold', time: '3m', color: 'text-patina' },
    { icon: '◌', name: 'meridian', state: 'idle', msg: 'updated landing copy', time: '2h', color: 'text-smoke/50' },
    { icon: '◌', name: 'waypoint', state: 'idle', msg: 'benchmark suite passing', time: '1d', color: 'text-smoke/50' },
  ]

  return (
    <section ref={ref} className="bg-anvil pt-28 pb-20 md:pt-36 md:pb-28 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Headline */}
        <h1 className="hero-el font-heading font-bold text-parchment text-3xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight">
          Who's stuck?<br />
          <span className="text-smoke">Who needs you?</span>
        </h1>

        <p className="hero-el font-body text-smoke text-base md:text-lg mt-6 max-w-xl leading-relaxed">
          Lightweight attention infrastructure for humans and agents. A pull-based CLI that replaces dashboards with a single status board and a shell prompt glyph.
        </p>

        {/* The Board — this IS the product */}
        <div className="hero-el mt-10 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
          {/* Terminal chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="font-mono text-[11px] text-smoke/40 ml-2">$ td</span>
          </div>
          {/* Board output */}
          <div className="px-4 md:px-5 py-4 font-mono text-[11px] md:text-xs leading-relaxed">
            <div className="text-smoke/40 mb-3 flex justify-between">
              <span className="tracking-widest text-parchment/60 font-medium">TEND</span>
              <span>Fri Mar 14, 14:32</span>
            </div>
            <div className="space-y-1">
              {board.map((row, i) => (
                <div key={i} className="flex">
                  <span className={`${row.color} w-4 shrink-0`}>{row.icon}</span>
                  <span className="text-parchment/70 w-[7.5rem] md:w-36 shrink-0 truncate ml-1">{row.name}</span>
                  <span className={`${row.color} w-16 shrink-0`}>{row.state}</span>
                  <span className="text-smoke/50 truncate hidden sm:block">{row.msg}</span>
                  {row.time && <span className="text-smoke/30 ml-auto pl-2 shrink-0">({row.time})</span>}
                </div>
              ))}
            </div>
            <div className="text-smoke/30 mt-4 pt-3 border-t border-white/5">
              2 need you · 2 working · 2 idle
            </div>
          </div>
        </div>

        {/* Sub-proof */}
        <div className="hero-el flex flex-wrap items-center gap-x-4 gap-y-2 mt-6">
          <span className="font-mono text-xs text-smoke/40">Single binary</span>
          <span className="text-smoke/20">·</span>
          <span className="font-mono text-xs text-smoke/40">Zero dependencies</span>
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
              Get Started <ArrowRight size={15} />
            </span>
            <span className="btn-bg bg-parchment/20 rounded-full" />
          </a>
          <a
            href="https://github.com/metalaureate/tend-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="link-lift font-mono text-sm text-smoke/60 hover:text-parchment transition-colors flex items-center gap-1.5"
          >
            <Github size={14} /> View source
          </a>
        </div>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   WHY TEND EXISTS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function WhyTend() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.why-el', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: 'top 75%' },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section id="problem" ref={ref} className="py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="why-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Why Tend exists</p>

        <h2 className="why-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
          The scarce resource isn't code.<br />
          <span className="text-smoke">It's the attention of the person in charge.</span>
        </h2>

        <div className="why-el mt-8 font-body text-smoke text-base md:text-lg leading-relaxed space-y-5 max-w-2xl">
          <p>
            Builders today are less like lone coders and more like a master blacksmith tending an ever-growing workshop of agents — or a head chef running a large kitchen of cooks.
          </p>
          <p>
            Every tool for managing these agents builds a dashboard. Live panels, notification badges, real-time streaming. They assume agents run autonomously and you check in when they're done.
          </p>
          <p>
            Some do. But the reality is a distribution. On any given day you might have two or three projects where you're actively collaborating with an agent — steering it every 5–15 minutes, reviewing its work, making judgment calls on tricky details inside a large codebase. A couple more where you're grooming a spec or a plan, kicking off revisions and checking back when the agent has a new draft. Another two where the agent can run for longer stretches before it needs you. And a couple more — cloud refactors, test suites, research jobs, or agents running actual lines of business such as customer support or sales — that might run for hours and only need you if they get stuck.
          </p>
          <p>
            As AI agents and tooling improves, five simultaneous projects will become ten, then twenty — expanding into all roles — to fill the only truly scarce resource: the attention of the person in charge, the one responsible for success and failure.
          </p>
        </div>

        {/* The unsolved problem */}
        <div className="why-el mt-12 bg-parchment border border-chalk rounded-[1.5rem] p-6 md:p-8">
          <p className="font-heading font-bold text-lg md:text-xl text-anvil">
            The unsolved problem is attention management.
          </p>
          <p className="font-body text-smoke mt-3 leading-relaxed">
            The projects where you and the agent are working together at varying cadences, and you need to stay in your train of thought while still being reachable by the others. A dashboard doesn't help here. It's a permanent invitation to break focus. A notification badge is an interrupt. They add vigilance, not concentration.
          </p>
        </div>

        <div className="why-el mt-8 font-body text-smoke text-base md:text-lg leading-relaxed space-y-5 max-w-2xl">
          <p>
            This isn't just an efficiency problem. The builder's span of control shrinks. Five projects that could be ten. And the constant low-grade anxiety of not knowing what's happening elsewhere becomes chronic.
          </p>
          <p>
            The problem isn't even specific to humans. An agent coordinating other agents — an agent CEO running an autonomous company — hits the same bottleneck. It spawns subagents across threads and environments, each working at different cadences. Polling a dashboard wastes compute the same way it wastes human focus. The pull model, the five-state protocol, the relay — they work just as well when the coordinator is an agent. Tend is attention infrastructure, not just a developer tool.
          </p>
        </div>

        {/* The thesis */}
        <div className="why-el mt-12 md:mt-16">
          <h3>
            <span className="font-display text-anvil text-3xl md:text-5xl lg:text-6xl">
              Tend doesn't build a better dashboard.
            </span>
            <br />
            <span className="font-display text-ember text-3xl md:text-5xl lg:text-6xl">
              It removes the need for one.
            </span>
          </h3>
        </div>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   THE PROMPT GLYPH — Ambient certainty
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PromptGlyph() {
  const ref = useRef(null)
  const [glyphState, setGlyphState] = useState(0) // 0 = clear, 1 = needs attention
  const states = [
    { glyph: '○', label: 'nothing needs you', color: 'text-smoke' },
    { glyph: '●3', label: '3 things need attention', color: 'text-ember' },
  ]

  useEffect(() => {
    const interval = setInterval(() => setGlyphState(s => (s + 1) % 2), 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.glyph-el', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: 'top 75%' },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  const current = states[glyphState]

  return (
    <section ref={ref} className="bg-anvil py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="glyph-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">The insight</p>

        <h2 className="glyph-el font-heading font-bold text-2xl md:text-4xl text-parchment leading-tight">
          A single dot in your prompt.<br />
          <span className="text-smoke">Ambient certainty.</span>
        </h2>

        <p className="glyph-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
          The shell prompt indicator updates after every command you run. It's already in your visual field.
          When it says <span className="font-mono text-parchment">○</span>, nothing needs you. The uncertainty — which
          is what drives the compulsive checking — is gone.
        </p>

        {/* Live prompt demo */}
        <div className="glyph-el mt-10 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="font-mono text-[11px] text-smoke/40 ml-2">zsh</span>
          </div>
          <div className="p-5 font-mono text-sm">
            <div className="text-smoke/40 mb-1">~/projects/northstar</div>
            <div className="flex items-center gap-2">
              <span className="text-smoke/50">$</span>
              <span className="text-parchment/70">git push origin feat/myfeature</span>
              <span
                className={`ml-auto transition-all duration-500 text-lg ${current.color}`}
              >
                {current.glyph}
              </span>
            </div>
            <div className="text-smoke/20 text-xs mt-3 text-right transition-all duration-500">
              {current.label}
            </div>
          </div>
        </div>

        {/* The train metaphor */}
        <div className="glyph-el mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: 'Stay on your mind train.', desc: 'Deep work in one project. The prompt is silent.' },
            { step: 'Reach a station.', desc: 'Natural pause. Agent is running. You finished a thought.' },
            { step: 'Glance at the board.', desc: 'Type td. 3-second scan. Handle what needs handling. Get back on.' },
          ].map((item, i) => (
            <div key={i} className="bg-white/5 rounded-[1rem] p-5">
              <p className="font-heading font-bold text-parchment text-sm">{item.step}</p>
              <p className="font-body text-smoke text-sm mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <p className="glyph-el font-body text-smoke/60 text-sm mt-8 max-w-xl leading-relaxed">
          The goal is maximizing flow state while supervising a dozen constantly working agents. Not a dashboard you monitor — a board you glance at when you're ready to switch context.
        </p>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INSTALL
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Install() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.inst-el', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: 'top 75%' },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section id="get-started" ref={ref} className="py-20 md:py-28 px-6">
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
              ✓ Configured lifecycle hooks<br />
              ✓ Added protocol to AGENTS.md (fallback)<br />
              ✓ Registered project
            </div>
          </div>
        </div>

        <p className="inst-el font-body text-smoke text-sm mt-6 leading-relaxed max-w-2xl">
          <span className="font-mono text-anvil">td init</span> sets up the event log, configures lifecycle hooks compatible with Claude Code and Copilot, and adds the protocol to AGENTS.md as a fallback. Run <span className="font-mono text-anvil">td</span> from anywhere to see your board.
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
            <div className="text-parchment/80 mb-3">td — Who's stuck? Who needs you?</div>
            <div className="text-smoke/40 mb-2">Usage:</div>
            <div className="space-y-0.5 text-smoke/60">
              {[
                ['td', 'Show the status board'],
                ['td <project>', 'Project detail + agent sessions'],
                ['td init [project]', 'Initialize .tend/ in a project'],
                ['td clear [project]', 'Clear events history for a project'],
                ['td add [project] "msg"', 'Queue a TODO for the agent\'s next session'],
                ['td ack [project]', 'Clear done/stuck/waiting \u2192 idle'],
                ['td relay <subcmd>', 'Relay management (setup|status|pull|token)'],
                ['td version', 'Show version'],
                ['td help', 'Show this help'],
              ].map(([cmd, desc]) => (
                <div key={cmd} className="flex">
                  <span className="text-parchment/70 w-[13rem] md:w-60 shrink-0">{cmd}</span>
                  <span className="text-smoke/60">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RELAY — Remote agents
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Relay() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.relay-el', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: 'top 75%' },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} className="bg-anvil py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="relay-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">Remote agents</p>

        <h2 className="relay-el font-heading font-bold text-2xl md:text-4xl text-parchment leading-tight">
          One board. Every agent.<br />
          <span className="text-smoke">Wherever they run.</span>
        </h2>

        <p className="relay-el font-body text-smoke text-base md:text-lg mt-6 leading-relaxed max-w-2xl">
          Local agents write to <span className="font-mono text-parchment">.tend/events</span> directly — no network, no accounts, plain text. But agents increasingly run elsewhere: Codex in the cloud, CI pipelines, SSH sessions, remote worktrees. Without a common protocol, you're back to maintaining per-environment solutions.
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
            <div className="text-parchment/80 ml-2">export TEND_RELAY_TOKEN="tnd_281w29...392t"</div>
          </div>
        </div>

        {/* How it ties together */}
        <div className="relay-el mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white/5 rounded-[1rem] p-5">
            <p className="font-heading font-bold text-parchment text-sm">Setup: one token</p>
            <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
              Run <span className="font-mono text-parchment">td relay setup</span> on your laptop.
              Copy the token to each remote environment as <span className="font-mono text-parchment">TEND_RELAY_TOKEN</span>.
              No accounts. No passwords. No signup.
            </p>
          </div>
          <div className="bg-white/5 rounded-[1rem] p-5">
            <p className="font-heading font-bold text-parchment text-sm">Agents don't change</p>
            <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
              The agent's AGENTS.md instructions stay the same. The developer sets a token on the remote environment and the CLI handles the rest. The relay is invisible plumbing.
            </p>
          </div>
          <div className="bg-white/5 rounded-[1rem] p-5">
            <p className="font-heading font-bold text-parchment text-sm">No daemon. No sync.</p>
            <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
              <span className="font-mono text-parchment">td</span> reads from local cache — never hits the network, stays under 100ms.
              The board refreshes the cache on each invocation, then renders from cache.
            </p>
          </div>
          <div className="bg-white/5 rounded-[1rem] p-5">
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
                <span className="text-parchment/70 w-[7.5rem] md:w-36 shrink-0 truncate ml-1">my-app</span>
                <span className="text-patina w-16 shrink-0">working</span>
                <span className="text-smoke/50 truncate hidden sm:block">building auth scaffold</span>
                <span className="text-smoke/30 ml-auto pl-2 shrink-0">(3m)</span>
              </div>
              <div className="flex">
                <span className="text-ember w-4 shrink-0">◉</span>
                <span className="text-parchment/70 w-[7.5rem] md:w-36 shrink-0 truncate ml-1">cloud-refactor</span>
                <span className="text-ember w-16 shrink-0">done</span>
                <span className="text-smoke/50 truncate hidden sm:block">migration complete (PR #12)</span>
                <span className="text-parchment/40 ml-auto pl-2 shrink-0">↗</span>
              </div>
              <div className="flex">
                <span className="text-smoke/50 w-4 shrink-0">◌</span>
                <span className="text-parchment/70 w-[7.5rem] md:w-36 shrink-0 truncate ml-1">deep-search</span>
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
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FOOTER
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Footer() {
  return (
    <footer className="pt-16 pb-8 px-6">
      <div className="max-w-3xl mx-auto">
        {/* CTA */}
        <div className="text-center mb-16">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://github.com/metalaureate/tend-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-magnetic inline-flex items-center gap-2 bg-ember text-parchment px-6 py-3 rounded-full font-heading font-medium text-sm"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Github size={16} /> View on GitHub <ArrowRight size={15} />
              </span>
              <span className="btn-bg bg-anvil rounded-full" />
            </a>
          </div>
        </div>

        {/* Footer bar */}
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
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   APP
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <WhyTend />
      <PromptGlyph />
      <Install />
      <Relay />
      <Footer />
    </div>
  )
}
