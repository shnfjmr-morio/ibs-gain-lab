const STORAGE_KEY = 'ibs_pending_gut_checks'

interface PendingCheck {
  mealId: string
  description: string
  fireAt: number   // Unix ms
  lang: 'ja' | 'en'
}

function loadPending(): PendingCheck[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') } catch { return [] }
}

function savePending(list: PendingCheck[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

function fire(check: PendingCheck) {
  if (Notification.permission !== 'granted') return
  const body = check.lang === 'en'
    ? `How's your gut feeling after "${check.description}"?`
    : `「${check.description}」から1時間。お腹の調子はいかがですか？`
  new Notification('FutoLab', {
    body,
    icon: '/assets/logo-icon.png',
    tag: `gut-check-${check.mealId}`,
    requireInteraction: false,
  })
  savePending(loadPending().filter(p => p.mealId !== check.mealId))
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function scheduleGutCheck(mealId: string, description: string, lang: 'ja' | 'en') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const fireAt = Date.now() + 60 * 60 * 1000   // 1時間後
  const check: PendingCheck = { mealId, description, fireAt, lang }
  savePending([...loadPending().filter(p => p.mealId !== mealId), check])
  setTimeout(() => fire(check), 60 * 60 * 1000)
}

/** アプリ起動時に呼び出す — アプリが閉じている間に時間が過ぎたチェックを処理 */
export function resumePendingChecks() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  const now = Date.now()
  loadPending().forEach(check => {
    const remaining = check.fireAt - now
    if (remaining <= 0) {
      fire(check)
    } else {
      setTimeout(() => fire(check), remaining)
    }
  })
}
