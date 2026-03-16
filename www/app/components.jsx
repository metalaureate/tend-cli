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
