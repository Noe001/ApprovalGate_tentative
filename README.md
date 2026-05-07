# ApprovalGate（稟議ゲート）

AIエージェントが実行する操作（メール送信・DB更新・外部API呼び出しなど）に対して、**事前承認フローを一元管理**するSaaSシステムです。

- AIエージェントはSDKを通じて承認リクエストを送信し、承認されるまで処理をブロック
- ルールエンジンで条件に合致するリクエストを自動承認・自動拒否
- 人間によるレビューはWebダッシュボードまたはSlack上で操作
- マルチテナント・マルチプロジェクト対応

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React 19 + TypeScript + Vite |
| ルーティング | TanStack Router (ファイルベース) |
| UIコンポーネント | Radix UI + Tailwind CSS |
| バックエンド | Supabase (PostgreSQL + Auth + Edge Functions) |
| Edge Functions | Deno |
| 外部連携 | Slack API |

## ローカル実行手順

### 前提条件

- Node.js 20以上
- Supabase アカウント（[supabase.com](https://supabase.com)）

### 1. リポジトリのクローン

```bash
git clone git@github.com:Noe001/ApprovalGate_tentative.git
cd ApprovalGate_tentative
npm install
```

### 2. Supabaseプロジェクトの作成

1. [Supabase Dashboard](https://supabase.com/dashboard) でプロジェクトを新規作成
2. 以下の値を控える：
   - Project URL（例: `https://xxxx.supabase.co`）
   - `anon` キー（Project Settings > API > Project API keys）
   - `service_role` キー（同上）

### 3. 環境変数の設定

`.env` ファイルをプロジェクトルートに作成：

```env
# --- Frontend (Vite) ---
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>

# --- Edge Functions secrets ---
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
SLACK_SIGNING_SECRET=<your_slack_signing_secret>
```

### 4. データベースのセットアップ

[Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) を開き、以下のマイグレーションファイルを**順番に**実行してください：

```
supabase/migrations/20260506000000_initial.sql
supabase/migrations/20260507000000_fix_approval_requests.sql
supabase/migrations/20260508000000_waitlist_and_cron.sql
supabase/migrations/20260509000000_release_security_fixes.sql
```

> **注意:** `20260508000000_waitlist_and_cron.sql` には `pg_cron` 拡張が必要です。Supabase Dashboard の Database > Extensions から `pg_cron` を有効化してから実行してください。

### 5. メール確認の無効化（開発環境）

Supabase Dashboard > Authentication > Sign In / Providers > User Signups セクションで **「Confirm email」をOFF** にして保存します。

### 6. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開くとログイン画面が表示されます。

## ディレクトリ構成

```
.
├── src/
│   ├── routes/          # TanStack Router ファイルベースルーティング
│   ├── components/      # UIコンポーネント
│   ├── hooks/           # カスタムフック
│   ├── stores/          # Zustand ストア
│   └── lib/             # Supabaseクライアント等
├── supabase/
│   ├── migrations/      # SQLマイグレーションファイル（4本）
│   └── functions/       # Deno Edge Functions
│       ├── sdk-requests/       # AIエージェントからのリクエスト受付
│       ├── sdk-status/         # リクエストステータス取得
│       ├── slack-events/       # Slackイベントwebhook
│       ├── slack-interactivity/ # Slackボタン操作ハンドラ
│       └── process-timeouts/   # タイムアウト処理（cron）
└── sdk/                 # 外部連携用SDK
```

## 初回利用の流れ

1. `/signup` でアカウント作成
2. チーム名とスラッグを入力してチームを作成
3. ダッシュボードへリダイレクト
4. Projects でプロジェクトを作成し、APIキーを発行
5. SDKまたはREST APIでAIエージェントから承認リクエストを送信
