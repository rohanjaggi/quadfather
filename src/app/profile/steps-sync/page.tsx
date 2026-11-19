'use client'

import { useState, useEffect, type CSSProperties, type ReactNode } from 'react'
import { generateAccessToken, deleteAccessToken, getAccessTokenStatus } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useHaptic } from '@/components/telegram'
import PageHeader from '@/components/ui/PageHeader'
import { CheckIcon } from '@/components/ui/icons'
import { ConfirmSheet, FormError } from '@/components/settings/ui'

type Confirmable = 'regenerate' | 'revoke'

const CONFIRM: Record<Confirmable, { title: string; body: string; label: string; busy: string }> = {
  regenerate: {
    title: 'Make a new token?',
    body: 'Your current token stops working. The Shortcut on your iPhone won’t sync steps until you paste the new one into it.',
    label: 'Make new token',
    busy: 'Creating…',
  },
  revoke: {
    title: 'Revoke your token?',
    body: 'Steps sync stops straight away and the Shortcut will start failing until you set up a new token.',
    label: 'Revoke token',
    busy: 'Revoking…',
  },
}

const COPY_FAILED_MESSAGE = 'Couldn’t copy. Press and hold the text to select it instead.'

const srOnly: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
}

export default function StepsSyncPage() {
  const haptic = useHaptic()
  const [token, setToken] = useState<string | null>(null)
  const [tokenHint, setTokenHint] = useState<string | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  // Label of the field whose last copy attempt failed, so the fallback hint
  // appears under that field rather than under all of them.
  const [copyFailed, setCopyFailed] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<Confirmable | null>(null)

  useEffect(() => {
    getAccessTokenStatus().then(({ has_token, hint }) => {
      if (has_token) setTokenHint(hint)
    }).catch(() => {})
  }, [])

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const stepsUrl = `${baseUrl}/api/steps`
  // The server only ever returns the token once, at generation. `tokenHint` is a
  // MASK (`••••abc123`) — pasting it into the Shortcut produces a header that
  // fails auth, so it is never offered as copyable header text.
  const authHeader = token ? `Bearer ${token}` : null
  const hasToken = !!(token || tokenHint)

  async function handleGenerateToken() {
    if (tokenLoading) return
    setTokenLoading(true)
    setTokenError(null)
    try {
      const { token: newToken } = await generateAccessToken()
      setToken(newToken)
      setTokenHint(null)
      setConfirming(null)
    } catch (err) {
      setTokenError(errorMessage(err, 'Couldn’t create a token. Try again.'))
    } finally {
      setTokenLoading(false)
    }
  }

  async function handleRevokeToken() {
    if (tokenLoading) return
    setTokenLoading(true)
    setTokenError(null)
    try {
      await deleteAccessToken()
      setToken(null)
      setTokenHint(null)
      setConfirming(null)
    } catch (err) {
      setTokenError(errorMessage(err, 'Couldn’t revoke the token. Try again.'))
    } finally {
      setTokenLoading(false)
    }
  }

  function handleGenerateClick() {
    if (tokenLoading) return
    // Nothing to invalidate the first time round, so don't ask.
    if (!hasToken) {
      void handleGenerateToken()
      return
    }
    setTokenError(null)
    setConfirming('regenerate')
  }

  /**
   * The token is shown exactly once, so a false "Copied" is data loss: the user
   * dismisses the page believing they have it and the only copy is gone.
   *
   * `navigator.clipboard` is undefined on several Telegram Android webviews
   * (and on any non-secure origin), where the old call threw a TypeError before
   * `setCopied` ever ran; `writeText` also rejects when the webview denies the
   * permission, and the floating promise meant that rejection was invisible
   * under a green "Copied". Both now fail loudly instead.
   */
  function copyText(text: string, label: string) {
    setCopyFailed(null)
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard?.writeText) {
      reportCopyFailure(label)
      return
    }
    clipboard.writeText(text).then(
      () => {
        haptic.notification('success')
        setCopied(label)
        setTimeout(() => setCopied(null), 2000)
      },
      () => reportCopyFailure(label),
    )
  }

  function reportCopyFailure(label: string) {
    setCopied(null)
    setCopyFailed(label)
    // Best-effort native alert on top of the inline hint — the inline one is
    // what the user is guaranteed to see if the SDK isn't there.
    void import('@twa-dev/sdk')
      .then(({ default: WebApp }) => {
        if (typeof WebApp.showAlert === 'function') WebApp.showAlert(COPY_FAILED_MESSAGE)
      })
      .catch(() => {})
  }

  const copy = (value: string, label: string, name: string) => (
    <CopyField value={value} label={label} name={name} copied={copied} copyFailed={copyFailed} onCopy={copyText} />
  )

  return (
    <div>
      <PageHeader
        title="Steps sync"
        subtitle="Send your Apple Health steps here with an iPhone Shortcut."
        back={{ href: '/profile', label: 'Settings' }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section className="card">
          <h2 className="card-title" style={{ margin: '0 0 6px' }}>Access token</h2>

          {token ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                Copy it now. It’s only shown once.
              </p>
              {copy(token, 'token', 'token')}
            </div>
          ) : tokenHint ? (
            <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--ink)', fontWeight: 600 }}>Active</span>, ending {tokenHint.replace(/^•+/, '')}.
              {' '}Only the end is kept, so make a new token if you need it in full.
            </p>
          ) : (
            <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>
              The token lets your Shortcut send steps to Quadfather. Keep it private.
            </p>
          )}

          {tokenError && !confirming && <div style={{ marginTop: 12 }}><FormError>{tokenError}</FormError></div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 16 }}>
            {hasToken ? (
              <>
                <button type="button" className="btn-secondary" onClick={handleGenerateClick} disabled={tokenLoading} style={{ width: '100%' }}>
                  Make a new token
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => { setTokenError(null); setConfirming('revoke') }}
                  disabled={tokenLoading}
                  style={{ width: '100%', color: 'var(--over)' }}
                >
                  Revoke token
                </button>
              </>
            ) : (
              <button type="button" className="btn-primary" onClick={handleGenerateClick} disabled={tokenLoading}>
                {tokenLoading ? 'Creating…' : 'Create token'}
              </button>
            )}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title" style={{ margin: '0 0 4px' }}>Set up the Shortcut</h2>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            <Step n={1} title="Find health samples">
              <P>Open Shortcuts, tap +, then search for “Find Health Samples” and add it. Set:</P>
              <Spec rows={[['Type', 'Steps'], ['Start date', 'is today'], ['Unit', 'count']]} />
              <P strong>Leave “Group by” unset so every sample is counted.</P>
            </Step>

            <Step n={2} title="Calculate statistics">
              <P>Search for “Calculate Statistics” and add it below. Set:</P>
              <Spec rows={[['Operation', 'Sum'], ['Input', 'Health Samples']]} />
              <P muted>This adds every step sample into one total.</P>
            </Step>

            <Step n={3} title="Get contents of URL">
              <P>Add “Get Contents of URL” below, then set it up like this.</P>
              <Sub label="URL: tap the blue “URL” text and paste">{copy(stepsUrl, 'url', 'URL')}</Sub>
              <Spec rows={[['Method', 'POST']]} />
              <Sub label="Headers: expand them and add two">
                <p style={{ margin: '0 0 6px', fontSize: 14 }}>Key <b>Authorization</b>, value:</p>
                {authHeader ? copy(authHeader, 'auth', 'Authorization header') : (
                  <P muted>
                    {tokenHint
                      ? 'Your token is hidden. Make a new token above and the full header appears here, ready to copy.'
                      : 'Create a token above and the full header appears here, ready to copy.'}
                  </P>
                )}
                <p style={{ margin: '12px 0 6px', fontSize: 14 }}>Key <b>Content-Type</b>, value:</p>
                {copy('application/json', 'content-type', 'Content-Type value')}
              </Sub>
              <Sub label="Request body">
                <P>Choose JSON, tap “Add new field” and pick Number. Type <b>steps</b> as the key. For the value, tap the field and pick <b>Statistics</b>, the result of step 2.</P>
                <P muted>It shows as a pink “Statistics” pill. That’s your total for the day.</P>
              </Sub>
            </Step>

            <Step n={4} title="Run it automatically" last>
              <P>In the Automation tab, add two automations that both run this shortcut.</P>
              <Sub label="When you open Telegram">
                <P>Tap +, choose App, pick Telegram with “Is Opened” selected, and choose Run Immediately. Add Run Shortcut and pick yours.</P>
              </Sub>
              <Sub label="Every night at 11 pm">
                <P>Tap +, choose Time of Day, set 11:00 pm, and choose Run Immediately. Add Run Shortcut and pick the same one.</P>
              </Sub>
              <P muted>The Telegram one keeps today’s count fresh. The 11 pm one catches your final total before midnight, so yesterday is always right.</P>
            </Step>
          </ol>
        </section>

        <section className="card">
          <h2 className="card-title" style={{ margin: '0 0 6px' }}>Not working?</h2>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, color: 'var(--muted)', lineHeight: 1.6 }}>
            <li>In Health, go to Privacy, then Shortcuts, and make sure Steps is on.</li>
            <li>Tap the play button in Shortcuts to test it by hand first.</li>
            <li>The body value must be the pink Statistics pill, not typed text.</li>
            <li>If you make a new token here, paste it into the Shortcut too.</li>
          </ul>
        </section>
      </div>

      {confirming && (
        <ConfirmSheet
          open
          onClose={() => setConfirming(null)}
          title={CONFIRM[confirming].title}
          body={CONFIRM[confirming].body}
          confirmLabel={CONFIRM[confirming].label}
          busyLabel={CONFIRM[confirming].busy}
          busy={tokenLoading}
          error={tokenError}
          onConfirm={() => { void (confirming === 'regenerate' ? handleGenerateToken() : handleRevokeToken()) }}
        />
      )}
    </div>
  )
}

function Step({ n, title, last, children }: { n: number; title: string; last?: boolean; children: ReactNode }) {
  return (
    <li style={{ display: 'grid', gridTemplateColumns: '28px 1fr', columnGap: 12, padding: '14px 0', borderBottom: last ? 'none' : '1px solid var(--line)' }}>
      <span aria-hidden="true" style={{
        width: 28, height: 28, borderRadius: 14, background: 'var(--track)', color: 'var(--ink)',
        display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 600,
      }}>
        {n}
      </span>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ margin: '3px 0 0', fontSize: 15, fontWeight: 600 }}>
          <span style={srOnly}>Step {n}: </span>{title}
        </h3>
        {children}
      </div>
    </li>
  )
}

function P({ muted, strong, children }: { muted?: boolean; strong?: boolean; children: ReactNode }) {
  return (
    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: muted ? 'var(--muted)' : 'var(--ink)', fontWeight: strong ? 600 : 400 }}>
      {children}
    </p>
  )
}

function Sub({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>{label}</p>
      {children}
    </div>
  )
}

/** The values a Shortcuts action must be set to, as label/value rows. */
function Spec({ rows }: { rows: [string, string][] }) {
  return (
    <dl style={{ margin: 0 }}>
      {rows.map(([k, v], i) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: i ? '1px solid var(--line)' : 'none', fontSize: 14 }}>
          <dt style={{ color: 'var(--muted)' }}>{k}</dt>
          <dd style={{ margin: 0, fontWeight: 600 }}>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function CopyField({ value, label, name, copied, copyFailed, onCopy }: {
  value: string
  label: string
  name: string
  copied: string | null
  copyFailed: string | null
  onCopy: (text: string, label: string) => void
}) {
  const failed = copyFailed === label
  const done = copied === label
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <code style={{
          flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 12,
          border: '1px solid var(--line-strong)', background: 'var(--card)',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13,
          color: 'var(--ink)', wordBreak: 'break-all', lineHeight: 1.4,
          // Selectable so the fallback hint below is actually actionable.
          userSelect: 'all', WebkitUserSelect: 'all',
        }}>
          {value}
        </code>
        <button
          type="button"
          className="btn-pill"
          onClick={() => onCopy(value, label)}
          aria-label={done ? `${name} copied` : `Copy ${name}`}
          data-active={done ? 'true' : undefined}
          style={{ minHeight: 44, minWidth: 82, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0 }}
        >
          {done && <CheckIcon size={16} />}
          {done ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span role="status" style={srOnly}>{done ? `${name} copied` : ''}</span>
      {failed && (
        <p role="alert" style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--over)' }}>
          {COPY_FAILED_MESSAGE}
        </p>
      )}
    </div>
  )
}
