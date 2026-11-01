import { describe, expect, test } from 'vitest'
import { answeredCount, bubbleLabel, clampIndex, parseCachedIndex } from './questionNav'

const questions = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]

describe('question navigation', () => {
  test('clampIndex keeps the index inside the quiz', () => {
    expect(clampIndex(-1, 3)).toBe(0)
    expect(clampIndex(1, 3)).toBe(1)
    expect(clampIndex(5, 3)).toBe(2)
    expect(clampIndex(0, 0)).toBe(0)
  })

  test('parseCachedIndex restores a saved question, falling back to the first', () => {
    expect(parseCachedIndex(null, 3)).toBe(0)
    expect(parseCachedIndex('abc', 3)).toBe(0)
    expect(parseCachedIndex('1.5', 3)).toBe(0)
    expect(parseCachedIndex('2', 3)).toBe(2)
    expect(parseCachedIndex('9', 3)).toBe(2)
    expect(parseCachedIndex('-4', 3)).toBe(0)
  })

  test('answeredCount counts questions with at least one pick', () => {
    expect(answeredCount(questions, {})).toBe(0)
    expect(answeredCount(questions, { q1: ['a'], q2: [], q3: ['b', 'c'] })).toBe(2)
  })

  test('bubbleLabel says the number and whether it is answered', () => {
    expect(bubbleLabel(0, true)).toBe('Question 1, answered')
    expect(bubbleLabel(2, false)).toBe('Question 3, not answered')
  })
})
