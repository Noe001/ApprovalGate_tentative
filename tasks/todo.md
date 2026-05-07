# 現在の調査タスク

## 目的

稟議ゲート（仮）が2026年時点で事業化する価値のあるアプリかを、市場需要、競合、小規模チームでの開発・運用可能性から評価する。

## チェックリスト

- [x] 既存ドキュメントからプロダクト仮説を把握する
- [x] AIエージェント/生成AIガバナンス需要を外部情報で確認する
- [x] 直接・隣接競合を調べる
- [x] MVPとLevel 2以降の開発・運用難易度を評価する
- [x] 結論、リスク、推奨ピボット/絞り込みを整理する

## レビュー

### 暫定結論

価値はある。ただし「AIエージェント承認SDK」単体では、OpenAI Agents SDK、LangChain/LangGraph、HumanLayer系の既存資産に近く、早期にコモディティ化しやすい。日本企業向けの承認運用、LINE WORKS/Slack、監査ログ、ルール、将来的なクレデンシャル保管まで含めた「実行権限制御インフラ」に絞ると勝ち筋がある。

### 需要

- 総務省 令和7年版情報通信白書では、日本企業の生成AI業務利用は55.2%。導入懸念は「効果的な活用方法がわからない」に次いで「社内情報の漏えい等のセキュリティリスク」「ランニングコスト」が上位。
- Gartner公開情報では、2028年に企業アプリの33%がagentic AIを含み、日常業務判断の15%が自律化する一方、2027年末までにagentic AI案件の40%以上が中止される予測。安全に本番化するための承認・監査・権限管理需要は強い。
- ただし初期に「今すぐ買う」層は広くない。日本のAIスタートアップ、AI機能を組み込むSaaS、SIerのAI新規事業、社内DXチームに絞るべき。

### 競合

- HumanLayerは2024年時点でPython/TypeScript、Slack/SMS/email、フレームワーク非依存の承認ワークフローを提供しており、かなり直接競合。ただし2026年現在はCodeLayerへ訴求が寄り、旧SDKはsuperseded扱い。
- LangChain/LangGraph、OpenAI Agents SDKはhuman-in-the-loop/approval/resumeを標準機能化している。低レベルの「一時停止して承認」は差別化になりにくい。
- Microsoft Copilot Studio/Power Automateはagent flowsにHuman in the loop、multistage approvals、Teams/Outlook応答を持つ。Microsoft圏の企業には強い。
- ServiceNow AI Control Towerは大企業向けの広範なAIガバナンスで強いが、価格・導入重さの面で小規模AI開発チームとはターゲットが異なる。

### 小規模チーム可否

- MVPは2人前後でも可能。範囲はPythonまたはTypeScript SDKの片方、Slack、API、承認一覧、監査ログ、fail-closed、テストモードまでに絞る。
- Level 2のクレデンシャル保管は難易度が高い。外部APIごとの代理実行、OAuth、トークン更新、監査、障害時責任が増えるため、最初はSendGrid/Stripeなど1〜2カテゴリに限定すべき。
- Level 3 Outbound Proxy、汎用コネクタ大量対応、エンタープライズSLA、SOC2/ISMS前提の売り方は小規模チームの初期スコープから外すべき。

### 推奨方針

1. 「SDKで承認」ではなく「日本企業向けAIエージェント実行権限管理」にポジションを変える。
2. MVPはSlack、監査ログ、最小の承認一覧、LangGraph/OpenAI Agents SDK接続サンプルに集中する。LINE WORKSはWaitlistで需要確認する。
3. 有料化前に、AIエージェントを実運用している3〜5社から、承認待ち件数、止めたいアクション、既存の自前承認実装の有無を確認する。
4. Level 2は汎用Vaultではなく「メール送信」「支払い」「CRM更新」など1用途で構造的保証を示す。

---

# ドキュメント再設計タスク

## 目的

フィードバックを反映し、プロジェクト全体を「AIエージェント承認SDK」から「AIエージェント実行権限管理インフラ」へ再定義する。実装前に必要な検証・MVP・ヒアリング成果物も作成する。

## チェックリスト

- [x] 変更方針を整理する
- [x] 上位文書（提案書、product、market、business）を修正する
- [x] 仕様文書の前提をMVP/Phase 2以降に分ける
- [x] 実装前の顧客検証・MVP定義・実装前チェックリストを作成する
- [x] CLAUDE.md と .claude を触っていないことを確認する

## 方針

- 外向けメッセージは「危険な実行を人間承認・監査ログ・権限分離で本番運用できるようにする」に統一する。
- SDKは導入手段であり、差別化の本体ではないと明記する。
- HumanLayerのピボットはカテゴリ証明だけでなく、承認ワークフロー単体の弱さを示す警戒信号として扱う。
- LINE WORKSは国内企業への重要な入口だが、MVP実装ではなくWaitlist/ヒアリングで需要確認する。
- 現行の詳細仕様は捨てず、Phase 2以降の設計資産として保持する。

## レビュー

- 上位文書を「AIエージェント実行権限管理インフラ」へ再定義した。
- 競合認識にHumanLayerのピボットを警戒信号として反映した。
- LINE WORKSはMVP実装から外し、Waitlist/ヒアリングで需要確認する方針に変更した。
- Phase 1 MVPとPhase 2以降の設計資産を分離した。
- 実装前成果物としてMVPスコープ、顧客ヒアリング計画、実装開始チェックリスト、検証用デモ仕様を追加した。
- CLAUDE.md と .claude ディレクトリは変更対象外として扱った。

---

# リリース前 実装レビュー・修正タスク

## 目的

全Markdown仕様と現行コードベースを照合し、Phase 0デモ/Phase 1 MVPのリリースを阻害する明確な不整合を修正する。Phase 2以降の大型機能は今回の実装対象外とする。

## チェックリスト

- [x] 全Markdown仕様のMVP/Phase 2境界を確認する
- [x] フロントエンド、Supabase Edge Functions、DBスキーマ、SDKを分担レビューする
- [x] P0の仕様不一致を修正する
- [x] SDKの環境変数、モック、fail behaviorを仕様に合わせる
- [x] 環境変数例とリリース前メモを更新する
- [x] build/test/lintで検証し、残課題をレビューに記録する

## 実装方針

- 本格MVPは顧客検証後という既存Markdownの判断を尊重し、今回の実装は既存コードのリリース阻害バグ修正に絞る。
- 直す対象は、Slack通知/SDK status/APIキー検証/RLS/ロールガード/SDK設定/環境変数例のように、仕様とコードの明確な不整合があるものに限定する。
- LINE WORKS、Teams、複数承認、エスカレーション、Level 2 Vault、課金の本実装は今回追加しない。

## レビュー

- Markdown仕様とコードを照合し、Phase 0デモ/Phase 1 MVPのリリース阻害になる不整合を修正した。
- フロントエンドはロール別ナビゲーション、Admin/Owner/Analyticsルートガード、viewerの承認操作非表示、Slack設定導線、主要フォームlabel関連付けを修正した。
- SupabaseはAPIキー検証、SDK request/status、Slack通知、timeout処理のスキーマ不一致を修正し、viewer/approver/admin/ownerのRLS補強マイグレーションを追加した。
- SDKは仕様に合わせて環境変数、mock mode、fail-open/closed、snake_case API payload、metadata制限、レスポンス正規化を実装し、テストを拡充した。
- `.env.example` にSupabase Edge Function secretsとSDK環境変数を追加した。
- 検証結果: `app npm run build` 成功、`app npm run lint` 成功、`sdk npm test` 成功（23/23）、`sdk npm run build` 成功。
- Denoがローカル環境にないため、Supabase Edge FunctionsのDeno型チェックは未実行。デプロイ前にCIまたはSupabase CLI/Deno環境で確認する。
- `get_errors` にはCognitive Complexity、readonly props、nested ternaryなどのSonar系保守性指摘が残る。ビルド阻害ではないが、正式リリース前の品質改善バックログとして扱う。
- Vite buildは500KB超chunk警告を出す。リリースブロッカーではないが、analytics/chart系の遅延読み込み検討余地がある。
