import { useState, useEffect } from 'react'
import { X, Building2, Sparkles, GraduationCap, Copy, Check } from 'lucide-react'
import type { Match } from '../types/thesis'
import { MatchScoreBadge } from './ui/MatchScoreBadge'
import { useTypewriter } from '../hooks/useTypewriter'
import { apiService } from '../api/apiService'

const aiGradient = {
  background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 60%, #7c3aed 100%)',
} as const

const aiTextStyle = {
  background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
} as const

interface Supervisor {
  full_name: string
  email: string
  interests: string
  score: number
}

interface Props {
  match: Match
  onClose: () => void
}

type DraftMode = 'company' | 'supervisor'

export function ActionDrawer({ match, onClose }: Props) {
  const [generating, setGenerating] = useState(false)
  const [draftText, setDraftText] = useState('')
  const [draftMode, setDraftMode] = useState<DraftMode>('company')
  const [error, setError] = useState<string | null>(null)
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null)
  const [loadingSupervisor, setLoadingSupervisor] = useState(true)
  const [copied, setCopied] = useState(false)
  const [excludedSupervisors, setExcludedSupervisors] = useState<string[]>([])

  // Load best supervisor when drawer opens
  useEffect(() => {
    setLoadingSupervisor(true)
    setSupervisor(null)
    setDraftText('')
    setExcludedSupervisors([])
    apiService.findSupervisor(match.title, match.summary)
      .then((data) => setSupervisor(data.supervisor))
      .catch(() => setSupervisor(null))
      .finally(() => setLoadingSupervisor(false))
  }, [match.id])

  async function handleTryAnother() {
    if (!supervisor) return
    const newExcluded = [...excludedSupervisors, supervisor.full_name]
    setExcludedSupervisors(newExcluded)
    setLoadingSupervisor(true)
    setSupervisor(null)
    try {
      // Try each excluded name — pass the last excluded one to skip it
      const data = await apiService.findSupervisor(match.title, match.summary, newExcluded[newExcluded.length - 1])
      setSupervisor(data.supervisor)
    } catch {
      setSupervisor(null)
    } finally {
      setLoadingSupervisor(false)
    }
  }

  const { displayed } = useTypewriter(generating ? draftText : '', 8)

  async function handleGenerateCompanyPitch() {
    setDraftText('')
    setDraftMode('company')
    setError(null)
    setGenerating(true)
    try {
      const result = await apiService.generatePitch(match.id)
      setDraftText(result.pitch)
    } catch (err) {
      setError('Could not generate pitch. Make sure the backend is running.')
      setGenerating(false)
    }
  }

  async function handleGenerateSupervisorPitch() {
    if (!supervisor) return
    setDraftText('')
    setDraftMode('supervisor')
    setError(null)
    setGenerating(true)
    try {
      const result = await apiService.generateSupervisorPitch(
        supervisor.full_name,
        supervisor.email,
        supervisor.interests,
        match.title
      )
      setDraftText(result.pitch)
    } catch (err) {
      setError('Could not generate supervisor email. Make sure the backend is running.')
      setGenerating(false)
    }
  }

  function handleCopyEmail() {
    if (!supervisor?.email) return
    navigator.clipboard.writeText(supervisor.email)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isTyping = generating && displayed.length < draftText.length
  if (generating && !isTyping && draftText) {
    setTimeout(() => setGenerating(false), 100)
  }

  return (
    <aside
      className="flex h-screen flex-col border-l"
      style={{
        width: 400,
        minWidth: 400,
        borderColor: 'var(--border)',
        backgroundColor: 'var(--card)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl ds-title-sm font-semibold"
          style={{ ...aiGradient, color: '#fff' }}
        >
          {match.companyInitial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="ds-label truncate" style={{ color: 'var(--foreground)' }}>
            {match.title}
          </p>
          <div className="flex items-center gap-1.5">
            <Building2 size={11} style={{ color: 'var(--muted-foreground)' }} />
            <p className="ds-caption" style={{ color: 'var(--muted-foreground)' }}>
              {match.company}
            </p>
          </div>
        </div>
        <button
          className="rounded-lg p-1.5 transition-colors duration-150"
          style={{ color: 'var(--muted-foreground)' }}
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4 flex items-center gap-2">
          <MatchScoreBadge score={match.score} />
          <span className="ds-caption" style={{ color: 'var(--muted-foreground)' }}>
            {match.matchReason}
          </span>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {match.tags.map((t) => (
            <span
              key={t}
              className="ds-caption rounded-full px-3 py-1"
              style={{
                backgroundColor: 'var(--secondary)',
                color: 'var(--muted-foreground)',
                border: '1px solid var(--border)',
              }}
            >
              {t}
            </span>
          ))}
        </div>

        <p className="ds-small leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {match.summary}
        </p>

        <p className="ds-caption mt-3" style={{ color: 'var(--muted-foreground)' }}>
          Contact:{' '}
          <span style={aiTextStyle}>{match.contact}</span>
        </p>

        {/* Recommended Supervisor */}
        <div
          className="mt-4 rounded-xl p-3"
          style={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap size={14} style={{ color: '#7c3aed' }} />
            <span className="ds-caption font-semibold" style={{ color: 'var(--foreground)' }}>
              Recommended Supervisor
            </span>
          </div>

          {loadingSupervisor ? (
            <div className="h-4 w-40 animate-pulse rounded" style={{ backgroundColor: 'var(--border)' }} />
          ) : supervisor ? (
            <>
              <p className="ds-caption font-medium" style={aiTextStyle}>
                {supervisor.full_name}
              </p>
              <p className="ds-caption mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                {supervisor.interests}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <p className="ds-caption flex-1" style={{ color: 'var(--muted-foreground)' }}>
                  {supervisor.email}
                </p>
                <button
                  className="flex items-center gap-1 rounded-lg px-2 py-1 ds-caption transition-all duration-150"
                  style={{
                    backgroundColor: copied ? 'rgba(124,58,237,0.1)' : 'var(--border)',
                    color: copied ? '#7c3aed' : 'var(--muted-foreground)',
                  }}
                  onClick={handleCopyEmail}
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
          <div className="mt-2 flex items-center justify-between">
                <p className="ds-caption" style={{ color: '#7c3aed' }}>
                  {supervisor.score}% match
                </p>
                <button
                  className="ds-caption transition-opacity hover:opacity-70"
                  style={{ color: 'var(--muted-foreground)' }}
                  onClick={handleTryAnother}
                >
                  Try another →
                </button>
              </div>

              {/* Email supervisor button */}
              <button
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2 ds-caption transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
                style={{ ...aiGradient, color: '#fff' }}
                onClick={handleGenerateSupervisorPitch}
                disabled={generating}
              >
                <Sparkles size={13} />
                {generating && draftMode === 'supervisor' ? 'Generating…' : 'Email Supervisor'}
              </button>
            </>
          ) : (
            <p className="ds-caption" style={{ color: 'var(--muted-foreground)' }}>
              No supervisor found
            </p>
          )}
        </div>
      </div>

      {/* Draft Creator */}
      <div
        className="border-t px-5 pb-5 pt-4"
        style={{ borderColor: 'var(--border)' }}
      >
        <p className="ds-label mb-3" style={{ color: 'var(--foreground)' }}>
          Draft Creator
        </p>

        {error && (
          <p className="mb-3 ds-caption" style={{ color: '#ef4444' }}>{error}</p>
        )}

        {draftText && (
          <>
            <p className="ds-caption mb-2" style={{ color: 'var(--muted-foreground)' }}>
              {draftMode === 'supervisor' ? '✉️ Email to supervisor' : '✉️ Email to company'}
            </p>
            <textarea
              className="mb-3 h-52 w-full resize-none rounded-xl p-3 ds-caption leading-relaxed outline-none"
              style={{
                backgroundColor: 'var(--secondary)',
                color: 'var(--foreground)',
                border: '1px solid var(--border)',
                fontFamily: '"Courier New", monospace',
              }}
              value={isTyping ? displayed : draftText}
              onChange={(e) => setDraftText(e.target.value)}
              readOnly={isTyping}
            />
          </>
        )}

        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3 ds-label transition-opacity duration-150 hover:opacity-90 active:opacity-80"
          style={{ ...aiGradient, color: '#fff' }}
          onClick={handleGenerateCompanyPitch}
          disabled={generating}
        >
          <Sparkles size={15} />
          {generating && draftMode === 'company' ? 'Generating…' : draftText && draftMode === 'company' ? 'Regenerate Company Email' : 'Generate AI Proposal'}
        </button>
      </div>
    </aside>
  )
}
