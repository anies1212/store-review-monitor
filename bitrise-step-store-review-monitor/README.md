# Store Review Monitor - Bitrise Step

A Bitrise Step that monitors App Store Connect and Google Play Console review status and sends Slack notifications.

## Features

- Monitor App Store Connect review status
- Monitor Google Play Console review status
- Slack notifications (Webhook / Bot Token)
- Multi-language support (English / Japanese)
- Smart notification logic (prevents duplicate notifications)
- Notify on version/build changes
- Notify on rejection recovery

## Usage

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
            - slack_language: "en"
```

### Scheduled Builds

Use Bitrise Scheduled Builds for periodic monitoring:

1. Go to Bitrise Dashboard > Your App
2. Open **Settings** > **Triggers**
3. Add a new schedule in the **Scheduled** tab
4. Set the interval (e.g., every 6 hours) and workflow

### Cache Configuration (Important)

To persist version cache between builds, add cache steps to your workflow:

```yaml
workflows:
  monitor:
    steps:
      # Pull cache at the start
      - cache-pull@2: {}

      # Monitor step
      - git::https://github.com/anies1212/bitrise-step-store-review-monitor.git@main:
          inputs:
            - app_store_issuer_id: $APP_STORE_ISSUER_ID
            # ... other inputs

      # Push cache at the end
      - cache-push@2:
          inputs:
            - cache_paths: |
                $BITRISE_CACHE_DIR/store-review-versions.json
```

**Note**: Without cache configuration, notifications will be sent on every run.

## Inputs

### App Store Connect

| Parameter | Description | Required |
|-----------|-------------|----------|
| `app_store_issuer_id` | App Store Connect API Issuer ID | No |
| `app_store_key_id` | App Store Connect API Key ID | No |
| `app_store_private_key` | App Store Connect API Private Key (base64 or raw .p8) | No |
| `app_store_app_id` | App Store App ID | No |

### Google Play

| Parameter | Description | Required |
|-----------|-------------|----------|
| `google_play_package_name` | Android package name (e.g., com.example.app) | No |
| `google_play_service_account` | Service Account JSON (base64 or raw JSON) | No |

### Slack

| Parameter | Description | Required |
|-----------|-------------|----------|
| `slack_webhook_url` | Slack Incoming Webhook URL | Either webhook or bot_token |
| `slack_bot_token` | Slack Bot Token (xoxb-...) | Either webhook or bot_token |
| `slack_channel` | Slack channel ID or name | Required with bot_token |
| `slack_language` | Notification language (`en` or `ja`) | No (default: `en`) |
| `slack_mentions` | User IDs to mention (comma-separated) | No |

### Other

| Parameter | Description | Required |
|-----------|-------------|----------|
| `cache_path` | Cache file path | No |

## Outputs

| Parameter | Description |
|-----------|-------------|
| `STORE_REVIEW_APP_STORE_STATUS` | Current App Store review status |
| `STORE_REVIEW_GOOGLE_PLAY_STATUS` | Current Google Play review status |
| `STORE_REVIEW_NOTIFICATION_SENT` | Whether a notification was sent (`true`/`false`) |

## Setup

### Creating App Store Connect API Key

1. Log in to [App Store Connect](https://appstoreconnect.apple.com/)
2. Go to **Users and Access** > **Keys**
3. Create a new key in the **App Store Connect API** tab
4. Save the **Issuer ID**, **Key ID**, and **.p8 file**

### Creating Google Play Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new service account in **IAM & Admin** > **Service Accounts**
3. Enable API access in [Google Play Console](https://play.google.com/console/)
4. Link the service account and download the JSON key

### Configuring Bitrise Secrets

Set the following Secrets in Bitrise Dashboard:

```
APP_STORE_ISSUER_ID: your-issuer-id
APP_STORE_KEY_ID: your-key-id
APP_STORE_PRIVATE_KEY: (base64 encoded .p8 file content)
APP_STORE_APP_ID: your-app-id

GOOGLE_PLAY_PACKAGE_NAME: com.example.app
GOOGLE_PLAY_SERVICE_ACCOUNT: (base64 encoded JSON content)

SLACK_WEBHOOK_URL: https://hooks.slack.com/services/xxx/xxx/xxx
```

## Notification Triggers

Notifications are sent in the following cases:

### On Version/Build Change

Notifications are sent for these statuses:

**App Store:**
- `READY_FOR_SALE` - App is live
- `PENDING_DEVELOPER_RELEASE` - Waiting for developer release
- `PENDING_APPLE_RELEASE` - Waiting for Apple release
- `REJECTED` - Rejected
- `METADATA_REJECTED` - Metadata rejected
- `INVALID_BINARY` - Invalid binary

**Google Play:**
- `COMPLETED` - Release completed

### On Rejection Recovery

Notifications are sent when the app recovers from a rejected state to an approved state, even with the same version/build.

## Example Workflows

### Monitor App Store Only

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
            - slack_language: "en"
```

### With Bot Token and Mentions

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
            - slack_language: "en"
```

## Local Testing

```bash
cd bitrise-step-store-review-monitor

# Install dependencies
go mod tidy

# Build
go build -o step

# Set environment variables and test
export app_store_issuer_id="your-issuer-id"
export app_store_key_id="your-key-id"
export app_store_private_key="your-private-key"
export app_store_app_id="your-app-id"
export slack_webhook_url="your-webhook-url"
./step
```

## Related Links

- [GitHub Actions Version](https://github.com/anies1212/store-review-monitor)
- [Bitrise Step Development Guide](https://devcenter.bitrise.io/en/steps-and-workflows/developing-your-own-bitrise-step.html)

## License

MIT License
