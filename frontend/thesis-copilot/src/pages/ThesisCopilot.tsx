// src/pages/ThesisCopilot.tsx

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import type { Match } from '../types/thesis'
import { apiService } from '../api/apiService'

import { Sidebar } from '../components/Sidebar'
import { CVUploadCard } from '../components/CVUploadCard'
import { MemoryDumpCard } from '../components/MemoryDumpCard'
import { MatchCard } from '../components/MatchCard'
import { ActionDrawer } from '../components/ActionDrawer'

const aiGradient = {
  background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 60%, #7c3aed 100%)',
} as const

export function ThesisCopilot() {
  const [cvUploaded, setCvUploaded] = useState(false)
  const [memoryText, setMemoryText] = useState('')
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(false)
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cvKeywords, setCvKeywords] = useState<string[]>([]) // real keywords from CV

  // The search button is enabled when either a CV was uploaded OR text was typed
  const readyToSearch = cvUploaded || memoryText.trim().length > 5

  // ── CV Upload ────────────────────────────────────────────────────────────
  // When the user drops or selects a PDF, we:
  //  1. Mark the card as "uploaded" for the UI
  //  2. Immediately send the file to the backend and run a search
  async function handleCvUpload(file?: File) {
    setCvUploaded(true)
    setError(null)

    // If no file was passed (e.g. drag-and-drop without file access), just mark uploaded
    if (!file) return

    setLoading(true)
    setMatches([])
    setActiveMatch(null)

    try {
      const { matches, keywords } = await apiService.uploadCV(file)
      setMatches(matches)
      setCvKeywords(keywords)
    } catch (err) {
      console.error('CV Upload Error:', err)
      setError('CV upload failed. Make sure the Python backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  // ── Text Search ─────────────────────────────────────────────────────────
  // When the user clicks "Find My Top Matches" after typing in the text area
  async function handleFindMatches() {
    if (!readyToSearch) return

    setLoading(true)
    setMatches([])
    setActiveMatch(null)
    setError(null)

    try {
      // Use typed text, or fallback hint if only CV was uploaded
      const searchQuery =
        memoryText.trim() ||
        'Data Science and Machine Learning student looking for an applied industry thesis'

      const liveResults = await apiService.findMatches(searchQuery)
      setMatches(liveResults)
    } catch (err) {
      console.error('Search Error:', err)
      setError('Search failed. Make sure the Python backend is running on port 8000.')
    } finally {
      setLoading(false)
    }
  }

  function handleMatchClick(match: Match) {
    setActiveMatch(activeMatch?.id === match.id ? null : match)
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <Sidebar profileSynced={cvUploaded} />

      <main className="flex flex-1 flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-8 py-8">

          {/* Title */}
          <h1 className="ds-title-lg mb-1" style={{ color: 'var(--foreground)' }}>
            Thesis Copilot
          </h1>
          <p className="ds-small mb-8" style={{ color: 'var(--muted-foreground)' }}>
            Drop your CV, describe your dream — get your perfect thesis match in seconds.
          </p>

          {/* Intake Zone */}
          <div className="mb-5 flex gap-4">
            <CVUploadCard
              onUpload={handleCvUpload}
              uploaded={cvUploaded}
              keywords={cvKeywords}
            />
            <MemoryDumpCard value={memoryText} onChange={setMemoryText} />
          </div>

          {/* Error message */}
          {error && (
            <div
              className="mb-4 rounded-xl px-4 py-3 ds-small"
              style={{
                backgroundColor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444',
              }}
            >
              {error}
            </div>
          )}

          {/* CTA Button */}
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 ds-label transition-opacity duration-150 hover:opacity-90 active:opacity-80 disabled:opacity-40"
            style={{ ...aiGradient, color: '#fff' }}
            onClick={handleFindMatches}
            disabled={!readyToSearch || loading}
          >
            <Sparkles size={16} />
            {loading ? 'Finding your matches…' : 'Find My Top Matches'}
          </button>

          {/* Results Zone */}
          {(matches.length > 0 || loading) && (
            <div className="mt-10">
              <h2 className="ds-title-sm mb-4" style={{ color: 'var(--foreground)' }}>
                Deine Top 3 Matchings
              </h2>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-20 animate-pulse rounded-2xl"
                      style={{ backgroundColor: 'var(--secondary)' }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((m) => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      active={activeMatch?.id === m.id}
                      onClick={() => handleMatchClick(m)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Action Drawer — slides in from the right when a match is selected */}
      {activeMatch && (
        <ActionDrawer
          match={activeMatch}
          onClose={() => setActiveMatch(null)}
        />
      )}
    </div>
  )
}
