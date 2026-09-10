import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessHealth, type ToolRecord } from '../extension/src/session-health'

const rec = (i: number, tool: string, args: string, error: boolean | null = false): ToolRecord => ({ id: String(i), tool, sig: `${tool}:${args}`, error })

test('varied successful calls are ok', () => {
  const h = assessHealth([rec(1, 'Read', 'a.ts'), rec(2, 'Edit', 'a.ts'), rec(3, 'Bash', 'npm test'), rec(4, 'Read', 'b.ts')])
  assert.equal(h.level, 'ok')
})

test('four identical Bash calls warn, six are bad', () => {
  const four = Array.from({ length: 4 }, (_, i) => rec(i, 'Bash', 'npm test'))
  assert.equal(assessHealth(four).level, 'warn')
  const six = Array.from({ length: 6 }, (_, i) => rec(i, 'Bash', 'npm test'))
  const h = assessHealth(six)
  assert.equal(h.level, 'bad')
  assert.match(h.reason, /6× identical Bash:npm test/)
})

test('re-reading or re-searching the same thing is not a loop', () => {
  const reads = Array.from({ length: 10 }, (_, i) => rec(i, 'Read', 'ui/canvas.html'))
  const greps = Array.from({ length: 10 }, (_, i) => rec(100 + i, 'Grep', 'foo'))
  assert.equal(assessHealth([...reads, ...greps]).level, 'ok')
})

test('three consecutive errors of one tool are bad; scattered errors only warn', () => {
  const consecutive = [rec(1, 'Read', 'a'), rec(2, 'Bash', 'x', true), rec(3, 'Bash', 'y', true), rec(4, 'Bash', 'z', true)]
  assert.equal(assessHealth(consecutive).level, 'bad')
  const scattered = [rec(1, 'Bash', 'a', true), rec(2, 'Read', 'b'), rec(3, 'Bash', 'c', true), rec(4, 'Read', 'd'), rec(5, 'Edit', 'e', true), rec(6, 'Read', 'f')]
  assert.equal(assessHealth(scattered).level, 'warn')
})

test('pending calls do not count as errors and the window is bounded', () => {
  const old = Array.from({ length: 30 }, (_, i) => rec(i, 'Bash', 'old'))     // outside the window
  const now = Array.from({ length: 5 }, (_, i) => rec(100 + i, 'Read', `f${i}`, null))
  assert.equal(assessHealth([...old, ...now]).level, 'bad') // 15 of the old bash calls still inside the 20-window
  assert.equal(assessHealth(now).level, 'ok')
})
