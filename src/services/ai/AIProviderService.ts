import type { UserProfile } from '../../types/entities'

export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface AIResponse {
  content: string
  provider: string
  model: string
}

/**
 * プロバイダーに依存しない AI 呼び出し抽象レイヤー。
 * profile の aiProvider / apiKey 設定に基づいて適切なプロバイダーを選択する。
 */
export async function callAI(
  messages: AIMessage[],
  profile: UserProfile,
  options?: { maxTokens?: number; temperature?: number }
): Promise<AIResponse> {
  const provider = profile.aiProvider ?? 'claude'

  switch (provider) {
    case 'claude':
      return callClaude(messages, profile, options)
    case 'openai':
      return callOpenAI(messages, profile, options)
    case 'gemini':
      return callGemini(messages, profile, options)
    default:
      throw new Error(`Unknown AI provider: ${provider}`)
  }
}

// ─── Claude ──────────────────────────────────────────────────────────

async function callClaude(
  messages: AIMessage[],
  profile: UserProfile,
  options?: { maxTokens?: number; temperature?: number }
): Promise<AIResponse> {
  const apiKey = profile.claudeApiKey
  if (!apiKey) throw new Error('Claude API key is not set')

  const model = profile.aiModel ?? 'claude-sonnet-4-6'

  // system メッセージを分離
  const systemMsg = messages.find(m => m.role === 'system')
  const userMessages = messages.filter(m => m.role !== 'system')

  const body = {
    model,
    max_tokens: options?.maxTokens ?? 1024,
    system: systemMsg?.content,
    messages: userMessages.map(m => ({ role: m.role, content: m.content })),
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Claude API error ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`)
  }

  const data = await res.json() as any
  return {
    content: data.content?.[0]?.text ?? '',
    provider: 'claude',
    model,
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────

async function callOpenAI(
  messages: AIMessage[],
  profile: UserProfile,
  options?: { maxTokens?: number; temperature?: number }
): Promise<AIResponse> {
  const apiKey = profile.openaiApiKey
  if (!apiKey) throw new Error('OpenAI API key is not set')

  const model = profile.aiModel ?? 'gpt-4o-mini'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`OpenAI API error ${res.status}: ${(err as any)?.error?.message ?? res.statusText}`)
  }

  const data = await res.json() as any
  return {
    content: data.choices?.[0]?.message?.content ?? '',
    provider: 'openai',
    model,
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────

async function callGemini(
  messages: AIMessage[],
  profile: UserProfile,
  options?: { maxTokens?: number }
): Promise<AIResponse> {
  const apiKey = profile.geminiApiKey
  if (!apiKey) throw new Error('Gemini API key is not set')

  const model = profile.aiModel ?? 'gemini-2.0-flash'

  // system メッセージを分離し、user/assistant のみを contents に変換
  const systemMsg = messages.find(m => m.role === 'system')
  const rawContents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  // Gemini は contents が空だとエラーになるため、最低1件の user メッセージが必要
  if (rawContents.length === 0) {
    throw new Error('Gemini: at least one user message is required')
  }

  // 連続する同一ロールをマージ（Gemini は交互ロールを要求する）
  const contents: { role: string; parts: { text: string }[] }[] = []
  for (const turn of rawContents) {
    const prev = contents[contents.length - 1]
    if (prev && prev.role === turn.role) {
      prev.parts.push(...turn.parts)
    } else {
      contents.push({ ...turn })
    }
  }

  const body: any = {
    contents,
    generationConfig: { maxOutputTokens: options?.maxTokens ?? 1024 },
  }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    const detail = (errBody as any)?.error?.message ?? res.statusText
    throw new Error(`Gemini API error ${res.status}: ${detail}`)
  }

  const data = await res.json() as any
  const candidate = data.candidates?.[0]
  const finishReason: string = candidate?.finishReason ?? ''

  // SAFETY や MAX_TOKENS 以外で候補がない場合はエラーとして扱う
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason ?? 'unknown'
    throw new Error(`Gemini: no candidates returned (blockReason: ${blockReason})`)
  }

  const text: string = candidate?.content?.parts?.[0]?.text ?? ''

  if (!text && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
    throw new Error(`Gemini: empty response (finishReason: ${finishReason})`)
  }

  return {
    content: text,
    provider: 'gemini',
    model,
  }
}

/**
 * プロバイダーが設定済みで使用可能かチェック
 */
export function getAIStatus(profile: UserProfile | null): {
  available: boolean
  provider: string
  missingKey: boolean
} {
  if (!profile) return { available: false, provider: 'none', missingKey: true }

  const provider = profile.aiProvider ?? 'claude'
  const keyMap: Record<string, string | undefined> = {
    claude: profile.claudeApiKey,
    openai: profile.openaiApiKey,
    gemini: profile.geminiApiKey,
  }
  const key = keyMap[provider]
  return {
    available: !!key,
    provider,
    missingKey: !key,
  }
}
