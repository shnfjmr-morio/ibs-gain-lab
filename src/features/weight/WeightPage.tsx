import { useState } from 'react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { db } from '../../db/schema'
import { toDateStr, nowIso, uuid } from '../../utils/date'
import { haptic } from '../../utils/haptics'
import { listItemVariants, staggerContainer } from '../../utils/motion'
import { EmptyState } from '../../components/ui/EmptyState'
import { SuccessModal } from '../../components/ui/SuccessModal'
import { useProfileStore } from '../../stores/useProfileStore'
import { WeightChartSection } from './WeightChartSection'
import type { WeightLog, IBSStatus } from '../../types/entities'

const IBS_STATUSES: IBSStatus[] = ['stable', 'mild', 'active', 'recovering']

const statusColor: Record<IBSStatus, string> = {
  stable:     'text-emerald-600 bg-emerald-50',
  mild:       'text-amber-600 bg-amber-50',
  active:     'text-red-600 bg-red-50',
  recovering: 'text-blue-600 bg-blue-50',
}

export default function WeightPage() {
  const { t } = useTranslation()
  const { profile } = useProfileStore()
  const [showAdd, setShowAdd]   = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [weightKg, setWeightKg] = useState('')
  const [bodyFat, setBodyFat]   = useState('')
  const [ibsStatus, setIbsStatus] = useState<IBSStatus>('stable')
  const [notes, setNotes]       = useState('')

  const logs = useLiveQuery(() => db.weightLogs.orderBy('date').reverse().limit(30).toArray(), [])

  const handleSave = async () => {
    const w = parseFloat(weightKg)
    if (isNaN(w) || w <= 0) return
    const today = toDateStr()
    const existing = await db.weightLogs.where('date').equals(today).first()
    if (existing) {
      await db.weightLogs.update(existing.id, {
        weightKg: w,
        bodyFatPercent: bodyFat ? parseFloat(bodyFat) : null,
        ibsStatus,
        notes,
      })
    } else {
      const log: WeightLog = {
        id: uuid(),
        date: today,
        weightKg: w,
        bodyFatPercent: bodyFat ? parseFloat(bodyFat) : null,
        ibsStatus,
        notes,
        createdAt: nowIso(),
      }
      await db.weightLogs.add(log)
    }
    haptic('success')

    // Check weight milestone
    if (profile?.targetWeightKg && w >= profile.targetWeightKg) {
      setShowSuccess(true)
    }

    setShowAdd(false)
    setWeightKg(''); setBodyFat(''); setNotes(''); setIbsStatus('stable')
  }

  const inputCls = 'w-full border border-black/[0.04] rounded-2xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow'

  return (
    <AppShell title={t('weight.title')}>
      <div className="p-4 space-y-3">
        <m.button data-motion
          onClick={() => setShowAdd(true)}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full flex items-center justify-center gap-2 bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow relative overflow-hidden mb-2"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
          <Plus size={20} className="relative z-10" strokeWidth={2.5} />
          <span className="relative z-10 text-[15px] tracking-wide font-display">{t('weight.add')}</span>
        </m.button>

        {/* 体重推移グラフ（2件以上の場合のみ表示） */}
        {logs && logs.length >= 2 && (
          <WeightChartSection logs={logs} targetWeightKg={profile?.targetWeightKg} />
        )}

        {logs && logs.length > 0 ? (
          <m.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
            {logs.map(log => (
              <m.div key={log.id} variants={listItemVariants}
                className="glass-panel rounded-3xl p-5 shadow-sm border border-black/[0.03]">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 font-display tracking-wider uppercase mb-1">{log.date}</p>
                    <p className="text-3xl font-bold font-display text-gray-900 tracking-tight leading-none">
                      {log.weightKg}
                      <span className="text-sm font-medium text-gray-400 ml-1 uppercase tracking-wider">kg</span>
                    </p>
                    {log.bodyFatPercent && (
                      <p className="text-[11px] font-medium text-gray-500 mt-2">{t('weight.body_fat')} <span className="font-bold text-gray-700">{log.bodyFatPercent}%</span></p>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full font-display tracking-widest uppercase border border-white/50 shadow-sm ${statusColor[log.ibsStatus]}`}>
                    {t(`weight.status.${log.ibsStatus}`)}
                  </span>
                </div>
                {log.notes && <p className="text-[13px] text-gray-600 mt-3 pt-3 border-t border-black/[0.04] leading-relaxed">{log.notes}</p>}
              </m.div>
            ))}
          </m.div>
        ) : (
          <EmptyState title={t('weight.no_logs')} />
        )}
      </div>

      <BottomSheet
        open={showAdd}
        onOpenChange={(open) => {
          if (!open) {
            setShowAdd(false)
            setWeightKg(''); setBodyFat(''); setNotes(''); setIbsStatus('stable')
          }
        }}
      >
        <div className="space-y-4 pb-4">
          <h2 className="text-lg font-bold font-display text-gray-900 tracking-tight">{t('weight.add')}</h2>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">{t('weight.weight_kg')}</label>
              <input
                type="number" step="0.1" value={weightKg}
                onChange={e => setWeightKg(e.target.value)}
                placeholder="53.2"
                className="w-full border border-black/[0.04] rounded-2xl px-4 py-3 text-xl font-bold font-display tracking-wide focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow placeholder:font-normal placeholder:text-gray-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">{t('weight.body_fat_optional')}</label>
              <input
                type="number" step="0.1" value={bodyFat}
                onChange={e => setBodyFat(e.target.value)}
                placeholder="15.0" className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-2 block uppercase tracking-wider">{t('weight.ibs_status')}</label>
              <div className="grid grid-cols-2 gap-2">
                {IBS_STATUSES.map(status => (
                  <button key={status} onClick={() => setIbsStatus(status)}
                    className={`py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 ${
                      ibsStatus === status ? statusColor[status] + ' shadow-sm ring-2 ring-emerald-500/30 ring-offset-1' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                    }`}>
                    {t(`weight.status.${status}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1.5 block uppercase tracking-wider">{t('weight.notes')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="今日の気づきなど" rows={3} className={`${inputCls} resize-none`} />
            </div>
          </div>

          <m.button data-motion
            onClick={handleSave}
            disabled={!weightKg}
            whileTap={weightKg ? { scale: 0.97 } : undefined}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow relative overflow-hidden tracking-wide font-display mt-2 disabled:opacity-40 disabled:grayscale-[0.5]"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
            <span className="relative z-10">{t('weight.save')}</span>
          </m.button>
        </div>
      </BottomSheet>

      <SuccessModal
        open={showSuccess}
        onClose={() => setShowSuccess(false)}
        title={t('success.weight_goal')}
        description={t('success.weight_goal_desc')}
      />
    </AppShell>
  )
}
