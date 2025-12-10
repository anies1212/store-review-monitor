# Store Review Monitor - Bitrise Step

App Store Connect と Google Play Console のレビューステータスを監視し、Slack で通知する Bitrise ステップです。

## 機能

- App Store Connect のレビューステータス監視
- Google Play Console のレビューステータス監視
- Slack 通知（Webhook / Bot Token 両対応）
- 多言語対応（英語・日本語）
- スマート通知ロジック（重複通知を防止）
- バージョン/ビルド変更時の通知
- リジェクトからの回復時の通知

## 使い方

### 基本的な設定

`bitrise.yml` に以下のように追加します：

```yaml
workflows:
  monitor:
    steps:
      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@main:
          title: Monitor Store Reviews
          inputs:
            # App Store Connect
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            - app_store_key_id: $APP_STORE_KEY_ID
            - app_store_private_key: $APP_STORE_PRIVATE_KEY
            - app_store_app_id: $APP_STORE_APP_ID
            # Google Play
            - google_play_package_name: $GOOGLE_PLAY_PACKAGE_NAME
            - google_play_service_account: $GOOGLE_PLAY_SERVICE_ACCOUNT
            # Slack
            - slack_webhook_url: $SLACK_WEBHOOK_URL
            - slack_language: "ja"
```

### スケジュール実行

Bitrise の Scheduled Builds 機能を使って定期実行できます：

1. Bitrise ダッシュボードでアプリを選択
2. **Settings** > **Triggers** を開く
3. **Scheduled** タブで新しいスケジュールを追加
4. 実行間隔（例：6時間ごと）とワークフローを設定

### キャッシュの設定（重要）

ビルド間でバージョンキャッシュを保持するには、キャッシュステップを追加してください：

```yaml
workflows:
  monitor:
    steps:
      # ビルド開始時にキャッシュを取得
      - cache-pull@2: {}

      # 監視ステップ
      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@main:
          inputs:
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            # ... その他の入力

      # ビルド終了時にキャッシュを保存
      - cache-push@2:
          inputs:
            - cache_paths: |
                $BITRISE_CACHE_DIR/store-review-versions.json
```

**注意**: キャッシュを設定しないと、毎回通知が送信されます。

## 入力パラメータ

### App Store Connect

| パラメータ | 説明 | 必須 |
|-----------|------|------|
| `app_store_issuer_id` | App Store Connect API Issuer ID | いいえ |
| `app_store_key_id` | App Store Connect API Key ID | いいえ |
| `app_store_private_key` | App Store Connect API Private Key (base64 または raw .p8) | いいえ |
| `app_store_app_id` | App Store App ID | いいえ |

### Google Play

| パラメータ | 説明 | 必須 |
|-----------|------|------|
| `google_play_package_name` | Android パッケージ名 (例: com.example.app) | いいえ |
| `google_play_service_account` | Service Account JSON (base64 または raw JSON) | いいえ |

### Slack

| パラメータ | 説明 | 必須 |
|-----------|------|------|
| `slack_webhook_url` | Slack Incoming Webhook URL | webhook または bot_token のどちらか |
| `slack_bot_token` | Slack Bot Token (xoxb-...) | webhook または bot_token のどちらか |
| `slack_channel` | Slack チャンネル ID または名前 | bot_token 使用時は必須 |
| `slack_language` | 通知言語 (`en` または `ja`) | いいえ (デフォルト: `en`) |
| `slack_mentions` | メンションするユーザー ID（カンマ区切り） | いいえ |

### その他

| パラメータ | 説明 | 必須 |
|-----------|------|------|
| `cache_path` | キャッシュファイルのパス | いいえ |

## 出力パラメータ

| パラメータ | 説明 |
|-----------|------|
| `STORE_REVIEW_APP_STORE_STATUS` | 現在の App Store レビューステータス |
| `STORE_REVIEW_GOOGLE_PLAY_STATUS` | 現在の Google Play レビューステータス |
| `STORE_REVIEW_NOTIFICATION_SENT` | 通知が送信されたかどうか (`true`/`false`) |

## セットアップ

### App Store Connect API キーの作成

1. [App Store Connect](https://appstoreconnect.apple.com/) にログイン
2. **ユーザーとアクセス** > **キー** を選択
3. **App Store Connect API** タブで新しいキーを作成
4. **Issuer ID**、**Key ID**、**.p8 ファイル**を保存

### Google Play Service Account の作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. **IAM & Admin** > **Service Accounts** で新しいサービスアカウントを作成
3. [Google Play Console](https://play.google.com/console/) で API アクセスを有効化
4. サービスアカウントをリンクし、JSON キーをダウンロード

### Bitrise Secrets の設定

Bitrise ダッシュボードで以下の Secrets を設定します：

```
APP_STORE_ISSUER_ID: your-issuer-id
APP_STORE_KEY_ID: your-key-id
APP_STORE_PRIVATE_KEY: (base64 エンコードした .p8 ファイルの内容)
APP_STORE_APP_ID: your-app-id

GOOGLE_PLAY_PACKAGE_NAME: com.example.app
GOOGLE_PLAY_SERVICE_ACCOUNT: (base64 エンコードした JSON の内容)

SLACK_WEBHOOK_URL: https://hooks.slack.com/services/xxx/xxx/xxx
```

## 通知トリガー

通知が送信されるのは以下の場合です：

### バージョン/ビルド変更時

以下のステータスの場合に通知されます：

**App Store:**
- `READY_FOR_SALE` - 販売準備完了
- `PENDING_DEVELOPER_RELEASE` - デベロッパーリリース待ち
- `PENDING_APPLE_RELEASE` - Apple リリース待ち
- `REJECTED` - リジェクト
- `METADATA_REJECTED` - メタデータリジェクト
- `INVALID_BINARY` - 無効なバイナリ

**Google Play:**
- `COMPLETED` - リリース完了

### リジェクトからの回復時

同じバージョン/ビルドでも、リジェクト状態から承認状態に変わった場合は通知されます。

## サンプルワークフロー

### App Store のみ監視

```yaml
workflows:
  monitor_ios:
    steps:
      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@main:
          inputs:
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            - app_store_key_id: $APP_STORE_KEY_ID
            - app_store_private_key: $APP_STORE_PRIVATE_KEY
            - app_store_app_id: $APP_STORE_APP_ID
            - slack_webhook_url: $SLACK_WEBHOOK_URL
            - slack_language: "ja"
```

### Bot Token でメンション付き通知

```yaml
workflows:
  monitor_with_mentions:
    steps:
      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@main:
          inputs:
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            - app_store_key_id: $APP_STORE_KEY_ID
            - app_store_private_key: $APP_STORE_PRIVATE_KEY
            - app_store_app_id: $APP_STORE_APP_ID
            - slack_bot_token: $SLACK_BOT_TOKEN
            - slack_channel: "#app-releases"
            - slack_mentions: "U1234567890,U0987654321"
            - slack_language: "ja"
```

## ローカルでのテスト

```bash
cd bitrise-step-store-review-monitor

# 依存関係の取得
go mod tidy

# ビルド
go build -o step

# 環境変数を設定してテスト
export app_store_issuer_id="your-issuer-id"
export app_store_key_id="your-key-id"
export app_store_private_key="your-private-key"
export app_store_app_id="your-app-id"
export slack_webhook_url="your-webhook-url"
./step
```

## 関連リンク

- [GitHub Actions 版](https://github.com/anies1212/store-review-monitor)
- [Bitrise Step 開発ガイド](https://devcenter.bitrise.io/en/steps-and-workflows/developing-your-own-bitrise-step.html)

## ライセンス

MIT License
