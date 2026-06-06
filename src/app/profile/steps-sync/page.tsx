'use client'

import { useState } from 'react'
import Link from 'next/link'
import { generateAccessToken, deleteAccessToken } from '@/lib/api'

export default function StepsSyncPage() {
  const [token, setToken] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const stepsUrl = `${baseUrl}/api/steps`
  const authHeader = token ? `Bearer ${token}` : 'Bearer <your-token>'

  async function handleGenerateToken() {
    setTokenLoading(true)
    try {
      const { token: newToken } = await generateAccessToken()
      setToken(newToken)
    } catch (err) {
      console.error(err)
    } finally {
      setTokenLoading(false)
    }
  }

  async function handleRevokeToken() {
    setTokenLoading(true)
    try {
      await deleteAccessToken()
      setToken(null)
    } catch (err) {
      console.error(err)
    } finally {
      setTokenLoading(false)
    }
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Header */}
      <div className="fade-up">
        <Link href="/profile" style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontFamily: 'var(--font-display)', fontSize: '13px',
          color: 'var(--tg-theme-hint-color)', textDecoration: 'none',
          marginBottom: '12px',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Settings
        </Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '32px',
          fontWeight: 700, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tg-theme-text-color)',
        }}>
          Steps Sync
        </h1>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: '14px',
          color: 'var(--tg-theme-hint-color)', marginTop: '6px',
        }}>
          Auto-sync your Apple Health steps daily
        </p>
      </div>

      {/* Step 1: Generate Token */}
      <div className="fade-up fade-up-1">
        <div style={{
          padding: '18px', borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, flexShrink: 0,
            }}>1</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
              Generate Access Token
            </p>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            This token lets your iOS Shortcut send steps to the app. Keep it secret.
          </p>

          {token && (
            <CopyableField value={token} label="token" copied={copied} onCopy={copyText} />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            {token && (
              <button type="button" onClick={handleRevokeToken} disabled={tokenLoading}
                className="btn-secondary" style={{ flex: 1, color: 'var(--accent-calories)' }}>
                Revoke
              </button>
            )}
            <button type="button" onClick={handleGenerateToken} disabled={tokenLoading}
              className="btn-primary" style={{ flex: token ? 2 : 1 }}>
              {tokenLoading ? 'Generating…' : token ? 'Regenerate' : 'Generate Token'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Create Shortcut */}
      <div className="fade-up fade-up-2">
        <div style={{
          padding: '18px', borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, flexShrink: 0,
            }}>2</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
              Create iOS Shortcut
            </p>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            Open the Shortcuts app and create a new shortcut with these 2 actions:
          </p>

          {/* Action 1 */}
          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '6px',
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>
              Action 1: Find Health Samples
            </p>
            <ul style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.6, paddingLeft: '16px', margin: 0 }}>
              <li>Type: <strong>Steps</strong></li>
              <li>Start Date: <strong>Start of Today</strong></li>
              <li>Group By: <strong>Day</strong></li>
            </ul>
          </div>

          {/* Action 2 */}
          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '10px',
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--tg-theme-text-color)' }}>
              Action 2: Get Contents of URL
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>URL</p>
                <CopyableField value={stepsUrl} label="url" copied={copied} onCopy={copyText} />
              </div>

              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>Method</p>
                <CopyableField value="POST" label="method" copied={copied} onCopy={copyText} />
              </div>

              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>Header: Authorization</p>
                <CopyableField value={authHeader} label="auth" copied={copied} onCopy={copyText} />
              </div>

              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>Header: Content-Type</p>
                <CopyableField value="application/json" label="content-type" copied={copied} onCopy={copyText} />
              </div>

              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginBottom: '4px' }}>Request Body (JSON)</p>
                <CopyableField value={'{"steps": <Health Samples value>}'} label="body" copied={copied} onCopy={copyText} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Automate */}
      <div className="fade-up fade-up-3">
        <div style={{
          padding: '18px', borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              backgroundColor: 'var(--tg-theme-button-color)',
              color: 'var(--tg-theme-button-text-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, flexShrink: 0,
            }}>3</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
              Automate It
            </p>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            In Shortcuts, go to the <strong>Automation</strong> tab and create a Personal Automation:
          </p>

          <ul style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.8, paddingLeft: '16px', margin: 0 }}>
            <li>Trigger: <strong>Time of Day</strong> — 9:00 PM</li>
            <li>Action: <strong>Run Shortcut</strong> — select your shortcut</li>
            <li>Toggle off <strong>Ask Before Running</strong></li>
          </ul>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5, fontStyle: 'italic' }}>
            Steps will sync to your dashboard automatically every night.
          </p>
        </div>
      </div>

    </div>
  )
}

function CopyableField({ value, label, copied, onCopy }: {
  value: string
  label: string
  copied: string | null
  onCopy: (text: string, label: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
      <code style={{
        flex: 1, padding: '9px 11px', borderRadius: '8px',
        backgroundColor: 'var(--tg-theme-bg-color)',
        fontFamily: 'monospace', fontSize: '11px',
        color: 'var(--tg-theme-text-color)',
        wordBreak: 'break-all', lineHeight: 1.4,
        border: '1px solid var(--surface-border)',
      }}>
        {value}
      </code>
      <button
        type="button"
        onClick={() => onCopy(value, label)}
        style={{
          background: 'none', border: '1px solid var(--surface-border)',
          borderRadius: '8px', padding: '7px 10px',
          fontFamily: 'var(--font-display)', fontSize: '11px',
          color: copied === label ? 'var(--accent-protein)' : 'var(--tg-theme-hint-color)',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        {copied === label ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
