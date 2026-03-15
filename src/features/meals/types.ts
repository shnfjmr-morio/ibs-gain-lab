import type { FODMAPLevel, IBSSafetyScore, MealType, GutFeedback } from '../../types/entities'

export type InputMode = 'text' | 'voice'
export type AddStep = 'input' | 'confirm' | 'ai_analyzing' | 'notify_prompt'

export interface MealDraft {
  fodmapLevel: FODMAPLevel
  ibsSafety: IBSSafetyScore
  calories: number
  protein: number
  fat: number
  carbs: number
  notes: string
  aiEstimated: boolean
  matchedFoodNames?: string[]
}

export interface EditForm {
  mealType: MealType
  description: string
  calories: string
  protein: string
  fat: string
  carbs: string
  fodmapLevel: FODMAPLevel
  ibsSafety: IBSSafetyScore
  gutFeedback: GutFeedback | ''
  notes: string
}
