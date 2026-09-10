'use client'

import { COLORS } from '@/lib/colors'
import { Z } from '@/lib/agent-types'
import type { FileCollision, SessionInfo } from '@/lib/bridge-types'
import { folderName } from '@/lib/session-label'

interface StatusSidebarProps {
  sessions: SessionInfo[]
  selectedSessionId: string | null
  collisions: FileCollision[]
  onSelectSession: (id: string) => void
  /** Hide while a side panel (Files / Chat / Dead letters) occupies the right edge */
  hidden: boolean
}

const levelColor = (level: 'ok' | 'warn' | 'bad') => level === 'bad' ? COLORS.error : level === 'warn' ? COLORS.waiting_permission : COLORS.complete

/** Right-hand sidebar with what needs attention across sessions: health verdicts and same-file collisions. Renders nothing when there is nothing to say. */
export function StatusSidebar({ sessions, selectedSessionId, collisions, onSelectSession, hidden }: StatusSidebarProps) {
  const unhealthy = sessions
    .filter(s => s.health && s.health.level !== 'ok')
    .sort((a, b) => (a.id === selectedSessionId ? -1 : b.id === selectedSessionId ? 1 : 0) || (a.health!.level === 'bad' ? -1 : 1))
  if (hidden || (unhealthy.length === 0 && collisions.length === 0)) return null

  const nameOf = (id: string) => {
    const s = sessions.find(x => x.id === id)
    if (!s) return id.slice(0, 8)
    return s.cwd ? `${folderName(s.cwd)} · ${s.label}` : s.label
  }
  const chip = (id: string, extra?: string) => (
    <button
      key={id}
      onClick={() => onSelectSession(id)}
      className="px-2 py-1 rounded text-left truncate"
      style={{
        maxWidth: '100%',
        background: id === selectedSessionId ? COLORS.tabSelectedBg : COLORS.tabInactiveBg,
        border: `1px solid ${id === selectedSessionId ? COLORS.tabSelectedBorder : COLORS.tabInactiveBorder}`,
        color: id === selectedSessionId ? COLORS.holoBright : COLORS.textMuted,
      }}
      title={nameOf(id)}
    >
      {extra}{nameOf(id)}
    </button>
  )

  return (
    <div
      className="absolute flex flex-col gap-3 font-mono text-[12px] overflow-y-auto"
      style={{ top: 52, right: 12, bottom: 96, width: 300, zIndex: Z.info, pointerEvents: 'auto' }}
    >
      {unhealthy.length > 0 && (
        <section className="glass-card p-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Needs attention</div>
          {unhealthy.map(s => (
            <div key={s.id} className="flex flex-col gap-1 rounded px-2 py-1.5" style={{ background: 'rgba(10, 15, 30, 0.5)', border: `1px solid ${levelColor(s.health!.level)}40` }}>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: levelColor(s.health!.level), boxShadow: `0 0 6px ${levelColor(s.health!.level)}` }} />
                {chip(s.id)}
              </div>
              <div style={{ color: levelColor(s.health!.level) }}>{s.health!.reason}</div>
            </div>
          ))}
        </section>
      )}

      {collisions.length > 0 && (
        <section className="glass-card p-3 flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-wider" style={{ color: COLORS.textMuted }}>Same file, same time</div>
          {collisions.map(c => (
            <div key={c.file} className="flex flex-col gap-1 rounded px-2 py-1.5" style={{ background: 'rgba(30, 20, 5, 0.5)', border: `1px solid ${COLORS.waiting_permission}40` }} title={c.file}>
              <div className="truncate" style={{ color: COLORS.waiting_permission }}>⚠ {c.file.split(/[\\/]/).pop()}</div>
              <div className="truncate" style={{ color: COLORS.textMuted, fontSize: 10 }}>{c.file}</div>
              <div className="flex flex-col gap-1">
                {c.sessions.map(sid => {
                  const parties = c.parties.filter(p => p.sessionId === sid)
                  const wrote = parties.some(p => p.action === 'write')
                  const agents = [...new Set(parties.map(p => p.agent))]
                  return (
                    <div key={sid} className="flex flex-col gap-0.5">
                      {chip(sid, wrote ? '✎ ' : '👁 ')}
                      {agents.length > 1 && <div style={{ color: COLORS.textMuted, fontSize: 10 }}>{agents.join(' ↔ ')}</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
