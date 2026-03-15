# UI/UX Native-Feel Design Document v2

## 0. 現状スタック確認

| パッケージ | バージョン | 状態 |
|-----------|-----------|------|
| motion (Framer Motion v12) | ^12.36.0 | 導入済み |
| vaul (BottomSheet) | ^1.1.2 | 導入済み |
| lucide-react | ^0.577.0 | 導入済み |
| tailwindcss v4 | ^4.2.1 | 導入済み |
| zustand | ^5.0.11 | 導入済み |

既存アニメーション基盤:
- `AnimatePresence` + `PageWrapper` によるページ遷移アニメーション（`src/utils/motion.ts`）
- `useNavStore` による遷移方向管理
- `haptic()` ユーティリティ（`src/utils/haptics.ts`）
- `Button` コンポーネント（motion.button + whileTap）
- `BottomSheet` コンポーネント（vaul Drawer ベース）

---

## 1. 追加が必要なパッケージ

**追加パッケージは不要。** 既存スタックで全要件を賄える。

- アイコン: `lucide-react` で全て対応可能
- アニメーション: `motion/react` (v12) で AnimatePresence, motion.div, useSpring 等すべて利用可能
- BottomSheet: `vaul` で対応済み
- 状態管理: `zustand` で対応済み
- ハプティクス: `src/utils/haptics.ts` で対応済み

---

## 2. 画像アセット組み込み計画

### 配置済みファイル

| ファイル名 | 元ファイル | 用途 |
|-----------|-----------|------|
| `public/assets/logo-icon.png` | `Gemini_Generated_Image_fm0ckjfm0ckjfm0c.png` | メインアイコン（腹筋+胃腸のグラデーションアイコン） |
| `public/assets/empty-state.png` | `Gemini_Generated_Image_4hx7y4hx7y4hx7y4.png` | 空画面イラスト（空のボウル+カトラリー） |
| `public/assets/success.png` | `Gemini_Generated_Image_dlomxcdlomxcdlom.png` | 目標達成イラスト（プロテインシェイカー+星） |

### 表示方針

#### logo-icon.png (メインアイコン)
- **表示箇所**: AppShell ヘッダー左端（タイトル「FutoLab」の左隣）、HomePage のアプリ名表示
- **サイズ**: 28x28px（ヘッダー）、32x32px（ホーム画面）
- **CSS**: `mix-blend-mode: multiply` を適用し、背景色 `#FAFAF7` と自然に溶け込ませる
- **実装**: `<img src="/assets/logo-icon.png" alt="FutoLab" className="w-7 h-7 mix-blend-multiply" />`

#### empty-state.png (Empty State)
- **表示箇所**: 食事一覧が空のとき（MealsPage, HomePage の食事セクション）、体重ログが空のとき
- **サイズ**: 幅 160px、中央配置
- **CSS**: `mix-blend-mode: multiply` + `opacity-80` で柔らかく表示
- **実装**: EmptyState コンポーネント経由で使用（後述）

#### success.png (サクセスイラスト)
- **表示箇所**: カロリー目標達成時のモーダル、体重マイルストーン達成時
- **サイズ**: 幅 140px、中央配置
- **CSS**: `mix-blend-mode: multiply` は不要（3Dレンダリング風のため背景透過で使用）
- **アニメーション**: `motion.img` で `scale: [0.8, 1.05, 1]` + `opacity: [0, 1]` のバウンスイン

---

## 3. 変更が必要なコンポーネント仕様

### a) GutStatusButton (新規)

**目的**: 絵文字ベースのお腹の調子選択を、Lucide アイコン + アニメーションで置き換え

**ファイル**: `src/components/ui/GutStatusButton.tsx`

```typescript
import { motion } from 'motion/react'
import { Smile, Meh, Frown } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import type { GutFeedback } from '../../types/entities'

interface GutStatusButtonProps {
  value: GutFeedback | ''
  onChange: (value: GutFeedback) => void
  size?: 'sm' | 'md'
}
```

**アイコンマッピング**:
| GutFeedback | Lucide アイコン | カラー | アクティブ背景 |
|-------------|---------------|--------|-------------|
| `great` | `Smile` | `text-emerald-600` | `bg-emerald-50 ring-2 ring-emerald-400` |
| `ok` | `Meh` | `text-amber-500` | `bg-amber-50 ring-2 ring-amber-400` |
| `bad` | `Frown` | `text-red-500` | `bg-red-50 ring-2 ring-red-400` |

**アニメーション仕様**:
- タップ時: `whileTap={{ scale: 0.9 }}` + `haptic('light')`
- 選択時: `animate={{ scale: [1, 1.15, 1] }}` バウンスエフェクト（duration: 0.3）
- 遷移: `transition={{ type: 'spring', stiffness: 400, damping: 25 }}`

**レイアウト**:
- `size="md"`: `grid grid-cols-3 gap-3` で各ボタン `py-3 rounded-2xl`、アイコン size=28
- `size="sm"`: `grid grid-cols-3 gap-2` で各ボタン `py-2 rounded-xl`、アイコン size=20
- 各ボタン下にラベル表示: `text-[11px] font-medium mt-1`

**使用箇所の置き換え**:
- `HomePage.tsx` の `GUT_EMOJI` Record と対応する表示
- `MealsPage.tsx` の `gutEmoji` Record と編集フォーム内のグリッド
- `GutFeedbackModal.tsx` の絵文字ボタン

---

### b) EmptyState (新規)

**目的**: データがない画面の統一的な空状態表示

**ファイル**: `src/components/ui/EmptyState.tsx`

```typescript
import { motion } from 'motion/react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}
```

**レイアウト仕様**:
```
<motion.div
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.4, ease: 'easeOut' }}
  className="flex flex-col items-center justify-center py-16 px-6"
>
  <img
    src="/assets/empty-state.png"
    alt=""
    className="w-40 h-auto mb-5 mix-blend-multiply opacity-80"
  />
  <p className="text-base font-semibold text-gray-700 mb-1">{title}</p>
  {description && (
    <p className="text-sm text-gray-400 text-center max-w-[240px]">{description}</p>
  )}
  {action && (
    <Button variant="primary" size="sm" className="mt-4 w-auto px-6" onClick={action.onClick}>
      {action.label}
    </Button>
  )}
</motion.div>
```

**使用箇所**:
- `MealsPage.tsx`: 食事リストが空のとき（現在 `text-center py-16 text-gray-400 text-sm` のプレーンテキスト）
- `HomePage.tsx`: 食事セクションが空のとき（現在 `px-4 py-10 text-center`）
- `WeightPage.tsx`: 体重ログが空のとき

---

### c) SuccessModal (新規)

**目的**: カロリー目標達成・体重マイルストーン達成時のお祝いモーダル

**ファイル**: `src/components/ui/SuccessModal.tsx`

```typescript
import { AnimatePresence, motion } from 'motion/react'
import { haptic } from '../../utils/haptics'

interface SuccessModalProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
}
```

**アニメーション仕様**:
- オーバーレイ: `fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm`
  - `initial={{ opacity: 0 }}` → `animate={{ opacity: 1 }}` → `exit={{ opacity: 0 }}`
- モーダルカード: `bg-white rounded-3xl p-6 mx-6 shadow-2xl`
  - `initial={{ scale: 0.8, opacity: 0, y: 40 }}` → `animate={{ scale: 1, opacity: 1, y: 0 }}`
  - `transition={{ type: 'spring', stiffness: 300, damping: 25 }}`
- 画像: `motion.img`
  - `initial={{ scale: 0.5, opacity: 0 }}` → `animate={{ scale: 1, opacity: 1 }}`
  - `transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}`
- 表示時: `haptic('success')` を実行

**レイアウト**:
```
<div className="flex flex-col items-center text-center">
  <motion.img src="/assets/success.png" className="w-36 h-auto mb-4" ... />
  <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
  <p className="text-sm text-gray-500 mb-5">{message}</p>
  <Button variant="primary" size="md" onClick={onClose} className="w-full">OK</Button>
</div>
```

**トリガー条件**:
- 1日のカロリー摂取が目標の100%に到達したとき（`HomePage` or `MealsPage` の `handleSave` 後に判定）
- 体重が目標体重に到達したとき（`WeightPage` の体重記録後に判定）

---

### d) AppShell (更新)

**ファイル**: `src/components/layout/AppShell.tsx`

**変更内容**: ヘッダー左端にロゴ画像を追加

**現在のヘッダー**:
```tsx
<h1 className="text-base font-semibold text-gray-800 tracking-tight">{title}</h1>
```

**変更後のヘッダー**:
```tsx
<div className="flex items-center gap-2">
  <img
    src="/assets/logo-icon.png"
    alt="FutoLab"
    className="w-7 h-7 rounded-lg mix-blend-multiply"
  />
  <h1 className="text-base font-semibold text-gray-800 tracking-tight">{title}</h1>
</div>
```

**注意点**:
- `mix-blend-multiply` により `#FAFAF7` 背景と自然に融合する
- `rounded-lg` でアイコンの角を微丸にする
- rightAction の配置は変更なし

---

### e) BottomNav (更新)

**ファイル**: `src/components/layout/BottomNav.tsx`

**変更内容**: glassmorphism 強化 + safe area 対応の確認・改善

**現在のスタイル**:
```
bg-[#FAFAF7]/80 backdrop-blur-xl
border-t border-white/60
shadow-[0_-1px_0_rgba(0,0,0,0.04)]
```

**変更後のスタイル**:
```
bg-white/70 backdrop-blur-2xl backdrop-saturate-150
border-t border-white/30
shadow-[0_-2px_20px_rgba(0,0,0,0.06)]
```

**変更理由**:
- `backdrop-blur-xl` → `backdrop-blur-2xl`: よりiOS風の深いブラー
- `backdrop-saturate-150` 追加: 背景の彩度を上げ、iOS UIの「すりガラス」効果に近づける
- `bg-[#FAFAF7]/80` → `bg-white/70`: 白ベースにして透明感を強調
- シャドウを `0_-2px_20px` に変更: より浮遊感のある影

**safe area 確認**: 現在 `<div className="h-[env(safe-area-inset-bottom)]" />` で対応済み。問題なし。

**アクティブタブのアニメーション強化**:
- 現在のインジケーター: `h-[2.5px]` の静的バー
- 追加: `motion.span` に変更し `layoutId="nav-indicator"` で自動スライドアニメーション
```tsx
{active && (
  <motion.span
    layoutId="nav-indicator"
    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-6 rounded-full bg-emerald-500"
    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
  />
)}
```

---

## 4. 実装優先順位とフェーズ分け

### Phase 1 (すぐやる) - ネイティブ感の基盤

| # | タスク | 対象ファイル | 工数目安 |
|---|--------|-------------|---------|
| 1-1 | AppShell にロゴ画像追加 | `AppShell.tsx` | 5分 |
| 1-2 | BottomNav の glassmorphism 強化 + layoutId アニメーション | `BottomNav.tsx` | 15分 |
| 1-3 | GutStatusButton 新規作成 | `GutStatusButton.tsx` | 30分 |
| 1-4 | GutStatusButton を既存コンポーネントに組み込み | `HomePage.tsx`, `MealsPage.tsx`, `GutFeedbackModal.tsx` | 20分 |
| 1-5 | EmptyState 新規作成 | `EmptyState.tsx` | 15分 |
| 1-6 | EmptyState を既存画面に組み込み | `HomePage.tsx`, `MealsPage.tsx`, `WeightPage.tsx` | 15分 |

### Phase 2 (後でやる) - 達成感・エンゲージメント

| # | タスク | 対象ファイル | 工数目安 |
|---|--------|-------------|---------|
| 2-1 | SuccessModal 新規作成 | `SuccessModal.tsx` | 20分 |
| 2-2 | カロリー目標達成判定ロジック + SuccessModal トリガー | `MealsPage.tsx`, `HomePage.tsx` | 30分 |
| 2-3 | 体重マイルストーン達成判定 + SuccessModal トリガー | `WeightPage.tsx` | 20分 |
| 2-4 | HomePage ヒーローカードのマイクロインタラクション追加 | `HomePage.tsx` | 20分 |
| 2-5 | 全画面のスクロール連動アニメーション微調整 | 各ページ | 30分 |

---

## 5. 各コンポーネントの具体的なコード仕様

### 5-1. GutStatusButton

```typescript
// src/components/ui/GutStatusButton.tsx
import { motion } from 'motion/react'
import { Smile, Meh, Frown, type LucideIcon } from 'lucide-react'
import { haptic } from '../../utils/haptics'
import { useTranslation } from 'react-i18next'
import type { GutFeedback } from '../../types/entities'

interface GutStatusButtonProps {
  value: GutFeedback | ''
  onChange: (value: GutFeedback) => void
  size?: 'sm' | 'md'
}

const OPTIONS: {
  key: GutFeedback
  icon: LucideIcon
  activeColor: string
  activeBg: string
  labelKey: string
}[] = [
  {
    key: 'great',
    icon: Smile,
    activeColor: 'text-emerald-600',
    activeBg: 'bg-emerald-50 ring-2 ring-emerald-400',
    labelKey: 'gut.great',
  },
  {
    key: 'ok',
    icon: Meh,
    activeColor: 'text-amber-500',
    activeBg: 'bg-amber-50 ring-2 ring-amber-400',
    labelKey: 'gut.ok',
  },
  {
    key: 'bad',
    icon: Frown,
    activeColor: 'text-red-500',
    activeBg: 'bg-red-50 ring-2 ring-red-400',
    labelKey: 'gut.bad',
  },
]

export function GutStatusButton({ value, onChange, size = 'md' }: GutStatusButtonProps) {
  const { t } = useTranslation()
  const iconSize = size === 'md' ? 28 : 20
  const gridClass = size === 'md' ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-3 gap-2'
  const btnClass = size === 'md' ? 'py-3 rounded-2xl' : 'py-2 rounded-xl'

  return (
    <div className={gridClass}>
      {OPTIONS.map(({ key, icon: Icon, activeColor, activeBg, labelKey }) => {
        const isActive = value === key
        return (
          <motion.button
            key={key}
            type="button"
            whileTap={{ scale: 0.9 }}
            animate={isActive ? { scale: [1, 1.15, 1] } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            onClick={() => {
              haptic('light')
              onChange(key)
            }}
            className={`flex flex-col items-center justify-center ${btnClass} transition-colors ${
              isActive ? `${activeBg} ${activeColor}` : 'bg-gray-100 text-gray-400'
            }`}
          >
            <Icon size={iconSize} strokeWidth={isActive ? 2.2 : 1.6} />
            <span className="text-[11px] font-medium mt-1">{t(labelKey)}</span>
          </motion.button>
        )
      })}
    </div>
  )
}
```

**i18n キー追加** (`src/i18n/ja.json`, `src/i18n/en.json`):
```json
{
  "gut": {
    "great": "好調",
    "ok": "普通",
    "bad": "不調"
  }
}
```
```json
{
  "gut": {
    "great": "Great",
    "ok": "OK",
    "bad": "Bad"
  }
}
```

---

### 5-2. EmptyState

```typescript
// src/components/ui/EmptyState.tsx
import { motion } from 'motion/react'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center py-16 px-6"
    >
      <img
        src="/assets/empty-state.png"
        alt=""
        className="w-40 h-auto mb-5 mix-blend-multiply opacity-80"
      />
      <p className="text-base font-semibold text-gray-700 mb-1">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 text-center max-w-[240px]">{description}</p>
      )}
      {action && (
        <Button variant="primary" size="sm" className="mt-4 w-auto px-6" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </motion.div>
  )
}
```

---

### 5-3. SuccessModal

```typescript
// src/components/ui/SuccessModal.tsx
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from './Button'
import { haptic } from '../../utils/haptics'

interface SuccessModalProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
}

export function SuccessModal({ open, onClose, title, message }: SuccessModalProps) {
  useEffect(() => {
    if (open) haptic('success')
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="bg-white rounded-3xl p-6 mx-6 shadow-2xl max-w-[320px] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <motion.img
                src="/assets/success.png"
                alt=""
                className="w-36 h-auto mb-4"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}
              />
              <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-500 mb-5">{message}</p>
              <Button variant="primary" size="md" onClick={onClose} className="w-full">
                OK
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

### 5-4. AppShell ヘッダー更新

```diff
// src/components/layout/AppShell.tsx
- <h1 className="text-base font-semibold text-gray-800 tracking-tight">{title}</h1>
+ <div className="flex items-center gap-2">
+   <img
+     src="/assets/logo-icon.png"
+     alt="FutoLab"
+     className="w-7 h-7 rounded-lg mix-blend-multiply"
+   />
+   <h1 className="text-base font-semibold text-gray-800 tracking-tight">{title}</h1>
+ </div>
```

---

### 5-5. BottomNav glassmorphism + layoutId

```diff
// src/components/layout/BottomNav.tsx

// nav 要素のクラス変更:
- bg-[#FAFAF7]/80 backdrop-blur-xl
- border-t border-white/60
- shadow-[0_-1px_0_rgba(0,0,0,0.04)]
+ bg-white/70 backdrop-blur-2xl backdrop-saturate-150
+ border-t border-white/30
+ shadow-[0_-2px_20px_rgba(0,0,0,0.06)]

// アクティブインジケーターの変更:
// import { motion } from 'motion/react' を追加

- <span
-   className={`absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] rounded-full bg-emerald-500 transition-all duration-300 ease-out ${
-     active ? 'w-6 opacity-100' : 'w-0 opacity-0'
-   }`}
- />
+ {active && (
+   <motion.span
+     layoutId="nav-indicator"
+     className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-6 rounded-full bg-emerald-500"
+     transition={{ type: 'spring', stiffness: 400, damping: 30 }}
+   />
+ )}
```

---

## 付録: mix-blend-mode: multiply の効果説明

`mix-blend-mode: multiply` は画像の白い背景部分を透明に見せる効果がある。
アプリの背景色 `#FAFAF7`（ほぼ白のウォームグレー）の上に配置する場合、
画像の白背景が完全に溶け込み、イラスト部分のみが浮かび上がる。

- `logo-icon.png`: グラデーション背景があるため multiply が効果的。アイコンが背景に自然に馴染む。
- `empty-state.png`: 白背景のイラストのため multiply + `opacity-80` で柔らかく溶け込む。
- `success.png`: 3D レンダリング風で既に透過背景に近い表現。multiply は不要（むしろ色が暗くなるリスクがある）。そのまま表示する。
