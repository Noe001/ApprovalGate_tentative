# APIエンドポイント仕様

## 基本設計

### ベースURL

| 用途 | ベースURL |
|------|----------|
| Webダッシュボード用API | `https://api.ringigate.com/web/v1` |
| SDK用API | `https://api.ringigate.com/sdk/v1` |
| Slack Webhook受信 | `https://api.ringigate.com/webhooks` |

---

### 認証方式

| API種別 | 認証方式 |
|--------|---------|
| Webダッシュボード用 | セッションクッキー（`ringigate_session`）または Bearer JWT |
| SDK用 | `Authorization: Bearer rg_live_xxxxx`（APIキー） |
| Slack Webhook | `X-Slack-Signature` HMAC-SHA256検証 |

---

### 共通レスポンス形式

**成功（単一リソース）**
```json
{
  "data": { ... }
}
```

**成功（リスト）**
```json
{
  "data": [ ... ],
  "pagination": {
    "cursor": "01HXXXXX",
    "has_more": true,
    "total": 142
  }
}
```

**エラー**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "プロジェクト名は2文字以上で入力してください",
    "details": {
      "field": "name",
      "constraint": "min_length",
      "min": 2
    }
  }
}
```

### エラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|--------------|------|
| `UNAUTHORIZED` | 401 | 未認証 |
| `FORBIDDEN` | 404 | 権限不足（Not Foundとして返す） |
| `NOT_FOUND` | 404 | リソースが存在しない |
| `VALIDATION_ERROR` | 422 | 入力値が不正 |
| `DUPLICATE_ERROR` | 409 | 重複（メール・スラッグ等） |
| `RATE_LIMITED` | 429 | レート制限超過 |
| `PLAN_LIMIT_EXCEEDED` | 403 | プラン上限到達 |
| `APPROVAL_DENIED` | 403 | SDKへの却下応答 |
| `APPROVAL_TIMEOUT` | 408 | SDKへのタイムアウト応答 |
| `SERVICE_UNAVAILABLE` | 503 | サービス障害（fail-closed） |
| `CYCLIC_ESCALATION_DETECTED` | 422 | ルール設定でエスカレーションの循環を検出 |
| `IMMUTABLE_FIELD` | 422 | 変更不可フィールドへの変更を試みた（slug等） |
| `INTERNAL_ERROR` | 500 | 内部エラー |

### ページネーション

- リスト系エンドポイントはカーソルベースページネーション
- クエリパラメータ: `?cursor=01HXXXXX&limit=20`（limitデフォルト: 20・最大: 100）

---

## 認証エンドポイント

### POST `/auth/signup`

新規アカウント作成。

**リクエスト**
```json
{
  "name": "田中 太郎",
  "email": "tanaka@example.com",
  "password": "SecurePass123"
}
```

**レスポンス** `201 Created`
```json
{
  "data": {
    "user_id": "01HXXXXX",
    "email": "tanaka@example.com",
    "email_verified": false
  }
}
```

---

### POST `/auth/login`

ログイン。セッションクッキーを設定する。

**リクエスト**
```json
{
  "email": "tanaka@example.com",
  "password": "SecurePass123",
  "totp_code": "123456"
}
```
`totp_code` は2FA有効時のみ必須。

**レスポンス** `200 OK`
```json
{
  "data": {
    "user_id": "01HXXXXX",
    "name": "田中 太郎",
    "email": "tanaka@example.com",
    "tenants": [
      { "tenant_id": "01HYYYYY", "name": "Acme Corp", "role": "owner" }
    ]
  }
}
```

---

### POST `/auth/logout`

セッション削除。

**レスポンス** `204 No Content`

---

### POST `/auth/forgot-password`

パスワードリセットメールを送信。

**リクエスト**
```json
{ "email": "tanaka@example.com" }
```

**レスポンス** `200 OK`（メールアドレスの存在有無を返さない）

---

### POST `/auth/reset-password`

パスワードリセット実行。

**リクエスト**
```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePass456"
}
```

**レスポンス** `200 OK`

---

### GET `/auth/verify-email`

メール確認リンクのトークン検証。

**クエリパラメータ** `?token=xxxxx`

**レスポンス** `302 Redirect → /t/:tenant_id/dashboard`（確認成功）

---

### POST `/auth/resend-verification`

確認メールを再送信。

**レスポンス** `200 OK`（1分クールダウン中は `429` を返す）

---

### GET `/auth/google`

Google OAuth開始。`302 Redirect → Google認証画面`

---

### GET `/auth/google/callback`

Google OAuthコールバック。`302 Redirect → /t/:tenant_id/dashboard`

---

## テナントエンドポイント

### POST `/web/v1/tenants`

テナント（組織）を新規作成。

**リクエスト**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

**レスポンス** `201 Created`
```json
{
  "data": {
    "tenant_id": "01HXXXXX",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "created_at": "2026-05-06T09:00:00Z"
  }
}
```

---

### GET `/web/v1/tenants/:tenant_id`

テナント情報を取得。

**レスポンス** `200 OK`
```json
{
  "data": {
    "tenant_id": "01HXXXXX",
    "name": "Acme Corp",
    "slug": "acme-corp",
    "timezone": "Asia/Tokyo",
    "default_timeout_seconds": 1800,
    "default_timeout_behavior": "deny",
    "fail_closed": true
  }
}
```

---

### PATCH `/web/v1/tenants/:tenant_id`

テナント設定を更新。Owner のみ。

**リクエスト**（変更するフィールドのみ送信）
```json
{
  "name": "Acme Corp (Updated)",
  "timezone": "America/New_York",
  "default_timeout_seconds": 3600
}
```

`slug` フィールドは変更不可。送信した場合は `IMMUTABLE_FIELD` エラーを返す。

**レスポンス** `200 OK`

---

### DELETE `/web/v1/tenants/:tenant_id`

テナントを削除（ソフトデリート）。Owner のみ。確認用の `name` フィールドを送ること。

**リクエスト**
```json
{ "confirm_name": "Acme Corp" }
```

**レスポンス** `204 No Content`

---

## メンバーエンドポイント

### GET `/web/v1/tenants/:tenant_id/members`

メンバー一覧を取得。

**レスポンス** `200 OK`
```json
{
  "data": [
    {
      "user_id": "01HXXXXX",
      "name": "田中 太郎",
      "email": "tanaka@example.com",
      "role": "owner",
      "last_login_at": "2026-05-05T10:00:00Z",
      "joined_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### PATCH `/web/v1/tenants/:tenant_id/members/:user_id`

メンバーのロールを変更。

**リクエスト**
```json
{ "role": "admin" }
```

**レスポンス** `200 OK`

---

### DELETE `/web/v1/tenants/:tenant_id/members/:user_id`

メンバーをテナントから削除。

**レスポンス** `204 No Content`

---

## 招待エンドポイント

### POST `/web/v1/tenants/:tenant_id/invitations`

招待メールを送信。

**リクエスト**
```json
{
  "emails": ["yamamoto@example.com", "inoue@example.com"],
  "role": "approver"
}
```

**レスポンス** `201 Created`
```json
{
  "data": {
    "sent": ["yamamoto@example.com", "inoue@example.com"],
    "skipped": []
  }
}
```
`skipped` には既にメンバーのアドレスが入る。

---

### GET `/web/v1/tenants/:tenant_id/invitations`

招待中の一覧を取得。

---

### DELETE `/web/v1/tenants/:tenant_id/invitations/:invitation_id`

招待を取消。

**レスポンス** `204 No Content`

---

### POST `/web/v1/tenants/:tenant_id/invitations/:invitation_id/resend`

招待を再送信（トークンを再発行）。

**レスポンス** `200 OK`

---

### GET `/invitations/:token`

招待トークンの内容を確認（認証不要）。

**レスポンス** `200 OK`
```json
{
  "data": {
    "tenant_name": "Acme Corp",
    "inviter_name": "田中 太郎",
    "role": "approver",
    "email": "yamamoto@example.com",
    "expires_at": "2026-05-13T09:00:00Z"
  }
}
```

---

### POST `/invitations/:token/accept`

招待を受諾してテナントに参加。

**リクエスト**（既存アカウントがない場合）
```json
{
  "name": "山本 三郎",
  "password": "NewPass789"
}
```
既存アカウントがある場合はリクエストボディ不要（ログイン済みセッションから判断）。

**レスポンス** `200 OK`
```json
{
  "data": {
    "tenant_id": "01HXXXXX",
    "redirect_to": "/t/01HXXXXX/dashboard"
  }
}
```

---

## プロジェクトエンドポイント

### GET `/web/v1/tenants/:tenant_id/projects`

プロジェクト一覧。Admin+ のみ。

**レスポンス** `200 OK`
```json
{
  "data": [
    {
      "project_id": "01HXXXXX",
      "name": "marketing-agent",
      "description": "マーケティング自動化エージェント",
      "is_active": true,
      "pending_count": 3,
      "monthly_count": 47,
      "created_at": "2026-01-15T00:00:00Z"
    }
  ]
}
```

---

### POST `/web/v1/tenants/:tenant_id/projects`

プロジェクトを新規作成。

**リクエスト**
```json
{
  "name": "marketing-agent",
  "description": "マーケティング自動化エージェント",
  "default_approver_ids": ["01HXXXXX"],
  "timeout_seconds": 1800,
  "timeout_behavior": "deny"
}
```

**レスポンス** `201 Created`

---

### GET `/web/v1/tenants/:tenant_id/projects/:project_id`

プロジェクト詳細。

---

### PATCH `/web/v1/tenants/:tenant_id/projects/:project_id`

プロジェクトを更新。

---

### DELETE `/web/v1/tenants/:tenant_id/projects/:project_id`

プロジェクトを削除（ソフトデリート）。

**リクエスト**
```json
{ "confirm_name": "marketing-agent" }
```

**レスポンス** `204 No Content`

---

## APIキーエンドポイント

### GET `/web/v1/tenants/:tenant_id/projects/:project_id/api-keys`

APIキー一覧（ハッシュ・末尾4文字のみ表示。フルキーは返さない）。

**レスポンス** `200 OK`
```json
{
  "data": [
    {
      "key_id": "01HXXXXX",
      "name": "本番キー",
      "prefix": "rg_live_",
      "last_four": "ab12",
      "is_test": false,
      "last_used_at": "2026-05-05T10:00:00Z",
      "created_at": "2026-01-15T00:00:00Z",
      "revoked_at": null
    }
  ]
}
```

---

### POST `/web/v1/tenants/:tenant_id/projects/:project_id/api-keys`

APIキーを発行。**フルキーはこのレスポンスでのみ返る。**

**リクエスト**
```json
{
  "name": "本番キー",
  "is_test": false
}
```

**レスポンス** `201 Created`
```json
{
  "data": {
    "key_id": "01HXXXXX",
    "full_key": "rg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "name": "本番キー",
    "is_test": false,
    "created_at": "2026-05-06T09:00:00Z"
  }
}
```

---

### DELETE `/web/v1/tenants/:tenant_id/projects/:project_id/api-keys/:key_id`

APIキーを失効（即時・不可逆）。

**レスポンス** `204 No Content`

---

## ルールエンドポイント

### GET `/web/v1/tenants/:tenant_id/rules`

ルール一覧。クエリパラメータ `?project_id=xxx` でプロジェクト限定。

**レスポンス** `200 OK`
```json
{
  "data": [
    {
      "rule_id": "01HXXXXX",
      "name": "DB操作は管理者へ",
      "order": 1,
      "is_active": true,
      "action_type": "escalate",
      "action_config": {
        "escalate_to": ["01HYYYYY"],
        "wait_minutes": 15
      },
      "conditions": [
        {
          "condition_id": "01HZZZZZ",
          "group": 1,
          "field": "reason",
          "operator": "contains",
          "value": "DB削除"
        }
      ]
    }
  ]
}
```

---

### POST `/web/v1/tenants/:tenant_id/rules`

ルールを新規作成。

**リクエスト**
```json
{
  "name": "少額は自動承認",
  "project_id": null,
  "order": 2,
  "action_type": "auto_approve",
  "action_config": {},
  "timeout_seconds": null,
  "conditions": [
    {
      "group": 1,
      "field": "metadata.amount",
      "operator": "lte",
      "value": "5000"
    }
  ]
}
```

**レスポンス** `201 Created`

---

### PATCH `/web/v1/tenants/:tenant_id/rules/:rule_id`

ルールを更新。

---

### DELETE `/web/v1/tenants/:tenant_id/rules/:rule_id`

ルールを削除。

**レスポンス** `204 No Content`

---

### POST `/web/v1/tenants/:tenant_id/rules/reorder`

ルールの順序を一括更新。

**リクエスト**
```json
{
  "order": ["01HXXXXX", "01HYYYYY", "01HZZZZZ"]
}
```
配列のインデックス順に `order` が 1, 2, 3 ... と設定される。

**レスポンス** `200 OK`

---

### POST `/web/v1/tenants/:tenant_id/rules/:rule_id/test`

ルールをドライランでテスト。

**リクエスト**
```json
{
  "reason": "メール送信",
  "metadata": { "amount": 3000 }
}
```

**レスポンス** `200 OK`
```json
{
  "data": {
    "matched": true,
    "matched_condition": "metadata.amount <= 5000",
    "action": "auto_approve"
  }
}
```

---

## 承認リクエストエンドポイント（Webダッシュボード）

### GET `/web/v1/tenants/:tenant_id/approval-requests`

承認リクエスト一覧。

**クエリパラメータ**

| パラメータ | 説明 |
|-----------|------|
| `status` | `PENDING` / `APPROVED` / `REJECTED` / `AUTO_APPROVED` / `TIMED_OUT` / `ERROR` |
| `project_id` | プロジェクトで絞り込み |
| `assignee_id` | 担当承認者で絞り込み（Admin+のみ） |
| `from` | 期間開始（ISO 8601） |
| `to` | 期間終了（ISO 8601） |
| `q` | キーワード検索 |
| `is_test` | `true` / `false` / 未指定（すべて） |
| `cursor` | ページネーションカーソル |
| `limit` | 件数（デフォルト20） |

**レスポンス** `200 OK`
```json
{
  "data": [
    {
      "request_id": "01HXXXXX",
      "status": "PENDING",
      "reason": "メール送信",
      "description": "顧客へのキャンペーン通知",
      "project": { "project_id": "01HYYYYY", "name": "marketing-agent" },
      "assignees": [{ "user_id": "01HZZZZZ", "name": "田中 太郎" }],
      "timeout_at": "2026-05-06T09:30:00Z",
      "is_test": false,
      "created_at": "2026-05-06T09:00:00Z"
    }
  ],
  "pagination": { "cursor": "01HXXXXX", "has_more": true, "total": 47 }
}
```

---

### GET `/web/v1/tenants/:tenant_id/approval-requests/:request_id`

承認リクエスト詳細（メタデータ・タイムライン含む）。

**レスポンス** `200 OK`
```json
{
  "data": {
    "request_id": "01HXXXXX",
    "status": "PENDING",
    "reason": "メール送信",
    "description": "顧客へのキャンペーン通知",
    "metadata": {
      "recipient_email": "customers@list.csv",
      "subject": "新機能リリースのご案内",
      "recipient_count": 234
    },
    "project": { "project_id": "01HYYYYY", "name": "marketing-agent" },
    "assignees": [{ "user_id": "01HZZZZZ", "name": "田中 太郎" }],
    "applied_rule": null,
    "timeout_at": "2026-05-06T09:30:00Z",
    "is_test": false,
    "created_at": "2026-05-06T09:00:00Z",
    "timeline": [
      { "event": "created", "at": "2026-05-06T09:00:00Z", "actor": null },
      { "event": "notified", "channel": "slack", "user": "田中 太郎", "at": "2026-05-06T09:00:05Z" }
    ]
  }
}
```

---

### POST `/web/v1/tenants/:tenant_id/approval-requests/:request_id/approve`

リクエストを承認。

**リクエスト**（ボディ不要）

**レスポンス** `200 OK`

---

### POST `/web/v1/tenants/:tenant_id/approval-requests/:request_id/reject`

リクエストを却下。

**リクエスト**
```json
{ "reason": "対象リストに誤りがあります" }
```
`reason` は任意。最大500文字。

**レスポンス** `200 OK`

---

### POST `/web/v1/tenants/:tenant_id/approval-requests/:request_id/escalate`

リクエストをエスカレーション。

**リクエスト**
```json
{ "escalate_to_user_id": "01HXXXXX" }
```

**レスポンス** `200 OK`

---

### POST `/web/v1/tenants/:tenant_id/approval-requests/:request_id/reprocess`

ERROR 状態のリクエストを PENDING に戻して再処理。Admin+ のみ。

**レスポンス** `200 OK`

---

### POST `/web/v1/tenants/:tenant_id/approval-requests/bulk-approve`

複数リクエストを一括承認。

**リクエスト**
```json
{ "request_ids": ["01HXXXXX", "01HYYYYY"] }
```

**レスポンス** `200 OK`
```json
{
  "data": {
    "approved": ["01HXXXXX"],
    "skipped": ["01HYYYYY"]
  }
}
```
`skipped` には承認待ち以外のリクエストIDが入る。

---

### POST `/web/v1/tenants/:tenant_id/approval-requests/bulk-reject`

複数リクエストを一括却下。

**リクエスト**
```json
{
  "request_ids": ["01HXXXXX", "01HYYYYY"],
  "reason": "一括却下"
}
```

---

## アナリティクスエンドポイント

### GET `/web/v1/tenants/:tenant_id/analytics/summary`

KPIカード用サマリー。

**クエリパラメータ** `?period=7d` (`1d` / `7d` / `30d` / `90d`)

**レスポンス** `200 OK`
```json
{
  "data": {
    "total_requests": 142,
    "approval_rate": 0.982,
    "avg_response_seconds": 392,
    "auto_approval_rate": 0.43,
    "previous_period": {
      "total_requests": 130,
      "approval_rate": 0.969
    }
  }
}
```

---

### GET `/web/v1/tenants/:tenant_id/analytics/requests-over-time`

リクエスト推移グラフデータ。

**クエリパラメータ** `?period=30d&project_id=xxx`

---

### GET `/web/v1/tenants/:tenant_id/analytics/approver-performance`

承認者別パフォーマンステーブル。

---

### GET `/web/v1/tenants/:tenant_id/analytics/export`

CSVエクスポート。`Content-Type: text/csv` で返す。

**クエリパラメータ** `?from=2026-01-01&to=2026-05-06`

---

## 通知設定エンドポイント

### GET `/web/v1/tenants/:tenant_id/settings/notifications`

通知チャネル連携状態を取得。Phase 1ではSlackのみを実装し、LINE WORKS/TeamsはPhase 1.5候補として返せる構造を維持する。

**レスポンス** `200 OK`
```json
{
  "data": {
    "slack": {
      "connected": true,
      "workspace_name": "Acme Corp",
      "channel": "#approvals"
    },
    "line_works": { "connected": false, "status": "waitlist" },
    "teams": { "connected": false, "status": "future_candidate" }
  }
}
```

---

### DELETE `/web/v1/tenants/:tenant_id/settings/notifications/slack`

Slack連携を解除。

**レスポンス** `204 No Content`

---

### GET `/web/v1/slack/oauth/start`

Slack OAuth フロー開始。`302 Redirect → Slack認証画面`

---

### POST `/web/v1/tenants/:tenant_id/settings/notifications/slack/test`

テスト通知を送信。

**レスポンス** `200 OK`

---

### GET `/web/v1/users/me/notification-preferences`

個人通知設定を取得。

### PATCH `/web/v1/users/me/notification-preferences`

個人通知設定を更新。

**リクエスト**
```json
{
  "email_frequency": "immediate",
  "slack_enabled": true,
  "reminder_enabled": true
}
```

---

## アカウントエンドポイント

### GET `/web/v1/users/me`

自分のプロフィールを取得。

### PATCH `/web/v1/users/me`

プロフィールを更新（name, avatar）。

### POST `/web/v1/users/me/2fa/setup`

2FA設定開始。QRコード用シークレットを返す。

**レスポンス** `200 OK`
```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qr_url": "data:image/png;base64,..."
  }
}
```

### POST `/web/v1/users/me/2fa/confirm`

2FA設定を確認・有効化。バックアップコードを返す（1回のみ）。

**リクエスト**
```json
{ "totp_code": "123456" }
```

**レスポンス** `200 OK`
```json
{
  "data": {
    "backup_codes": ["AAAA-BBBB", "CCCC-DDDD", "..."]
  }
}
```

### DELETE `/web/v1/users/me/2fa`

2FAを無効化。

**リクエスト**
```json
{ "totp_code": "123456" }
```

### GET `/web/v1/users/me/sessions`

アクティブセッション一覧。

### DELETE `/web/v1/users/me/sessions/:session_id`

特定セッションを無効化。

---

## SDK/Adapter/API連携用エンドポイント

AIエージェント連携用エンドポイント。認証はAPIキー（`Authorization: Bearer rg_live_xxxxx`）。

---

### POST `/sdk/v1/requests`

承認リクエストを作成（SDK/Adapterまたは直接APIからの呼び出し）。

**リクエスト**
```json
{
  "reason": "メール送信",
  "description": "顧客へのキャンペーン通知",
  "metadata": {
    "recipient_email": "customers@list.csv",
    "recipient_count": 234
  },
  "timeout": 1800,
  "on_timeout": "deny",
  "approvers": ["tanaka@example.com"],
  "approver_mode": "any"
}
```

`approvers` はメールアドレスで指定し、内部でユーザーIDに変換される。存在しないメールアドレスを指定した場合は `VALIDATION_ERROR` を返す。  
`approver_mode` は `"any"`（デフォルト）または `"all"`。`approvers` 省略時はプロジェクト設定値を使用。  
`metadata` は最大10KB。超過した場合は `VALIDATION_ERROR`（`constraint: "max_size"`）を返す。

**レスポンス** `202 Accepted`
```json
{
  "data": {
    "request_id": "01HXXXXX",
    "status": "PENDING",
    "timeout_at": "2026-05-06T09:30:00Z"
  }
}
```

ルールにより自動処理された場合は即時に確定ステータスを返す:
```json
{
  "data": {
    "request_id": "01HXXXXX",
    "status": "AUTO_APPROVED",
    "timeout_at": null
  }
}
```

**サービス障害時（fail-closed）** `503`
```json
{
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "稟議ゲート（仮）APIに接続できません"
  }
}
```

---

### GET `/sdk/v1/requests/:request_id/status`

ポーリングで結果を確認。

**レスポンス** `200 OK`
```json
{
  "data": {
    "request_id": "01HXXXXX",
    "status": "APPROVED",
    "decided_at": "2026-05-06T09:05:00Z",
    "decided_by": "tanaka@example.com",
    "rejection_reason": null
  }
}
```

`status` が `PENDING` の場合は待機継続。  
`status` が `REJECTED` / `TIMED_OUT` の場合、SDKは例外を発生させる。

---

## Slack Webhookエンドポイント

### GET `/webhooks/slack/oauth`

Slack OAuth コールバック。Slackが認可後にリダイレクトしてくる。

---

### POST `/webhooks/slack/interactivity`

Slackのボタンクリック・モーダル送信を受信。

**検証**: `X-Slack-Signature` HMAC-SHA256 + タイムスタンプ検証（必須）

**Slackが送るペイロード（抜粋）**
```json
{
  "type": "block_actions",
  "actions": [
    {
      "action_id": "approve_request",
      "value": "01HXXXXX"
    }
  ],
  "user": { "id": "UXXXXX", "email": "tanaka@example.com" }
}
```

**レスポンス** `200 OK`（3秒以内に返すこと。処理は非同期で行い、Slackメッセージを後から更新する）

---

### POST `/webhooks/slack/events`

Slack Event API（app_home_opened等）を受信。

**レスポンス** `200 OK`

---

## 請求エンドポイント

### GET `/web/v1/tenants/:tenant_id/billing`

現在のプランと使用状況を取得。

**レスポンス** `200 OK`
```json
{
  "data": {
    "plan": "growth",
    "current_period_requests": 1240,
    "plan_limit_requests": 5000,
    "member_count": 8,
    "plan_limit_members": 20,
    "next_billing_date": "2026-06-01",
    "overage_allowed": false
  }
}
```

### GET `/web/v1/tenants/:tenant_id/billing/invoices`

請求書一覧。Stripe請求書のリスト。

### POST `/web/v1/tenants/:tenant_id/billing/portal`

Stripe Customer Portalへのリンクを生成（プラン変更・支払い方法変更等）。

**レスポンス** `200 OK`
```json
{
  "data": { "portal_url": "https://billing.stripe.com/..." }
}
```

---

## リアルタイム更新（Supabase Realtime）

REST API に加え、フロントエンドは Supabase Realtime（WebSocket）で以下のテーブル変更をリアルタイムに受け取る。REST APIをポーリングする必要はない。

| 監視テーブル | イベント | 用途 |
|------------|---------|------|
| `approval_requests` | `UPDATE` | 承認ステータスの変化（PENDING → APPROVED 等）をダッシュボード・詳細ページに即時反映 |
| `approval_requests` | `INSERT` | 新着リクエストをダッシュボードの承認待ち一覧に即時追加 |
| `rules` | `UPDATE` / `INSERT` / `DELETE` | ルール一覧の変更を複数ブラウザ間で同期 |

**フィルタリング**: Supabase Realtime の `filter` オプションで `tenant_id=eq.{tenant_id}` を指定し、自テナントのデータのみ受信する。

**フォールバック**: Realtime 接続が切れた場合は TanStack Query の `refetchInterval: 30_000` による30秒ポーリングに自動フォールバックする。
