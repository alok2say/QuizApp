import { describe, it, expect } from 'vitest'
import { scoreAnswer } from './scoring'

const singleSelect = {
  id: 'q1',
  points: 10,
  options: [
    { id: 'a', isCorrect: true },
    { id: 'b', isCorrect: false },
  ],
}

const multiSelect = {
  id: 'q2',
  points: 20,
  options: [
    { id: 'a', isCorrect: true },
    { id: 'b', isCorrect: true },
    { id: 'c', isCorrect: false },
  ],
}

describe('scoreAnswer', () => {
  it('awards full points for an exact single-select match', () => {
    expect(scoreAnswer(singleSelect, ['a'])).toEqual({
      questionId: 'q1',
      isCorrect: true,
      pointsAwarded: 10,
    })
  })

  it('awards zero for a wrong single-select answer', () => {
    expect(scoreAnswer(singleSelect, ['b'])).toEqual({
      questionId: 'q1',
      isCorrect: false,
      pointsAwarded: 0,
    })
  })

  it('awards full points only for an exact multi-select match', () => {
    expect(scoreAnswer(multiSelect, ['a', 'b'])).toEqual({
      questionId: 'q2',
      isCorrect: true,
      pointsAwarded: 20,
    })
  })

  it('awards zero for a partial multi-select match (no partial credit)', () => {
    expect(scoreAnswer(multiSelect, ['a'])).toEqual({
      questionId: 'q2',
      isCorrect: false,
      pointsAwarded: 0,
    })
  })

  it('awards zero for a multi-select match with an extra wrong option', () => {
    expect(scoreAnswer(multiSelect, ['a', 'b', 'c'])).toEqual({
      questionId: 'q2',
      isCorrect: false,
      pointsAwarded: 0,
    })
  })

  it('is order-independent', () => {
    expect(scoreAnswer(multiSelect, ['b', 'a'])).toEqual({
      questionId: 'q2',
      isCorrect: true,
      pointsAwarded: 20,
    })
  })

  it('awards zero for an unanswered question', () => {
    expect(scoreAnswer(singleSelect, [])).toEqual({
      questionId: 'q1',
      isCorrect: false,
      pointsAwarded: 0,
    })
  })
})
