# Step 2 実装設計書 — FutoLab v1.1

**作成日**: 2026-03-15
**設計者**: Claude Opus (Architecture & Design)
**対象バージョン**: FutoLab v1.0 -> v1.1
**前提スタック**: React 19 / TypeScript / Tailwind CSS v4 / Zustand / Dexie.js / Claude API (BYOK) / motion v12 / vaul v1.1

---

## 0. Step 2 スコープ概要

Step 1（UI/UX改善 Phase 1-A〜E）の監査完了を受け、以下の方針で Step 2 のスコープを決定する。

### 優先度判断の原則

1. **技術的負債の解消は機能追加より先** — MealsPage 714行モノリスは、今後のすべての食事関連機能追加のボトルネックになる
2. **ユーザー体験の完成度** — 体重推移グラフはデータが溜まり始めるユーザーが最も求める機能
3. **バンドルサイズ最適化** — LazyMotion導入はコード量が少なく効果が高い
4. **AI相談の永続化** — ChatPageの会話がリロードで消える問題は信頼性に直結する
5. **HomePageダッシュボード改善** — 日常利用の入口として情報密度を適正化する

### スコープサマリー

```
Step 2-A: MealsPage コンポーネント分割 [Must]
Step 2-B: 体重推移グラフ（WeightPage） [Must]
Step 2-C: LazyMotion 導入（バンドルサイズ削減） [Must]
Step 2-D: AI相談 会話履歴永続化 [Should]
Step 2-E: HomePage ダッシュボード改善 [Should]
```

### スコープ外（Step 2 では実装しない）

| 機能 | 理由 |
|------|------|
| **個人FODMAPアダプテーションエンジン** | ARCHITECTURE Section 12 に詳細設計があるが、前提となる `PostMealSymptomLog`（食後症状詳細ログ）のUI/データ蓄積がまだない。現在の `gutFeedback`（3段階）だけでは学習エンジンの精度が不十分。Step 3 で `PostMealSymptomLog` UIを先に実装し、2-3週間のデータ蓄積後に Step 4 で学習エンジンを起動する |
| **バーコードスキャン** | `html5-qrcode` + OpenFoodFacts API の統合は独立した大型タスク。Step 2 の技術的負債解消とは独立して Step 3 以降で実装する |
| **筋トレ記録** | ARCHITECTURE Phase 2 に含まれるが、IBS増量管理のコア体験ではない。Step 4 以降に回す |
| **サプリメントDB** | 同上 |

---

## 1. Step 2-A: MealsPage コンポーネント分割 [Must]

### 1-1. 背景と目的

**問題**: `MealsPage.tsx` が 714行のモノリスで、以下の4つの責務が混在している。

1. 食事一覧表示（日付ナビゲーション + リスト）
2. 食事追加フロー（入力 -> FODMAP照合 -> AI分析 -> 確認 -> 保存 -> 通知）
3. 食事編集フロー（BottomSheet + 全フィールド編集 + 削除）
4. 腸フィードバック（GutFeedbackModal連携）

**リスク**: このまま Step 2-B 以降の機能を追加すると、バグ混入リスクが指数的に増加する。

### 1-2. 分割方針

**担当: Gemini（Frontend/UI）**

```
src/features/meals/
├── MealsPage.tsx            # 親コンポーネント（状態オーケストレーション）〜150行
├── components/
│   ├── MealDateNav.tsx      # 日付ナビゲーション 〜40行
│   ├── MealList.tsx         # 食事リスト表示 〜80行
│   ├── MealCard.tsx         # 個別食事カード 〜60行
│   ├── MealAddOverlay.tsx   # 食事追加フルスクリーンオーバーレイ（inputステップ）〜100行
│   ├── MealConfirmSheet.tsx # 食事確認・AI分析・通知BottomSheet 〜120行
│   └── MealEditSheet.tsx    # 食事編集BottomSheet 〜100行
└── hooks/
    └── useMealAddFlow.ts    # 追加フロー全体のカスタムフック 〜120行
```

### 1-3. 具体的な分割指針

#### MealsPage.tsx（親 / 〜150行）

```tsx
// 責務: 状態の統合と子コンポーネントの配置のみ
export default function MealsPage() {
  const { t } = useTranslation()
  const today = toDateStr()
  const [viewDate, setViewDate] = useState(today)
  const meals = useLiveQuery(...)

  // 追加フローの状態をカスタムフックに委譲
  const addFlow = useMealAddFlow(viewDate)
  // 編集フロー
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null)

  return (
    <AppShell title={...}>
      <MealDateNav viewDate={viewDate} setViewDate={setViewDate} today={today} />
      {viewDate === today && <AddButton onClick={addFlow.handleAddClick} />}
      <MealList meals={meals} onEdit={setEditingMeal} />
      {addFlow.showAdd && addFlow.step === 'input' && <MealAddOverlay {...addFlow} />}
      <MealConfirmSheet {...addFlow} />
      <MealEditSheet meal={editingMeal} onClose={() => setEditingMeal(null)} />
      <SuccessModal ... />
      {addFlow.pendingFeedbackMeal && <GutFeedbackModal ... />}
    </AppShell>
  )
}
```

#### useMealAddFlow.ts（カスタムフック / 〜120行）

```tsx
// 責務: 追加フローの全ステート管理 + ビジネスロジック
export function useMealAddFlow(viewDate: string) {
  const { profile } = useProfileStore()
  const [showAdd, setShowAdd] = useState(false)
  const [addStep, setAddStep] = useState<AddStep>('input')
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<MealDraft | null>(null)
  // ...他の状態

  const handleNext = () => { /* FODMAP照合ロジック */ }
  const handleAiAnalyze = async () => { /* AI分析 */ }
  const handleSave = async () => { /* 保存 + 通知 */ }
  const handleAddClick = async () => { /* gutFeedbackチェック */ }
  const resetAdd = () => { /* 全状態リセット */ }

  return {
    showAdd, addStep, mealType, description, draft,
    // ...setter群
    handleNext, handleAiAnalyze, handleSave, handleAddClick, resetAdd,
    // pendingFeedbackMeal
  }
}
```

#### MealCard.tsx（個別食事カード / 〜60行）

```tsx
// 現在の meals.map() 内のJSXブロックを抽出
interface MealCardProps {
  meal: Meal
  onEdit: (meal: Meal) => void
}

export function MealCard({ meal, onEdit }: MealCardProps) {
  // 既存のカードUI（日時 + タイプ + gutFeedback + 説明 + kcal + FODMAP + PFC）
}
```

### 1-4. 型定義の整理

`MealDraft`, `EditForm`, `AddStep`, `InputMode` の型定義を `src/features/meals/types.ts` に移動する。

```tsx
// src/features/meals/types.ts
import type { FODMAPLevel, IBSSafetyScore, MealType, GutFeedback } from '../../types/entities'

export type InputMode = 'text' | 'voice'
export type AddStep = 'input' | 'confirm' | 'ai_analyzing' | 'notify_prompt'

export interface MealDraft {
  fodmapLevel: FODMAPLevel
  ibsSafety: IBSSafetyScore
  calories: number; protein: number; fat: number; carbs: number
  notes: string; aiEstimated: boolean; matchedFoodNames?: string[]
}

export interface EditForm {
  mealType: MealType; description: string
  calories: string; protein: string; fat: string; carbs: string
  fodmapLevel: FODMAPLevel; ibsSafety: IBSSafetyScore
  gutFeedback: GutFeedback | ''; notes: string
}
```

### 1-5. 注意事項

- **見た目は一切変えない**: ピクセル単位で現在の表示と同じにする。リファクタリングのみ。
- **テストは手動**: 追加 -> FODMAP照合 -> AI分析 -> 保存 -> 通知 -> 編集 -> 削除の全フローを確認
- `createPortal` を使用しているフルスクリーンオーバーレイは `MealAddOverlay` に移動するが、portal のターゲット (`document.getElementById('root')!`) はそのまま維持
- 定数（`MEAL_TYPES`, `FODMAP_LEVELS`, `fodmapColor`, `safetyColor`, `gutEmoji`, `inputCls`, `stepVariants`）は `src/features/meals/constants.ts` に集約

### 1-6. Sonnet / Gemini の担当分離

| タスク | 担当 |
|--------|------|
| `useMealAddFlow.ts` カスタムフック作成 | **Sonnet**（ロジック層） |
| `types.ts`, `constants.ts` の分離 | **Sonnet** |
| 各UIコンポーネントの分割（JSX抽出） | **Gemini** |
| `MealsPage.tsx` の統合（子コンポーネント配置） | **Gemini** |

---

## 2. Step 2-B: 体重推移グラフ [Must]

### 2-1. 背景と目的

現在の `WeightPage.tsx`（190行）はリスト表示のみ。ARCHITECTURE S05 の設計では折れ線グラフ（実測値 + 7日移動平均 + 目標ライン）が含まれている。

体重を記録し始めたユーザーが「増えているか」を直感的に把握するため、グラフは必須。

### 2-2. 技術選定

**Recharts は不採用**。理由:
- バンドルサイズが大きい（gzip 〜45KB）
- IBS増量管理アプリに必要なのは単純な折れ線グラフのみ
- SVGを直接描画することで、デザインの完全制御 + バンドルサイズゼロを実現する

**方針: カスタム SVG コンポーネント**

### 2-3. コンポーネント設計

**担当: Gemini（UI）+ Sonnet（データ加工）**

#### 新規ファイル: `src/components/ui/WeightChart.tsx`（Gemini担当）

```tsx
interface WeightChartProps {
  data: ChartDataPoint[]
  targetWeightKg?: number
  periodDays: 30 | 90 | 180
}

interface ChartDataPoint {
  date: string         // 'YYYY-MM-DD'
  weightKg: number
  movingAvg7: number | null
  ibsStatus: IBSStatus
}

export function WeightChart({ data, targetWeightKg, periodDays }: WeightChartProps) {
  // SVG 描画
  // - 実測値: エメラルド線（太さ2px）+ ドット（ibsStatus === 'active' なら赤ドット）
  // - 7日移動平均: 半透明エメラルド線（太さ1.5px、破線）
  // - 目標ライン: グレー点線（横線）
  // - Y軸: 最小値-0.5kg 〜 最大値+0.5kg（動的スケール）
  // - X軸: 日付ラベル（5〜7個）
  // - タッチ対応: ドットをタップすると日付 + 体重のツールチップ表示
  // - glass-panel スタイルに調和するデザイン
}
```

#### デザイン仕様

```
┌─ 体重推移 ────────────────────────┐
│  [30日] [90日] [180日]            │
│                                    │
│  56.0 ─ ─ ─ ─ ─ ─ ─ 目標 ─ ─ ─  │
│        ●                           │
│  55.0     ●   ●                    │
│              ●   ●  ●             │
│  54.0  ─ ─ ─ ─ ─ ─ ● ●          │
│                         ●  🔴     │
│  53.0                      ●      │
│                                    │
│  3/1  3/5  3/10  3/15             │
│                                    │
│  今週平均: 54.8kg (+0.3)          │
│  目標到達予測: 4月中旬             │
└────────────────────────────────────┘
```

- `🔴` = IBS active 状態の日の体重ドット
- 期間切替ボタンは glass-panel + segment-control スタイル
- グラフ下部に統計サマリー（今週平均 / 前週比 / 目標到達予測）

#### 新規ファイル: `src/services/weight/WeightChartService.ts`（Sonnet担当）

```tsx
export interface ChartDataPoint {
  date: string
  weightKg: number
  movingAvg7: number | null
  ibsStatus: IBSStatus
}

export interface WeightStats {
  weeklyAvg: number | null
  weeklyChange: number | null     // 前週比
  monthlyAvg: number | null
  estimatedGoalDate: string | null // 目標到達予測日
}

/**
 * 指定期間の体重データを取得し、7日移動平均を計算する。
 */
export async function getWeightChartData(
  periodDays: 30 | 90 | 180
): Promise<ChartDataPoint[]> {
  const since = /* periodDays日前の日付 */
  const logs = await db.weightLogs
    .where('date').aboveOrEqual(since)
    .sortBy('date')

  return logs.map((log, i, arr) => ({
    date: log.date,
    weightKg: log.weightKg,
    movingAvg7: computeMovingAvg(arr, i, 7),
    ibsStatus: log.ibsStatus,
  }))
}

/**
 * 体重統計を計算する。
 * - 今週平均、前週比
 * - 目標到達予測（線形回帰で推定）
 */
export async function getWeightStats(
  targetWeightKg: number | undefined
): Promise<WeightStats> {
  // 直近14日のデータから計算
}

function computeMovingAvg(
  data: WeightLog[], index: number, window: number
): number | null {
  // index を中心に window 日分の平均を取る
  // データが window/2 未満なら null
}
```

### 2-4. WeightPage の更新（Gemini担当）

`WeightPage.tsx` の冒頭（追加ボタンの直後、リストの前）にグラフセクションを追加する。

```tsx
// WeightPage.tsx の return 内
<div className="p-4 space-y-3">
  {/* 追加ボタン（既存） */}
  <motion.button ... />

  {/* 新規: 体重推移グラフ */}
  {logs && logs.length >= 2 && (
    <WeightChartSection logs={logs} targetWeightKg={profile?.targetWeightKg} />
  )}

  {/* 既存: リスト */}
  {logs && logs.length > 0 ? (...) : (<EmptyState ... />)}
</div>
```

**表示条件**: 体重ログが 2件以上ある場合にのみグラフを表示する（1件では折れ線が引けない）。

### 2-5. Dexie スキーマ変更

**不要**。既存の `weightLogs` テーブル（`id, date, createdAt`）で十分。`date` インデックスで期間フィルタが可能。

### 2-6. Sonnet / Gemini の担当分離

| タスク | 担当 |
|--------|------|
| `WeightChartService.ts` 実装 | **Sonnet** |
| `ChartDataPoint` 型定義 | **Sonnet**（`src/types/entities.ts` に追加 or `src/services/weight/` に配置） |
| `WeightChart.tsx` SVGコンポーネント | **Gemini** |
| `WeightChartSection.tsx`（グラフ + 期間切替 + 統計サマリー） | **Gemini** |
| `WeightPage.tsx` 統合 | **Gemini** |

---

## 3. Step 2-C: LazyMotion 導入 [Must]

### 3-1. 背景と目的

**監査指摘**: motion v12 のフルバンドル（`motion/react` からの `import { motion }`）は 〜33KB (gzip) を含む。`LazyMotion` + `m` コンポーネントを使えば、必要な features のみを動的インポートし、初期ロードを 〜5KB に削減できる。

### 3-2. 実装方針

**担当: Sonnet（インフラ）**

#### 1. LazyMotion プロバイダーの設定

```tsx
// src/components/LazyMotionProvider.tsx
import { LazyMotion } from 'motion/react'

// 必要な features のみを動的インポート
const loadFeatures = () =>
  import('motion/react').then(mod => mod.domAnimation)

export function LazyMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      {children}
    </LazyMotion>
  )
}
```

#### 2. App.tsx で LazyMotionProvider をラップ

```tsx
// src/App.tsx
import { LazyMotionProvider } from './components/LazyMotionProvider'

function App() {
  return (
    <LazyMotionProvider>
      {/* 既存のRouter等 */}
    </LazyMotionProvider>
  )
}
```

#### 3. 全コンポーネントで `motion` -> `m` に置換

**担当: Gemini（UIファイルの修正）**

```tsx
// Before
import { motion } from 'motion/react'
<motion.button whileTap={{ scale: 0.97 }}>...</motion.button>

// After
import { m } from 'motion/react'
<m.button whileTap={{ scale: 0.97 }}>...</m.button>
```

**対象ファイル一覧**:
- `src/features/home/HomePage.tsx` — `motion.button` x1
- `src/features/meals/MealsPage.tsx` — `motion.button` x5, `motion.div` x3（分割後は各子コンポーネント）
- `src/features/weight/WeightPage.tsx` — `motion.button` x2, `motion.div` x1
- `src/features/chat/ChatPage.tsx` — なし（motion未使用）
- `src/features/onboarding/OnboardingPage.tsx` — 要確認
- `src/components/PageWrapper.tsx` — `AnimatePresence` + `motion.div`
- `src/components/ui/SuccessModal.tsx` — 要確認

**注意**: `AnimatePresence` は `LazyMotion` 配下でもそのまま使用可能。変更不要。

### 3-3. バンドルサイズ影響

| 変更前 | 変更後 | 削減量 |
|--------|--------|--------|
| 〜33KB (gzip) 初期ロード | 〜5KB (gzip) 初期ロード + 動的ロード | **〜28KB 初期ロード削減** |

### 3-4. リスク

- `strict` モードを有効にすると、`LazyMotion` 外で `motion` を使うと警告が出る。App.tsx 最上位でラップすることで問題なし
- `m` コンポーネントは `motion` と100%互換。API差異なし
- `domAnimation` は `whileTap`, `animate`, `initial`, `exit`, `transition` を含む。現在使用中のすべての機能をカバー

### 3-5. Sonnet / Gemini の担当分離

| タスク | 担当 |
|--------|------|
| `LazyMotionProvider.tsx` 作成 | **Sonnet** |
| `App.tsx` への統合 | **Sonnet** |
| 全 UI ファイルの `motion` -> `m` 置換 | **Gemini** |

---

## 4. Step 2-D: AI相談 会話履歴永続化 [Should]

### 4-1. 背景と目的

**問題**: 現在の `ChatPage.tsx` は会話履歴を React の `useState` で管理しており、ページ遷移やリロードですべて消える。

DBスキーマには `chatSessions` と `chatMessages` テーブルが既に定義されているが、未使用のまま。

### 4-2. 実装方針

**担当: Sonnet（データ層）+ Gemini（UI）**

#### 1. ChatService の新規作成（Sonnet担当）

```tsx
// src/services/chat/ChatService.ts

import { db } from '../../db/schema'
import { uuid, nowIso } from '../../utils/date'
import type { ChatSession, ChatMessage } from '../../types/entities'

/**
 * 新規セッションを作成する。
 * セッション = 1つの会話スレッド。
 */
export async function createSession(title?: string): Promise<ChatSession> {
  const session: ChatSession = {
    id: uuid(),
    title: title ?? '新しい相談',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }
  await db.chatSessions.add(session)
  return session
}

/**
 * セッションにメッセージを追加する。
 */
export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): Promise<ChatMessage> {
  const msg: ChatMessage = {
    id: uuid(),
    sessionId,
    role,
    content,
    timestamp: nowIso(),
  }
  await db.chatMessages.add(msg)
  // セッションの updatedAt を更新
  await db.chatSessions.update(sessionId, { updatedAt: nowIso() })
  return msg
}

/**
 * セッションのメッセージ一覧を取得する。
 */
export async function getMessages(sessionId: string): Promise<ChatMessage[]> {
  return db.chatMessages
    .where('sessionId').equals(sessionId)
    .sortBy('timestamp')
}

/**
 * 直近のセッション一覧を取得する。
 */
export async function getRecentSessions(limit = 20): Promise<ChatSession[]> {
  return db.chatSessions
    .orderBy('createdAt')
    .reverse()
    .limit(limit)
    .toArray()
}

/**
 * セッションを削除する（メッセージも含む）。
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.chatMessages.where('sessionId').equals(sessionId).delete()
  await db.chatSessions.delete(sessionId)
}

/**
 * セッションのタイトルを自動生成する。
 * 最初のユーザーメッセージの先頭20文字を使用。
 */
export function generateTitle(firstMessage: string): string {
  const trimmed = firstMessage.trim()
  return trimmed.length > 20 ? trimmed.slice(0, 20) + '...' : trimmed
}
```

#### 2. ChatPage の更新（Gemini担当）

**変更点**:

```tsx
// ChatPage.tsx の主要変更

export default function ChatPage() {
  // 既存の useState<Message[]>([]) を Dexie LiveQuery に置換
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  // セッション一覧
  const sessions = useLiveQuery(() => getRecentSessions(), [])
  // 現在のセッションのメッセージ
  const messages = useLiveQuery(
    () => currentSessionId ? getMessages(currentSessionId) : [],
    [currentSessionId]
  )

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || isStreaming || !profile?.claudeApiKey) return

    // セッションがなければ新規作成
    let sessionId = currentSessionId
    if (!sessionId) {
      const session = await createSession(generateTitle(content))
      sessionId = session.id
      setCurrentSessionId(sessionId)
    }

    // ユーザーメッセージを DB に保存
    await addMessage(sessionId, 'user', content)
    setInput('')
    setIsStreaming(true)

    // AI応答をストリーミングで受信し、完了後に DB に保存
    let fullResponse = ''
    const history = (messages ?? []).map(m => ({ role: m.role, content: m.content }))
    history.push({ role: 'user' as const, content })

    await sendMessage(history, profile, {
      onToken: (token) => { fullResponse += token; /* リアルタイム表示用 state 更新 */ },
      onDone: async () => {
        await addMessage(sessionId!, 'assistant', fullResponse)
        setIsStreaming(false)
      },
      onError: async (err) => {
        const errMsg = err.message === 'NO_API_KEY' ? 'APIキーが設定されていません' : 'エラーが発生しました'
        await addMessage(sessionId!, 'assistant', errMsg)
        setIsStreaming(false)
      },
    })
  }

  // 新しい相談ボタン
  const handleNewChat = () => {
    setCurrentSessionId(null)
  }
}
```

#### 3. 会話履歴一覧UI（Gemini担当）

ChatPage ヘッダーに「履歴」ボタンを追加し、BottomSheet で過去のセッション一覧を表示する。

```
┌─ AI相談 ────── [+新規] [履歴] ──┐
│                                    │
│  (メッセージエリア)                │
│                                    │
│  [入力欄]                   [送信] │
└────────────────────────────────────┘

┌─ 履歴（BottomSheet）──────────────┐
│  3/15 外食で何を食べるか相談した...  │
│  3/14 プロテインを選びたい...       │
│  3/13 今日の食事を記録したい...     │
│                                    │
│  [スワイプで削除]                   │
└────────────────────────────────────┘
```

### 4-3. ストリーミング中の表示

ストリーミング中のアシスタントメッセージは、DB保存完了前のため `useLiveQuery` には現れない。そのため、ストリーミング中のみ `streamingContent: string` を別 state で管理し、メッセージリストの末尾に仮表示する。`onDone` で DB 保存が完了すると、`useLiveQuery` が自動的に更新されるので、`streamingContent` をクリアする。

```tsx
const [streamingContent, setStreamingContent] = useState('')

// 表示用メッセージリスト
const displayMessages = [
  ...(messages ?? []),
  ...(isStreaming && streamingContent
    ? [{ id: 'streaming', role: 'assistant' as const, content: streamingContent, timestamp: '' }]
    : [])
]
```

### 4-4. Dexie スキーマ変更

**不要**。`chatSessions` テーブル（`id, createdAt`）と `chatMessages` テーブル（`id, sessionId, timestamp`）は既に v1 スキーマで定義済み。

### 4-5. i18n 追加キー

```json
{
  "chat": {
    "new_chat": "新しい相談",
    "history": "履歴",
    "delete_session": "この会話を削除",
    "delete_confirm": "削除しますか？",
    "no_history": "まだ相談履歴がありません"
  }
}
```

### 4-6. Sonnet / Gemini の担当分離

| タスク | 担当 |
|--------|------|
| `ChatService.ts` 作成 | **Sonnet** |
| `ChatPage.tsx` のロジック部分（handleSend の DB 統合） | **Sonnet**（ロジック案の提供）|
| `ChatPage.tsx` のUI変更（履歴ボタン、BottomSheet、セッション切替） | **Gemini** |
| i18n キー追加 | **Gemini** |

---

## 5. Step 2-E: HomePage ダッシュボード改善 [Should]

### 5-1. 背景と目的

現在の `HomePage.tsx`（216行）は機能的に十分だが、ARCHITECTURE S01 にある以下の要素が未実装:

1. **体重推移ミニグラフ**（7日分のスパークライン）
2. **目標到達予測**
3. **コンテキスト依存アラート**（カロリー不足時の具体的な食品提案は AI 依存のため、シンプルなメッセージに留める）

### 5-2. 実装方針

**担当: Gemini（UI）**

#### 追加要素1: 体重ミニグラフ

ヒーローカード内の体重表示エリアに、直近7日のスパークライン（SVG）を追加する。

```tsx
// WeightChart のミニ版（sparkline）
// 数値の隣に幅80px x 高さ30pxの小さなSVGを配置
<div className="flex items-center gap-2">
  <p className="text-2xl font-bold">{latestWeight.weightKg}<span>kg</span></p>
  <WeightSparkline data={last7DaysWeights} width={80} height={30} />
</div>
```

`WeightSparkline` は Step 2-B の `WeightChart` の簡易版。SVGのpath要素1本のみ。

#### 追加要素2: 週間カロリー達成率

ヒーローカードの下に、過去7日のカロリー達成状況をドットインジケーターで表示。

```
┌─ 週間カロリー達成 ──────────────────┐
│  月  火  水  木  金  土  日          │
│  ●   ●   ●   ○   ●   ○   ◐         │
│  達成率: 71%（5/7日）              │
└──────────────────────────────────────┘
```

- `●` = 90%以上達成（エメラルド）
- `◐` = 60-89%達成（アンバー）
- `○` = 60%未満（グレー）

#### 追加要素3: サービス層

```tsx
// src/services/home/HomeStatsService.ts（Sonnet担当）
export async function getWeeklyCalorieStats(): Promise<{
  days: Array<{ date: string; pct: number; status: 'achieved' | 'partial' | 'missed' }>
  achievementRate: number  // 0-100
}>

export async function getLast7DaysWeights(): Promise<Array<{
  date: string; weightKg: number
}>>
```

### 5-3. 注意事項

- HomePageは「一目で今日の状態が分かる」ことが最優先。情報過多にしない
- ミニグラフと週間カロリーは `logs.length >= 2` の場合のみ表示
- 初回利用時（データなし）は現在の表示のまま

### 5-4. Sonnet / Gemini の担当分離

| タスク | 担当 |
|--------|------|
| `HomeStatsService.ts` 作成 | **Sonnet** |
| `WeightSparkline.tsx` コンポーネント | **Gemini** |
| 週間カロリーインジケーター | **Gemini** |
| `HomePage.tsx` 統合 | **Gemini** |

---

## 6. 実装順序とタイムライン

```
Step 2-A: MealsPage分割  ←── 最優先（後続タスクの前提）
    ↓
Step 2-C: LazyMotion導入  ←── 2-Aと並行可能（インフラ変更）
    ↓
Step 2-B: 体重推移グラフ  ←── 新規コンポーネント追加
    ↓
Step 2-D: AI相談永続化    ←── 独立タスク
    ↓
Step 2-E: HomePage改善    ←── 2-Bのミニ版を流用
```

### 依存関係

```
2-A (MealsPage分割) → 直接の技術的依存はないが、コードベースの健全性のため最優先
2-B (体重グラフ) → 2-E (HomePageミニグラフ) が WeightSparkline を流用
2-C (LazyMotion) → 2-Aの分割後に適用すると diff が綺麗になる
2-D (チャット永続化) → 完全独立。いつでも着手可能
```

### 推奨実装フロー

```
Day 1:   Sonnet: useMealAddFlow.ts + types.ts + constants.ts を作成
         Sonnet: LazyMotionProvider.tsx を作成
Day 1:   Gemini: MealsPage の UI 分割（MealCard, MealDateNav, MealList）
Day 2:   Gemini: MealAddOverlay, MealConfirmSheet, MealEditSheet の分割
         Gemini: motion -> m の全ファイル置換
Day 2:   Sonnet: WeightChartService.ts を作成
Day 3:   Gemini: WeightChart.tsx SVG コンポーネント作成
         Gemini: WeightPage.tsx にグラフ統合
Day 3:   Sonnet: ChatService.ts を作成
Day 4:   Gemini: ChatPage.tsx の DB 統合 + 履歴 UI
Day 4:   Sonnet: HomeStatsService.ts を作成
Day 5:   Gemini: WeightSparkline + 週間カロリーインジケーター + HomePage統合
Day 5:   Opus: Step 2 全体監査
```

---

## 7. Dexie スキーマ変更サマリー

**Step 2 ではスキーマ変更不要。**

既存のスキーマ v2 で以下のテーブルがすべてカバーされている:
- `weightLogs` — 体重グラフ（Step 2-B）
- `chatSessions` + `chatMessages` — 会話永続化（Step 2-D）
- `dailyLogs` — 週間カロリー統計（Step 2-E）

---

## 8. リスクと注意事項

### 8-1. MealsPage 分割のリスク

| リスク | 対策 |
|--------|------|
| props drilling が深くなる | `useMealAddFlow` フックで状態を集約し、必要なプロパティのみを子に渡す。3階層以上のdrillは禁止 |
| 分割後のイベントフロー破壊 | 追加フロー全体（入力 -> FODMAP -> AI -> 確認 -> 保存 -> 通知 -> gutFeedback）を手動で完全テスト |
| createPortal の動作 | MealAddOverlay 内で portal を使用する際、React Tree 上の Context（i18n, ProfileStore）が正しくアクセスできることを確認 |

### 8-2. SVG体重グラフのリスク

| リスク | 対策 |
|--------|------|
| タッチ操作の精度 | ドットの当たり判定を半径 12px（実際の描画は 4px）に拡大して指でのタップを容易にする |
| データが少ない場合の表示 | 2件以上で表示、5件未満は点のみ（線は3件以上から） |
| 動的Y軸スケールのエッジケース | 全データが同じ体重の場合、Y軸範囲を強制的に +/-0.5kg にする |

### 8-3. チャット永続化のリスク

| リスク | 対策 |
|--------|------|
| ストリーミング中断時のデータ不整合 | `onDone` でのみ DB に保存。中断時は未保存のまま（ユーザーに「保存されませんでした」と表示） |
| IndexedDB の容量制限 | ChatMessage は 1年で最大数千件程度。容量問題は Phase 3 以降で検討 |
| セッション間のコンテキスト断絶 | 各セッションは独立。新規セッション開始時に今日のコンテキスト（カロリー、体重、食事）を自動注入するのは既存の `buildContext()` で対応済み |

### 8-4. LazyMotion のリスク

| リスク | 対策 |
|--------|------|
| 動的インポート遅延で初回アニメーションがカクつく | `LazyMotion` の `features` は `App.tsx` マウント時にロードされるため、ユーザーが操作を開始する頃には完了している。問題なし |
| `strict` モードの副作用 | `LazyMotion` 外の `motion` 使用をビルド時に検出可能。テスト時にコンソール警告を確認 |

---

## 9. Step 3 への布石

Step 2 完了後、Step 3 では以下を予定する（確定ではない）:

1. **PostMealSymptomLog UI** — 食後症状の詳細記録（4択 -> 詳細の2ステップ）。個人FODMAP適応エンジンのデータ源
2. **バーコードスキャン** — `html5-qrcode` + OpenFoodFacts API
3. **個人FODMAPアダプテーションエンジン（Stage 1/2）** — `PostMealSymptomLog` のデータが 2-3 週間蓄積した後に起動

Step 2-A の MealsPage 分割は、Step 3 の PostMealSymptomLog UI 統合を容易にするための前提作業でもある。

---

## 10. バージョニング

Step 2 完了後のリリース:
- **バージョン**: `v1.1.0-beta`
- **CHANGELOG エントリ**: 体重推移グラフ、AI相談履歴永続化、HomePage改善、バンドルサイズ最適化
- `MealsPage` リファクタリングは内部改善のため CHANGELOG には「コード品質改善」として簡潔に記載

---

*End of Step 2 Implementation Plan*
