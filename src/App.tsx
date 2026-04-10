"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence }  from 'framer-motion'
import Navbar        from './components/Navbar'
import tenLogo  from './assets/ten-logo-white.png'
import HomePage      from './components/HomePage'
import LogisticsPage from './components/LogisticsPage'
import ReportWizard  from './components/ReportWizard'
import LoginScreen   from './components/LoginScreen'

// ── Types ──────────────────────────────────────────────────────────────────────

export type Page = 'home' | 'logistics' | 'reports'

export interface User {
  name:  string
  email: string
  id:    string
}

type AuthState = 'loading' | 'unauthenticated' | 'authenticated'

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  const [page,      setPage]      = useState<Page>('home')
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [user,      setUser]      = useState<User | null>(null)

  const navigate = useCallback((p: Page) => setPage(p), [])

  // ── Auth bootstrap ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Check for saved session on every launch (silent token refresh)
    window.electronAPI.getAuthStatus().then((result) => {
      if (result.loggedIn && result.user) {
        setUser(result.user as User)
        setAuthState('authenticated')
      } else {
        setAuthState('unauthenticated')
      }
    }).catch(() => {
      setAuthState('unauthenticated')
    })

    // Listen for auth changes pushed from main process
    window.electronAPI.onAuthChanged((result) => {
      if (result.loggedIn && result.user) {
        setUser(result.user as User)
        setAuthState('authenticated')
      } else {
        setUser(null)
        setAuthState('unauthenticated')
      }
    })

    return () => {
      window.electronAPI.removeAllListeners('auth:changed')
    }
  }, [])

  const handleLogin = useCallback(() => {
    window.electronAPI.getAuthStatus().then((result) => {
      if (result.loggedIn && result.user) {
        setUser(result.user as User)
        setAuthState('authenticated')
      }
    })
  }, [])

  const handleLogout = useCallback(async () => {
    await window.electronAPI.logout()
    setUser(null)
    setAuthState('unauthenticated')
    setPage('home')
  }, [])

  // ── Splash / loading ─────────────────────────────────────────────────────────
  if (authState === 'loading') {
    return (
      <div
        style={{
          position:       'fixed',
          inset:          0,
          background:     '#070707',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexDirection:  'column',
          gap:            '20px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <img src={tenLogo} alt="TEN" style={{ height: '64px', width: 'auto', filter: 'brightness(0) invert(1)' }} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{
            width:          '24px',
            height:         '24px',
            borderRadius:   '50%',
            border:         '2.5px solid rgba(204,28,28,0.2)',
            borderTopColor: '#cc1c1c',
            animation:      'spin 0.9s linear infinite',
          }}
        />
      </div>
    )
  }

  // ── Sign-in screen ───────────────────────────────────────────────────────────
  if (authState === 'unauthenticated') {
    return (
      <AnimatePresence mode="wait">
        <LoginScreen key="login" onLogin={handleLogin} />
      </AnimatePresence>
    )
  }

  // ── Authenticated pages ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar currentPage={page} onNavigate={navigate} user={user} onLogout={handleLogout} />

      {/* HomePage stays mounted so planner/onedrive state is never lost */}
      <div style={{ display: page === 'home' ? 'block' : 'none' }}>
        <HomePage user={user} onNavigate={navigate} />
      </div>

      <AnimatePresence mode="wait">
        {page === 'logistics' && (
          <motion.div key="logistics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <LogisticsPage onNavigate={navigate} />
          </motion.div>
        )}

        {page === 'reports' && (
          <motion.div key="reports" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <ReportWizard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
