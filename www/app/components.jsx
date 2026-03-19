'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export function ScrollReveal({ children, className, triggerClassName }) {
  const ref = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(`.${triggerClassName}`, {
        y: 30,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: ref.current ? { trigger: ref.current, start: 'top 75%' } : undefined,
      })
    }, ref)
    return () => ctx.revert()
  }, [triggerClassName])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}

export function HeroReveal({ children }) {
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

  return <div ref={ref}>{children}</div>
}

export function ScrollNavbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return scrolled
}

export function NavbarClient() {
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
        <a href="#dashboard" className="link-lift opacity-70 hover:opacity-100 transition-opacity">Dashboard</a>
        <a href="#get-started" className="link-lift opacity-70 hover:opacity-100 transition-opacity">Install</a>
      </div>
      <a
        href="https://github.com/metalaureate/tend-cli"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-magnetic inline-flex items-center gap-1.5 bg-ember text-parchment px-3.5 py-1.5 rounded-lg text-sm font-medium ml-2"
      >
        <span className="relative z-10 flex items-center gap-1.5">
          <GithubIcon /> GitHub
        </span>
        <span className="btn-bg bg-anvil rounded-lg" />
      </a>
    </nav>
  )
}

export function HeroPromptGlyph() {
  return (
    <div className="mt-4 pt-3 border-t border-white/5 flex items-center">
      <span className="text-smoke/30">~/projects</span>
      <span className="text-smoke/30 ml-1">$</span>
      <span className="inline-block w-1.5 h-3.5 bg-parchment/40 animate-pulse ml-1.5" />
      <span className="ml-auto text-ember transition-all duration-500">●2</span>
    </div>
  )
}

export function GlyphDemo() {
  const [glyphState, setGlyphState] = useState(0)
  const states = [
    { glyph: '○', label: 'nothing needs you', color: 'text-smoke' },
    { glyph: '●3', label: '3 things need attention', color: 'text-ember' },
  ]

  useEffect(() => {
    const interval = setInterval(() => setGlyphState(s => (s + 1) % 2), 3000)
    return () => clearInterval(interval)
  }, [])

  const current = states[glyphState]

  return (
    <div className="mt-10 bg-black/40 border border-white/10 rounded-[1.25rem] overflow-hidden">
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
          <span className={`ml-auto transition-all duration-500 text-lg ${current.color}`}>
            {current.glyph}
          </span>
        </div>
        <div className="text-smoke/20 text-xs mt-3 text-right transition-all duration-500">
          {current.label}
        </div>
      </div>
    </div>
  )
}

function GithubIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  )
}

export function GithubIconExport() {
  return <GithubIcon />
}

function ArrowRightIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

export function ArrowRightIconExport() {
  return <ArrowRightIcon />
}

export function DashboardLive() {
  const [tick, setTick] = useState(0)
  const REFRESH_SECS = 60
  const REFRESH_WARNING_THRESHOLD = 10

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const secsLeft = Math.max(0, REFRESH_SECS - (tick % REFRESH_SECS))
  const countdown = secsLeft < REFRESH_SECS ? `${secsLeft}s` : '1m 0s'

  const rows = [
    { icon: '?', name: 'atlas-api', state: 'stuck', msg: 'needs database credentials for staging', right: '', stateColor: 'text-ember' },
    { icon: '\u25d0', name: 'northstar', state: 'working', msg: 'refactoring auth middleware', right: '(8m)', stateColor: 'text-patina' },
    { icon: '\u25d0', name: 'sextant', state: 'working', msg: 'building data pipeline', right: '(23m) \u2197', stateColor: 'text-patina' },
    { icon: '\u25c9', name: 'beacon', state: 'done', msg: 'PR #204 ready for review', right: '\u2197', stateColor: 'text-ember' },
    { icon: '\u25cc', name: 'meridian', state: 'idle', msg: 'tests passing', right: '(1h)', stateColor: 'text-smoke/50' },
    { icon: '\u25cc', name: 'waypoint', state: 'idle', msg: 'analysis complete', right: '(3h) \u2197', stateColor: 'text-smoke/50' },
  ]

  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return (
    <div className="mt-10 bg-anvil rounded-[1.25rem] overflow-hidden shadow-xl">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
        <span className="w-2.5 h-2.5 rounded-full bg-ember/40" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
        <span className="w-2.5 h-2.5 rounded-full bg-patina/40" />
        <span className="font-mono text-[11px] text-smoke/40 ml-2">$ tend -</span>
      </div>
      {/* Dashboard status line */}
      <div className="px-4 py-2 border-b border-white/5 font-mono text-[11px] flex justify-between text-smoke/40">
        <span>
          <span className="text-parchment/60 font-medium">tend</span>
          {' '}dashboard  \u00b7  updated {timeStr}  \u00b7  next refresh in{' '}
          <span className={secsLeft <= REFRESH_WARNING_THRESHOLD ? 'text-ember' : 'text-smoke/40'}>{countdown}</span>
        </span>
        <span>q to quit</span>
      </div>
      {/* Board */}
      <div className="px-4 md:px-5 py-4 font-mono text-[11px] md:text-xs leading-relaxed">
        <div className="text-smoke/40 mb-3 flex justify-between">
          <span className="tracking-widest text-parchment/60 font-medium">TEND</span>
          <span>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}, {pad(now.getHours())}:{pad(now.getMinutes())}</span>
        </div>
        <div className="space-y-1">
          {rows.map((row, i) => (
            <div key={i} className="flex">
              <span className={`${row.stateColor} w-4 shrink-0`}>{row.icon}</span>
              <span className="text-parchment/70 w-30 md:w-36 shrink-0 truncate ml-1">{row.name}</span>
              <span className={`${row.stateColor} w-16 shrink-0`}>{row.state}</span>
              <span className="text-smoke/50 truncate hidden sm:block">{row.msg}</span>
              {row.right && <span className="text-smoke/30 ml-auto pl-2 shrink-0">{row.right}</span>}
            </div>
          ))}
        </div>
        <div className="text-smoke/30 mt-4 pt-3 border-t border-white/5">
          2 need you \u00b7 2 working \u00b7 2 idle &nbsp;<span className="text-parchment/30">\u2197 = relay</span>
        </div>
      </div>
    </div>
  )
}
