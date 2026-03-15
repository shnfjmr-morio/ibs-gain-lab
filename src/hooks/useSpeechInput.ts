import { useState, useRef, useCallback, useEffect } from 'react'

// ─── 型定義 ────────────────────────────────────────────────────────────────

export type SpeechErrorType = 'not-allowed' | 'no-speech' | 'network' | 'aborted' | 'unknown'

export interface SpeechRecognitionError {
  type: SpeechErrorType
  message: string
}

export interface UseSpeechInputOptions {
  lang: 'ja' | 'en'
  /** 中間結果を有効にするか（iOS Safariでは遅いためデフォルトoff） */
  interimResults?: boolean
  /** 最終認識結果のコールバック */
  onResult: (transcript: string) => void
  /** 中間結果のコールバック（interimResults=true時のみ呼ばれる） */
  onInterim?: (transcript: string) => void
  /** エラー時コールバック */
  onError?: (error: SpeechRecognitionError) => void
}

export interface UseSpeechInputReturn {
  /** Web Speech APIがこの環境で利用可能か */
  isSupported: boolean
  /** PWAスタンドアロンモードで動作しているか（iOS PWAでは音声API非対応） */
  isPWAStandalone: boolean
  /** 現在リスニング中か */
  isListening: boolean
  /** 中間認識テキスト（interimResults有効時） */
  interimText: string
  /** 認識を開始（トグル: 既にリスニング中なら何もしない） */
  start: () => void
  /** 認識を停止 */
  stop: () => void
  /** 最後に発生したエラー */
  error: SpeechRecognitionError | null
}

// ─── 定数 ──────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 10_000

const ERROR_TYPE_MAP: Record<string, SpeechErrorType> = {
  'not-allowed': 'not-allowed',
  'no-speech':   'no-speech',
  'network':     'network',
  'aborted':     'aborted',
}

// ─── 環境検出 ──────────────────────────────────────────────────────────────

function detectPWAStandalone(): boolean {
  // iOS Safari のスタンドアロンモード（ホーム画面追加後）の検出
  // standalone モードでは webkitSpeechRecognition が動作しない
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

function detectSpeechAPI(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useSpeechInput(options: UseSpeechInputOptions): UseSpeechInputReturn {
  const { lang, interimResults = false, onResult, onInterim, onError } = options

  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [error, setError]             = useState<SpeechRecognitionError | null>(null)

  const recogRef   = useRef<any>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // レンダリングをまたいでも最新のコールバックを参照するためRefで保持
  const onResultRef  = useRef(onResult)
  const onInterimRef = useRef(onInterim)
  const onErrorRef   = useRef(onError)
  useEffect(() => { onResultRef.current  = onResult  }, [onResult])
  useEffect(() => { onInterimRef.current = onInterim }, [onInterim])
  useEffect(() => { onErrorRef.current   = onError   }, [onError])

  const isPWAStandalone = detectPWAStandalone()
  const isSupported     = !isPWAStandalone && detectSpeechAPI()

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const stop = useCallback(() => {
    clearTimer()
    recogRef.current?.stop()
    recogRef.current = null
    setIsListening(false)
    setInterimText('')
  }, [])

  const start = useCallback(() => {
    if (!isSupported || isListening) return

    setError(null)
    setInterimText('')

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    const recog = new SR()
    recog.lang            = lang === 'en' ? 'en-US' : 'ja-JP'
    recog.continuous      = false   // iOS Safariでは continuous=true が不安定
    recog.interimResults  = interimResults

    recog.onresult = (e: any) => {
      clearTimer()
      let final   = ''
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          final += t
        } else {
          interim += t
        }
      }
      if (interim) {
        setInterimText(interim)
        onInterimRef.current?.(interim)
      }
      if (final) {
        setInterimText('')
        onResultRef.current(final)
        setIsListening(false)
        recogRef.current = null
      }
    }

    recog.onerror = (e: any) => {
      clearTimer()
      // 'aborted' は手動stopによる正常終了なのでエラー扱いしない
      if (e.error === 'aborted') {
        setIsListening(false)
        setInterimText('')
        return
      }
      const err: SpeechRecognitionError = {
        type:    ERROR_TYPE_MAP[e.error] ?? 'unknown',
        message: e.message ?? e.error ?? 'Unknown speech recognition error',
      }
      setError(err)
      onErrorRef.current?.(err)
      setIsListening(false)
      setInterimText('')
      recogRef.current = null
    }

    recog.onend = () => {
      clearTimer()
      setIsListening(false)
      setInterimText('')
      recogRef.current = null
    }

    recogRef.current = recog
    recog.start()
    setIsListening(true)

    // 10秒無音で自動停止
    timeoutRef.current = setTimeout(() => {
      recogRef.current?.stop()
    }, TIMEOUT_MS)
  }, [isSupported, isListening, lang, interimResults])

  // アンマウント時のクリーンアップ
  useEffect(() => {
    return () => {
      clearTimer()
      recogRef.current?.abort()
      recogRef.current = null
    }
  }, [])

  return { isSupported, isPWAStandalone, isListening, interimText, start, stop, error }
}
