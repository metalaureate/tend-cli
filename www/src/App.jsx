import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, ExternalLink, Github } from 'lucide-react'

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
        px-6 py-3 rounded-full flex items-center gap-6
        ${scrolled
          ? 'bg-parchment/70 backdrop-blur-xl border border-chalk shadow-lg text-anvil'
          : 'bg-anvil/40 backdrop-blur-sm text-parchment border border-white/5'
        }`}
      style={{ maxWidth: '600px', width: '90%' }}
    >
      <a href="#" className="font-mono text-sm font-medium tracking-tight">tend</a>
      <div className="hidden sm:flex items-center gap-5 ml-auto text-sm">
        <a href="#problem" className="link-lift opacity-70 hover:opacity-100 transition-opacity">Why</a>
        <a href="#how" className="link-lift opacity-70 hover:opacity-100 transition-opacity">How</a>
        <a
          href="https://github.com/metalaureate/tend-cli"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-magnetic inline-flex items-center gap-1.5 bg-ember text-parchment px-4 py-1.5 rounded-full text-sm font-medium"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            <Github size={14} /> GitHub
          </span>
          <span className="btn-bg bg-anvil rounded-full" />
        </a>
      </div>
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
    { icon: '◉', name: 'tari-universe', state: 'done', msg: 'PR #847 ready for review', time: '', color: 'text-ember' },
    { icon: '◉', name: 'fable', state: 'working', msg: 'refactoring narrative engine', time: '12m', color: 'text-patina' },
    { icon: '▲', name: 'social-scanner', state: 'stuck', msg: 'tool approval needed', time: '', color: 'text-ember' },
    { icon: '◉', name: 'hestia', state: 'working', msg: 'building auth scaffold', time: '3m', color: 'text-patina' },
    { icon: '◌', name: 'dead-internet', state: 'idle', msg: 'updated landing copy', time: '2h', color: 'text-smoke/50' },
    { icon: '◌', name: 'clawzempic', state: 'idle', msg: 'benchmark suite passing', time: '1d', color: 'text-smoke/50' },
  ]

  return (
    <section ref={ref} className="bg-anvil pt-28 pb-20 md:pt-36 md:pb-28 px-6">
      <div className="max-w-3xl mx-auto">
        {/* Headline */}
        <h1 className="hero-el font-heading font-bold text-parchment text-3xl md:text-5xl lg:text-6xl leading-[1.1] tracking-tight">
          What's running?<br />
          <span className="text-smoke">What needs me?</span>
        </h1>

        <p className="hero-el font-body text-smoke text-base md:text-lg mt-6 max-w-xl leading-relaxed">
          A pull-based CLI that replaces agent dashboards with a departures board and a shell prompt glyph, so you can stay in flow and check agents only at natural pauses.
        </p>

        {/* The Board — this IS the product */}
        <div className="hero-el mt-10 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
          {/* Terminal chrome */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="font-mono text-[11px] text-smoke/40 ml-2">$ tend</span>
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
          <span className="font-mono text-xs text-smoke/40">Bash script</span>
          <span className="text-smoke/20">·</span>
          <span className="font-mono text-xs text-smoke/40">Zero dependencies</span>
          <span className="text-smoke/20">·</span>
          <span className="font-mono text-xs text-smoke/40">No daemon</span>
          <span className="text-smoke/20">·</span>
          <span className="font-mono text-xs text-smoke/40">No database</span>
        </div>

        {/* CTA */}
        <div className="hero-el mt-8 flex flex-col sm:flex-row items-start gap-4">
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
   THE PROBLEM — Anti-dashboard thesis
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Problem() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.prob-el', {
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
        <p className="prob-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">The problem</p>

        <h2 className="prob-el font-heading font-bold text-2xl md:text-4xl text-anvil leading-tight">
          You check your agents for the 47th time today.<br />
          <span className="text-smoke">Nothing has changed.</span>
        </h2>

        <div className="prob-el mt-8 font-body text-smoke text-base md:text-lg leading-relaxed space-y-5 max-w-2xl">
          <p>
            You're running four projects. Two agents are actively working. One finished ten minutes
            ago and needs your review. One is stuck on a tool approval. But you don't know any of
            this — so you check. Tab, check. Tab, check. Tab, check.
          </p>
          <p>
            Each check is a context switch. Each context switch degrades focus. You end up
            project-managing instead of building. The polling isn't productive — it's a compulsion
            driven by uncertainty. The absence of information creates anxiety, and the anxiety
            creates the check.
          </p>
        </div>

        {/* The anti-dashboard argument */}
        <div className="prob-el mt-12 bg-parchment border border-chalk rounded-[1.5rem] p-6 md:p-8">
          <p className="font-heading font-bold text-lg md:text-xl text-anvil">
            30+ tools have launched to solve this. Every single one builds a dashboard.
          </p>
          <p className="font-body text-smoke mt-3 leading-relaxed">
            Live panels. Notification badges. Real-time streaming. TUIs, GUIs, Electron wrappers.
            They add more surface to monitor. A dashboard is a permanent invitation to poll.
            A notification badge is an interrupt. They make the problem worse.
          </p>
        </div>

        {/* The thesis */}
        <div className="prob-el mt-12 md:mt-16">
          <p className="font-body text-smoke text-lg md:text-xl leading-relaxed">
            Every competitor builds more UI.
          </p>
          <h3 className="mt-4">
            <span className="font-display text-anvil text-3xl md:text-5xl lg:text-6xl">
              Tend builds{' '}
            </span>
            <span className="font-display text-ember text-3xl md:text-5xl lg:text-6xl">
              less.
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
          The shell prompt indicator fires after every command you run. It's already in your visual field.
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
            <div className="text-smoke/40 mb-1">~/projects/fable</div>
            <div className="flex items-center gap-2">
              <span className="text-smoke/50">$</span>
              <span className="text-parchment/70">git push origin feat/narrative</span>
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
            { step: 'Stay on the train.', desc: 'Deep work in one project. The prompt is silent.' },
            { step: 'Reach a station.', desc: 'Natural pause. Agent is running. You finished a thought.' },
            { step: 'Glance at the board.', desc: 'Type tend. 3-second scan. Handle what needs handling. Get back on.' },
          ].map((item, i) => (
            <div key={i} className="bg-white/5 rounded-[1rem] p-5">
              <p className="font-heading font-bold text-parchment text-sm">{item.step}</p>
              <p className="font-body text-smoke text-sm mt-2 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        <p className="glyph-el font-body text-smoke/60 text-sm mt-8 max-w-xl leading-relaxed">
          The metaphor is public transit, not mission control. You don't stare at the departures board — you glance when you walk into the station.
        </p>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOW IT WORKS — Three steps
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HowItWorks() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.how-el', {
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
    <section id="how" ref={ref} className="py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="how-el font-mono text-xs text-smoke/50 uppercase tracking-widest mb-6">How it works</p>

        <div className="space-y-10">
          {/* Step 1 */}
          <div className="how-el">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-mono text-smoke/30 text-sm">01</span>
              <h3 className="font-heading font-bold text-xl md:text-2xl text-anvil">Initialize</h3>
            </div>
            <div className="bg-anvil rounded-[1rem] p-4 font-mono text-sm">
              <div>
                <span className="text-smoke/50">$ </span>
                <span className="text-parchment">cd ~/projects/my-app && tend init</span>
              </div>
              <div className="text-patina mt-2 text-xs">✓ Created .tend/ directory</div>
              <div className="text-patina text-xs">✓ Added protocol to AGENTS.md</div>
              <div className="text-patina text-xs">✓ Registered project</div>
            </div>
            <p className="font-body text-smoke text-sm mt-3 leading-relaxed">
              One command in your project root. Sets up the event log, teaches your agents the protocol via AGENTS.md, wires the shell prompt indicator.
            </p>
          </div>

          {/* Step 2 */}
          <div className="how-el">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-mono text-smoke/30 text-sm">02</span>
              <h3 className="font-heading font-bold text-xl md:text-2xl text-anvil">Agents emit. You don't poll.</h3>
            </div>
            <div className="bg-anvil rounded-[1rem] p-4 font-mono text-xs space-y-1">
              <div className="text-smoke/30 mb-2"># .tend/events — append-only, plain text</div>
              <div className="text-patina">2026-03-14T14:20:00 working refactoring narrative engine</div>
              <div className="text-parchment">2026-03-14T14:45:00 done    refactored narrative engine (PR #204)</div>
              <div className="text-ember">2026-03-14T14:46:00 stuck   tool approval needed: npm test</div>
              <div className="text-patina">2026-03-14T15:01:00 working resumed after approval</div>
              <div className="text-smoke/50">2026-03-14T15:30:00 idle    session ended</div>
            </div>
            <p className="font-body text-smoke text-sm mt-3 leading-relaxed">
              Five states: <span className="font-mono text-patina">working</span>,{' '}
              <span className="font-mono text-parchment">done</span>,{' '}
              <span className="font-mono text-ember">stuck</span>,{' '}
              <span className="font-mono text-ember">waiting</span>,{' '}
              <span className="font-mono text-smoke">idle</span>.
              No YAML. No JSON. Just timestamps and human-readable messages.
            </p>
          </div>

          {/* Step 3 */}
          <div className="how-el">
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-mono text-smoke/30 text-sm">03</span>
              <h3 className="font-heading font-bold text-xl md:text-2xl text-anvil">Glance. Handle. Disappear.</h3>
            </div>
            <p className="font-body text-smoke text-sm leading-relaxed">
              Run <span className="font-mono text-anvil">tend</span> from anywhere. The board shows what needs you.
              <span className="font-mono text-anvil"> tend switch</span> jumps to the right editor window.
              <span className="font-mono text-anvil"> tend add</span> queues work for the agent.
              No persistent UI. No daemon. It runs, shows you the state, and exits.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {[
                'tend',
                'tend <project>',
                'tend switch',
                'tend add "msg"',
                'tend emit',
                'tend ack',
              ].map((cmd) => (
                <span
                  key={cmd}
                  className="font-mono text-xs text-smoke bg-anvil/5 border border-chalk px-3 py-1.5 rounded-lg"
                >
                  {cmd}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PRINCIPLES — Four tight statements
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Principles() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.princ-el', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: { trigger: ref.current, start: 'top 80%' },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  const principles = [
    { title: 'Pull, not push.', desc: 'No notifications. No badges. No live updates. Tend speaks only when spoken to.' },
    { title: 'Scan, don\'t read.', desc: 'The board is a 3-second glance. Status icons are the primary signal.' },
    { title: 'Act or jump.', desc: 'Queue a task with tend add. Focus the right window with tend switch. Handle it inline.' },
    { title: 'Then disappear.', desc: 'No persistent UI. No daemon. No background process. It runs and exits.' },
  ]

  return (
    <section ref={ref} className="bg-anvil py-20 md:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {principles.map((p, i) => (
            <div key={i} className="princ-el bg-white/5 border border-white/5 rounded-[1.25rem] p-6">
              <h3 className="font-heading font-bold text-parchment text-base">{p.title}</h3>
              <p className="font-body text-smoke text-sm mt-2 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GET STARTED
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function GetStarted() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gs-el', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: { trigger: ref.current, start: 'top 80%' },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section id="get-started" ref={ref} className="py-20 md:py-28 px-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="gs-el font-display text-3xl md:text-5xl text-anvil text-center">
          Start tending.
        </h2>

        {/* Terminal */}
        <div className="gs-el mt-10 bg-anvil rounded-[1.25rem] overflow-hidden shadow-xl">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
            <span className="w-2.5 h-2.5 rounded-full bg-ember/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-patina/40" />
            <span className="font-mono text-[11px] text-smoke/40 ml-2">terminal</span>
          </div>
          <div className="p-5 font-mono text-sm space-y-1.5">
            <div><span className="text-smoke/50">$ </span><span className="text-parchment">git clone https://github.com/metalaureate/tend-cli</span></div>
            <div><span className="text-smoke/50">$ </span><span className="text-parchment">cd tend-cli && make install</span></div>
            <div><span className="text-smoke/50">$ </span><span className="text-parchment">cd ~/projects/my-app && tend init</span></div>
            <div className="text-patina text-xs mt-3 pt-3 border-t border-white/5">✓ Ready. Run tend to see your board.</div>
          </div>
        </div>

        {/* The referral sentence */}
        <p className="gs-el font-body text-smoke text-center text-sm mt-8 max-w-md mx-auto leading-relaxed">
          &ldquo;I put a dot in my terminal prompt that tells me if any of my agents need me. I stopped checking.&rdquo;
        </p>

        {/* CTA */}
        <div className="gs-el flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
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
          <a
            href="https://github.com/metalaureate/tend-cli/blob/main/README.md"
            target="_blank"
            rel="noopener noreferrer"
            className="link-lift font-heading text-sm text-ember flex items-center gap-1"
          >
            Read the docs <ExternalLink size={14} />
          </a>
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
    <footer className="bg-anvil rounded-t-[2rem] md:rounded-t-[3rem] pt-12 pb-8 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
          <div>
            <span className="font-mono text-parchment text-sm">tend</span>
            <p className="font-body text-smoke/60 text-xs mt-2 max-w-xs leading-relaxed">
              Lightweight attention infrastructure for humans and agents.
            </p>
          </div>
          <div className="flex gap-6 text-xs">
            <a href="https://github.com/metalaureate/tend-cli" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-parchment transition-colors link-lift">GitHub</a>
            <a href="https://github.com/metalaureate/tend-cli/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-parchment transition-colors link-lift">Docs</a>
            <a href="https://github.com/metalaureate/tend-cli/blob/main/templates/AGENTS.md.template" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-parchment transition-colors link-lift">AGENTS.md</a>
          </div>
        </div>
        <div className="border-t border-white/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-patina pulse-dot" />
            <span className="font-mono text-[11px] text-smoke/40">relay.tend.dev</span>
          </div>
          <span className="font-mono text-[11px] text-smoke/30">MIT License · Built for the age of agents.</span>
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
      <Problem />
      <PromptGlyph />
      <HowItWorks />
      <Principles />
      <GetStarted />
      <Footer />
    </div>
  )
}
