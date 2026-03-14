# UI/UX 大幅改善プロジェクト — Implementation Plan (Audited v2)

**作成日**: 2026-03-14
**監査日**: 2026-03-14
**対象バージョン**: FutoLab v0.x -> v1.0 (Phase 1 UI/UX リフト)
**前提スタック**: React 19 / Tailwind CSS v4 / Vite 8 / PWA

---

## 0. 作業フロー概要

```
Phase 1-A: パッケージ導入 + 共通インフラ整備
Phase 1-B: BottomSheet 化（vaul）
Phase 1-C: ページ遷移アニメーション（motion）
Phase 1-D: マイクロインタラクション統一
Phase 1-E: Glassmorphism + SafeArea 対応
Phase 1-F: Haptics ユーティリティ
```

各フェーズは独立して適用可能。失敗時のロールバック範囲が明確になるよう、1ファイルずつ変更する。

---

## 1. 導入パッケージ

### 1-1. インストールコマンド

```bash
npm install motion vaul clsx tailwind-merge
```

> **重要: `framer-motion` ではなく `motion` を使用する。**
> framer-motion v11 は React 19 との互換性に既知の問題がある（型エラー、内部 ref ハンドリングの不整合）。
> framer-motion は Motion (motion.dev) にリブランドされ、`motion` パッケージ v12+ が React 19 を正式サポートしている。
> インポートパスは `"motion/react"` を使用する。

| パッケージ | バージョン目安 | 用途 |
|---|---|---|
| `motion` | ^12 | ページ遷移・リスト・タップエフェクト（React 19 対応） |
| `vaul` | ^1.1 | ネイティブ感のあるドラッグ可能BottomSheet |
| `clsx` | ^2 | 条件付きクラス名結合 |
| `tailwind-merge` | ^2 | Tailwindクラスの衝突解決 |

### 1-2. 既存ライブラリとの共存

- `lucide-react` は既インストール済み -> そのまま流用
- `react-router-dom v7` の `<Routes>` は `motion` の `AnimatePresence` でラップする（既存の `key={location.pathname}` 手法を拡張）
- 現在の `pageSlideUp / slideFromRight / slideFromLeft` CSS keyframes は **motion 移行後に削除**。移行期間中は共存させる
- `document.documentElement.dataset.swipeDir` による方向管理は `useNavStore` に置き換える

---

## 2. 共通インフラ整備

### 2-1. `cn()` ユーティリティ

**新規作成**: `src/utils/cn.ts`

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

全コンポーネントの `className` 結合をこの関数で統一する。
現状のテンプレートリテラル `${condition ? '...' : '...'}` パターンは段階的に置き換える。

### 2-2. Haptics ユーティリティ

**新規作成**: `src/utils/haptics.ts`

```ts
// navigator.vibrate は Android のみ対応（iOS は Web Haptics API 未対応）
// iOS は将来 Web Haptics API が来たときのために抽象化しておく

type HapticStyle = 'light' | 'medium' | 'success' | 'error'

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light:   10,
  medium:  25,
  success: [20, 40, 20],
  error:   [30, 20, 30, 20, 30],
}

export function haptic(style: HapticStyle = 'light') {
  try {
    if (typeof navigator === 'undefined' || !navigator.vibrate) return
    navigator.vibrate(PATTERNS[style])
  } catch {
    // Silently ignore — some browsers throw on vibrate()
  }
}
```

**使用箇所**:
| アクション | スタイル |
|---|---|
| ボタンタップ（一般） | `light` |
| 食事・体重の保存完了 | `success` |
| スワイプでタブ切替 | `light` |
| バリデーションエラー | `error` |
| 削除確認 | `medium` |

### 2-3. モーション設定定数

**新規作成**: `src/utils/motion.ts`

```ts
import type { Variants, Transition } from 'motion/react'

// ページ遷移の基本設定
// spring を使用し、duration ベースの tween より自然な減速感を出す
export const PAGE_TRANSITION: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
}

// タブ切替方向別バリアント
// custom 経由で direction を受け取る形式にする（AnimatePresence の custom prop と連動）
export const pageVariants: Variants = {
  initial: (direction: number) => ({
    x: direction > 0 ? '30%' : '-30%',
    opacity: 0,
  }),
  animate: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? '-30%' : '30%',
    opacity: 0,
  }),
}

// リストアイテムのスタガー
export const listItemVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
}

export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.06 } },
}
```

**旧設計からの修正点:**
1. `pageVariants` を関数ではなく `Variants` オブジェクトに変更し、`custom` prop 経由で `direction` を受け取る形にした。これが `AnimatePresence` の `custom` prop と正しく連動する正規の方法。旧設計の `pageVariants(direction)` は呼び出し時点の direction をクロージャでキャプチャするため、exit アニメーション時に古い direction が使われるバグがあった。
2. `PAGE_TRANSITION` を `tween` から `spring` に変更。iOS のネイティブ遷移に近い自然な動きになる。
3. `overlayVariants` を削除（vaul が内部でオーバーレイアニメーションを管理するため不要）。
4. `tapScale` 定数を削除（Button コンポーネントに直接組み込むため）。

---

## 3. ページ遷移アニメーション (motion)

### 3-1. 現状の問題点

現在は `document.documentElement.dataset.swipeDir` -> CSS クラス切替という手法。
- タブバーの index 差で方向を判定しているが、ブラウザバック時の方向が未対応
- CSS アニメーションには exit アニメーションがなく、入退場が重なると崩れる
- DOM data attribute はレンダリングサイクルと同期しないため、React の状態管理と一貫性がない

### 3-2. 新アーキテクチャ

**変更ファイル**: `src/App.tsx`, `src/components/layout/AppShell.tsx`, `src/hooks/useSwipeNav.ts`

#### `src/stores/useNavStore.ts`（新規）

```ts
import { create } from 'zustand'

const TAB_ORDER = ['/', '/meals', '/chat', '/weight', '/settings'] as const

interface NavStore {
  direction: number  // -1: 左へ(前のタブへ), 1: 右へ(次のタブへ)
  isAnimating: boolean // 遷移アニメーション中フラグ（連打防止）
  setDirection: (d: number) => void
  setIsAnimating: (v: boolean) => void
  computeDirection: (from: string, to: string) => number
}

export const useNavStore = create<NavStore>((set) => ({
  direction: 1,
  isAnimating: false,
  setDirection: (d) => set({ direction: d }),
  setIsAnimating: (v) => set({ isAnimating: v }),
  computeDirection: (from: string, to: string) => {
    const fromIdx = TAB_ORDER.indexOf(from as typeof TAB_ORDER[number])
    const toIdx = TAB_ORDER.indexOf(to as typeof TAB_ORDER[number])
    // タブ順にないパス（ディープリンク等）はデフォルト右方向
    if (fromIdx === -1 || toIdx === -1) return 1
    return toIdx > fromIdx ? 1 : -1
  },
}))

export { TAB_ORDER }
```

**旧設計からの修正点:**
1. `isAnimating` フラグを追加。遷移中のタブクリック/スワイプを抑制する。
2. `computeDirection` メソッドを追加。ブラウザバック・ディープリンク時にも正しい方向を算出できる。
3. `TAB_ORDER` をストアからエクスポートし、複数箇所でのハードコーディングを防ぐ。

#### ブラウザバック・ディープリンク対応

`popstate` イベントを監視し、direction を自動算出する:

```tsx
// src/hooks/useDirectionSync.ts（新規）
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useNavStore } from '../stores/useNavStore'

/**
 * location 変更時に direction が未セットの場合（ブラウザバック、ディープリンク）、
 * TAB_ORDER から方向を自動算出する。
 */
export function useDirectionSync() {
  const location = useLocation()
  const prevPathRef = useRef(location.pathname)
  const computeDirection = useNavStore((s) => s.computeDirection)
  const setDirection = useNavStore((s) => s.setDirection)

  useEffect(() => {
    const prev = prevPathRef.current
    const next = location.pathname
    if (prev !== next) {
      // BottomNav / useSwipeNav が先に setDirection していない場合のフォールバック
      // 実際には BottomNav/useSwipeNav が navigate 前に setDirection を呼ぶので、
      // ここに来るのはブラウザバック/フォワード/ディープリンクのみ
      const dir = computeDirection(prev, next)
      setDirection(dir)
      prevPathRef.current = next
    }
  }, [location.pathname, computeDirection, setDirection])
}
```

#### `src/components/PageWrapper.tsx`（新規）

```tsx
import { forwardRef } from 'react'
import { motion } from 'motion/react'
import { useNavStore } from '../stores/useNavStore'
import { pageVariants, PAGE_TRANSITION } from '../utils/motion'

interface PageWrapperProps {
  children: React.ReactNode
}

/**
 * AnimatePresence mode="popLayout" は子コンポーネントに ref を要求する。
 * forwardRef で DOM ノードへの参照を転送する。
 */
const PageWrapper = forwardRef<HTMLDivElement, PageWrapperProps>(
  function PageWrapper({ children }, ref) {
    const direction = useNavStore((s) => s.direction)
    const setIsAnimating = useNavStore((s) => s.setIsAnimating)

    return (
      <motion.div
        ref={ref}
        custom={direction}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={PAGE_TRANSITION}
        onAnimationStart={() => setIsAnimating(true)}
        onAnimationComplete={() => setIsAnimating(false)}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          // iOS momentum scroll 対応
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </motion.div>
    )
  }
)

export default PageWrapper
```

**旧設計からの修正点:**
1. `forwardRef` でラップ。`AnimatePresence mode="popLayout"` は exit 中のコンポーネントを `position: absolute` で DOM に残すため、直下の子コンポーネントに ref が必要。これがないと React の警告が出る上に、layout 計算が崩れる。
2. `onAnimationStart` / `onAnimationComplete` で `isAnimating` を管理し、遷移中のインタラクション抑制を実現する。
3. `overscrollBehavior: 'contain'` を追加し、iOS でスクロールがページ外に伝播するのを防ぐ。
4. `variants` に関数ではなくオブジェクトを渡し、`custom` prop で direction を動的に注入する正しいパターンに修正。

#### `src/App.tsx` の AnimatedRoutes

```tsx
import { AnimatePresence } from 'motion/react'
import { useLocation, Routes, Route, Navigate, BrowserRouter } from 'react-router-dom'
import { useNavStore } from './stores/useNavStore'
import { useDirectionSync } from './hooks/useDirectionSync'
import PageWrapper from './components/PageWrapper'
import AnimationErrorBoundary from './components/AnimationErrorBoundary'
// ...各ページのインポート

function AnimatedRoutes() {
  const location = useLocation()
  const direction = useNavStore((s) => s.direction)

  // ブラウザバック・ディープリンク時の direction 自動算出
  useDirectionSync()

  return (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={
          <PageWrapper><HomePage /></PageWrapper>
        } />
        <Route path="/meals" element={
          <PageWrapper><MealsPage /></PageWrapper>
        } />
        <Route path="/weight" element={
          <PageWrapper><WeightPage /></PageWrapper>
        } />
        <Route path="/chat" element={
          <PageWrapper><ChatPage /></PageWrapper>
        } />
        <Route path="/settings" element={
          <PageWrapper><SettingsPage /></PageWrapper>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
```

**旧設計からの修正点: `mode="wait"` を使用（`popLayout` ではない）**

`popLayout` には React Router との組み合わせで以下の既知の問題がある:
- exit 中のコンポーネントが `position: absolute` で兄弟要素として挿入されるが、React Router の `<Routes>` が返す単一要素と相性が悪い
- exit 中のコンポーネントがルーティングコンテキストを失い、`useLocation` 等が不正な値を返す可能性がある
- `<Routes>` は内部で単一の `<Route>` マッチしか返さないため、`popLayout` が期待する「2つの子が同時に存在する」状態と矛盾する

`mode="wait"` は exit 完了後に enter を開始するため、上記の問題が起きない。遷移が少しだけ長くなるが、安定性を優先する。
もし同時遷移（クロスフェード）が必要な場合は、`mode="sync"` + 手動の `position: absolute` 管理に切り替える（下記に代替案を記載）。

**代替案: 同時遷移が必要な場合**

```tsx
// mode="sync" + 手動 absolute 管理
// PageWrapper の position: absolute はそのままで、
// 親コンテナに position: relative + overflow: hidden を設定
<AnimatePresence mode="sync" custom={direction} initial={false}>
  <PageWrapper key={location.pathname}>
    <Routes location={location}>
      {/* ... */}
    </Routes>
  </PageWrapper>
</AnimatePresence>
```

この場合は `key` を `PageWrapper` に付け、`<Routes>` を `PageWrapper` の子にすることで、
exit 中も各 `PageWrapper` が独自のルーティングコンテキストを保持する。

#### `src/components/layout/BottomNav.tsx` の方向セット

```tsx
import { useNavStore, TAB_ORDER } from '../../stores/useNavStore'

// コンポーネント内部:
const setDirection = useNavStore((s) => s.setDirection)
const isAnimating = useNavStore((s) => s.isAnimating)

const handleTabClick = (path: string) => {
  // 遷移中は連打を無視
  if (isAnimating) return
  if (path === pathname) return // 同じタブは無視

  const currentIdx = tabs.findIndex((t) => t.path === pathname)
  const nextIdx = tabs.findIndex((t) => t.path === path)
  setDirection(nextIdx > currentIdx ? 1 : -1)
  navigate(path)
}
```

#### `useSwipeNav.ts` の方向セット + vaul 競合回避

```ts
import { useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useNavStore, TAB_ORDER } from '../stores/useNavStore'

const TABS = [...TAB_ORDER]
const MIN_SWIPE_X = 55
const RATIO       = 1.4
const EDGE_GUARD  = 20

export function useSwipeNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const startX = useRef(0)
  const startY = useRef(0)
  const startTime = useRef(0)

  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const attachSwipe = useCallback((el: HTMLElement) => {
    const handleTouchStart = (e: TouchEvent) => {
      // vaul の Drawer が開いている場合はスワイプナビを無効化
      // vaul は [data-vaul-drawer] 属性を持つ要素を DOM に追加する
      if (document.querySelector('[data-vaul-drawer]')) return

      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
      startTime.current = Date.now()
    }

    const handleTouchEnd = (e: TouchEvent) => {
      // vaul Drawer が開いている場合は無視
      if (document.querySelector('[data-vaul-drawer]')) return

      // 遷移中は無視
      if (useNavStore.getState().isAnimating) return

      const x0 = startX.current
      const dx = e.changedTouches[0].clientX - x0
      const dy = e.changedTouches[0].clientY - startY.current
      const dt = Date.now() - startTime.current

      // 長押し（500ms+）はスワイプとみなさない
      if (dt > 500) return

      if (
        Math.abs(dx) < MIN_SWIPE_X ||
        Math.abs(dx) < Math.abs(dy) * RATIO ||
        x0 < EDGE_GUARD ||
        x0 > window.innerWidth - EDGE_GUARD
      ) return

      const idx = TABS.indexOf(pathnameRef.current)
      if (idx === -1) return

      const { setDirection } = useNavStore.getState()

      if (dx < 0 && idx < TABS.length - 1) {
        setDirection(1)
        navigateRef.current(TABS[idx + 1])
      }
      if (dx > 0 && idx > 0) {
        setDirection(-1)
        navigateRef.current(TABS[idx - 1])
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [])

  return { attachSwipe }
}
```

**旧設計からの修正点:**
1. `document.documentElement.dataset.swipeDir` を `useNavStore.getState()` に置き換え。
2. vaul の Drawer が開いている時はスワイプナビを無効化（`[data-vaul-drawer]` 属性チェック）。
3. `isAnimating` チェックで遷移中のスワイプを抑制。
4. `startTime` を追加し、長押しをスワイプと誤判定しないようにした。

### 3-3. `AppShell.tsx` の構造変更

AppShell は PageWrapper の中に配置されるため、`h-svh` は使わない。
代わりに `h-full` で PageWrapper の absolute コンテナいっぱいに広がる。

```tsx
import { type ReactNode, useEffect, useRef } from 'react'
import BottomNav from './BottomNav'
import { useSwipeNav } from '../../hooks/useSwipeNav'

interface Props {
  children: ReactNode
  title?: string
  rightAction?: ReactNode
}

export default function AppShell({ children, title, rightAction }: Props) {
  const mainRef = useRef<HTMLElement>(null)
  const { attachSwipe } = useSwipeNav()

  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    return attachSwipe(el)
  }, [attachSwipe])

  return (
    <div className="flex flex-col h-full bg-[#FAFAF7]">
      {title && (
        <header className="shrink-0 sticky top-0 z-40
          bg-[#FAFAF7]/80 backdrop-blur-xl
          border-b border-white/60
          shadow-[0_1px_0_rgba(0,0,0,0.05)]
          px-4 pt-[env(safe-area-inset-top)] pb-3
          flex items-center justify-between"
        >
          <h1 className="text-base font-semibold text-gray-800 tracking-tight">{title}</h1>
          {rightAction && <div>{rightAction}</div>}
        </header>
      )}

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
```

**レイアウト構造:**

```
App (BrowserRouter)
|-- div#transition-container [position:relative, flex:1, overflow:hidden]
|   `-- AnimatePresence
|       `-- PageWrapper [position:absolute, inset:0] (遷移中は2枚重なる)
|           `-- AppShell [h-full, flex-col]
|               |-- Header (shrink-0, sticky)
|               |-- main (flex-1, overflow-y-auto)
|               `-- BottomNav (shrink-0)
```

**旧設計からの修正点:**
- Header と BottomNav を PageWrapper の外に出す設計を撤回。
  理由: BottomNav の `useLocation()` が exit 中のページで不整合を起こす。
  代わりに、各ページの AppShell 内に Header と BottomNav を含め、ページ全体として遷移させる。
  BottomNav は位置が固定なのでユーザーには視覚的に動かないように見えるが、実際には2枚の BottomNav が同時に存在する（opacity / x の遷移で自然に見える）。
- `h-svh` -> `h-full` に変更。PageWrapper が absolute で h-svh 相当の空間を作るため。
- 旧 CSS アニメーションクラス (`page-enter`, `page-enter-from-right` 等) の参照を削除。

---

## 4. BottomSheet 化（vaul）

### 4-1. vaul の選定理由

- `@radix-ui/react-dialog` ベースで accessibility (ARIA) 完備
- ドラッグして閉じるジェスチャー対応（iOS標準シートと同じ体験）
- `snapPoints` による多段シート対応（将来的な詳細展開に使える）
- React 19 対応済み（vaul v1.1）

### 4-2. 共通 BottomSheet ラッパー

**新規作成**: `src/components/ui/BottomSheet.tsx`

```tsx
import { Drawer } from 'vaul'
import { cn } from '../../utils/cn'

interface BottomSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  snapPoints?: number[]
  activeSnapPoint?: number | string | null
  setActiveSnapPoint?: (snapPoint: number | string | null) => void
  fadeFromIndex?: number
  dismissible?: boolean
  className?: string
  /** trueの場合、シート外タップでも閉じない */
  modal?: boolean
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  snapPoints,
  activeSnapPoint,
  setActiveSnapPoint,
  fadeFromIndex,
  dismissible = true,
  className,
  modal = true,
}: BottomSheetProps) {
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      snapPoints={snapPoints}
      activeSnapPoint={activeSnapPoint}
      setActiveSnapPoint={setActiveSnapPoint}
      fadeFromIndex={fadeFromIndex}
      dismissible={dismissible}
      modal={modal}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[90] bg-black/40" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-[100]',
            'max-w-[480px] mx-auto',
            'bg-[#FAFAF7] rounded-t-[28px]',
            'max-h-[90dvh] outline-none',
            className
          )}
        >
          {/* ドラッグハンドル */}
          <Drawer.Handle className="mt-3 mb-1" />

          {/* コンテンツ（スクロール可能） */}
          <div
            className="overflow-y-auto px-4 pb-4"
            style={{
              maxHeight: 'calc(90dvh - 2.5rem)',
              paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
              overscrollBehavior: 'contain',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

**旧設計からの修正点:**

1. **`Drawer.Handle` コンポーネントを使用**: 手動の div ハンドルではなく vaul 公式の `Drawer.Handle` を使う。これにより ARIA 属性が自動付与され、ドラッグ判定も正確になる。

2. **`backdrop-blur` をオーバーレイから削除**: `backdrop-blur-[2px]` は全画面に対する GPU コンポジットレイヤーを生成し、古い iPhone (A12 以前) で顕著なフレームドロップを引き起こす。黒の半透明オーバーレイのみで十分な視覚的分離ができる。

3. **`overscroll-behavior: contain` と `-webkit-overflow-scrolling: touch`**: iOS でのモーメンタムスクロールとドラッグ閉じの干渉を軽減する。

4. **`snapPoints` の型を `number[]` に修正**: vaul v1 の `snapPoints` は 0-100 の数値配列（画面高さのパーセント）。文字列を含む `(string | number)[]` は誤り。

5. **`activeSnapPoint` / `setActiveSnapPoint` / `fadeFromIndex` props を追加**: multi-step sheet で必要になる制御用 props。

6. **safe-area padding**: `pb-[env(safe-area-inset-bottom)]` を `paddingBottom: max(1rem, env(safe-area-inset-bottom))` に変更。safe-area がない端末でも最低限のパディングを確保。

### 4-3. iOS スクロール干渉の追加対策

vaul の Drawer.Content 内でスクロール可能なコンテンツがある場合、iOS でドラッグ閉じとスクロールが競合する既知の問題がある。

対策:
```css
/* vaul の ::after 擬似要素がスクロールコンテンツを切り取る問題の修正 */
[data-vaul-drawer][data-vaul-drawer-direction='bottom']::after {
  height: unset !important;
}
```

これを `src/index.css` に追加する。

### 4-4. 置き換え対象と対応方針

| 現在の実装 | 置き換え後 |
|---|---|
| `MealsPage.tsx` の `showAdd` + `createPortal` | `<BottomSheet open={showAdd}>` |
| `MealsPage.tsx` の `editingMeal` + `createPortal` | `<BottomSheet open={!!editingMeal}>` |
| `WeightPage.tsx` の追加フォーム | `<BottomSheet>` |
| `GutFeedbackModal.tsx` の `createPortal` | `<BottomSheet>` |

**移行後に削除するもの**:
- `src/index.css` の `sheet-enter`, `backdrop-enter` keyframes
- 各ファイルの `createPortal` インポートと `document.getElementById('root')!`

### 4-5. MealsPage の multi-step sheet 設計

食事追加フローは `input -> confirm -> ai_analyzing -> notify_prompt` の4ステップ。
これを vaul で実装する際の設計判断:

**方針: 単一 BottomSheet + 内部 state で step を切り替える（snapPoints は使わない）**

理由:
- `snapPoints` はシートの高さ制御用であり、画面内容の切り替えには不適切
- step ごとにシートの高さが変わる場合、vaul が自動でコンテンツ高さに追従する
- step 切り替え時のアニメーションは motion の `AnimatePresence` で内部的に行う

```tsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BottomSheet } from '../../components/ui/BottomSheet'

type AddStep = 'input' | 'confirm' | 'ai_analyzing' | 'notify_prompt'

function MealAddSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<AddStep>('input')

  const handleOpenChange = (v: boolean) => {
    if (!v) setStep('input') // 閉じたらリセット
    onOpenChange(v)
  }

  return (
    <BottomSheet open={open} onOpenChange={handleOpenChange} dismissible={step !== 'ai_analyzing'}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {step === 'input' && <InputStep onNext={() => setStep('confirm')} />}
          {step === 'confirm' && <ConfirmStep onBack={() => setStep('input')} onAnalyze={() => setStep('ai_analyzing')} onSave={() => {/* ... */}} />}
          {step === 'ai_analyzing' && <AnalyzingStep />}
          {step === 'notify_prompt' && <NotifyStep onDone={() => handleOpenChange(false)} />}
        </motion.div>
      </AnimatePresence>
    </BottomSheet>
  )
}
```

**ポイント:**
- AI 分析中は `dismissible={false}` でシートを閉じられなくする
- step 切り替え時に内部 `AnimatePresence` でクロスフェードする
- `Drawer.Handle` は常に表示されるので、全 step 共通のシート外見を維持

### 4-6. フォーム input の iOS zoom 対策

vaul 移行後も、シート内の input/textarea に `font-size: 16px` を維持する必要がある。
現在の `src/index.css` に既に以下のルールがあるため、vaul の Drawer.Content 内にも自動適用される:

```css
input, textarea, select {
  font-size: 16px;
}
```

ただし、vaul の Portal は `document.body` 直下にレンダリングされるため、`#root` にスコープされた CSS カスタムプロパティはそのまま適用される。この global ルールは Portal 内にも有効。

---

## 5. マイクロインタラクション標準ルール

### 5-1. タップフィードバックの統一方針

`motion` の `motion.button` / `motion.div` に `whileTap={{ scale: 0.96 }}` を適用する。
CSS の `button:active { transform: scale(0.955) }` は**削除**し、motion に一本化する。

**ただし、CSS -> motion 移行は段階的に行う。** Phase 1-D で motion ベースの Button コンポーネントに置き換えたページから、対応する CSS ルールを無効化していく。

### 5-2. 共通ボタンコンポーネント

**新規作成**: `src/components/ui/Button.tsx`

```tsx
import { motion } from 'motion/react'
import { cn } from '../../utils/cn'
import { haptic } from '../../utils/haptics'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const variantStyles = {
  primary:   'bg-emerald-600 text-white shadow-[0_4px_14px_rgba(61,143,133,0.3)]',
  secondary: 'bg-gray-100 text-gray-700',
  ghost:     'text-gray-500',
  danger:    'bg-red-500 text-white',
}

const sizeStyles = {
  sm: 'py-2 px-3 text-sm rounded-xl',
  md: 'py-3 px-4 text-sm rounded-2xl font-semibold',
  lg: 'py-3.5 text-base rounded-2xl font-semibold',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  onClick,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      // disabled 時は whileTap を無効化（scale してしまう問題の対策）
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'w-full flex items-center justify-center gap-2',
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      onClick={(e) => {
        if (disabled) return
        haptic('light')
        onClick?.(e)
      }}
      disabled={disabled}
      {...props}
    >
      {children}
    </motion.button>
  )
}
```

**旧設計からの修正点:**
1. `disabled` 時に `whileTap` を `undefined` にする。motion は `disabled` 属性を尊重しないため、`whileTap={{ scale: 0.96 }}` が disabled ボタンでも発火する。明示的に `undefined` を渡す必要がある。
2. `disabled` 時のスタイル (`opacity-40 cursor-not-allowed`) を追加。
3. `onClick` 内で `disabled` チェックを追加（HTML の disabled は `motion.button` で伝播しない場合がある）。
4. 変数名 `variants` -> `variantStyles` に変更。motion の `variants` prop と名前衝突を避ける。

### 5-3. カードのタップフィードバック

```tsx
import { motion } from 'motion/react'

<motion.div
  whileTap={{ scale: 0.98 }}
  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
  className="bg-white rounded-2xl p-4 ..."
>
```

### 5-4. リストのスタガーアニメーション

```tsx
import { motion } from 'motion/react'
import { staggerContainer, listItemVariants } from '../../utils/motion'

<motion.div variants={staggerContainer} initial="initial" animate="animate">
  {meals.map((meal) => (
    <motion.div
      key={meal.id}
      variants={listItemVariants}
      // layout prop は個別アイテムには付けない（下記注意参照）
    >
      <MealCard meal={meal} />
    </motion.div>
  ))}
</motion.div>
```

**旧設計からの修正点: `layout` prop の削除**

旧設計ではリストアイテム全体に `layout` prop を付けていたが、以下の理由で削除する:

1. **Dexie LiveQuery との相性問題**: `useLiveQuery` は DB 変更時にリスト全体を再レンダリングする。`layout` prop があると、全アイテムの位置を FLIP アニメーションで再計算するため、アイテム数が多い場合に顕著なフレームドロップが発生する。
2. **代替手段**: 追加・削除時のアニメーションは `AnimatePresence` + `listItemVariants` の `exit` で十分。リフローアニメーションが必要な場合は、変更されたアイテムのみに `layoutId` を付ける。

`layout` prop を使用する場合の安全なパターン:
```tsx
// 並べ替え可能なリストのみ layout を使用
<motion.div layout="position" layoutId={`meal-${meal.id}`}>
  <MealCard meal={meal} />
</motion.div>
```

`layout="position"` にすることで、サイズ変更アニメーションを省略し、位置変更のみアニメーションする。これでコストを最小化できる。

### 5-5. アイコンアニメーション

| シーン | アニメーション |
|---|---|
| 保存完了チェックマーク | `animate={{ pathLength: 1 }}` stroke アニメーション |
| ローディングスピナー | `animate={{ rotate: 360 }}` (無限ループ) |
| マイクボタン（録音中） | `animate={{ scale: [1, 1.1, 1] }}` pulse |
| Sparkles（AI） | `animate={{ rotate: [-5, 5, -5] }}` wiggle |

---

## 6. Error Boundary 設計

### 6-1. アニメーション専用 Error Boundary

motion や vaul がレンダリングエラーを起こした場合のフォールバックを用意する。

**新規作成**: `src/components/AnimationErrorBoundary.tsx`

```tsx
import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export default class AnimationErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    // motion/vaul のエラーをログに記録
    console.error('[AnimationErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? this.props.children
    }
    return this.props.children
  }
}
```

**使用箇所:**

```tsx
// App.tsx
<AnimationErrorBoundary fallback={<FallbackRoutes />}>
  <AnimatedRoutes />
</AnimationErrorBoundary>

// FallbackRoutes: アニメーションなしの素の Routes
function FallbackRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell><HomePage /></AppShell>} />
      {/* ... */}
    </Routes>
  )
}
```

```tsx
// BottomSheet.tsx にも Error Boundary をラップ
// vaul がクラッシュした場合、createPortal ベースのフォールバックシートを表示
<AnimationErrorBoundary fallback={<FallbackSheet {...props} />}>
  <Drawer.Root {...drawerProps}>
    {/* ... */}
  </Drawer.Root>
</AnimationErrorBoundary>
```

### 6-2. ReducedMotion 対応

```tsx
// App.tsx のルート付近
import { MotionConfig } from 'motion/react'

<MotionConfig reducedMotion="user">
  <BrowserRouter>
    <AnimationErrorBoundary>
      <AnimatedRoutes />
    </AnimationErrorBoundary>
  </BrowserRouter>
</MotionConfig>
```

`reducedMotion="user"` を設定することで、OS の「視差効果を減らす」設定を自動的に尊重する。

---

## 7. Glassmorphism + セーフエリア

### 7-1. ヘッダーの Glassmorphism 化

**変更ファイル**: `src/components/layout/AppShell.tsx`

```tsx
<header className="
  shrink-0 px-4 pb-3 sticky top-0 z-40
  pt-[env(safe-area-inset-top)]
  bg-[#FAFAF7]/80 backdrop-blur-xl
  border-b border-white/60
  shadow-[0_1px_0_rgba(0,0,0,0.05)]
">
```

### 7-2. BottomNav の Glassmorphism 化

**変更ファイル**: `src/components/layout/BottomNav.tsx`

```tsx
<nav className="
  shrink-0
  bg-[#FAFAF7]/80 backdrop-blur-xl
  border-t border-white/60
  pb-[env(safe-area-inset-bottom)]
  shadow-[0_-1px_0_rgba(0,0,0,0.04)]
  z-50
">
```

### 7-3. backdrop-blur のパフォーマンス考慮

`backdrop-blur-xl` は GPU コンポジットレイヤーを生成する。以下の対策を講じる:

1. **ヘッダーと BottomNav のみに限定**: 全画面オーバーレイ（BottomSheet の Overlay 等）には使わない。
2. **`will-change: transform`**: ヘッダーと BottomNav に付与し、レイヤー生成を事前に最適化する。
3. **古い端末でのフォールバック**: `@supports not (backdrop-filter: blur(1px))` で不透明背景にフォールバック。

```css
/* src/index.css に追加 */
@supports not (backdrop-filter: blur(1px)) {
  .backdrop-blur-xl {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
    background-color: #FAFAF7 !important;
  }
}
```

### 7-4. セーフエリア対応の完全整理

| 要素 | 対応 |
|---|---|
| ヘッダー | `padding-top: env(safe-area-inset-top)` |
| BottomNav | `padding-bottom: env(safe-area-inset-bottom)` |
| BottomSheet | `padding-bottom: max(1rem, env(safe-area-inset-bottom))` |
| フルスクリーン背景 | `min-height: 100dvh` |

`index.html` の viewport メタに `viewport-fit=cover` が既に設定済みであることを確認。

### 7-5. Tailwind CSS v4 での backdrop-blur 有効化

Tailwind v4 では `backdrop-blur` はデフォルト有効。
`bg-opacity` 系は `bg-[color]/opacity` 記法に統一。
例: `bg-white/80` (OK) / `bg-white bg-opacity-80` (NG)

---

## 8. 変更ファイル一覧（優先順位順）

### Phase 1-A（インフラ）
| ファイル | 操作 | 内容 |
|---|---|---|
| `src/utils/cn.ts` | 新規 | clsx + twMerge ユーティリティ |
| `src/utils/haptics.ts` | 新規 | バイブレーション共通関数 |
| `src/utils/motion.ts` | 新規 | motion 定数・バリアント |
| `src/stores/useNavStore.ts` | 新規 | タブ遷移方向 + isAnimating 状態管理 |
| `src/hooks/useDirectionSync.ts` | 新規 | ブラウザバック・ディープリンクの direction 自動算出 |
| `src/components/AnimationErrorBoundary.tsx` | 新規 | motion/vaul エラーのフォールバック |

### Phase 1-B（BottomSheet）
| ファイル | 操作 | 内容 |
|---|---|---|
| `src/components/ui/BottomSheet.tsx` | 新規 | vaul ラッパー |
| `src/components/ui/Button.tsx` | 新規 | motion.button ラッパー |
| `src/components/GutFeedbackModal.tsx` | 変更 | createPortal -> BottomSheet |
| `src/features/meals/MealsPage.tsx` | 変更 | createPortal -> BottomSheet + multi-step |
| `src/features/weight/WeightPage.tsx` | 変更 | createPortal -> BottomSheet |

### Phase 1-C（ページ遷移）
| ファイル | 操作 | 内容 |
|---|---|---|
| `src/components/PageWrapper.tsx` | 新規 | motion.div ページラッパー (forwardRef) |
| `src/App.tsx` | 変更 | AnimatePresence + PageWrapper + MotionConfig + ErrorBoundary |
| `src/components/layout/AppShell.tsx` | 変更 | h-svh -> h-full、CSS アニメクラス削除 |
| `src/components/layout/BottomNav.tsx` | 変更 | useNavStore + isAnimating 連打防止 |
| `src/hooks/useSwipeNav.ts` | 変更 | useNavStore + vaul 競合回避 + 長押し除外 |

### Phase 1-D（マイクロインタラクション）
| ファイル | 操作 | 内容 |
|---|---|---|
| `src/features/meals/MealsPage.tsx` | 変更 | motion.div + stagger (layout なし) |
| `src/features/home/HomePage.tsx` | 変更 | motion.div + whileTap |
| `src/features/weight/WeightPage.tsx` | 変更 | motion.div + stagger |

### Phase 1-E（Glassmorphism + クリーンアップ）
| ファイル | 操作 | 内容 |
|---|---|---|
| `src/components/layout/AppShell.tsx` | 変更 | backdrop-blur ヘッダー |
| `src/components/layout/BottomNav.tsx` | 変更 | backdrop-blur ナビ |
| `src/index.css` | 変更 | 旧 keyframes 削除 + vaul ::after fix + backdrop-blur fallback |

---

## 9. リスクと注意事項

### 9-1. motion バンドルサイズ

- `motion` パッケージは約 **+45KB gzip** の追加になる
- PWA のオフラインキャッシュには影響しない（初回ロード時のみ）
- バンドルサイズ削減オプション: `m` コンポーネント + `LazyMotion` を使えば約 5KB に削減可能（ただし feature の手動読み込みが必要）

```tsx
// 将来のバンドル最適化（Phase 2 で検討）
import { LazyMotion, domAnimation, m } from 'motion/react'

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} />
</LazyMotion>
```

### 9-2. vaul と iOS のスクロール干渉

- vaul は `touch-action: none` を Drawer.Content に内部でセットする
- シート内スクロールコンテナには `overscroll-behavior: contain` + `-webkit-overflow-scrolling: touch` が必要
- `Drawer.Content` 内の `overflow-y: auto` 要素に対して、vaul は scroll position が 0 の時のみドラッグ閉じを許可する設計になっている。ただし iOS のモーメンタムスクロールが残っている間にドラッグ判定が誤作動する既知の問題がある
- 対策: スクロール要素に `overscroll-behavior: contain` を必ず付ける

### 9-3. AnimatePresence と React Router v7

- `mode="wait"` を採用し、exit 完了後に enter を開始する安全なパターンを使用
- `<Routes>` の `location` prop と `key` prop が正しくセットされていること
- 注意: `mode="wait"` は exit + enter の合計時間分だけ遷移が長くなる。`PAGE_TRANSITION` の duration を短めに設定（spring で約 0.25s）

### 9-4. CSS keyframes との移行期間

- Phase 1-A ~ 1-C の間は、CSS keyframes と motion が混在する
- **旧 CSS クラス削除は Phase 1-E の最後**に行い、途中での削除は避ける
- 混在期間中、CSS `button:active { transform: scale(0.955) }` と motion の `whileTap` が二重に適用される可能性がある。motion 導入済みのコンポーネントには `data-motion` 属性を付け、CSS 側で除外する:

```css
button:not([data-motion]):not([disabled]):active {
  transform: scale(0.955);
}
```

### 9-5. Haptics の iOS 対応

- `navigator.vibrate` は iOS Safari では**完全非対応**
- `try { if (!navigator.vibrate) return }` でサイレントに無視されるため、実害はない
- iOS の Haptic Feedback は WKWebView ネイティブ機能であり、PWA では利用不可

### 9-6. 遷移中のインタラクション抑制

- `useNavStore.isAnimating` で遷移中のタブクリック・スワイプを無視する
- BottomSheet の開閉中は `onOpenChange` の `open: false` コールバックで制御される（vaul が内部管理）
- 連打防止は UI レベルで行い、navigate 自体のデバウンスは行わない（React Router が同一パスへの navigate を無視するため）

---

## 10. 品質チェックリスト（実装完了後）

- [ ] iPhone Safari（実機）でボトムシートがドラッグで閉じられること
- [ ] BottomSheet 内のスクロールとシートドラッグが干渉しないこと（スクロール位置 0 でのみドラッグ閉じが発火すること）
- [ ] タブ切替時にスライドアニメーションが方向通りに動くこと
- [ ] ブラウザバック・フォワードで遷移方向が正しいこと
- [ ] ディープリンク（URL 直接入力）で遷移方向がデフォルト（右）になること
- [ ] スワイプでのタブ切替が、BottomSheet 表示中に誤発火しないこと
- [ ] 遷移アニメーション中のタブクリック・スワイプが無視されること
- [ ] disabled ボタンで whileTap の scale アニメーションが発火しないこと
- [ ] input/textarea で iOS zoom が発生しないこと（font-size: 16px 維持）
- [ ] セーフエリア（ノッチ・ホームインジケータ）が確保されていること
- [ ] OS の「視差効果を減らす」設定でアニメーションが軽減されること
- [ ] motion/vaul のレンダリングエラー時に ErrorBoundary がフォールバックを表示すること
- [ ] Lighthouse PWA スコアが 90 以上を維持すること
- [ ] `npm run build` でビルドエラーがないこと
- [ ] Android Chrome での動作確認（Haptics は Android のみ動作する）
- [ ] backdrop-blur 非対応ブラウザで不透明背景にフォールバックすること

---

## 11. 実装しない（スコープ外）

- Shared Element Transition（食事カード -> 詳細画面の拡大遷移）-> Phase 2
- `LazyMotion` によるバンドルサイズ最適化 -> Phase 2
- ネイティブアプリ化（React Native / Capacitor）-> Phase 3
- CSS View Transitions API -> ブラウザ対応待ち
