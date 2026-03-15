import { AnimatePresence, m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { BottomSheet } from '../../../components/ui/BottomSheet'
import { fodmapColor, safetyColor, inputCls, stepVariants, stepTransition } from '../constants'
import type { MealAddFlowReturn } from '../hooks/useMealAddFlow'

type MealConfirmSheetProps = Pick<
  MealAddFlowReturn,
  | 'showAdd'
  | 'addStep'
  | 'setAddStep'
  | 'description'
  | 'draft'
  | 'matchResults'
  | 'calories'
  | 'setCalories'
  | 'protein'
  | 'setProtein'
  | 'fat'
  | 'setFat'
  | 'carbs'
  | 'setCarbs'
  | 'aiError'
  | 'saveError'
  | 'hasApiKey'
  | 'lang'
  | 'handleAiAnalyze'
  | 'handleSave'
  | 'handleAllowNotification'
  | 'resetAdd'
>

export function MealConfirmSheet({
  showAdd,
  addStep,
  setAddStep,
  description,
  draft,
  matchResults,
  calories,
  setCalories,
  protein,
  setProtein,
  fat,
  setFat,
  carbs,
  setCarbs,
  aiError,
  saveError,
  hasApiKey,
  lang,
  handleAiAnalyze,
  handleSave,
  handleAllowNotification,
  resetAdd,
}: MealConfirmSheetProps) {
  const { t } = useTranslation()

  return (
    <BottomSheet
      open={showAdd && addStep !== 'input'}
      onOpenChange={(open) => { if (!open) resetAdd() }}
      dismissible={false}
      className="min-h-[65dvh]"
      footer={
        addStep === 'confirm' ? (
          <div className="space-y-2">
            {saveError && (
              <p className="text-xs text-red-500 text-center bg-red-50 rounded-xl px-3 py-2">
                {saveError}
              </p>
            )}
            <m.button
              data-motion
              onClick={handleSave}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow tracking-wide font-display relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
              <span className="relative z-10">{t('meals.save')}</span>
            </m.button>
            <button
              onClick={() => setAddStep('input')}
              className="w-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 rounded-[1.25rem] py-3.5 text-[15px] font-bold font-display"
            >
              {t('common.cancel')}
            </button>
          </div>
        ) : addStep === 'notify_prompt' ? (
          <div className="space-y-2">
            <m.button
              data-motion
              onClick={handleAllowNotification}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="w-full bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold shadow-glow tracking-wide font-display relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
              <span className="relative z-10">{t('meals.notification_allow')}</span>
            </m.button>
            <button
              onClick={resetAdd}
              className="w-full text-sm font-medium text-gray-400 py-2 hover:text-gray-600 transition-colors"
            >
              {t('meals.notification_deny')}
            </button>
          </div>
        ) : undefined
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={addStep}
          variants={stepVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={stepTransition}
          className="space-y-3 pb-2"
        >
          {/* confirm ステップ */}
          {addStep === 'confirm' && draft && (
            <>
              <h2 className="text-base font-semibold text-gray-900">{t('meals.confirm_title')}</h2>
              <div className="bg-gray-50 rounded-xl px-3 py-2.5 text-sm text-gray-700">{description}</div>

              {matchResults.length > 0 ? (
                <div className="space-y-2">
                  {matchResults.map((m) => (
                    <div key={m.entry.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-semibold text-gray-800">{m.entry.nameJa}</p>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${fodmapColor[m.entry.fodmapLevel]}`}>
                          {t(`meals.fodmap_level.${m.entry.fodmapLevel}`)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">{t('meals.ibs_safety')}</span>
                        <span className={`text-xs font-medium ${safetyColor[m.entry.ibsSafety]}`}>
                          {t(`meals.safety.${m.entry.ibsSafety}`)}
                        </span>
                      </div>
                      {(lang === 'en' ? m.entry.noteEn : m.entry.noteJa) && (
                        <p className="text-xs text-gray-400">
                          {lang === 'en' ? m.entry.noteEn : m.entry.noteJa}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{draft.notes}</p>
                </div>
              )}

              {draft.aiEstimated && (
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Sparkles size={10} />{t('meals.ai_estimated')}
                </p>
              )}

              <div>
                <p className="text-xs text-gray-400 mb-2">{t('meals.nutrition_optional')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'calories', label: 'kcal',                     val: calories, set: setCalories },
                    { key: 'protein',  label: `${t('meals.protein')} (g)`, val: protein,  set: setProtein },
                    { key: 'fat',      label: `${t('meals.fat')} (g)`,     val: fat,      set: setFat },
                    { key: 'carbs',    label: `${t('meals.carbs')} (g)`,   val: carbs,    set: setCarbs },
                  ].map(({ key, label, val, set }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                      <input
                        type="number"
                        value={val}
                        onChange={e => set(e.target.value)}
                        placeholder="0"
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {hasApiKey && (
                <m.button
                  data-motion
                  onClick={handleAiAnalyze}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="w-full flex items-center justify-center gap-2 border border-emerald-300 text-emerald-700 rounded-xl py-2.5 text-sm font-medium bg-emerald-50"
                >
                  <Sparkles size={14} />{t('meals.ai_fill')}
                </m.button>
              )}
              {aiError && <p className="text-xs text-red-500 text-center">{aiError}</p>}
            </>
          )}

          {/* ai_analyzing ステップ */}
          {addStep === 'ai_analyzing' && (
            <div className="py-12 text-center space-y-3">
              <m.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full mx-auto"
              />
              <p className="text-sm text-gray-500">{t('meals.analyzing')}</p>
            </div>
          )}

          {/* notify_prompt ステップ */}
          {addStep === 'notify_prompt' && (
            <div className="py-6 text-center space-y-4">
              <p className="text-2xl">🔔</p>
              <p className="text-base font-semibold text-gray-800">{t('meals.notification_prompt')}</p>
            </div>
          )}
        </m.div>
      </AnimatePresence>
    </BottomSheet>
  )
}
