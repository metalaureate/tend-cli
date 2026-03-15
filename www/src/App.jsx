import { useEffect, useRef, useState, useCallback } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, ExternalLink, Github, Terminal } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   NAVBAR — "The Floating Island"
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0.1 }
    )
    const hero = document.getElementById('hero')
    if (hero) observer.observe(hero)
    return () => observer.disconnect()
  }, [])

  return (
    <nav
      ref={navRef}
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ease-out
        px-6 py-3 rounded-full flex items-center gap-6
        ${scrolled
          ? 'bg-parchment/60 backdrop-blur-xl border border-chalk shadow-lg text-anvil'
          : 'bg-transparent text-parchment'
        }`}
      style={{ maxWidth: '720px', width: '90%' }}
    >
      <a href="#" className="font-mono text-sm font-medium tracking-tight whitespace-nowrap">
        tend
      </a>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-5 ml-auto text-sm">
        <a href="#features" className="link-lift opacity-80 hover:opacity-100 transition-opacity">How It Works</a>
        <a href="#philosophy" className="link-lift opacity-80 hover:opacity-100 transition-opacity">Philosophy</a>
        <a href="#get-started" className="link-lift opacity-80 hover:opacity-100 transition-opacity">Get Started</a>
        <a
          href="https://github.com/metalaureate/tend-cli"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-magnetic inline-flex items-center gap-2 bg-ember text-parchment px-4 py-2 rounded-full text-sm font-medium"
        >
          <span className="relative z-10 flex items-center gap-2">
            Install Tend <ArrowRight size={14} />
          </span>
          <span className="btn-bg bg-anvil rounded-full" />
        </a>
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden ml-auto"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        <div className="space-y-1.5">
          <span className={`block w-5 h-0.5 transition-transform ${scrolled ? 'bg-anvil' : 'bg-parchment'} ${mobileOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-0.5 transition-opacity ${scrolled ? 'bg-anvil' : 'bg-parchment'} ${mobileOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 transition-transform ${scrolled ? 'bg-anvil' : 'bg-parchment'} ${mobileOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </div>
      </button>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-parchment/95 backdrop-blur-xl rounded-2xl border border-chalk p-4 flex flex-col gap-3 text-anvil md:hidden shadow-xl">
          <a href="#features" onClick={() => setMobileOpen(false)} className="text-sm py-1">How It Works</a>
          <a href="#philosophy" onClick={() => setMobileOpen(false)} className="text-sm py-1">Philosophy</a>
          <a href="#get-started" onClick={() => setMobileOpen(false)} className="text-sm py-1">Get Started</a>
          <a
            href="https://github.com/metalaureate/tend-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-magnetic inline-flex items-center justify-center gap-2 bg-ember text-parchment px-4 py-2.5 rounded-full text-sm font-medium"
          >
            Install Tend <ArrowRight size={14} />
          </a>
        </div>
      )}
    </nav>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HERO — "The Opening Shot"
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Hero() {
  const heroRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.hero-line', {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        stagger: 0.08,
        delay: 0.3,
      })
      gsap.from('.hero-cta', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        delay: 0.8,
      })
      gsap.from('.hero-proof', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        ease: 'power3.out',
        delay: 1.1,
      })
    }, heroRef)
    return () => ctx.revert()
  }, [])

  return (
    <section
      id="hero"
      ref={heroRef}
      className="relative h-[100dvh] flex items-end overflow-hidden"
    >
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=1920&q=80)',
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-anvil via-anvil/80 to-anvil/30" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl px-6 md:px-12 pb-16 md:pb-24">
        <h1>
          <span className="hero-line block font-heading font-bold text-parchment text-2xl md:text-3xl lg:text-4xl mb-2">
            Attention is the
          </span>
          <span className="hero-line block font-display text-parchment text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.05]">
            scarcest resource.
          </span>
        </h1>

        <p className="hero-line font-mono text-smoke text-sm md:text-base mt-6 max-w-lg">
          One command. One glance. Then back to work.
        </p>

        <div className="hero-cta mt-8">
          <a
            href="#get-started"
            className="btn-magnetic inline-flex items-center gap-2 bg-ember text-parchment px-6 py-3 rounded-full font-heading font-medium text-sm md:text-base"
          >
            <span className="relative z-10 flex items-center gap-2">
              Install Tend <ArrowRight size={16} />
            </span>
            <span className="btn-bg bg-parchment/20 rounded-full" />
          </a>
        </div>

        <p className="hero-proof font-mono text-smoke/60 text-xs mt-8 tracking-wide">
          $ tend &nbsp;·&nbsp; No daemon. No database. No config files.
        </p>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FEATURES — Card 1: Departures Board
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function DeparturesBoard() {
  const [order, setOrder] = useState([0, 1, 2])
  const items = [
    { icon: '◐', name: 'my-app', status: 'working', msg: 'building auth scaffold', time: '3m', color: 'text-patina' },
    { icon: '●', name: 'design-system', status: 'stuck', msg: 'tool approval needed: npm test', time: '', color: 'text-ember' },
    { icon: '○', name: 'api-migration', status: 'idle', msg: 'update deps', time: '2h ago', color: 'text-smoke' },
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setOrder(prev => {
        const next = [...prev]
        next.unshift(next.pop())
        return next
      })
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-anvil rounded-[1.5rem] p-4 h-48 flex flex-col justify-center gap-1 overflow-hidden">
      {order.map((idx, pos) => {
        const item = items[idx]
        return (
          <div
            key={idx}
            className="font-mono text-xs md:text-sm transition-all duration-500"
            style={{
              transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
              opacity: pos === 0 ? 1 : pos === 1 ? 0.7 : 0.4,
              transform: `scale(${pos === 0 ? 1 : pos === 1 ? 0.97 : 0.94})`,
            }}
          >
            <span className={item.color}>{item.icon}</span>
            <span className="text-parchment/80 ml-2">{item.name.padEnd(18)}</span>
            <span className={`${item.color} ml-1`}>{item.status.padEnd(10)}</span>
            <span className="text-smoke hidden sm:inline ml-1">{item.msg}</span>
            {item.time && <span className="text-smoke/50 hidden sm:inline ml-1">({item.time})</span>}
          </div>
        )
      })}
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FEATURES — Card 2: Event Stream Typewriter
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function EventStream() {
  const messages = [
    '2026-03-14T14:20:00 working refactoring narrative engine',
    '2026-03-14T14:45:00 done    refactored narrative engine (PR #204)',
    '2026-03-14T14:46:00 stuck   tool approval needed: npm test',
    '2026-03-14T15:01:00 working resumed after approval',
    '2026-03-14T15:30:00 idle    session ended',
  ]
  const [lines, setLines] = useState([])
  const [currentChar, setCurrentChar] = useState(0)
  const [currentMsg, setCurrentMsg] = useState(0)
  const [typing, setTyping] = useState(true)

  useEffect(() => {
    if (!typing) return
    const msg = messages[currentMsg]
    if (currentChar < msg.length) {
      const timer = setTimeout(() => setCurrentChar(c => c + 1), 25)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => {
        setLines(prev => [...prev.slice(-3), msg])
        setCurrentChar(0)
        setCurrentMsg(m => (m + 1) % messages.length)
        if (currentMsg === messages.length - 1) {
          setTyping(false)
          setTimeout(() => {
            setLines([])
            setTyping(true)
          }, 2000)
        }
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [currentChar, currentMsg, typing])

  const partial = messages[currentMsg]?.slice(0, currentChar) || ''

  const colorLine = (line) => {
    if (line.includes('working')) return 'text-patina'
    if (line.includes('stuck')) return 'text-ember'
    if (line.includes('done')) return 'text-parchment'
    return 'text-smoke'
  }

  return (
    <div className="bg-anvil rounded-[1.5rem] p-4 h-48 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2 h-2 rounded-full bg-patina pulse-dot" />
        <span className="font-mono text-xs text-smoke">Live Feed</span>
      </div>
      <div className="flex-1 font-mono text-xs space-y-1 overflow-hidden">
        {lines.map((line, i) => (
          <div key={i} className={`${colorLine(line)} opacity-50`}>
            {line}
          </div>
        ))}
        {typing && (
          <div className={colorLine(partial)}>
            {partial}
            <span className="cursor-blink text-ember">▌</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FEATURES — Card 3: Focus Protocol (Weekly Grid)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function FocusProtocol() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const [activeDay, setActiveDay] = useState(-1)
  const [cursorPos, setCursorPos] = useState({ x: -20, y: 30, visible: false })

  useEffect(() => {
    let step = 0
    const sequence = () => {
      if (step === 0) {
        setCursorPos({ x: 10, y: 30, visible: true })
        step++
        return 400
      }
      if (step <= 7) {
        const targetDay = (step - 1) % 7
        const x = 12 + targetDay * 32
        setCursorPos({ x, y: 30, visible: true })
        if (step === 4) {
          setActiveDay(3) // Wednesday
        }
        step++
        return step === 5 ? 600 : 300
      }
      if (step === 8) {
        setCursorPos({ x: 120, y: 65, visible: true })
        step++
        return 500
      }
      setCursorPos({ x: 120, y: 65, visible: false })
      step = 0
      setActiveDay(-1)
      return 1500
    }

    let timeout
    const run = () => {
      const delay = sequence()
      timeout = setTimeout(run, delay)
    }
    timeout = setTimeout(run, 1000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div className="bg-anvil rounded-[1.5rem] p-4 h-48 relative overflow-hidden">
      <div className="flex gap-3 mt-4 justify-center">
        {days.map((d, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono text-xs transition-all duration-200
              ${activeDay === i
                ? 'bg-ember text-parchment scale-95'
                : 'bg-parchment/10 text-smoke'
              }`}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="flex justify-center mt-4">
        <div className="font-mono text-xs text-smoke/60 bg-parchment/5 px-3 py-1.5 rounded-lg">
          tend switch
        </div>
      </div>

      {/* Animated SVG cursor */}
      {cursorPos.visible && (
        <svg
          className="absolute pointer-events-none transition-all duration-300 ease-out"
          style={{ left: cursorPos.x, top: cursorPos.y }}
          width="16"
          height="20"
          viewBox="0 0 16 20"
          fill="none"
        >
          <path
            d="M1 1L1 14.5L4.5 11L8.5 18L11 17L7 10L12 10L1 1Z"
            fill="#F5F2EB"
            stroke="#111111"
            strokeWidth="1"
          />
        </svg>
      )}

      <div className="absolute bottom-3 left-0 right-0 text-center">
        <span className="font-mono text-[10px] text-smoke/40">
          ○ nothing needs you
        </span>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   FEATURES Section
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Features() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.feature-card', {
        y: 60,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.15,
        scrollTrigger: {
          trigger: '.feature-grid',
          start: 'top 80%',
        },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section id="features" ref={ref} className="py-24 md:py-32 px-6 md:px-12 max-w-6xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="font-heading font-bold text-3xl md:text-4xl text-anvil">
          Functional artifacts
        </h2>
        <p className="font-body text-smoke mt-3 max-w-md mx-auto">
          Not marketing cards. Working micro-UIs that show how Tend feels in practice.
        </p>
      </div>

      <div className="feature-grid grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1 */}
        <div className="feature-card bg-parchment border border-chalk rounded-[2rem] p-6 shadow-sm">
          <DeparturesBoard />
          <h3 className="font-heading font-bold text-lg mt-5 text-anvil">The Departures Board</h3>
          <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
            One glance shows you what needs you, what's running fine, and what's been idle. Handle what needs handling. Get back to work.
          </p>
        </div>

        {/* Card 2 */}
        <div className="feature-card bg-parchment border border-chalk rounded-[2rem] p-6 shadow-sm">
          <EventStream />
          <h3 className="font-heading font-bold text-lg mt-5 text-anvil">Five States. Plain Text.</h3>
          <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
            Agents emit state changes to an append-only log. No YAML. No JSON. Just ISO 8601 timestamps and human-readable messages.
          </p>
        </div>

        {/* Card 3 */}
        <div className="feature-card bg-parchment border border-chalk rounded-[2rem] p-6 shadow-sm">
          <FocusProtocol />
          <h3 className="font-heading font-bold text-lg mt-5 text-anvil">Pull, Not Push</h3>
          <p className="font-body text-smoke text-sm mt-2 leading-relaxed">
            No notifications. No badges. No live updates. Tend speaks only when spoken to. The shell prompt tells you when something needs you.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PHILOSOPHY — "The Manifesto"
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function Philosophy() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.phil-line', {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.phil-content',
          start: 'top 75%',
        },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section
      id="philosophy"
      ref={ref}
      className="relative bg-anvil py-32 md:py-44 overflow-hidden"
    >
      {/* Background texture */}
      <div
        className="absolute inset-0 opacity-[0.07] bg-cover bg-center"
        style={{
          backgroundImage: 'url(https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=1920&q=60)',
        }}
      />

      <div className="phil-content relative z-10 max-w-4xl mx-auto px-6 md:px-12">
        <p className="phil-line font-body text-smoke text-lg md:text-xl leading-relaxed max-w-2xl">
          Every other tool builds a dashboard. Live panels, notification badges, real-time streaming. They assume you want to watch.
        </p>

        <h2 className="phil-line mt-10 md:mt-14">
          <span className="font-display text-parchment text-4xl md:text-6xl lg:text-7xl">
            Tend assumes you want to{' '}
          </span>
          <span className="font-display text-ember text-4xl md:text-6xl lg:text-7xl">
            work.
          </span>
        </h2>

        <div className="phil-line mt-12 flex flex-wrap gap-4 font-mono text-sm text-smoke/60">
          <span>Pull, not push.</span>
          <span className="text-chalk/30">·</span>
          <span>Scan, don't read.</span>
          <span className="text-chalk/30">·</span>
          <span>Act or jump.</span>
          <span className="text-chalk/30">·</span>
          <span>Then disappear.</span>
        </div>
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HOW IT WORKS — Stacking Cards
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function RadarSvg() {
  return (
    <svg viewBox="0 0 200 200" className="w-32 h-32 md:w-40 md:h-40">
      {[80, 60, 40, 20].map((r, i) => (
        <circle
          key={i}
          cx="100" cy="100" r={r}
          fill="none"
          stroke="#2E9E6E"
          strokeWidth="1"
          opacity={0.2 + i * 0.15}
        >
          <animate
            attributeName="r"
            values={`${r};${r + 5};${r}`}
            dur={`${3 + i * 0.5}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values={`${0.15 + i * 0.1};${0.3 + i * 0.1};${0.15 + i * 0.1}`}
            dur={`${3 + i * 0.5}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
      <circle cx="100" cy="100" r="4" fill="#2E9E6E" opacity="0.8">
        <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

function ScannerSvg() {
  return (
    <svg viewBox="0 0 200 120" className="w-40 h-24 md:w-52 md:h-32">
      {/* Grid of dots */}
      {Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 10 }).map((_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={15 + col * 19}
            cy={12 + row * 20}
            r="3"
            fill="#8A8A8A"
            opacity="0.3"
          >
            <animate
              attributeName="fill"
              values="#8A8A8A;#2E9E6E;#8A8A8A"
              dur="4s"
              begin={`${col * 0.3 + row * 0.1}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="opacity"
              values="0.3;0.9;0.3"
              dur="4s"
              begin={`${col * 0.3 + row * 0.1}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))
      )}
      {/* Scan line */}
      <line x1="0" y1="0" x2="0" y2="120" stroke="#E8553D" strokeWidth="2" opacity="0.6">
        <animate attributeName="x1" values="0;200;0" dur="4s" repeatCount="indefinite" />
        <animate attributeName="x2" values="0;200;0" dur="4s" repeatCount="indefinite" />
      </line>
    </svg>
  )
}

function PulseSvg() {
  return (
    <svg viewBox="0 0 200 60" className="w-40 h-14 md:w-52 md:h-20">
      <path
        d="M0,30 L30,30 L40,10 L50,50 L60,20 L70,40 L80,30 L200,30"
        fill="none"
        stroke="#2E9E6E"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          values="400;0"
          dur="3s"
          repeatCount="indefinite"
        />
      </path>
      <circle r="3" fill="#2E9E6E">
        <animateMotion
          path="M0,30 L30,30 L40,10 L50,50 L60,20 L70,40 L80,30 L200,30"
          dur="3s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  )
}

function HowItWorks() {
  const ref = useRef(null)

  const steps = [
    {
      num: '01',
      title: 'tend init',
      desc: 'Sets up everything. .tend/ directory, AGENTS.md integration, shell prompt indicator, project registry. One command in your project root.',
      svg: <RadarSvg />,
    },
    {
      num: '02',
      title: 'Agents emit. You don\'t poll.',
      desc: 'Agents write state changes to a plain-text append-only log. Five states: working, done, stuck, waiting, idle. The protocol lives in AGENTS.md — agents pick it up automatically.',
      svg: <ScannerSvg />,
    },
    {
      num: '03',
      title: 'One board. Every project.',
      desc: 'Run tend from anywhere. The departures board shows what needs you, what\'s running fine, what\'s been idle. Including remote agents via the relay. Handle it, then disappear.',
      svg: <PulseSvg />,
    },
  ]

  useEffect(() => {
    const ctx = gsap.context(() => {
      steps.forEach((_, i) => {
        gsap.from(`.step-card-${i}`, {
          y: 80,
          opacity: 0,
          duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: `.step-card-${i}`,
            start: 'top 85%',
          },
        })
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={ref} className="py-24 md:py-32 px-6 md:px-12 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="font-heading font-bold text-3xl md:text-4xl text-anvil">
          How it works
        </h2>
      </div>

      <div className="space-y-8">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`step-card-${i} bg-parchment border border-chalk rounded-[2rem] p-8 md:p-12
              flex flex-col md:flex-row items-center gap-8 shadow-sm`}
          >
            <div className="flex-1">
              <span className="font-mono text-smoke text-sm">{step.num}</span>
              <h3 className="font-heading font-bold text-2xl md:text-3xl text-anvil mt-2">
                {step.title}
              </h3>
              <p className="font-body text-smoke text-sm md:text-base mt-4 leading-relaxed max-w-md">
                {step.desc}
              </p>
            </div>
            <div className="flex-shrink-0 flex items-center justify-center w-40 h-40 md:w-52 md:h-52 bg-anvil/5 rounded-[1.5rem]">
              {step.svg}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   GET STARTED — Installation
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function GetStarted() {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gs-content', {
        y: 50,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.gs-content',
          start: 'top 80%',
        },
      })
    }, ref)
    return () => ctx.revert()
  }, [])

  return (
    <section id="get-started" ref={ref} className="py-24 md:py-32 px-6 md:px-12">
      <div className="gs-content max-w-3xl mx-auto text-center">
        <h2 className="font-display text-4xl md:text-6xl text-anvil">
          Start tending.
        </h2>

        {/* Terminal window */}
        <div className="mt-12 bg-anvil rounded-[1.5rem] overflow-hidden shadow-2xl text-left">
          {/* Title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
            <span className="w-3 h-3 rounded-full bg-ember/60" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <span className="w-3 h-3 rounded-full bg-patina/60" />
            <span className="font-mono text-xs text-smoke/50 ml-2">terminal</span>
          </div>
          {/* Commands */}
          <div className="p-5 md:p-6 font-mono text-sm space-y-2">
            <div>
              <span className="text-smoke">$ </span>
              <span className="text-parchment">git clone https://github.com/metalaureate/tend-cli && cd tend-cli</span>
            </div>
            <div>
              <span className="text-smoke">$ </span>
              <span className="text-parchment">make install</span>
            </div>
            <div>
              <span className="text-smoke">$ </span>
              <span className="text-parchment">cd ~/projects/my-app && tend init</span>
            </div>
            <div className="text-patina mt-3 pt-3 border-t border-white/5">
              ✓ Initialized .tend/ directory
            </div>
            <div className="text-patina">
              ✓ Shell prompt indicator active
            </div>
            <div className="text-smoke/50">
              Ready. Run `tend` to see your board.
            </div>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {['No daemon', 'No database', 'No config files'].map((pill) => (
            <span
              key={pill}
              className="font-mono text-xs text-smoke bg-anvil/5 border border-chalk px-4 py-2 rounded-full"
            >
              {pill}
            </span>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <a
            href="https://github.com/metalaureate/tend-cli"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-magnetic inline-flex items-center gap-2 bg-ember text-parchment px-6 py-3 rounded-full font-heading font-medium"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Github size={18} />
              View on GitHub
              <ArrowRight size={16} />
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
    <footer className="bg-anvil rounded-t-[3rem] md:rounded-t-[4rem] pt-16 pb-8 px-6 md:px-12">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <span className="font-mono text-parchment text-lg">tend</span>
            <p className="font-body text-smoke text-sm mt-3 max-w-sm leading-relaxed">
              Lightweight attention infrastructure for humans and agents.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-heading text-parchment text-sm font-bold mb-4">Navigate</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="text-smoke hover:text-parchment transition-colors link-lift inline-block">How It Works</a></li>
              <li><a href="#philosophy" className="text-smoke hover:text-parchment transition-colors link-lift inline-block">Philosophy</a></li>
              <li>
                <a href="https://github.com/metalaureate/tend-cli" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-parchment transition-colors link-lift inline-block">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://github.com/metalaureate/tend-cli/blob/main/README.md" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-parchment transition-colors link-lift inline-block">
                  Docs
                </a>
              </li>
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-heading text-parchment text-sm font-bold mb-4">Infrastructure</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="https://github.com/metalaureate/tend-cli/blob/main/templates/AGENTS.md.template" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-parchment transition-colors link-lift inline-block">
                  AGENTS.md
                </a>
              </li>
              <li>
                <a href="https://github.com/metalaureate/tend-cli/tree/main/relay" target="_blank" rel="noopener noreferrer" className="text-smoke hover:text-parchment transition-colors link-lift inline-block">
                  Relay
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Status + bottom */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-patina pulse-dot" />
            <span className="font-mono text-xs text-smoke">relay.tend.dev operational</span>
          </div>
          <div className="font-mono text-xs text-smoke/50 flex flex-wrap justify-center gap-3">
            <span>MIT License</span>
            <span className="text-chalk/20">·</span>
            <span>Built for the age of agents.</span>
          </div>
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
    <div className="bg-parchment min-h-screen">
      <Navbar />
      <Hero />
      <Features />
      <Philosophy />
      <HowItWorks />
      <GetStarted />
      <Footer />
    </div>
  )
}
