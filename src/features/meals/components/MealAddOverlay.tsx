import { createPortal } from 'react-dom'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Mic, MicOff, ChevronRight } from 'lucide-react'
import { MEAL_TYPES } from '../constants'
import type { MealAddFlowReturn } from '../hooks/useMealAddFlow'

type MealAddOverlayProps = Pick<
  MealAddFlowReturn,
  | 'mealType'
  | 'setMealType'
  | 'inputMode'
  | 'setInputMode'
  | 'description'
  | 'setDescription'
  | 'voiceSupported'
  | 'isListening'
  | 'startListening'
  | 'stopListening'
  | 'handleNext'
  | 'resetAdd'
>

export function MealAddOverlay({
  mealType,
  setMealType,
  inputMode,
  setInputMode,
  description,
  setDescription,
  voiceSupported,
  isListening,
  startListening,
  stopListening,
  handleNext,
  resetAdd,
}: MealAddOverlayProps) {
  const { t } = useTranslation()

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-slate-50 flex flex-col overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Subtle background glow */}
      <div className="absolute top-[-5%] right-[-5%] w-72 h-72 bg-emerald-400/10 blur-[80px] rounded-full pointer-events-none" />

      {/* ヘッダー */}
      <div className="relative z-10 flex items-center justify-between px-5 py-4 border-b border-black/[0.04] bg-white/50 backdrop-blur-md">
        <h2 className="text-lg font-bold font-display text-gray-900 tracking-tight">
          {t('meals.add')}
        </h2>
        <button onClick={resetAdd} className="text-sm text-gray-400 px-2 py-1">
          {t('common.cancel')}
        </button>
      </div>

      {/* スクロール可能コンテンツ */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 食事タイプ選択 */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {MEAL_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                mealType === type ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {t(`meals.type.${type}`)}
            </button>
          ))}
        </div>

        {/* テキスト / 音声 切替 */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['text', 'voice'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setInputMode(mode)}
              disabled={mode === 'voice' && !voiceSupported}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                inputMode === mode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              {t(`meals.${mode}_input`)}
            </button>
          ))}
        </div>

        {/* テキスト入力 */}
        {inputMode === 'text' && (
          <div className="relative">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('meals.text_placeholder')}
              rows={4}
              className="w-full border border-black/[0.04] rounded-3xl px-5 py-4 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 bg-white/80 shadow-inner transition-shadow leading-relaxed"
            />
          </div>
        )}

        {/* 音声入力 */}
        {inputMode === 'voice' && (
          <div className="text-center space-y-3">
            <m.button
              onPointerDown={startListening}
              onPointerUp={stopListening}
              animate={isListening ? { scale: 1.1 } : { scale: 1 }}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg ${
                isListening ? 'bg-red-500' : 'bg-emerald-600'
              }`}
            >
              {isListening
                ? <MicOff size={32} className="text-white" />
                : <Mic size={32} className="text-white" />
              }
            </m.button>
            <p className="text-sm text-gray-400">
              {isListening ? t('meals.voice_listening') : t('meals.voice_prompt')}
            </p>
            {description && (
              <div className="bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-700 text-left">
                {description}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 固定フッター */}
      <div className="relative z-10 px-5 py-4 border-t border-black/[0.04] bg-white/50 backdrop-blur-md">
        <m.button
          data-motion
          onClick={handleNext}
          disabled={!description.trim()}
          whileTap={description.trim() ? { scale: 0.97 } : undefined}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="w-full flex items-center justify-center gap-2 bg-gradient-primary text-white rounded-[1.25rem] py-4 font-bold disabled:opacity-40 disabled:grayscale-[0.5] shadow-glow relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 pointer-events-none" />
          <span className="relative z-10 font-display tracking-wide">{t('meals.next')}</span>
          <ChevronRight size={18} className="relative z-10" />
        </m.button>
      </div>
    </div>,
    document.getElementById('root')!
  )
}
