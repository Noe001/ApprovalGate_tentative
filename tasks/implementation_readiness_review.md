# 実装移行 最終チェック

## 判定

**Phase 1 MVPの本格実装にはまだ移らない。**

ただし、**Phase 0の検証用デモ/プロトタイプ実装には移ってよい。**

理由は、[specs/21_pre_implementation_checklist.md](../specs/21_pre_implementation_checklist.md) の必須完了条件である顧客検証・支払い意思・Design Partner候補がまだ実績として埋まっていないため。プロダクト仕様と実装前成果物は揃ったが、「作れば使われる」証拠はまだない。

## チェック結果

| 領域 | 状態 | コメント |
|------|------|----------|
| 戦略メッセージ | OK | 「AIエージェント実行権限管理インフラ」に統一済み |
| 競合認識 | OK | HumanLayer、LangGraph/OpenAI、Microsoft/ServiceNowを反映済み |
| MVP範囲 | OK | [specs/19_mvp_scope.md](../specs/19_mvp_scope.md) でPhase 1範囲を定義済み |
| 実装前ヒアリング | 未完了 | 10社ヒアリング、支払い意思、Design Partner候補が未実施 |
| 検証用デモ仕様 | OK | [specs/22_validation_demo.md](../specs/22_validation_demo.md) に作成済み |
| LINE WORKS方針 | OK | MVP実装から外し、Waitlist/ヒアリングで検証する方針に変更済み |
| Level 2方針 | OK | 汎用Vaultではなく、限定用途の代理実行から始める前提に変更済み |
| 技術実装バックログ | 条件付きOK | Go判定後の最小バックログは定義済み。ただしGo条件は未達 |

## Go条件の未達項目

- 10社以上にヒアリングした実績がない
- 3社以上の明確なAIエージェント本番化課題が未確認
- 2社以上の有料PoC意向が未確認
- 1社以上の実アプリ接続協力が未確認
- 最初に止める危険操作が実顧客ベースで1〜2種類に絞れていない
- 最初のSDK/Adapter言語が顧客ベースで決まっていない
- LINE WORKS/Teamsの優先順位が顧客ベースで決まっていない
- Level 2の最初の代理実行ユースケースが顧客ベースで決まっていない

## 今すぐ実装してよいもの

以下は本格MVPではなく、ヒアリングの質を上げるための検証用実装として進めてよい。

1. Slack通知モック
2. Web承認一覧/詳細/監査ログの静的またはローカルデモ
3. LINE WORKS Waitlist表示
4. Level 2の概念図または代理実行モックログ
5. ヒアリング記録テンプレートの運用

## まだ実装しないもの

- 本番用マルチテナント基盤
- 課金
- LINE WORKS本連携
- Teams本連携
- 複数承認/エスカレーション
- 汎用承認ルールUI
- Level 2汎用クレデンシャル保管
- Outbound Proxy

## 推奨次アクション

1. [specs/22_validation_demo.md](../specs/22_validation_demo.md) に沿って、1〜2日で見せられる薄いデモを作る。
2. [specs/20_customer_discovery.md](../specs/20_customer_discovery.md) の質問票で10社ヒアリングを始める。
3. 2社以上が有料PoCに前向きになったら、[specs/21_pre_implementation_checklist.md](../specs/21_pre_implementation_checklist.md) を埋めてPhase 1 MVP実装へ進む。
