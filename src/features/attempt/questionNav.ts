// Pure helpers for moving through a quiz one question at a time.

export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(Math.max(index, 0), total - 1)
}

// The saved current question, or the first one if nothing usable is saved
export function parseCachedIndex(raw: string | null, total: number): number {
  if (raw === null || !/^-?\d+$/.test(raw)) return 0
  return clampIndex(Number(raw), total)
}

export function answeredCount(questions: { id: string }[], answers: Record<string, string[]>): number {
  return questions.filter((q) => (answers[q.id] ?? []).length > 0).length
}

export function bubbleLabel(index: number, answered: boolean): string {
  return `Question ${index + 1}, ${answered ? 'answered' : 'not answered'}`
}
