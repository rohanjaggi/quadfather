'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { generateAccessToken, deleteAccessToken, getAccessTokenStatus } from '@/lib/api'

export default function StepsSyncPage() {
  const [token, setToken] = useState<string | null>(null)
  const [tokenHint, setTokenHint] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    getAccessTokenStatus().then(({ has_token, hint }) => {
      if (has_token) setTokenHint(hint)
    }).catch(() => {})
  }, [])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const stepsUrl = `${baseUrl}/api/steps`
  const authHeader = token ? `Bearer ${token}` : tokenHint ? `Bearer ${tokenHint}` : 'Bearer <generate-token-first>'

  async function handleGenerateToken() {
    setTokenLoading(true)
    try {
      const { token: newToken } = await generateAccessToken()
      setToken(newToken)
      setTokenHint(null)
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
      setTokenHint(null)
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

          {token ? (
            <CopyableField value={token} label="token" copied={copied} onCopy={copyText} />
          ) : tokenHint ? (
            <div style={{
              padding: '9px 11px', borderRadius: '8px',
              backgroundColor: 'var(--tg-theme-bg-color)',
              fontFamily: 'monospace', fontSize: '11px',
              color: 'var(--tg-theme-hint-color)',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Token active: {tokenHint}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '8px' }}>
            {(token || tokenHint) && (
              <button type="button" onClick={handleRevokeToken} disabled={tokenLoading}
                className="btn-secondary" style={{ flex: 1, color: 'var(--accent-calories)' }}>
                Revoke
              </button>
            )}
            <button type="button" onClick={handleGenerateToken} disabled={tokenLoading}
              className="btn-primary" style={{ flex: (token || tokenHint) ? 2 : 1 }}>
              {tokenLoading ? 'Generating…' : (token || tokenHint) ? 'Regenerate' : 'Generate Token'}
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Action 1 — Find Health Samples */}
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
              Action 1: Find Health Samples
            </p>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            Open the <strong>Shortcuts</strong> app, tap <strong>+</strong> to create a new shortcut, then search for &ldquo;Find Health Samples&rdquo; and add it.
          </p>

          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '2px' }}>
              Configure it exactly like this:
            </p>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Type</span><strong style={{ color: 'var(--tg-theme-text-color)' }}>Steps</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Start Date</span><strong style={{ color: 'var(--tg-theme-text-color)' }}>is today</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Unit</span><strong style={{ color: 'var(--tg-theme-text-color)' }}>count</strong>
              </div>
            </div>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            This finds all of today&rsquo;s step samples from Apple Health.
          </p>

          <div style={{
            padding: '10px 12px', borderRadius: '8px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--accent-calories)', lineHeight: 1.5,
          }}>
            <strong>Important:</strong> Do NOT set &ldquo;Group by&rdquo; &mdash; leave it unset so all individual samples are returned.
          </div>
        </div>
      </div>

      {/* Step 3: Action 2 — Calculate Statistics */}
      <div className="fade-up fade-up-3">
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
            }}>3</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
              Action 2: Calculate Statistics
            </p>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            Search for &ldquo;Calculate Statistics&rdquo; and add it below Action 1.
          </p>

          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Operation</span><strong style={{ color: 'var(--tg-theme-text-color)' }}>Sum</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Input</span><strong style={{ color: 'var(--tg-theme-text-color)' }}>Health Samples</strong>
              </div>
            </div>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            This adds up all the individual step recordings into one total number.
          </p>
        </div>
      </div>

      {/* Step 4: Action 3 — Get Contents of URL */}
      <div className="fade-up fade-up-4">
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
            }}>4</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
              Action 3: Get Contents of URL
            </p>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5 }}>
            Search for &ldquo;Get Contents of URL&rdquo; and add it below. Then configure:
          </p>

          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}>
            {/* URL */}
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '4px' }}>
                Tap the blue &ldquo;URL&rdquo; text and paste:
              </p>
              <CopyableField value={stepsUrl} label="url" copied={copied} onCopy={copyText} />
            </div>

            {/* Method */}
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '4px' }}>
                Tap Method, change to POST
              </p>
            </div>

            {/* Headers */}
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '6px' }}>
                Expand &ldquo;Headers&rdquo; and add 2 headers:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', marginBottom: '3px' }}>Key: Authorization &nbsp;|&nbsp; Value:</p>
                  <CopyableField value={authHeader} label="auth" copied={copied} onCopy={copyText} />
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--tg-theme-hint-color)', marginBottom: '3px' }}>Key: Content-Type &nbsp;|&nbsp; Value:</p>
                  <CopyableField value="application/json" label="content-type" copied={copied} onCopy={copyText} />
                </div>
              </div>
            </div>

            {/* Request Body */}
            <div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '6px' }}>
                Request Body &rarr; tap &ldquo;JSON&rdquo;, then &ldquo;Add new field&rdquo;:
              </p>
              <div style={{
                padding: '10px 12px', borderRadius: '8px',
                backgroundColor: 'var(--tg-theme-secondary-bg-color)',
                border: '1px solid var(--surface-border)',
              }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.8 }}>
                  <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>1.</strong> Tap &ldquo;Add new field&rdquo; &rarr; choose <strong>Number</strong></div>
                  <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>2.</strong> Key: type <strong>steps</strong></div>
                  <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>3.</strong> Value: tap the field, then select <strong>Statistics</strong> (the result from Action 2)</div>
                </div>
              </div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', marginTop: '6px', lineHeight: 1.5 }}>
                The value should show as a pink pill that says &ldquo;Statistics&rdquo; or &ldquo;Sum&rdquo; — this is your total step count for the day.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Step 5: Automate */}
      <div className="fade-up fade-up-5">
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
            }}>5</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
              Run It Automatically
            </p>
          </div>

          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.6 }}>
            Add 2 automations that both run the same shortcut:
          </p>

          {/* Automation 1: Telegram */}
          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '4px',
            fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.8,
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '2px' }}>
              Automation 1: When you open Telegram
            </p>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>1.</strong> Go to the <strong>Automation</strong> tab in Shortcuts</div>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>2.</strong> Tap <strong>+</strong> &rarr; <strong>App</strong></div>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>3.</strong> Choose <strong>Telegram</strong>, keep &ldquo;Is Opened&rdquo; selected</div>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>4.</strong> Choose <strong>Run Immediately</strong></div>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>5.</strong> Add action &rarr; <strong>Run Shortcut</strong> &rarr; select your shortcut</div>
          </div>

          {/* Automation 2: Nightly */}
          <div style={{
            padding: '14px', borderRadius: '12px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            display: 'flex', flexDirection: 'column', gap: '4px',
            fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.8,
          }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--tg-theme-text-color)', marginBottom: '2px' }}>
              Automation 2: Nightly at 11 PM
            </p>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>1.</strong> Tap <strong>+</strong> &rarr; <strong>Time of Day</strong></div>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>2.</strong> Set time to <strong>11:00 PM</strong></div>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>3.</strong> Choose <strong>Run Immediately</strong></div>
            <div><strong style={{ color: 'var(--tg-theme-text-color)' }}>4.</strong> Add action &rarr; <strong>Run Shortcut</strong> &rarr; select the same shortcut</div>
          </div>

          <div style={{
            padding: '10px 12px', borderRadius: '8px',
            backgroundColor: 'var(--tg-theme-bg-color)',
            fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.5,
          }}>
            <strong style={{ color: 'var(--tg-theme-text-color)' }}>Why 2 triggers?</strong> The Telegram trigger keeps today&rsquo;s count fresh throughout the day. The 11 PM trigger captures your final step count before midnight, so yesterday&rsquo;s total is always accurate.
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="fade-up fade-up-6">
        <div style={{
          padding: '18px', borderRadius: '16px',
          backgroundColor: 'var(--tg-theme-secondary-bg-color)',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500, color: 'var(--tg-theme-text-color)' }}>
            Not working?
          </p>
          <ul style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--tg-theme-hint-color)', lineHeight: 1.8, paddingLeft: '16px', margin: 0 }}>
            <li>Make sure Health &rarr; Privacy &rarr; Shortcuts has <strong>Steps</strong> enabled</li>
            <li>Tap the <strong>play button</strong> in Shortcuts to test manually first</li>
            <li>The body field value must be the pink <strong>Health Samples</strong> variable, not typed text</li>
            <li>If you regenerate your token here, update it in the Shortcut too</li>
          </ul>
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
