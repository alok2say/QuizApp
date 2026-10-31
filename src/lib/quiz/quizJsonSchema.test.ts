import { describe, it, expect } from 'vitest'
import { validateQuizJson } from './quizJsonSchema'

const validQuiz = {
  title: 'Capitals Quiz',
  description: 'Test your knowledge of world capitals',
  timeLimitSeconds: 300,
  retakePolicy: 'UNLIMITED_BEST',
  feedbackMode: 'END_ONLY',
  leaderboardSize: 10,
  questions: [
    {
      text: 'What is the capital of France?',
      type: 'SINGLE_SELECT',
      points: 10,
      options: [
        { text: 'Paris', isCorrect: true },
        { text: 'London', isCorrect: false },
      ],
    },
  ],
}

describe('validateQuizJson', () => {
  it('accepts a fully valid quiz', () => {
    const result = validateQuizJson(validQuiz)
    expect(result).toEqual({ ok: true, data: validQuiz })
  })

  it('defaults a missing points to 10', () => {
    const question: Record<string, unknown> = { ...validQuiz.questions[0] }
    delete question.points
    const input = { ...validQuiz, questions: [question] }

    const result = validateQuizJson(input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.questions[0].points).toBe(10)
    }
  })

  it('defaults a missing leaderboardSize to 10', () => {
    const input: Record<string, unknown> = { ...validQuiz }
    delete input.leaderboardSize

    const result = validateQuizJson(input)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.leaderboardSize).toBe(10)
    }
  })

  it('rejects a non-object input', () => {
    const result = validateQuizJson(['not', 'an', 'object'])
    expect(result.ok).toBe(false)
  })

  it('rejects feedbackMode other than END_ONLY', () => {
    const result = validateQuizJson({ ...validQuiz, feedbackMode: 'IMMEDIATE' })
    expect(result.ok).toBe(false)
  })

  it('rejects a quiz with zero questions', () => {
    const result = validateQuizJson({ ...validQuiz, questions: [] })
    expect(result).toEqual({
      ok: false,
      errors: ['Quiz must have at least 1 question.'],
    })
  })

  it('rejects a question with fewer than 2 options', () => {
    const input = {
      ...validQuiz,
      questions: [{ ...validQuiz.questions[0], options: [{ text: 'Only one', isCorrect: true }] }],
    }
    const result = validateQuizJson(input)
    expect(result).toEqual({
      ok: false,
      errors: ['Question 1: must have at least 2 options.'],
    })
  })

  it('rejects a question with zero correct options', () => {
    const input = {
      ...validQuiz,
      questions: [
        {
          ...validQuiz.questions[0],
          options: [
            { text: 'A', isCorrect: false },
            { text: 'B', isCorrect: false },
          ],
        },
      ],
    }
    const result = validateQuizJson(input)
    expect(result).toEqual({
      ok: false,
      errors: ['Question 1: must have at least 1 correct option.'],
    })
  })

  it('rejects a SINGLE_SELECT question with 2 correct options', () => {
    const input = {
      ...validQuiz,
      questions: [
        {
          ...validQuiz.questions[0],
          type: 'SINGLE_SELECT',
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: true },
          ],
        },
      ],
    }
    const result = validateQuizJson(input)
    expect(result).toEqual({
      ok: false,
      errors: ['Question 1: SINGLE_SELECT questions must have exactly 1 correct option.'],
    })
  })

  it('accepts a MULTI_SELECT question with 2 correct options', () => {
    const input = {
      ...validQuiz,
      questions: [
        {
          text: 'Which are primary colors?',
          type: 'MULTI_SELECT',
          points: 20,
          options: [
            { text: 'Red', isCorrect: true },
            { text: 'Green', isCorrect: false },
            { text: 'Blue', isCorrect: true },
          ],
        },
      ],
    }
    const result = validateQuizJson(input)
    expect(result.ok).toBe(true)
  })
})
