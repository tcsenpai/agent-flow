/**
 * Session health verdict: a glanceable ok / warn / bad per session with a
 * one-line reason, derived from the last few tool calls. Signals:
 *   - loops: the same tool with the same arguments repeated
 *   - errors: failed tool results, especially consecutive ones of one tool
 * Context-window pressure is left to the frontend (it knows the model's window).
 * Thresholds are deliberately conservative: a false "bad" trains users to
 * ignore the color, which defeats the whole point.
 */

export type HealthLevel = 'ok' | 'warn' | 'bad'

export interface SessionHealth {
  level: HealthLevel
  reason: string
  metrics: { maxRepeat: number; recentErrors: number; consecutiveErrors: number }
}

export interface ToolRecord {
  /** tool_use id, to match the result */
  id: string
  tool: string
  /** tool + summarized args; identical signature = "the same call again" */
  sig: string
  /** null while pending */
  error: boolean | null
}

export const HEALTH_WINDOW = 20
export const REPEAT_WARN = 4
export const REPEAT_BAD = 6
export const ERRORS_WARN = 3
export const ERRORS_BAD = 5
export const CONSECUTIVE_ERRORS_BAD = 3

/** Re-reading or re-searching the same thing is normal work, not a loop; only tools with effects or cost count */
const LOOP_EXEMPT_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS'])

export function assessHealth(recent: ToolRecord[]): SessionHealth {
  const window = recent.slice(-HEALTH_WINDOW)

  // Loops: most repeated signature in the window
  const counts = new Map<string, number>()
  for (const r of window) if (!LOOP_EXEMPT_TOOLS.has(r.tool)) counts.set(r.sig, (counts.get(r.sig) ?? 0) + 1)
  let maxRepeat = 0, repeatedSig = ''
  for (const [sig, n] of counts) if (n > maxRepeat) { maxRepeat = n; repeatedSig = sig }

  // Errors among completed calls
  const completed = window.filter(r => r.error !== null)
  const recentErrors = completed.filter(r => r.error).length
  let consecutiveErrors = 0, consecutiveTool = ''
  for (let i = completed.length - 1; i >= 0; i--) {
    const r = completed[i]
    if (!r.error || (consecutiveTool && r.tool !== consecutiveTool)) break
    consecutiveTool = r.tool
    consecutiveErrors++
  }

  const metrics = { maxRepeat, recentErrors, consecutiveErrors }
  const repeatLabel = repeatedSig.slice(0, 60)
  if (maxRepeat >= REPEAT_BAD) return { level: 'bad', reason: `${maxRepeat}× identical ${repeatLabel}`, metrics }
  if (consecutiveErrors >= CONSECUTIVE_ERRORS_BAD) return { level: 'bad', reason: `${consecutiveErrors} consecutive ${consecutiveTool} errors`, metrics }
  if (recentErrors >= ERRORS_BAD) return { level: 'bad', reason: `${recentErrors} of last ${completed.length} tool calls failed`, metrics }
  if (maxRepeat >= REPEAT_WARN) return { level: 'warn', reason: `${maxRepeat}× identical ${repeatLabel}`, metrics }
  if (recentErrors >= ERRORS_WARN) return { level: 'warn', reason: `${recentErrors} of last ${completed.length} tool calls failed`, metrics }
  return { level: 'ok', reason: '', metrics }
}
