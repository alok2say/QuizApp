export type ScorableQuestion = {
  id: string
  points: number
  options: { id: string; isCorrect: boolean }[]
}

export type ScoredAnswer = {
  questionId: string
  isCorrect: boolean
  pointsAwarded: number
}

export function scoreAnswer(question: ScorableQuestion, selectedOptionIds: string[]): ScoredAnswer {
  const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id)
  const selected = new Set(selectedOptionIds)
  const correct = new Set(correctIds)

  const isCorrect =
    selected.size === correct.size && [...selected].every((id) => correct.has(id))

  return {
    questionId: question.id,
    isCorrect,
    pointsAwarded: isCorrect ? question.points : 0,
  }
}
