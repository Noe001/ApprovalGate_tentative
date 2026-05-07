# フロントエンド技術スタック

## 採用構成

```
Cloudflare Pages      Supabase
(Vite + React SPA)    ├── Auth（ログイン・セッション・OAuth）
        ↓             ├── Database（Postgres + RLS）
    API呼び出し  →    ├── Edge Functions（SDK API・Slack Webhook）
                      └── Realtime（承認ステータスのリアルタイム更新）
```

---

## 選定理由

| 観点 | 内容 |
|------|------|
| コスト | Cloudflare Pages は無料。Supabase は無料枠で始め、成長後に $25/月 |
| 開発速度 | Supabase に Auth・DB・API・Realtime が集約されており、別途バックエンドサービスが不要 |
| 型安全 | `supabase gen types typescript` でDB定義からTypeScript型を自動生成 |
| SSR不要 | B2B SaaS ダッシュボードは認証後のみ表示されるため、SSR による SEO 優位性は不要 |

---

## 採用技術一覧

| カテゴリ | 採用技術 | 理由 |
|---------|---------|------|
| ビルドツール | **Vite 6** | 高速な開発サーバー、シンプルな設定 |
| UIフレームワーク | **React 19** | — |
| 言語 | **TypeScript 5.x** | 型安全なAPI通信、コード補完 |
| ルーティング | **TanStack Router** | ファイルベースルーティング、型安全なパラメータ |
| スタイリング | **Tailwind CSS v4** | ユーティリティクラスで仕様書の色定義・レスポンシブを直接実装 |
| UIコンポーネント | **shadcn/ui** | Radix UI + Tailwind のコピーペーストコンポーネント。アクセシビリティ対応済み |
| サーバー状態管理 | **TanStack Query v5** | キャッシュ・ポーリング・楽観的更新を一元管理 |
| クライアント状態管理 | **Zustand** | モーダル開閉・選択状態などUIの一時状態のみ管理 |
| フォーム | **React Hook Form + Zod** | バリデーションを型と一体で定義 |
| 認証 | **Supabase Auth** | セッション・Google OAuth・JWT をSupabaseが担う |
| DBクライアント | **Supabase JS Client** | RLSポリシーが自動適用される |
| バックエンドAPI | **Supabase Edge Functions**（Deno） | SDK API・Slack Webhook受信・ルールエンジン |
| DnD（ルール並び替え） | **@dnd-kit/sortable** | ルール一覧のドラッグ&ドロップ |
| 日付処理 | **date-fns + date-fns-tz** | テナントTZ対応の日付フォーマット・相対表示 |
| チャート | **Recharts** | アナリティクスページの折れ線・ドーナツ・棒グラフ |
| トースト通知 | **Sonner** | shadcn/ui と統合済み |
| アイコン | **Lucide React** | shadcn/ui が標準で使用するアイコンセット |

---

## ディレクトリ構成

```
/
├── src/                              # Vite + React フロントエンド
│   ├── routes/                       # TanStack Router ファイルベースルーティング
│   │   ├── _auth/                    # 認証不要のレイアウトグループ
│   │   │   ├── login.tsx
│   │   │   ├── signup.tsx
│   │   │   ├── forgot-password.tsx
│   │   │   ├── verify-email.tsx
│   │   │   └── invite.$token.tsx
│   │   ├── create-team.tsx           # テナント作成（認証済み・テナントなし）
│   │   └── t.$tenant_id/             # テナントルート（認証済み・テナントあり）
│   │       ├── _layout.tsx           # サイドバー・トップバー共通レイアウト
│   │       ├── dashboard.tsx
│   │       ├── approvals/
│   │       │   ├── index.tsx
│   │       │   └── $request_id.tsx
│   │       ├── projects/
│   │       │   ├── index.tsx
│   │       │   ├── new.tsx
│   │       │   └── $project_id/
│   │       │       ├── index.tsx
│   │       │       └── api-keys.tsx
│   │       ├── rules/
│   │       │   ├── index.tsx
│   │       │   ├── new.tsx
│   │       │   └── $rule_id.edit.tsx
│   │       ├── analytics.tsx
│   │       ├── team.tsx
│   │       └── settings/
│   │           ├── general.tsx
│   │           ├── notifications.tsx
│   │           ├── billing.tsx
│   │           └── account.tsx
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui コンポーネント
│   │   ├── layout/                   # Sidebar, TopBar, Breadcrumb, BottomNav
│   │   ├── approvals/
│   │   ├── projects/
│   │   ├── rules/
│   │   ├── team/
│   │   └── common/                   # EmptyState, StatusBadge, CopyButton 等
│   │
│   ├── lib/
│   │   ├── supabase.ts               # Supabase クライアント初期化
│   │   ├── api.ts                    # Edge Functions 呼び出し用ラッパー
│   │   └── utils/
│   │       ├── date.ts               # テナントTZ対応の日付フォーマット
│   │       └── cn.ts                 # Tailwind クラス結合
│   │
│   ├── hooks/
│   │   ├── use-realtime-approval.ts  # Supabase Realtime で承認ステータス監視
│   │   ├── use-tenant.ts
│   │   └── use-current-user.ts
│   │
│   ├── stores/
│   │   └── ui-store.ts               # Zustand（モーダル・選択状態）
│   │
│   └── types/
│       ├── database.types.ts         # supabase gen types で自動生成
│       └── enums.ts
│
└── supabase/
    ├── functions/                    # Edge Functions（Deno）
    │   ├── sdk-requests/             # POST /sdk/v1/requests
    │   │   └── index.ts
    │   ├── sdk-status/               # GET /sdk/v1/requests/:id/status
    │   │   └── index.ts
    │   ├── slack-interactivity/      # POST /webhooks/slack/interactivity
    │   │   └── index.ts
    │   ├── slack-events/             # POST /webhooks/slack/events
    │   │   └── index.ts
    │   └── stripe-webhook/           # POST /webhooks/stripe
    │       └── index.ts
    │
    └── migrations/                   # DB マイグレーションSQL
        └── 0001_initial.sql
```

---

## 認証フロー

### ルートガード（TanStack Router の `beforeLoad`）

```
リクエスト受信
    ↓
Supabase セッションを確認
    ├── 未認証 → /login にリダイレクト（redirect パラメータに元URLを保存）
    ├── 認証済み・テナントなし → /create-team にリダイレクト
    └── 認証済み・テナントあり → 通常表示
```

`/t/$tenant_id/` へのアクセス時は URL の tenant_id とユーザーの所属テナント一覧を照合する。所属していない場合は NotFound ページを表示。

### ロールアクセス制御

各ルートの `beforeLoad` でロールを確認し、権限不足なら `notFound()` を throw する。

```
/t/$tenant_id/projects → Admin+ でなければ notFound()
/t/$tenant_id/rules    → Admin+ でなければ notFound()
```

---

## データフェッチングパターン

### 通常のデータ取得（TanStack Query）

```typescript
useQuery({
  queryKey: ['approvals', tenantId, filters],
  queryFn: () => supabase
    .from('approval_requests')
    .select('...')
    .eq('tenant_id', tenantId),
  refetchInterval: 30_000,  // 30秒自動リフレッシュ
})
```

### 承認ステータスのリアルタイム監視（Supabase Realtime）

SDKがポーリングする間、Webダッシュボードでも承認待ちリクエストの変化をリアルタイムで受け取る。

```typescript
// use-realtime-approval.ts
useEffect(() => {
  const channel = supabase
    .channel(`approval:${requestId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'approval_requests',
      filter: `id=eq.${requestId}`,
    }, (payload) => {
      queryClient.setQueryData(['approval', requestId], payload.new)
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [requestId])
```

---

## Edge Functions の注意点（Deno環境）

Edge Functions は Node.js ではなく **Deno** で動作する。このプロダクトで影響する箇所：

| 処理 | 対応方法 |
|------|---------|
| HMAC-SHA256（Slack署名検証） | Web Crypto API（`crypto.subtle`）を使用。Node.js の `crypto` モジュールは不要 |
| パスワードハッシュ（bcrypt） | Supabase Auth が担うため Edge Functions では不要 |
| Stripe SDK | `npm:stripe` で Deno から利用可能 |
| Supabase クライアント | `@supabase/supabase-js` は Deno 対応済み |

---

## カラー定義（Tailwind カスタムカラー）

```javascript
// tailwind.config.ts
colors: {
  status: {
    pending:  { DEFAULT: '#F59E0B', bg: '#FEF3C7', text: '#92400E' }, // Amber
    approved: { DEFAULT: '#10B981', bg: '#D1FAE5', text: '#065F46' }, // Green
    rejected: { DEFAULT: '#EF4444', bg: '#FEE2E2', text: '#991B1B' }, // Red
    timeout:  { DEFAULT: '#6B7280', bg: '#F3F4F6', text: '#374151' }, // Gray
    auto:     { DEFAULT: '#3B82F6', bg: '#DBEAFE', text: '#1E40AF' }, // Blue
    error:    { DEFAULT: '#B91C1C', bg: '#FEE2E2', text: '#7F1D1D' }, // Dark Red
  }
}
```

---

## レスポンシブブレークポイント

| ブレークポイント | 幅 | レイアウト |
|-------------|-----|----------|
| `md` | 768px | タブレット。サイドバー折りたたみ開始 |
| `lg` | 1024px | デスクトップ。サイドバー常時表示 |
| `xl` | 1280px | ワイドレイアウト（2カラムパネル等） |

767px 以下ではボトムナビゲーションを表示し、サイドバーを非表示にする。

---

## 環境変数（`.env.local`）

```bash
# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...

# Supabase Edge Functions シークレット（supabase secrets set で設定）
SLACK_SIGNING_SECRET=xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
SLACK_BOT_TOKEN=xoxb-xxx
```

Edge Functions のシークレットは `.env` には書かず、`supabase secrets set KEY=VALUE` コマンドで管理する。

---

## 開発環境セットアップ

```bash
# 依存パッケージインストール
npm install

# shadcn/ui 初期化（初回のみ）
npx shadcn@latest init
npx shadcn@latest add button input select dialog table badge

# Supabase ローカル起動（Docker が必要）
npx supabase start

# DB 型定義を自動生成
npx supabase gen types typescript --local > src/types/database.types.ts

# 開発サーバー起動（フロントエンド）
npm run dev

# Edge Functions ローカル起動（別ターミナル）
npx supabase functions serve
```

---

## ビルド・デプロイ

| 項目 | 設定 |
|------|------|
| フロントエンド | Cloudflare Pages（`npm run build` → `dist/` を配信） |
| Edge Functions | `supabase functions deploy` で Supabase にデプロイ |
| 本番URL | `https://app.ringigate.com`（Cloudflare Pages のカスタムドメイン） |
| プレビューデプロイ | PRごとに Cloudflare Pages が自動でプレビューURLを生成 |
| DB マイグレーション | `supabase db push`（本番適用）|

---

## 月額コスト目安

| フェーズ | Cloudflare Pages | Supabase | 合計 |
|---------|-----------------|---------|------|
| MVP（〜10テナント） | $0 | $0（無料枠） | **$0/月** |
| 初期成長（〜100テナント） | $0 | $25（Pro） | **$25/月** |
| 成長期（〜500テナント） | $0 | $25（Pro） | **$25/月** |
