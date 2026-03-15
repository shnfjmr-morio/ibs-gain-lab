import { create } from 'zustand'
import { db } from '../db/schema'
import type { UserProfile } from '../types/entities'
import i18n from '../utils/i18n'

interface ProfileStore {
  profile: UserProfile | null
  isLoading: boolean
  load: () => Promise<void>
  save: (data: Partial<UserProfile>) => Promise<void>
  setLanguage: (lang: 'ja' | 'en') => Promise<void>
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'default',
  name: '',
  age: 0,
  gender: 'male',
  heightCm: 170,
  currentWeightKg: 0,
  targetWeightKg: 0,
  targetWeeklyGainKg: 0.3,
  targetDailyCalories: 2200,
  ibsType: 'IBS-D',
  knownTriggers: [],
  safeFoods: [],
  avoidFoods: [],
  language: 'ja',
  gutCheckTiming: 'next_meal',
  claudeApiKey: '',
  aiProvider: 'claude' as const,
  openaiApiKey: '',
  geminiApiKey: '',
  aiModel: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profile: null,
  isLoading: true,

  load: async () => {
    set({ isLoading: true })
    const profile = await db.userProfile.get('default')
    if (profile) {
      i18n.changeLanguage(profile.language)
      set({ profile, isLoading: false })
    } else {
      set({ profile: null, isLoading: false })
    }
  },

  save: async (data) => {
    const current = get().profile ?? DEFAULT_PROFILE
    const updated: UserProfile = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    }
    await db.userProfile.put(updated)
    if (data.language) i18n.changeLanguage(data.language)
    set({ profile: updated })
  },

  setLanguage: async (lang) => {
    await get().save({ language: lang })
    i18n.changeLanguage(lang)
  },
}))
