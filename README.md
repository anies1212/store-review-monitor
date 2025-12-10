# Store Review Monitor

[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-supported-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Bitrise](https://img.shields.io/badge/Bitrise-supported-683D87?logo=bitrise&logoColor=white)](https://bitrise.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Monitor App Store Connect and Google Play Console review status with Slack notifications. Supports **GitHub Actions** and **Bitrise**.

App Store Connect と Google Play Console のレビューステータスを監視し、Slack で通知。**GitHub Actions** / **Bitrise** 対応。

## Features

- Monitor App Store Connect review status
- Monitor Google Play Console review status
- **Version and build number tracking** - Only notify when version/build changes or recovers from rejection
- **Smart rejection handling** - Notifies when same version/build is approved after rejection
- Support for both **Slack Webhook URL** and **Slack Bot Token**
- **Multi-language support** (English and Japanese)
- **Mention users** in Slack notifications

## Supported CI/CD Platforms

| Platform | Directory | Language |
|----------|-----------|----------|
| GitHub Actions | `/` (root) | TypeScript |
| Bitrise | `/bitrise-step-store-review-monitor` | Go |

---

## GitHub Actions

### Basic Setup

Create `.github/workflows/monitor-review.yml`:

```yaml
name: Monitor Store Review Status

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Monitor App Store and Google Play
        uses: anies1212/store-review-monitor@v1
        with:
          # App Store Connect
          app-store-issuer-id: ${{ secrets.APP_STORE_ISSUER_ID }}
          app-store-key-id: ${{ secrets.APP_STORE_KEY_ID }}
          app-store-private-key: ${{ secrets.APP_STORE_PRIVATE_KEY }}
          app-store-app-id: ${{ secrets.APP_STORE_APP_ID }}
          # Google Play
          google-play-package-name: 'com.example.app'
          google-play-service-account: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          # Slack
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          slack-language: 'ja'
```

### GitHub Actions Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `app-store-issuer-id` | No | App Store Connect API Issuer ID |
| `app-store-key-id` | No | App Store Connect API Key ID |
| `app-store-private-key` | No | App Store Connect API Private Key |
| `app-store-app-id` | No | App Store Connect App ID |
| `google-play-package-name` | No | Google Play package name |
| `google-play-service-account` | No | Google Play Service Account JSON |
| `slack-webhook-url` | No* | Slack Webhook URL |
| `slack-bot-token` | No* | Slack Bot Token (xoxb-...) |
| `slack-channel` | No** | Slack channel (required with bot-token) |
| `slack-language` | No | Language (`en` or `ja`, default: `en`) |
| `slack-mentions` | No | Slack user IDs to mention (comma-separated) |

\* Either `slack-webhook-url` or `slack-bot-token` is required
\*\* Required when using `slack-bot-token`

### GitHub Actions Outputs

| Output | Description |
|--------|-------------|
| `app-store-status` | Current App Store review status |
| `google-play-status` | Current Google Play review status |
| `notification-sent` | Whether a notification was sent |

---

## Bitrise

### Basic Setup

Add to your `bitrise.yml`:

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

### Scheduled Builds on Bitrise

1. Go to Bitrise Dashboard > Your App
2. **Settings** > **Triggers**
3. **Scheduled** tab > Add new schedule
4. Set interval (e.g., every 6 hours) and workflow

### Bitrise Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `app_store_issuer_id` | No | App Store Connect API Issuer ID |
| `app_store_key_id` | No | App Store Connect API Key ID |
| `app_store_private_key` | No | App Store Connect API Private Key |
| `app_store_app_id` | No | App Store Connect App ID |
| `google_play_package_name` | No | Google Play package name |
| `google_play_service_account` | No | Google Play Service Account JSON |
| `slack_webhook_url` | No* | Slack Webhook URL |
| `slack_bot_token` | No* | Slack Bot Token (xoxb-...) |
| `slack_channel` | No** | Slack channel (required with bot_token) |
| `slack_language` | No | Language (`en` or `ja`) |
| `slack_mentions` | No | Slack user IDs to mention (comma-separated) |

\* Either `slack_webhook_url` or `slack_bot_token` is required
\*\* Required when using `slack_bot_token`

### Bitrise Outputs

| Output | Description |
|--------|-------------|
| `STORE_REVIEW_APP_STORE_STATUS` | Current App Store review status |
| `STORE_REVIEW_GOOGLE_PLAY_STATUS` | Current Google Play review status |
| `STORE_REVIEW_NOTIFICATION_SENT` | Whether a notification was sent |

---

## Notification Triggers

Notifications are sent in the following cases:

### Case 1: Version or Build Number Changed

When the **version** or **build number** changes AND the status is one of:

**App Store Connect:**
- `READY_FOR_SALE` - App is live
- `PENDING_DEVELOPER_RELEASE` - Waiting for manual release
- `PENDING_APPLE_RELEASE` - Scheduled for release
- `REJECTED` - Review rejected
- `METADATA_REJECTED` - Metadata rejected
- `INVALID_BINARY` - Binary is invalid

**Google Play Console:**
- `COMPLETED` - Release completed

### Case 2: Recovered from Rejection

When the app **recovers from REJECTED status** to an approved status, even with the **same version and build number**.

**Examples:**

| Scenario | Notification |
|----------|--------------|
| 1.2.3 (100) → 1.2.4 (101) with READY_FOR_SALE | Yes |
| 1.2.3 (100) → 1.2.3 (101) with READY_FOR_SALE | Yes |
| 1.2.3 (100) REJECTED → 1.2.3 (100) READY_FOR_SALE | Yes |
| 1.2.3 (100) READY_FOR_SALE → 1.2.3 (100) READY_FOR_SALE | No |
| 1.2.3 (100) IN_REVIEW → 1.2.3 (100) WAITING_FOR_REVIEW | No |

---

## Setting Up Credentials

### App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to **Users and Access** → **Keys**
3. Create a new API key with "App Manager" role
4. Download the `.p8` private key file
5. Note the **Issuer ID** and **Key ID**

**Secrets to configure:**
- `APP_STORE_ISSUER_ID`: Your Issuer ID
- `APP_STORE_KEY_ID`: Your Key ID
- `APP_STORE_PRIVATE_KEY`: Contents of `.p8` file (or base64 encoded)
- `APP_STORE_APP_ID`: Your app's Apple ID

### Google Play Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a service account with **Android Publisher** role
3. Go to [Google Play Console](https://play.google.com/console) → **Settings** → **API access**
4. Link the service account
5. Download the JSON key file

**Secrets to configure:**
- `GOOGLE_PLAY_PACKAGE_NAME`: Your app's package name
- `GOOGLE_PLAY_SERVICE_ACCOUNT`: Contents of JSON file (or base64 encoded)

### Slack

#### Option 1: Webhook URL (Simpler)

1. Create a [Slack Incoming Webhook](https://api.slack.com/messaging/webhooks)
2. Copy the webhook URL

**Secret:** `SLACK_WEBHOOK_URL`

#### Option 2: Bot Token (More Features)

1. Create a [Slack App](https://api.slack.com/apps)
2. Add OAuth scopes: `chat:write`, `chat:write.customize`
3. Install to workspace
4. Copy Bot User OAuth Token (starts with `xoxb-`)
5. Invite bot to channel

**Secret:** `SLACK_BOT_TOKEN`

---

## Slack Notification Preview

### English
```
✅ App Store Review Status Update

Platform:              Version:
App Store              1.2.3 (100)

Current Status:        Previous Status:
Ready For Sale         In Review

Checked at: 2025-12-10T12:34:56Z
```

### Japanese
```
✅ App Store レビューステータス更新

プラットフォーム:        バージョン:
App Store              1.2.3 (100)

現在のステータス:        前回のステータス:
Ready For Sale         In Review

確認日時: 2025-12-10T12:34:56Z
```

---

## Development

### GitHub Actions (TypeScript)

```bash
# Install dependencies
npm install

# Build
npm run build

# Package for distribution
npm run package
```

### Bitrise Step (Go)

```bash
cd bitrise-step-store-review-monitor

# Install dependencies
go mod tidy

# Build
go build -o step

# Test locally
export app_store_issuer_id="..."
export slack_webhook_url="..."
./step
```

---

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
