# データモデル

## エンティティ一覧

| エンティティ | テーブル名 | 説明 |
|------------|-----------|------|
| テナント | `tenants` | 契約企業・組織の単位 |
| ユーザー | `users` | システムのアカウント |
| テナントメンバー | `tenant_members` | テナントとユーザーの中間テーブル（ロール情報を持つ） |
| 招待 | `invitations` | 未受諾の招待 |
| プロジェクト | `projects` | AIエージェントアプリの単位 |
| APIキー | `api_keys` | プロジェクト認証用のシークレットキー |
| ルール | `rules` | 承認自動化ルール |
| ルール条件 | `rule_conditions` | ルールの条件（1ルールに複数持てる） |
| 承認リクエスト | `approval_requests` | 承認依頼の1件 |
| 監査ログ | `audit_logs` | すべての操作履歴（変更不可） |
| 通知設定 | `notification_settings` | テナント・ユーザーごとの通知設定 |
| サブスクリプション | `subscriptions` | プラン・請求情報 |

---

## テナント（`tenants`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | テナントID |
| `name` | 文字列 | NOT NULL | 表示名 |
| `slug` | 文字列 | NOT NULL, UNIQUE | URLスラッグ（チームID） |
| `timezone` | 文字列 | NOT NULL, DEFAULT `Asia/Tokyo` | タイムゾーン |
| `default_timeout_seconds` | 整数 | NOT NULL, DEFAULT `1800` | デフォルトタイムアウト（秒） |
| `default_timeout_behavior` | ENUM | NOT NULL, DEFAULT `deny` | `deny` / `allow` |
| `fail_closed` | 真偽値 | NOT NULL, DEFAULT `true` | サービス障害時の動作 |
| `created_at` | タイムスタンプ | NOT NULL | 作成日時 |
| `deleted_at` | タイムスタンプ | NULL | 論理削除日時 |

---

## ユーザー（`users`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | ユーザーID |
| `email` | 文字列 | NOT NULL, UNIQUE | メールアドレス |
| `name` | 文字列 | NOT NULL | 表示名 |
| `avatar_url` | 文字列 | NULL | プロフィール画像URL |
| `email_verified_at` | タイムスタンプ | NULL | メール確認日時（NULLなら未確認） |
| `created_at` | タイムスタンプ | NOT NULL | 作成日時 |
| `deleted_at` | タイムスタンプ | NULL | 論理削除日時（ソフトデリート。30日後に物理削除） |

---

## テナントメンバー（`tenant_members`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | |
| `tenant_id` | ULID | FK → tenants | テナント |
| `user_id` | ULID | FK → users | ユーザー |
| `role` | ENUM | NOT NULL | `owner` / `admin` / `approver` / `viewer` |
| `joined_at` | タイムスタンプ | NOT NULL | 参加日時 |

UNIQUE制約: `(tenant_id, user_id)`

---

## 招待（`invitations`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | |
| `tenant_id` | ULID | FK → tenants | 招待先テナント |
| `inviter_id` | ULID | FK → users | 招待者 |
| `email` | 文字列 | NOT NULL | 招待先メールアドレス |
| `role` | ENUM | NOT NULL | 付与するロール |
| `token` | 文字列 | NOT NULL, UNIQUE | 招待トークン（ハッシュ化して保存） |
| `expires_at` | タイムスタンプ | NOT NULL | 有効期限（発行から7日） |
| `accepted_at` | タイムスタンプ | NULL | 受諾日時 |
| `created_at` | タイムスタンプ | NOT NULL | 作成日時 |

---

## プロジェクト（`projects`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | プロジェクトID |
| `tenant_id` | ULID | FK → tenants | 所属テナント |
| `name` | 文字列 | NOT NULL | プロジェクト名 |
| `description` | 文字列 | NULL | 説明 |
| `default_approver_ids` | ULID配列 | NOT NULL, DEFAULT `[]` | デフォルト承認者 |
| `timeout_seconds` | 整数 | NULL | タイムアウト（NULLでテナント設定を使用） |
| `timeout_behavior` | ENUM | NULL | `deny` / `allow`（NULLでテナント設定を使用） |
| `approver_mode` | ENUM | NOT NULL, DEFAULT `any` | `any`（誰か1人）/ `all`（全員） |
| `is_active` | 真偽値 | NOT NULL, DEFAULT `true` | アクティブ状態 |
| `created_at` | タイムスタンプ | NOT NULL | 作成日時 |
| `deleted_at` | タイムスタンプ | NULL | 論理削除日時 |

---

## APIキー（`api_keys`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | |
| `project_id` | ULID | FK → projects | 所属プロジェクト |
| `name` | 文字列 | NULL | キーの説明名 |
| `key_prefix` | 文字列 | NOT NULL | `rg_live_` または `rg_test_` |
| `key_hash` | 文字列 | NOT NULL, UNIQUE | キーのハッシュ（HMAC-SHA256 with per-key salt、または bcrypt。生のキーは保存しない） |
| `last_four` | 文字列 | NOT NULL | キーの末尾4文字（表示用） |
| `is_test` | 真偽値 | NOT NULL | テストキーか否か |
| `last_used_at` | タイムスタンプ | NULL | 最終使用日時 |
| `revoked_at` | タイムスタンプ | NULL | 失効日時 |
| `created_at` | タイムスタンプ | NOT NULL | 作成日時 |

---

## ルール（`rules`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | |
| `tenant_id` | ULID | FK → tenants | 所属テナント |
| `project_id` | ULID | FK → projects, NULL | 特定プロジェクト限定（NULLはテナント全体） |
| `name` | 文字列 | NOT NULL | ルール名 |
| `order` | 整数 | NOT NULL | 評価順序（小さいほど優先） |
| `action_type` | ENUM | NOT NULL | `auto_approve` / `notify_approver` / `auto_reject` / `escalate` |
| `action_config` | JSON | NOT NULL | アクションの設定（承認者リスト等） |
| `timeout_seconds` | 整数 | NULL | このルール固有のタイムアウト（NULLでプロジェクト設定を使用） |
| `is_active` | 真偽値 | NOT NULL, DEFAULT `true` | 有効/無効 |
| `created_at` | タイムスタンプ | NOT NULL | 作成日時 |
| `updated_at` | タイムスタンプ | NOT NULL | 更新日時 |

UNIQUE制約: `(tenant_id, project_id, order)`（同一スコープ内で順序番号が重複しないよう保証）

---

## ルール条件（`rule_conditions`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | |
| `rule_id` | ULID | FK → rules | 所属ルール |
| `group` | 整数 | NOT NULL | 同じグループ番号の条件はAND評価、グループ間はOR評価 |
| `field` | 文字列 | NOT NULL | 評価対象フィールド（`reason` / `project_name` / `metadata.{key}` 等） |
| `operator` | ENUM | NOT NULL | `contains` / `not_contains` / `equals` / `gt` / `gte` / `lt` / `lte` 等 |
| `value` | 文字列 | NOT NULL | 比較値（数値も文字列として格納し、比較時にキャスト） |

---

## 承認リクエスト（`approval_requests`）

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | リクエストID |
| `project_id` | ULID | FK → projects | 所属プロジェクト |
| `status` | ENUM | NOT NULL | `PENDING` / `APPROVED` / `REJECTED` / `AUTO_APPROVED` / `TIMED_OUT` / `ERROR` |
| `reason` | 文字列 | NOT NULL | アクション名 |
| `description` | 文字列 | NULL | アクション詳細説明 |
| `metadata` | JSON | NOT NULL, DEFAULT `{}` | 追加情報（最大10KB） |
| `approver_mode` | ENUM | NOT NULL, DEFAULT `any` | `any`（OR）/ `all`（AND）|
| `decided_by_id` | ULID | FK → users, NULL | 承認・却下したユーザー（AND モードでは最後に承認したユーザー）。自動処理時はNULL |
| `rejection_reason` | 文字列 | NULL | 却下理由（最大500文字） |
| `applied_rule_id` | ULID | FK → rules, NULL | 自動処理に使用されたルールID |
| `timeout_at` | タイムスタンプ | NULL | タイムアウト日時 |
| `decided_at` | タイムスタンプ | NULL | 決定日時 |
| `created_at` | タイムスタンプ | NOT NULL | リクエスト受信日時 |

**AND モードでの複数承認者の記録**

`decided_by_id` は単一IDのため、ANDモードで複数ユーザーが承認した場合の詳細は `audit_logs` テーブルを参照する（各承認操作が個別に記録される）。

---

## 承認リクエスト担当者（`approval_request_assignees`）

`approval_requests.assignee_ids` はPostgreSQLのネイティブ配列型（`uuid[]`）を使用する。Supabase RLSポリシーで `auth.uid() = ANY(assignee_ids)` の条件を付与することで、Approverは自分が担当するリクエストのみ参照できる。

**代替設計（スケール時）**: リクエスト数が大規模になった場合、別テーブルへの正規化を検討する。

```
approval_request_assignees
  ├── request_id (FK → approval_requests)
  └── user_id    (FK → users)
  UNIQUE: (request_id, user_id)
```

---

## 監査ログ（`audit_logs`）

変更不可のイミュータブルなテーブル。

| カラム名 | 型 | 制約 | 説明 |
|---------|-----|------|------|
| `id` | ULID | PK | |
| `tenant_id` | ULID | NOT NULL | 所属テナント |
| `actor_id` | ULID | NULL | 操作者（systemはNULL） |
| `actor_type` | ENUM | NOT NULL | `user` / `system` |
| `action` | 文字列 | NOT NULL | 操作種別（下記一覧参照） |

**`action` フィールドの値**

| 値 | 説明 |
|----|------|
| `request.created` | リクエスト受信 |
| `request.approved` | 人間による承認 |
| `request.rejected` | 人間による却下 |
| `request.auto_approved` | ルールによる自動承認 |
| `request.auto_rejected` | ルールによる自動却下 |
| `request.timed_out` | タイムアウト処理 |
| `request.escalated` | エスカレーション |
| `request.reprocessed` | ERRORからの再処理 |
| `member.invited` | メンバー招待 |
| `member.role_changed` | ロール変更 |
| `member.removed` | メンバー削除 |
| `project.created` | プロジェクト作成 |
| `project.deleted` | プロジェクト削除 |
| `api_key.issued` | APIキー発行 |
| `api_key.revoked` | APIキー失効 |
| `rule.created` | ルール作成 |
| `rule.updated` | ルール更新 |
| `rule.deleted` | ルール削除 |
| `resource_type` | 文字列 | NOT NULL | 操作対象の種別（例: `approval_request`） |
| `resource_id` | ULID | NOT NULL | 操作対象のID |
| `before` | JSON | NULL | 変更前の状態（変更操作の場合） |
| `after` | JSON | NULL | 変更後の状態（変更操作の場合） |
| `ip_address` | 文字列 | NULL | 操作者のIPアドレス |
| `channel` | ENUM | NOT NULL | `web` / `slack` / `line_works` / `api` / `system` |
| `created_at` | タイムスタンプ | NOT NULL | 操作日時 |

---

## エンティティ関連図（簡略版）

```
tenants
  ├── tenant_members (ユーザーとの多対多)
  ├── invitations
  ├── projects
  │    ├── api_keys
  │    ├── rules
  │    │    └── rule_conditions
  │    └── approval_requests
  └── audit_logs

users
  └── tenant_members (テナントとの多対多)
```

---

## インデックス推奨

パフォーマンスに影響する主要なクエリに対して以下のインデックスを推奨する。

| テーブル | インデックス対象カラム | 理由 |
|---------|---------------------|------|
| `approval_requests` | `(project_id, status, created_at DESC)` | 承認待ち一覧・プロジェクト別フィルターの高速化 |
| `approval_requests` | `(assignee_ids)` GINインデックス | 担当承認者での絞り込み |
| `approval_requests` | `timeout_at` | タイムアウト処理バッチジョブの対象レコード特定 |
| `audit_logs` | `(tenant_id, created_at DESC)` | 監査ログ一覧・テナント別取得 |
| `audit_logs` | `(resource_type, resource_id)` | リクエスト詳細ページのタイムライン取得 |
| `api_keys` | `key_hash` | APIリクエスト認証（毎リクエスト実行） |
| `rules` | `(tenant_id, project_id, is_active, order)` | ルール評価エンジンの実行順序取得 |
