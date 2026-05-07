# SDK/Adapter統合仕様

## 概要

稟議ゲート（仮）SDK/Adapterは、AIエージェントの危険なツール実行を稟議ゲート（仮）の承認・監査フローへ接続するためのライブラリ。SDKは導入手段であり、差別化の本体は承認UI、監査ログ、通知運用、権限分離にある。

Phase 1 MVPではPython・TypeScriptの両方を同時に作らない。Phase 0の10社ヒアリングで利用比率を確認し、最初の1言語に絞る。この仕様書は両言語対応時の完成形を含む。

---

## 対応言語・バージョン（完成形）

| 言語 | 対応バージョン |
|------|-------------|
| Python | 3.9以上 |
| TypeScript / Node.js | Node.js 18以上 |

---

## インストール

### Python

パッケージ名: `ringi-gate`  
インストールコマンド: `pip install ringi-gate`

### TypeScript / Node.js

パッケージ名: `@ringi-gate/sdk`  
インストールコマンド: `npm install @ringi-gate/sdk`

---

## 初期設定

### 必須の環境変数

| 変数名 | 説明 |
|--------|------|
| `RINGI_GATE_API_KEY` | プロジェクトのAPIキー（`rg_live_...` または `rg_test_...`） |

### オプションの環境変数

| 変数名 | デフォルト値 | 説明 |
|--------|-------------|------|
| `RINGI_GATE_BASE_URL` | `https://api.ringigate.com` | API接続先（セルフホスト時に変更） |
| `RINGI_GATE_TIMEOUT_SECONDS` | `1800`（30分） | SDK/Adapterがポーリングを続ける最大秒数 |
| `RINGI_GATE_FAIL_BEHAVIOR` | `deny` | サービス障害時の動作: `deny` / `allow` |

---

## デコレータのパラメータ（`@approval_required`）

### 必須パラメータ

| パラメータ名 | 型 | 説明 |
|------------|-----|------|
| `reason` | 文字列 | アクションの名称。通知に表示される（例: `"メール送信"`） |

### オプションパラメータ

| パラメータ名 | 型 | デフォルト | 説明 |
|------------|-----|-----------|------|
| `description` | 文字列 | なし | アクションの詳細説明。通知に補足として表示される |
| `metadata` | 辞書/オブジェクト | `{}` | 承認判断に役立つ追加情報。ルールエンジンの条件評価にも使用される（最大10KB） |
| `timeout` | 整数（秒） | プロジェクト設定値 | このアクション固有のタイムアウト秒数 |
| `on_timeout` | 文字列 | プロジェクト設定値 | タイムアウト時の動作: `"deny"` / `"allow"` |
| `approvers` | 文字列リスト | プロジェクト設定値 | 承認者のメールアドレスリスト（このアクション固有の承認者を指定する場合）。存在しないメールアドレスはエラーになる |
| `approver_mode` | 文字列 | プロジェクト設定値 | `"any"`（いずれか1人）/ `"all"`（全員承認が必要）。`approvers` を指定した場合に有効 |

### `metadata` の推奨キー名

ルールエンジンが標準的に認識するキー名。任意のキーも使用できるが、以下を使うとテンプレートルールが自動適用される。

| キー名 | 型 | 説明 |
|--------|-----|------|
| `amount` | 数値 | 金額・数量。「高額アクション承認」テンプレートルールで使用 |
| `recipient_email` | 文字列 | メール送信先アドレス |
| `recipient_count` | 整数 | 送信先件数 |
| `target_resource` | 文字列 | 操作対象のリソース名（例: `"users_table"`） |
| `operation_type` | 文字列 | 操作の種類（例: `"delete"`, `"update"`, `"send"`） |

---

## SDK/Adapter動作の詳細

### 承認フローの開始から終了まで

1. デコレータが付いた関数が呼ばれると、実際の関数本体の実行を一時停止
2. 稟議ゲート（仮）APIにリクエストを送信
3. リクエストIDを受け取る
4. 1秒ごとにAPIをポーリングして結果を確認
5. 結果が `APPROVED` → 関数本体を実行して戻り値を返す
6. 結果が `REJECTED` → `ApprovalDeniedException` を発生させる
7. タイムアウト → `on_timeout` の設定に従い、実行または例外発生

**非同期関数のサポート**: Python の `async def` 関数および TypeScript の `async function` にも同様のデコレータが適用可能。内部のポーリングも非同期（`await` ベース）で実行されるため、イベントループをブロックしない。

### 例外クラス

| 例外クラス名 | 発生条件 |
|------------|---------|
| `ApprovalDeniedException` | リクエストが却下されたとき |
| `ApprovalTimeoutException` | タイムアウトし、`on_timeout="deny"` のとき |
| `ApprovalServiceException` | 稟議ゲート（仮）APIに接続できず、`RINGI_GATE_FAIL_BEHAVIOR="deny"` のとき |

---

## テストモード

APIキーとして `rg_test_...` を使用すると、テストモードで動作する。

| テストモードの動作 |
|----------------|
| リクエストはDBに記録されるが、Slack/LINE WORKS/Teamsには通知が送られない |
| ダッシュボードのテスト用セクションで確認できる |
| 承認・却下は手動でAPIを叩くか、テストダッシュボードから行う |
| 自動承認ルールは通常どおり動作する |

---

## ローカル開発用のモック

稼働中の稟議ゲート（仮）サービスに接続せずにローカルでテストするための設定。

環境変数 `RINGI_GATE_MOCK_MODE=auto_approve` を設定すると:
- すべてのアクションが即時自動承認される
- APIへの通信は発生しない
- ログに `[MOCK MODE]` プレフィックスで記録される

`RINGI_GATE_MOCK_MODE=auto_deny` で全拒否モックも可能。

**テストモード（テストキー）とモックモードの使い分けは `16_system_behavior.md` セクション5「テストモードの使い分け」を参照。**

---

## 対応エージェントフレームワーク

デコレータを任意のPython/TypeScript関数に付けるだけで動作するため、原則すべてのフレームワークで動作する。代表的なフレームワークでの動作確認状況:

| フレームワーク | 動作確認 |
|--------------|---------|
| LangGraph / LangChain | Phase 1の最優先サンプル候補。ネイティブinterruptを補完するUI/監査として接続 |
| OpenAI Agents SDK | Phase 1の最優先サンプル候補。tool approvalと共存するAdapterを検証 |
| CrewAI | 顧客需要確認後にサンプル追加 |
| Anthropic Claude（tool use） | 顧客需要確認後にサンプル追加 |
| AutoGen | 顧客需要確認後にサンプル追加 |

---

## Webhook（Phase 1後半〜Phase 2候補）

### Webhookの登録

プロジェクト設定でWebhook URLを登録。承認・却下・タイムアウト時にHTTP POSTを送信する。

### Webhookペイロードのフィールド

| フィールド | 型 | 説明 |
|-----------|-----|------|
| `request_id` | 文字列 | リクエストID |
| `status` | 文字列 | `APPROVED` / `REJECTED` / `TIMED_OUT` |
| `reason` | 文字列 | 元のアクション名 |
| `decided_at` | 文字列 | 決定日時（ISO 8601形式） |
| `decided_by` | 文字列 | 承認者のメールアドレス（自動処理の場合は `"system"`） |
| `rejection_reason` | 文字列 | 却下理由（却下の場合のみ） |
| `metadata` | オブジェクト | 元のリクエストのメタデータ |

### Webhookの署名検証

- ペイロードのHMAC-SHA256署名をHTTPヘッダー `X-RingiGate-Signature` に付与
- プロジェクト設定で発行するWebhookシークレットを使用して検証
- 署名が一致しない場合はリクエストを無視することを推奨
