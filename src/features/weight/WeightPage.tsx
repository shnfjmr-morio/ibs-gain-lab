import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import AppShell from '../../components/layout/AppShell'
import { db } from '../../db/schema'
import { toDateStr, nowIso, uuid } from '../../utils/date'
import type { WeightLog, IBSStatus } from '../../types/entities'

const IBS_STATUSES: IBSStatus[] = ['stable', 'mild', 'active', 'recovering']

export default function WeightPage() {
  const { t } = useTranslation()
  const [showAdd, setShowAdd] = useState(false)
  const [weightKg, setWeightKg] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [ibsStatus, setIbsStatus] = useState<IBSStatus>('stable')
  const [notes, setNotes] = useState('')

  const logs = useLiveQuery(() => db.weightLogs.orderBy('date').reverse().limit(30).toArray(), [])

  const handleSave = async () => {
    const w = parseFloat(weightKg)
    if (isNaN(w) || w <= 0) return
    const log: WeightLog = {
      id: uuid(),
      date: toDateStr(),
      weightKg: w,
      bodyFatPercent: bodyFat ? parseFloat(bodyFat) : null,
      ibsStatus,
      notes,
      createdAt: nowIso(),
    }
    await db.weightLogs.add(log)
    setShowAdd(false)
    setWeightKg(''); setBodyFat(''); setNotes(''); setIbsStatus('stable')
  }

  const statusColor: Record<IBSStatus, string> = {
    stable: 'text-emerald-600 bg-emerald-50',
    mild: 'text-amber-600 bg-amber-50',
    active: 'text-red-600 bg-red-50',
    recovering: 'text-blue-600 bg-blue-50',
  }

  return (
    <AppShell title={t('weight.title')}>
      <div className="p-4 space-y-3">
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary w-full flex items-center justify-center gap-2 bg-emerald-600 text-white rounded-2xl py-3.5 font-semibold shadow-[0_4px_16px_rgba(61,143,133,0.35)]"
        >
          <Plus size={18} />
          {t('weight.add')}
        </button>

        {logs && logs.length > 0 ? logs.map(log => (
          <div key={log.id} className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-black/[0.04]">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400">{log.date}</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {log.weightKg}
                  <span className="text-sm font-normal text-gray-400 ml-1">kg</span>
                </p>
                {log.bodyFatPercent && (
                  <p className="text-xs text-gray-400">体脂肪 {log.bodyFatPercent}%</p>
                )}
              </div>
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor[log.ibsStatus]}`}>
                {t(`weight.status.${log.ibsStatus}`)}
              </span>
            </div>
            {log.notes && <p className="text-xs text-gray-400 mt-2">{log.notes}</p>}
          </div>
        )) : (
          <div className="text-center py-16 text-gray-400 text-sm">{t('weight.no_logs')}</div>
        )}
      </div>

      {showAdd && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-enter">
          <div className="bg-[#FAFAF7] rounded-t-3xl p-4 space-y-4 sheet-enter">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex justify-between items-center">
              <h2 className="text-base font-semibold text-gray-900">{t('weight.add')}</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 text-gray-400"><X size={20} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('weight.weight_kg')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={weightKg}
                  onChange={e => setWeightKg(e.target.value)}
                  placeholder="53.2"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('weight.body_fat_optional')}</label>
                <input
                  type="number"
                  step="0.1"
                  value={bodyFat}
                  onChange={e => setBodyFat(e.target.value)}
                  placeholder="15.0"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">{t('weight.ibs_status')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {IBS_STATUSES.map(status => (
                    <button
                      key={status}
                      onClick={() => setIbsStatus(status)}
                      className={`py-2 rounded-xl text-sm font-medium transition-colors ${
                        ibsStatus === status ? statusColor[status] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t(`weight.status.${status}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-1 block">{t('weight.notes')}</label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="今日の気づきなど"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={!weightKg}
              className="btn-primary w-full bg-emerald-600 text-white rounded-2xl py-3.5 font-semibold disabled:opacity-40 shadow-[0_4px_14px_rgba(61,143,133,0.3)]"
            >
              {t('weight.save')}
            </button>
          </div>
        </div>,
        document.getElementById('root')!
      )}
    </AppShell>
  )
}
