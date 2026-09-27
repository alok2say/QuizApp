import { z } from 'zod'

const optionSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
})

const questionSchema = z.object({
  text: z.string().min(1),
  type: z.enum(['SINGLE_SELECT', 'MULTI_SELECT']),
  points: z.number().int().positive().optional(),
  options: z.array(optionSchema),
})

const quizJsonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  timeLimitSeconds: z.number().int().positive(),
  retakePolicy: z.enum(['UNLIMITED_BEST', 'UNLIMITED_LATEST', 'SINGLE_ATTEMPT']),
  feedbackMode: z.literal('END_ONLY'),
  questions: z.array(questionSchema),
})

export type QuizJsonInput = z.infer<typeof quizJsonSchema>

export type ValidateQuizJsonResult =
  | { ok: true; data: QuizJsonInput }
  | { ok: false; errors: string[] }

export function validateQuizJson(input: unknown): ValidateQuizJsonResult {
  const parsed = quizJsonSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    }
  }

  const data = parsed.data
  const errors: string[] = []

  if (data.questions.length < 1) {
    errors.push('Quiz must have at least 1 question.')
  }

  data.questions.forEach((question, index) => {
    if (question.options.length < 2) {
      errors.push(`Question ${index + 1}: must have at least 2 options.`)
      return
    }

    const correctCount = question.options.filter((option) => option.isCorrect).length

    if (correctCount < 1) {
      errors.push(`Question ${index + 1}: must have at least 1 correct option.`)
      return
    }

    if (question.type === 'SINGLE_SELECT' && correctCount !== 1) {
      errors.push(`Question ${index + 1}: SINGLE_SELECT questions must have exactly 1 correct option.`)
    }
  })

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const withDefaults: QuizJsonInput = {
    ...data,
    questions: data.questions.map((question) => ({
      ...question,
      points: question.points ?? 10,
    })),
  }

  return { ok: true, data: withDefaults }
}
