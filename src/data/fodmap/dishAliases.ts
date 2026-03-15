// 料理名 → 構成食材キーワード のマッピング
// FodmapLookup がDBで見つからなかった時のフォールバックに使用
export interface DishAlias {
  /** 料理名のキーワード（部分一致で使用） */
  keywords: string[]
  /** 構成食材のキーワード（FODMAPDBのkeywordsに存在するもの） */
  components: string[]
  /** 概算カロリー(kcal)。栄養計算の補助 */
  estimatedCalories?: number
  /** 概算タンパク質(g) */
  estimatedProtein?: number
}

export const DISH_ALIASES: DishAlias[] = [
  // ─── 丼物 ──────────────────────────────────────
  { keywords: ['牛丼', 'ぎゅうどん'], components: ['牛肉', '白米', '玉ねぎ'], estimatedCalories: 650, estimatedProtein: 25 },
  { keywords: ['豚丼', 'ぶたどん'], components: ['豚肉', '白米', '玉ねぎ'], estimatedCalories: 680, estimatedProtein: 24 },
  { keywords: ['親子丼', 'おやこどん'], components: ['鶏肉', '卵', '白米', '玉ねぎ'], estimatedCalories: 620, estimatedProtein: 28 },
  { keywords: ['カツ丼', 'かつどん'], components: ['豚カツ', '卵', '白米', '玉ねぎ'], estimatedCalories: 850, estimatedProtein: 30 },
  { keywords: ['天丼', 'てんどん'], components: ['えび天', '白米'], estimatedCalories: 780, estimatedProtein: 18 },
  { keywords: ['うな丼', 'うなどん', '鰻丼'], components: ['うなぎ', '白米'], estimatedCalories: 720, estimatedProtein: 26 },
  { keywords: ['海鮮丼', 'かいせんどん'], components: ['まぐろ', '白米', 'サーモン'], estimatedCalories: 550, estimatedProtein: 30 },
  { keywords: ['マグロ丼', 'まぐろどん'], components: ['まぐろ', '白米'], estimatedCalories: 520, estimatedProtein: 32 },
  { keywords: ['サーモン丼', 'さーもんどん'], components: ['サーモン', '白米'], estimatedCalories: 560, estimatedProtein: 28 },
  { keywords: ['鉄火丼', 'てっかどん'], components: ['まぐろ', '白米'], estimatedCalories: 510, estimatedProtein: 30 },
  { keywords: ['ネギトロ丼'], components: ['まぐろ', '白米', 'ねぎ'], estimatedCalories: 530, estimatedProtein: 28 },
  { keywords: ['チキン南蛮丼'], components: ['鶏肉', '白米', '卵'], estimatedCalories: 750, estimatedProtein: 32 },
  { keywords: ['そぼろ丼', 'とりそぼろ丼'], components: ['鶏肉', '卵', '白米'], estimatedCalories: 580, estimatedProtein: 26 },
  { keywords: ['麻婆丼', 'マーボー丼'], components: ['豆腐', '豚肉', '白米'], estimatedCalories: 650, estimatedProtein: 22 },
  { keywords: ['天ぷら丼'], components: ['えび天', '白米'], estimatedCalories: 800, estimatedProtein: 20 },

  // ─── 麺類 ──────────────────────────────────────
  { keywords: ['ラーメン', 'らーめん', '拉麺'], components: ['中華麺', '豚肉', 'ねぎ'], estimatedCalories: 550, estimatedProtein: 22 },
  { keywords: ['醤油ラーメン', 'しょうゆらーめん'], components: ['中華麺', '豚肉', 'ねぎ', '醤油'], estimatedCalories: 530, estimatedProtein: 22 },
  { keywords: ['味噌ラーメン', 'みそらーめん'], components: ['中華麺', '豚肉', '味噌'], estimatedCalories: 600, estimatedProtein: 24 },
  { keywords: ['塩ラーメン', 'しおらーめん'], components: ['中華麺', '鶏肉'], estimatedCalories: 480, estimatedProtein: 20 },
  { keywords: ['豚骨ラーメン', 'とんこつらーめん'], components: ['中華麺', '豚肉'], estimatedCalories: 620, estimatedProtein: 26 },
  { keywords: ['つけ麺', 'つけめん'], components: ['中華麺', '豚肉'], estimatedCalories: 680, estimatedProtein: 28 },
  { keywords: ['担々麺', 'たんたんめん'], components: ['中華麺', '豚肉', 'ごま'], estimatedCalories: 650, estimatedProtein: 24 },
  { keywords: ['かけうどん'], components: ['うどん'], estimatedCalories: 310, estimatedProtein: 10 },
  { keywords: ['ざるうどん'], components: ['うどん'], estimatedCalories: 280, estimatedProtein: 10 },
  { keywords: ['きつねうどん'], components: ['うどん', '油揚げ'], estimatedCalories: 400, estimatedProtein: 14 },
  { keywords: ['肉うどん', 'にくうどん'], components: ['うどん', '牛肉'], estimatedCalories: 480, estimatedProtein: 20 },
  { keywords: ['天ぷらうどん', 'てんぷらうどん'], components: ['うどん', 'えび天'], estimatedCalories: 500, estimatedProtein: 16 },
  { keywords: ['カレーうどん', 'かれーうどん'], components: ['うどん', 'カレー'], estimatedCalories: 520, estimatedProtein: 18 },
  { keywords: ['ざるそば', 'もりそば'], components: ['そば'], estimatedCalories: 270, estimatedProtein: 12 },
  { keywords: ['かけそば'], components: ['そば'], estimatedCalories: 290, estimatedProtein: 12 },
  { keywords: ['月見そば', 'つきみそば'], components: ['そば', '卵'], estimatedCalories: 350, estimatedProtein: 16 },
  { keywords: ['焼きそば', 'やきそば'], components: ['中華麺', '豚肉', 'キャベツ'], estimatedCalories: 520, estimatedProtein: 18 },
  { keywords: ['冷やし中華', 'ひやしちゅうか'], components: ['中華麺', '卵', 'ハム', 'きゅうり'], estimatedCalories: 480, estimatedProtein: 18 },
  { keywords: ['スパゲッティ', 'パスタ', 'スパゲティ'], components: ['パスタ'], estimatedCalories: 420, estimatedProtein: 14 },
  { keywords: ['ミートソース', 'ボロネーゼ'], components: ['パスタ', '牛肉'], estimatedCalories: 580, estimatedProtein: 24 },
  { keywords: ['カルボナーラ'], components: ['パスタ', '卵', 'ベーコン'], estimatedCalories: 650, estimatedProtein: 22 },
  { keywords: ['ペペロンチーノ'], components: ['パスタ', 'オリーブオイル'], estimatedCalories: 480, estimatedProtein: 12 },
  { keywords: ['ナポリタン', 'なぽりたん'], components: ['パスタ', 'ウインナー', '玉ねぎ'], estimatedCalories: 560, estimatedProtein: 18 },

  // ─── 定食・セットメニュー ──────────────────────
  { keywords: ['唐揚げ定食', 'からあげていしょく'], components: ['鶏肉', '白米', '味噌汁'], estimatedCalories: 800, estimatedProtein: 38 },
  { keywords: ['焼き魚定食', 'やきざかなていしょく'], components: ['さば', '白米', '味噌汁'], estimatedCalories: 620, estimatedProtein: 32 },
  { keywords: ['刺身定食', 'さしみていしょく'], components: ['まぐろ', '白米', '味噌汁'], estimatedCalories: 580, estimatedProtein: 34 },
  { keywords: ['とんかつ定食', 'トンカツ定食'], components: ['豚カツ', '白米', 'キャベツ'], estimatedCalories: 900, estimatedProtein: 36 },
  { keywords: ['鶏の唐揚げ', 'からあげ', '唐揚げ', 'とり唐'], components: ['鶏肉'], estimatedCalories: 300, estimatedProtein: 20 },
  { keywords: ['チキンカツ', 'ちきんかつ'], components: ['鶏肉'], estimatedCalories: 350, estimatedProtein: 24 },
  { keywords: ['ハンバーグ', 'はんばーぐ'], components: ['牛肉', '玉ねぎ'], estimatedCalories: 300, estimatedProtein: 18 },
  { keywords: ['ハンバーグ定食'], components: ['牛肉', '玉ねぎ', '白米'], estimatedCalories: 750, estimatedProtein: 30 },

  // ─── カレー ────────────────────────────────────
  { keywords: ['カレーライス', 'かれーらいす', 'カレー'], components: ['白米', '玉ねぎ', '牛肉', 'じゃがいも', 'にんじん'], estimatedCalories: 700, estimatedProtein: 20 },
  { keywords: ['チキンカレー', 'ちきんかれー'], components: ['白米', '鶏肉', '玉ねぎ'], estimatedCalories: 680, estimatedProtein: 28 },
  { keywords: ['ドライカレー'], components: ['白米', '牛肉', '玉ねぎ'], estimatedCalories: 620, estimatedProtein: 22 },

  // ─── 炒め物・焼き物 ────────────────────────────
  { keywords: ['チャーハン', 'ちゃーはん', '炒飯'], components: ['白米', '卵', 'ねぎ'], estimatedCalories: 520, estimatedProtein: 14 },
  { keywords: ['野菜炒め', 'やさいいため'], components: ['キャベツ', 'にんじん', '豚肉'], estimatedCalories: 250, estimatedProtein: 16 },
  { keywords: ['肉野菜炒め', 'にくやさいいため'], components: ['豚肉', 'キャベツ', 'もやし'], estimatedCalories: 350, estimatedProtein: 22 },
  { keywords: ['回鍋肉', 'ホイコーロー', 'ほいこーろー'], components: ['豚肉', 'キャベツ'], estimatedCalories: 380, estimatedProtein: 20 },
  { keywords: ['青椒肉絲', 'チンジャオロース'], components: ['牛肉', 'ピーマン'], estimatedCalories: 350, estimatedProtein: 22 },
  { keywords: ['酢豚', 'すぶた'], components: ['豚肉', '玉ねぎ', 'ピーマン'], estimatedCalories: 420, estimatedProtein: 20 },
  { keywords: ['焼き鳥', 'やきとり'], components: ['鶏肉'], estimatedCalories: 200, estimatedProtein: 20 },
  { keywords: ['焼肉', 'やきにく', '焼き肉'], components: ['牛肉'], estimatedCalories: 400, estimatedProtein: 28 },
  { keywords: ['餃子', 'ぎょうざ', 'ギョーザ'], components: ['豚肉', 'キャベツ', 'にら'], estimatedCalories: 280, estimatedProtein: 16 },

  // ─── 煮物・汁物 ────────────────────────────────
  { keywords: ['味噌汁', 'みそしる', 'お味噌汁'], components: ['味噌', '豆腐', 'わかめ'], estimatedCalories: 45, estimatedProtein: 3 },
  { keywords: ['豚汁', 'とんじる'], components: ['豚肉', '味噌', 'ごぼう', 'にんじん', 'こんにゃく'], estimatedCalories: 150, estimatedProtein: 10 },
  { keywords: ['おでん'], components: ['大根', '卵', 'こんにゃく', 'ちくわ'], estimatedCalories: 200, estimatedProtein: 12 },
  { keywords: ['肉じゃが', 'にくじゃが'], components: ['牛肉', 'じゃがいも', '玉ねぎ'], estimatedCalories: 280, estimatedProtein: 16 },
  { keywords: ['筑前煮', 'ちくぜんに'], components: ['鶏肉', 'ごぼう', 'にんじん', 'こんにゃく', 'れんこん'], estimatedCalories: 200, estimatedProtein: 14 },

  // ─── 鍋料理 ────────────────────────────────────
  { keywords: ['すき焼き', 'すきやき', 'スキヤキ'], components: ['牛肉', '豆腐', '白菜', 'ねぎ', 'しらたき'], estimatedCalories: 450, estimatedProtein: 28 },
  { keywords: ['しゃぶしゃぶ', 'シャブシャブ'], components: ['豚肉', '白菜', 'ねぎ', '豆腐'], estimatedCalories: 380, estimatedProtein: 26 },
  { keywords: ['水炊き', 'みずたき'], components: ['鶏肉', '白菜', '豆腐', 'ねぎ'], estimatedCalories: 300, estimatedProtein: 24 },
  { keywords: ['鍋', 'なべ', '鍋料理'], components: ['白菜', '豆腐', '鶏肉'], estimatedCalories: 300, estimatedProtein: 20 },

  // ─── サンドイッチ・パン系 ──────────────────────
  { keywords: ['サンドイッチ', 'サンド'], components: ['食パン', '卵', 'ハム'], estimatedCalories: 380, estimatedProtein: 16 },
  { keywords: ['ハンバーガー', 'バーガー'], components: ['バンズ', '牛肉'], estimatedCalories: 500, estimatedProtein: 22 },
  { keywords: ['チーズバーガー'], components: ['バンズ', '牛肉', 'チーズ'], estimatedCalories: 560, estimatedProtein: 26 },
  { keywords: ['トースト'], components: ['食パン'], estimatedCalories: 160, estimatedProtein: 6 },
  { keywords: ['卵トースト', 'たまごトースト'], components: ['食パン', '卵'], estimatedCalories: 230, estimatedProtein: 10 },

  // ─── 揚げ物 ────────────────────────────────────
  { keywords: ['とんかつ', 'トンカツ', '豚カツ'], components: ['豚肉'], estimatedCalories: 380, estimatedProtein: 24 },
  { keywords: ['エビフライ', 'えびふらい'], components: ['えび'], estimatedCalories: 250, estimatedProtein: 18 },
  { keywords: ['コロッケ', 'ころっけ'], components: ['じゃがいも', '牛肉'], estimatedCalories: 280, estimatedProtein: 8 },
  { keywords: ['天ぷら', 'てんぷら', 'テンプラ'], components: ['えび'], estimatedCalories: 200, estimatedProtein: 10 },

  // ─── 朝食系 ────────────────────────────────────
  { keywords: ['和朝食', 'わちょうしょく', '和定食'], components: ['白米', '味噌汁', '卵', '焼き魚'], estimatedCalories: 550, estimatedProtein: 28 },
  { keywords: ['目玉焼き', 'めだまやき'], components: ['卵'], estimatedCalories: 90, estimatedProtein: 6 },
  { keywords: ['スクランブルエッグ'], components: ['卵'], estimatedCalories: 120, estimatedProtein: 8 },
  { keywords: ['オムレツ', 'おむれつ'], components: ['卵'], estimatedCalories: 180, estimatedProtein: 10 },
  { keywords: ['納豆ご飯', 'なっとうごはん'], components: ['白米', '納豆'], estimatedCalories: 380, estimatedProtein: 16 },
  { keywords: ['卵かけご飯', 'たまごかけごはん', 'TKG'], components: ['白米', '卵'], estimatedCalories: 350, estimatedProtein: 14 },
  { keywords: ['おにぎり', 'おむすび', '握り飯'], components: ['白米'], estimatedCalories: 170, estimatedProtein: 3 },
  { keywords: ['おかゆ', 'かゆ', '粥'], components: ['白米'], estimatedCalories: 70, estimatedProtein: 1 },

  // ─── 寿司 ──────────────────────────────────────
  { keywords: ['寿司', 'すし', 'スシ', '握り寿司'], components: ['白米', 'まぐろ', 'サーモン'], estimatedCalories: 400, estimatedProtein: 22 },
  { keywords: ['巻き寿司', 'まきずし', '巻き'], components: ['白米', 'まぐろ', '海苔'], estimatedCalories: 350, estimatedProtein: 16 },
  { keywords: ['手巻き寿司', 'てまきずし'], components: ['白米', 'まぐろ', '海苔'], estimatedCalories: 300, estimatedProtein: 18 },
  { keywords: ['ちらし寿司', 'ちらし'], components: ['白米', 'まぐろ', '卵'], estimatedCalories: 450, estimatedProtein: 20 },

  // ─── ファストフード・外食チェーン ──────────────
  { keywords: ['マクドナルド', 'マック', 'ビッグマック'], components: ['バンズ', '牛肉', 'チーズ'], estimatedCalories: 560, estimatedProtein: 26 },
  { keywords: ['フライドポテト', 'ポテト', 'フライポテト'], components: ['じゃがいも'], estimatedCalories: 320, estimatedProtein: 4 },
  { keywords: ['吉野家', 'よしのや'], components: ['牛肉', '白米', '玉ねぎ'], estimatedCalories: 650, estimatedProtein: 24 },
  { keywords: ['松屋', 'まつや'], components: ['牛肉', '白米', '玉ねぎ'], estimatedCalories: 670, estimatedProtein: 25 },
  { keywords: ['すき家', 'すきや'], components: ['牛肉', '白米', '玉ねぎ'], estimatedCalories: 660, estimatedProtein: 24 },
  { keywords: ['丸亀製麺', 'まるがめ'], components: ['うどん'], estimatedCalories: 310, estimatedProtein: 10 },
  { keywords: ['はなまる'], components: ['うどん'], estimatedCalories: 300, estimatedProtein: 10 },
  { keywords: ['ガスト', 'すかいらーく'], components: ['ハンバーグ', '白米'], estimatedCalories: 700, estimatedProtein: 28 },
  { keywords: ['デニーズ'], components: ['ハンバーグ', '白米'], estimatedCalories: 720, estimatedProtein: 28 },
  { keywords: ['サイゼリヤ', 'サイゼ'], components: ['パスタ'], estimatedCalories: 550, estimatedProtein: 20 },

  // ─── おかず単品 ────────────────────────────────
  { keywords: ['冷奴', 'ひややっこ'], components: ['豆腐'], estimatedCalories: 60, estimatedProtein: 6 },
  { keywords: ['湯豆腐', 'ゆどうふ'], components: ['豆腐'], estimatedCalories: 80, estimatedProtein: 7 },
  { keywords: ['ほうれん草のおひたし', 'おひたし'], components: ['ほうれん草'], estimatedCalories: 25, estimatedProtein: 2 },
  { keywords: ['きんぴらごぼう', 'きんぴら'], components: ['ごぼう', 'にんじん'], estimatedCalories: 90, estimatedProtein: 2 },
  { keywords: ['ひじきの煮物', 'ひじき'], components: ['ひじき', '大豆'], estimatedCalories: 80, estimatedProtein: 4 },
  { keywords: ['ポテトサラダ', 'ぽてとさらだ'], components: ['じゃがいも', 'マヨネーズ'], estimatedCalories: 180, estimatedProtein: 4 },

  // ─── デザート・おやつ ──────────────────────────
  { keywords: ['バナナ', 'ばなな'], components: ['バナナ'], estimatedCalories: 90, estimatedProtein: 1 },
  { keywords: ['ヨーグルト', 'よーぐると'], components: ['ヨーグルト'], estimatedCalories: 60, estimatedProtein: 3 },
  { keywords: ['プロテイン', 'ぷろていん', 'プロテインドリンク'], components: ['プロテイン'], estimatedCalories: 120, estimatedProtein: 25 },
]
