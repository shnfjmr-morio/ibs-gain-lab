import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useProfileStore } from './stores/useProfileStore'
import { resumePendingChecks } from './services/notifications/GutCheckNotifier'
import { db } from './db/schema'
import { toDateStr } from './utils/date'
import GutFeedbackModal from './components/GutFeedbackModal'
import OnboardingPage from './features/onboarding/OnboardingPage'
import HomePage from './features/home/HomePage'
import MealsPage from './features/meals/MealsPage'
import WeightPage from './features/weight/WeightPage'
import ChatPage from './features/chat/ChatPage'
import SettingsPage from './features/settings/SettingsPage'
import type { Meal, GutFeedback } from './types/entities'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/"         element={<HomePage />} />
      <Route path="/meals"    element={<MealsPage />} />
      <Route path="/weight"   element={<WeightPage />} />
      <Route path="/chat"     element={<ChatPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*"         element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const { profile, isLoading, load } = useProfileStore()
  const [notifMeal, setNotifMeal] = useState<Meal | null>(null)

  useEffect(() => { load(); resumePendingChecks() }, [])

  // 通知モード：アプリ起動時に未回答の食事があれば確認
  useEffect(() => {
    if (!profile) return
    const timing = profile.gutCheckTiming ?? 'both'
    if (timing !== 'notification' && timing !== 'both') return

    const check = async () => {
      const now = Date.now()
      const minAge = 30 * 60 * 1000   // 最低30分経過した食事
      const meals = await db.meals.where('date').equals(toDateStr()).toArray()
      const candidate = meals
        .filter(m => !m.gutFeedback)
        .filter(m => {
          const mealTs = new Date(`${m.date}T${m.time}:00`).getTime()
          return now - mealTs >= minAge
        })
        .sort((a, b) => b.time.localeCompare(a.time))[0]
      if (candidate) setNotifMeal(candidate)
    }
    check()
  }, [profile])

  const handleNotifFeedback = async (feedback: GutFeedback) => {
    if (!notifMeal) return
    await db.meals.update(notifMeal.id, { gutFeedback: feedback })
    setNotifMeal(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-[#FAFAF7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-[3px] border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">FutoLab</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return <OnboardingPage onComplete={() => load()} />
  }

  return (
    <BrowserRouter>
      <AnimatedRoutes />
      {/* 通知モード：起動時フィードバックモーダル */}
      {notifMeal && (
        <GutFeedbackModal
          meal={notifMeal}
          onSubmit={handleNotifFeedback}
          onSkip={() => setNotifMeal(null)}
        />
      )}
    </BrowserRouter>
  )
}
