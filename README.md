# Store Review Monitor

[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-supported-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Bitrise](https://img.shields.io/badge/Bitrise-supported-683D87?logo=bitrise&logoColor=white)](https://bitrise.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Monitor App Store Connect and Google Play Console review status with Slack notifications. Supports **GitHub Actions** and **Bitrise**.

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
| Bitrise | [separate repo](https://github.com/anies1212/bitrise-step-store-review-monitor) | Go |

---

## GitHub Actions

### Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `app-store-issuer-id` | Yes* | App Store Connect API Issuer ID |
| `app-store-key-id` | Yes* | App Store Connect API Key ID |
| `app-store-private-key` | Yes* | App Store Connect API Private Key (base64 or raw .p8) |
| `app-store-app-id` | Yes* | App Store Connect App ID |
| `google-play-package-name` | Yes** | Google Play package name (e.g., com.example.app) |
| `google-play-service-account` | Yes** | Google Play Service Account JSON (base64 or raw JSON) |
| `slack-webhook-url` | Yes*** | Slack Webhook URL |
| `slack-bot-token` | Yes*** | Slack Bot Token (xoxb-...) |
| `slack-channel` | Yes**** | Slack channel ID or name |
| `slack-language` | No | Language (`en` or `ja`, default: `en`) |
| `slack-mentions` | No | Slack user IDs to mention (comma-separated) |

\* Required for App Store monitoring (all 4 parameters must be provided together)
\*\* Required for Google Play monitoring (both parameters must be provided together)
\*\*\* Either `slack-webhook-url` or `slack-bot-token` is required
\*\*\*\* Required when using `slack-bot-token`

### Outputs

| Output | Description |
|--------|-------------|
| `app-store-status` | Current App Store review status |
| `google-play-status` | Current Google Play review status |
| `notification-sent` | Whether a notification was sent |

### Examples

#### Example 1: Monitor App Store Only

```yaml
name: Monitor App Store Review

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Monitor App Store
        uses: anies1212/store-review-monitor@v1
        with:
          app-store-issuer-id: ${{ secrets.APP_STORE_ISSUER_ID }}
          app-store-key-id: ${{ secrets.APP_STORE_KEY_ID }}
          app-store-private-key: ${{ secrets.APP_STORE_PRIVATE_KEY }}
          app-store-app-id: ${{ secrets.APP_STORE_APP_ID }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### Example 2: Monitor Google Play Only

```yaml
name: Monitor Google Play Review

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Monitor Google Play
        uses: anies1212/store-review-monitor@v1
        with:
          google-play-package-name: com.example.myapp
          google-play-service-account: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
```

#### Example 3: Monitor Both Stores with Bot Token and Mentions

```yaml
name: Monitor All Store Reviews

on:
  schedule:
    - cron: '0 */4 * * *'  # Every 4 hours
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
          google-play-package-name: com.example.myapp
          google-play-service-account: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          # Slack (using Bot Token)
          slack-bot-token: ${{ secrets.SLACK_BOT_TOKEN }}
          slack-channel: C1234567890
          slack-mentions: U1234567890,U0987654321
          slack-language: en
```

#### Example 4: Using Outputs for Conditional Steps

```yaml
name: Monitor with Conditional Steps

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  monitor:
    runs-on: ubuntu-latest
    steps:
      - name: Monitor Store Reviews
        id: monitor
        uses: anies1212/store-review-monitor@v1
        with:
          app-store-issuer-id: ${{ secrets.APP_STORE_ISSUER_ID }}
          app-store-key-id: ${{ secrets.APP_STORE_KEY_ID }}
          app-store-private-key: ${{ secrets.APP_STORE_PRIVATE_KEY }}
          app-store-app-id: ${{ secrets.APP_STORE_APP_ID }}
          slack-webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Log Results
        run: |
          echo "App Store Status: ${{ steps.monitor.outputs.app-store-status }}"
          echo "Notification Sent: ${{ steps.monitor.outputs.notification-sent }}"

      - name: Additional Action on Rejection
        if: contains(steps.monitor.outputs.app-store-status, 'REJECTED')
        run: |
          echo "App was rejected! Creating issue..."
          # Add your rejection handling logic here
```

---

## Bitrise

### Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `app_store_issuer_id` | Yes* | App Store Connect API Issuer ID |
| `app_store_key_id` | Yes* | App Store Connect API Key ID |
| `app_store_private_key` | Yes* | App Store Connect API Private Key (base64 or raw .p8) |
| `app_store_app_id` | Yes* | App Store Connect App ID |
| `google_play_package_name` | Yes** | Google Play package name (e.g., com.example.app) |
| `google_play_service_account` | Yes** | Google Play Service Account JSON (base64 or raw JSON) |
| `slack_webhook_url` | Yes*** | Slack Webhook URL |
| `slack_bot_token` | Yes*** | Slack Bot Token (xoxb-...) |
| `slack_channel` | Yes**** | Slack channel ID or name |
| `slack_language` | No | Language (`en` or `ja`, default: `en`) |
| `slack_mentions` | No | Slack user IDs to mention (comma-separated) |

\* Required for App Store monitoring (all 4 parameters must be provided together)
\*\* Required for Google Play monitoring (both parameters must be provided together)
\*\*\* Either `slack_webhook_url` or `slack_bot_token` is required
\*\*\*\* Required when using `slack_bot_token`

### Outputs

| Output | Description |
|--------|-------------|
| `STORE_REVIEW_APP_STORE_STATUS` | Current App Store review status |
| `STORE_REVIEW_GOOGLE_PLAY_STATUS` | Current Google Play review status |
| `STORE_REVIEW_NOTIFICATION_SENT` | Whether a notification was sent |

### Cache Configuration (Important)

To persist version cache between builds, add cache steps:

```yaml
- cache-pull@2: {}

- git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@1.0.0:
    inputs:
      # ... your inputs

- cache-push@2:
    inputs:
      - cache_paths: |
          $BITRISE_CACHE_DIR/store-review-versions.json
```

**Note**: Without cache configuration, notifications will be sent on every run.

### Examples

#### Example 1: Monitor App Store Only

```yaml
format_version: "11"
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git

workflows:
  monitor-appstore:
    steps:
      - cache-pull@2: {}

      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@1.0.0:
          title: Monitor App Store Reviews
          inputs:
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            - app_store_key_id: $APP_STORE_KEY_ID
            - app_store_private_key: $APP_STORE_PRIVATE_KEY
            - app_store_app_id: $APP_STORE_APP_ID
            - slack_webhook_url: $SLACK_WEBHOOK_URL

      - cache-push@2:
          inputs:
            - cache_paths: |
                $BITRISE_CACHE_DIR/store-review-versions.json
```

#### Example 2: Monitor Google Play Only

```yaml
format_version: "11"
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git

workflows:
  monitor-googleplay:
    steps:
      - cache-pull@2: {}

      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@1.0.0:
          title: Monitor Google Play Reviews
          inputs:
            - google_play_package_name: $GOOGLE_PLAY_PACKAGE_NAME
            - google_play_service_account: $GOOGLE_PLAY_SERVICE_ACCOUNT
            - slack_webhook_url: $SLACK_WEBHOOK_URL

      - cache-push@2:
          inputs:
            - cache_paths: |
                $BITRISE_CACHE_DIR/store-review-versions.json
```

#### Example 3: Monitor Both Stores with Bot Token and Mentions

```yaml
format_version: "11"
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git

workflows:
  monitor-all:
    steps:
      - cache-pull@2: {}

      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@1.0.0:
          title: Monitor All Store Reviews
          inputs:
            # App Store Connect
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            - app_store_key_id: $APP_STORE_KEY_ID
            - app_store_private_key: $APP_STORE_PRIVATE_KEY
            - app_store_app_id: $APP_STORE_APP_ID
            # Google Play
            - google_play_package_name: $GOOGLE_PLAY_PACKAGE_NAME
            - google_play_service_account: $GOOGLE_PLAY_SERVICE_ACCOUNT
            # Slack (using Bot Token)
            - slack_bot_token: $SLACK_BOT_TOKEN
            - slack_channel: "#app-releases"
            - slack_mentions: "U1234567890,U0987654321"
            - slack_language: "en"

      - cache-push@2:
          inputs:
            - cache_paths: |
                $BITRISE_CACHE_DIR/store-review-versions.json
```

#### Example 4: Using Outputs for Conditional Steps

```yaml
format_version: "11"
default_step_lib_source: https://github.com/bitrise-io/bitrise-steplib.git

workflows:
  monitor-with-conditions:
    steps:
      - cache-pull@2: {}

      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@1.0.0:
          title: Monitor Store Reviews
          inputs:
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            - app_store_key_id: $APP_STORE_KEY_ID
            - app_store_private_key: $APP_STORE_PRIVATE_KEY
            - app_store_app_id: $APP_STORE_APP_ID
            - slack_webhook_url: $SLACK_WEBHOOK_URL

      - script@1:
          title: Log Results
          inputs:
            - content: |
                #!/bin/bash
                echo "App Store Status: $STORE_REVIEW_APP_STORE_STATUS"
                echo "Notification Sent: $STORE_REVIEW_NOTIFICATION_SENT"

      - script@1:
          title: Handle Rejection
          run_if: '{{enveq "STORE_REVIEW_APP_STORE_STATUS" "REJECTED"}}'
          inputs:
            - content: |
                #!/bin/bash
                echo "App was rejected! Taking action..."
                # Add your rejection handling logic here

      - cache-push@2:
          inputs:
            - cache_paths: |
                $BITRISE_CACHE_DIR/store-review-versions.json
```

### Scheduled Builds on Bitrise

1. Go to Bitrise Dashboard > Your App
2. **Settings** > **Triggers**
3. **Scheduled** tab > Add new schedule
4. Set interval (e.g., every 6 hours) and select your workflow

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

```
✅ App Store Review Status Update

Platform:              Version:
App Store              1.2.3 (100)

Current Status:        Previous Status:
Ready For Sale         In Review

Checked at: 2025-12-10T12:34:56Z
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
