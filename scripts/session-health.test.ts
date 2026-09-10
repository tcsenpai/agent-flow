import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assessHealth, type ToolRecord } from '../extension/src/session-health'

const rec = (i: number, tool: string, args: string, error: boolean | null = false): ToolRecord => ({ id: String(i), tool, sig: `${tool}:${args}`, error })

test('varied successful calls are ok', () => {
  const h = assessHealth([rec(1, 'Read', 'a.ts'), rec(2, 'Edit', 'a.ts'), rec(3, 'Bash', 'npm test'), rec(4, 'Read', 'b.ts')])
  assert.equal(h.level, 'ok')
})

test('four identical calls warn, six are bad', () => {
  const four = Array.from({ length: 4 }, (_, i) => rec(i, 'Grep', 'foo'))
  assert.equal(assessHealth(four).level, 'warn')
  const six = Array.from({ length: 6 }, (_, i) => rec(i, 'Grep', 'foo'))
  const h = assessHealth(six)
  assert.equal(h.level, 'bad')
  assert.match(h.reason, /6× identical Grep:foo/)
})

test('three consecutive errors of one tool are bad; scattered errors only warn', () => {
  const consecutive = [rec(1, 'Read', 'a'), rec(2, 'Bash', 'x', true), rec(3, 'Bash', 'y', true), rec(4, 'Bash', 'z', true)]
  assert.equal(assessHealth(consecutive).level, 'bad')
  const scattered = [rec(1, 'Bash', 'a', true), rec(2, 'Read', 'b'), rec(3, 'Bash', 'c', true), rec(4, 'Read', 'd'), rec(5, 'Edit', 'e', true), rec(6, 'Read', 'f')]
  assert.equal(assessHealth(scattered).level, 'warn')
})

test('pending calls do not count as errors and the window is bounded', () => {
  const old = Array.from({ length: 30 }, (_, i) => rec(i, 'Grep', 'old'))     // outside the window
  const now = Array.from({ length: 5 }, (_, i) => rec(100 + i, 'Read', `f${i}`, null))
  assert.equal(assessHealth([...old, ...now]).level, 'bad') // 15 of the old greps still inside the 20-window
  assert.equal(assessHealth(now).level, 'ok')
})
