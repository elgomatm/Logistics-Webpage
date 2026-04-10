"use client"

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Page, User } from '../App'
import tenLogo from '../assets/ten-logo-white.png'

interface NavbarProps {
  currentPage: Page
  onNavigate:  (page: Page) => void
  user?:       User | null
  onLogout?:   () => void
}

const NAV_ITEMS: { label: string; page: Page }[] = [
  { label: 'Home',      page: 'home'      },
  { label: 'Logistics', page: 'logistics' },
  { label: 'Reports',   page: 'reports'   },
]

export default function Navbar({ currentPage, onNavigate, user, onLogout }: NavbarProps) {
  const [scrolled,      setScrolled]      = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close user menu when clicking outside
  useEffect(() => {
    if (!userMenuOpen) return
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-user-menu]')) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [userMenuOpen])

  const handleNav = (page: Page) => {
    setMenuOpen(false)
    onNavigate(page)
  }

  // First name only for display
  const displayName = user?.name?.split(' ')[0] ?? ''
  // Initials for avatar
  const initials = user?.name
    ? user.name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <>
      {/* ── Subtle red underline at the bottom edge of the navbar bar ── */}
      {/* The main page glow lives in each page's hero section */}
      <div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          top:        '63px',
          left:       0,
          right:      0,
          height:     '2px',
          zIndex:     49,
          background: 'radial-gradient(ellipse 55% 100% at 50% 0%, rgba(204,28,28,0.85) 0%, transparent 100%)',
        }}
      />

      <nav className="fixed top-0 left-0 right-0 z-50 glass-nav anim-fade-in">
        <div className="relative max-w-[1360px] mx-auto px-6 md:px-14 h-16 flex items-center justify-between">

          {/* Wordmark */}
          <button
            onClick={() => handleNav('home')}
            className="flex items-center gap-3 group"
          >
            <img
              src={tenLogo}
              alt="TEN"
              className="select-none"
              style={{
                height: '22px', width: 'auto', objectFit: 'contain',
                filter: 'brightness(0) invert(1)',
              }}
            />
            <span
              className="text-[11px] tracking-[0.18em] uppercase font-semibold leading-none hidden sm:block"
              style={{ color: 'var(--text-1)' }}
            >
              Document Studio
            </span>
          </button>

          {/* Center label */}
          <span
            className="absolute left-1/2 -translate-x-1/2 text-[9px] tracking-[0.28em] uppercase font-medium hidden md:block pointer-events-none select-none"
            style={{ color: 'var(--text-3)' }}
          >
            The Exotics Network
          </span>

          {/* Right side: nav links + user */}
          <div className="hidden md:flex items-center gap-6">
            {/* Nav links */}
            {NAV_ITEMS.map((item) => {
              const isActive = item.page === currentPage
              return (
                <button
                  key={item.page}
                  onClick={() => handleNav(item.page)}
                  className="relative text-[11px] tracking-[0.18em] uppercase font-medium transition-colors duration-200"
                  style={{ color: isActive ? 'var(--text-1)' : 'var(--text-2)' }}
                >
                  {item.label}
                  <span
                    className="absolute -bottom-1 left-0 h-px transition-all duration-300"
                    style={{
                      background: 'var(--champagne)',
                      width: isActive ? '100%' : '0%',
                    }}
                  />
                </button>
              )
            })}

            {/* User avatar / menu */}
            {user && (
              <div className="relative" data-user-menu>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2.5 group"
                  aria-label="User menu"
                >
                  {/* Avatar circle */}
                  <div
                    style={{
                      width:          '30px',
                      height:         '30px',
                      borderRadius:   '50%',
                      background:     'linear-gradient(135deg, rgba(204,28,28,0.25) 0%, rgba(204,28,28,0.10) 100%)',
                      border:         '1px solid rgba(204,28,28,0.35)',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      fontFamily:     '"Bebas Neue", sans-serif',
                      fontSize:       '13px',
                      letterSpacing:  '0.05em',
                      color:          'var(--champagne)',
                      flexShrink:     0,
                      transition:     'border-color 0.2s ease',
                    }}
                  >
                    {initials}
                  </div>
                  <span
                    className="text-[11px] tracking-[0.08em] font-medium transition-colors duration-200"
                    style={{ color: 'var(--text-2)' }}
                  >
                    {displayName}
                  </span>
                  {/* Chevron */}
                  <svg
                    width="10" height="6" viewBox="0 0 10 6" fill="none"
                    aria-hidden
                    style={{
                      color:      'var(--text-3)',
                      transition: 'transform 0.2s ease',
                      transform:  userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    }}
                  >
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Dropdown */}
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        position:    'absolute',
                        top:         'calc(100% + 10px)',
                        right:       0,
                        minWidth:    '200px',
                        background:  'rgba(14,12,10,0.96)',
                        border:      '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(16px)',
                        boxShadow:   '0 16px 40px rgba(0,0,0,0.5)',
                        overflow:    'hidden',
                      }}
                    >
                      {/* User info */}
                      <div
                        style={{
                          padding:     '14px 16px 12px',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <p
                          style={{
                            fontSize:    '12px',
                            fontWeight:  500,
                            color:       'rgba(255,255,255,0.85)',
                            marginBottom: '2px',
                          }}
                        >
                          {user.name}
                        </p>
                        <p
                          style={{
                            fontSize:    '10px',
                            color:       'rgba(255,255,255,0.35)',
                            letterSpacing: '0.03em',
                          }}
                        >
                          {user.email}
                        </p>
                      </div>

                      {/* Sign out */}
                      <button
                        onClick={() => {
                          setUserMenuOpen(false)
                          onLogout?.()
                        }}
                        style={{
                          width:          '100%',
                          textAlign:      'left',
                          padding:        '12px 16px',
                          display:        'flex',
                          alignItems:     'center',
                          gap:            '10px',
                          background:     'none',
                          border:         'none',
                          cursor:         'pointer',
                          fontSize:       '12px',
                          color:          'rgba(255,255,255,0.55)',
                          letterSpacing:  '0.03em',
                          transition:     'color 0.15s ease, background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'rgba(255,255,255,0.85)'
                          e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'rgba(255,255,255,0.55)'
                          e.currentTarget.style.background = 'none'
                        }}
                      >
                        {/* Sign out icon */}
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path d="M5 2H2.5A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                          <path d="M9 4.5l2.5 2.5-2.5 2.5M11.5 7H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col gap-1.5 p-2"
            aria-label="Toggle menu"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block w-5 h-px transition-all duration-300"
                style={{
                  background: 'var(--text-1)',
                  transform: menuOpen
                    ? i === 0 ? 'rotate(45deg) translateY(8px)'
                    : i === 2 ? 'rotate(-45deg) translateY(-8px)'
                    : 'none'
                    : 'none',
                  opacity: menuOpen && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed top-16 left-0 right-0 z-40 glass-nav"
            style={{ borderTop: '1px solid var(--border-mid)' }}
          >
            <div className="px-6 py-5 flex flex-col gap-4">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.page}
                  onClick={() => handleNav(item.page)}
                  className="text-left text-[12px] tracking-[0.18em] uppercase font-medium"
                  style={{ color: 'var(--text-1)' }}
                >
                  {item.label}
                </button>
              ))}

              {/* Mobile sign-out */}
              {user && (
                <>
                  <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
                  <div>
                    <p className="text-[10px] tracking-[0.12em]" style={{ color: 'var(--text-3)', marginBottom: '6px' }}>
                      {user.email}
                    </p>
                    <button
                      onClick={() => { setMenuOpen(false); onLogout?.() }}
                      className="text-left text-[12px] tracking-[0.18em] uppercase font-medium"
                      style={{ color: 'rgba(255,100,100,0.65)' }}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
