"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LoginScreenProps {
  onLogin: () => void
}

type LoginState = 'idle' | 'loading' | 'error'

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loginState, setLoginState] = useState<LoginState>('idle')
  const [errorMsg, setErrorMsg]     = useState('')

  const handleLogin = async () => {
    setLoginState('loading')
    setErrorMsg('')

    try {
      const result = await window.electronAPI.login()
      if (result.loggedIn) {
        onLogin()
      } else {
        setLoginState('error')
        setErrorMsg(result.error || 'Sign-in failed. Please try again.')
      }
    } catch (err: unknown) {
      setLoginState('error')
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      setErrorMsg(msg)
    }
  }

  const retry = () => {
    setLoginState('idle')
    setErrorMsg('')
  }

  return (
    <div
      style={{
        position:   'fixed',
        inset:      0,
        background: '#070707',
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow:   'hidden',
      }}
    >
      {/* Ambient champagne glow */}
      <div
        aria-hidden
        style={{
          position:    'absolute',
          top:         '30%',
          left:        '50%',
          transform:   'translate(-50%, -50%)',
          width:       '700px',
          height:      '500px',
          background:  'radial-gradient(ellipse at center, rgba(204,28,28,0.10) 0%, rgba(204,28,28,0.03) 50%, transparent 70%)',
          pointerEvents: 'none',
          filter:      'blur(40px)',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          gap:            '0',
          zIndex:         1,
          width:          '100%',
          maxWidth:       '420px',
          padding:        '0 24px',
        }}
      >
        {/* TEN Wordmark */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily:     '"Bebas Neue", sans-serif',
            fontSize:       '96px',
            letterSpacing:  '0.4em',
            lineHeight:     1,
            color:          'var(--champagne, #cc1c1c)',
            marginBottom:   '4px',
            userSelect:     'none',
          }}
        >
          TEN
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          style={{
            fontSize:       '9px',
            letterSpacing:  '0.28em',
            textTransform:  'uppercase',
            color:          'rgba(204,28,28,0.55)',
            marginBottom:   '56px',
          }}
        >
          Document Studio
        </motion.p>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            width:         '100%',
            background:    'rgba(255,255,255,0.025)',
            border:        '1px solid rgba(255,255,255,0.08)',
            borderRadius:  '16px',
            padding:       '36px 32px 32px',
            backdropFilter: 'blur(12px)',
          }}
        >
          <h2
            style={{
              fontFamily:    '"Bebas Neue", sans-serif',
              fontSize:      '26px',
              letterSpacing: '0.15em',
              color:         'rgba(255,255,255,0.90)',
              marginBottom:  '8px',
            }}
          >
            Welcome back
          </h2>

          <p
            style={{
              fontSize:      '13px',
              color:         'rgba(255,255,255,0.45)',
              lineHeight:    1.55,
              marginBottom:  '28px',
            }}
          >
            Sign in with your The Exotics Network account to continue.
          </p>

          {/* Domain hint */}
          <div
            style={{
              display:       'flex',
              alignItems:    'center',
              gap:           '8px',
              background:    'rgba(204,28,28,0.07)',
              border:        '1px solid rgba(204,28,28,0.18)',
              borderRadius:  '8px',
              padding:       '10px 14px',
              marginBottom:  '24px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="6.5" stroke="rgba(204,28,28,0.7)" />
              <path d="M7 4v3.5l2 1.5" stroke="rgba(204,28,28,0.7)" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: '11px', color: 'rgba(204,28,28,0.75)', letterSpacing: '0.04em' }}>
              @theexoticsnetwork.com accounts only
            </span>
          </div>

          {/* Sign-in button */}
          <button
            onClick={loginState === 'loading' ? undefined : handleLogin}
            disabled={loginState === 'loading'}
            style={{
              width:          '100%',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '10px',
              height:         '48px',
              background:     loginState === 'loading'
                ? 'rgba(204,28,28,0.12)'
                : 'linear-gradient(135deg, rgba(204,28,28,0.22) 0%, rgba(204,28,28,0.10) 100%)',
              border:         '1px solid rgba(204,28,28,0.35)',
              borderRadius:   '10px',
              color:          loginState === 'loading' ? 'rgba(204,28,28,0.5)' : '#cc1c1c',
              fontSize:       '13px',
              fontWeight:     500,
              letterSpacing:  '0.06em',
              cursor:         loginState === 'loading' ? 'not-allowed' : 'pointer',
              transition:     'background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (loginState !== 'loading') {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'linear-gradient(135deg, rgba(204,28,28,0.32) 0%, rgba(204,28,28,0.18) 100%)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(204,28,28,0.55)'
              }
            }}
            onMouseLeave={(e) => {
              if (loginState !== 'loading') {
                (e.currentTarget as HTMLButtonElement).style.background =
                  'linear-gradient(135deg, rgba(204,28,28,0.22) 0%, rgba(204,28,28,0.10) 100%)'
                ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(204,28,28,0.35)'
              }
            }}
          >
            {loginState === 'loading' ? (
              <>
                <span
                  style={{
                    display:        'inline-block',
                    width:          '16px',
                    height:         '16px',
                    borderRadius:   '50%',
                    border:         '2px solid rgba(204,28,28,0.22)',
                    borderTopColor: 'rgba(204,28,28,0.65)',
                    animation:      'spin 0.8s linear infinite',
                    flexShrink:     0,
                  }}
                />
                Opening browser…
              </>
            ) : (
              <>
                {/* Microsoft logo mark */}
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <rect x="1"  y="1"  width="7.5" height="7.5" fill="#f25022" rx="0.5" />
                  <rect x="9.5" y="1" width="7.5" height="7.5" fill="#7fba00" rx="0.5" />
                  <rect x="1"  y="9.5" width="7.5" height="7.5" fill="#00a4ef" rx="0.5" />
                  <rect x="9.5" y="9.5" width="7.5" height="7.5" fill="#ffb900" rx="0.5" />
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>

          {/* Error message */}
          <AnimatePresence>
            {loginState === 'error' && errorMsg && (
              <motion.div
                key="error"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: '16px' }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  background:   'rgba(220,60,60,0.08)',
                  border:       '1px solid rgba(220,60,60,0.25)',
                  borderRadius: '8px',
                  padding:      '12px 14px',
                  display:      'flex',
                  alignItems:   'flex-start',
                  gap:          '10px',
                }}
              >
                <span style={{ color: 'rgba(240,80,80,0.85)', fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>✕</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '12px', color: 'rgba(240,100,100,0.85)', lineHeight: 1.5, margin: 0 }}>
                    {errorMsg}
                  </p>
                  <button
                    onClick={retry}
                    style={{
                      marginTop:     '8px',
                      background:    'none',
                      border:        'none',
                      padding:       0,
                      color:         'rgba(240,100,100,0.65)',
                      fontSize:      '11px',
                      cursor:        'pointer',
                      textDecoration: 'underline',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Try again
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          style={{
            marginTop:     '24px',
            fontSize:      '10px',
            color:         'rgba(255,255,255,0.18)',
            letterSpacing: '0.05em',
            textAlign:     'center',
          }}
        >
          Your sign-in is remembered between sessions.
        </motion.p>
      </motion.div>
    </div>
  )
}
