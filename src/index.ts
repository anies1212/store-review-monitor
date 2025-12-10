import * as core from '@actions/core';
import { AppStoreConnectMonitor } from './monitors/appStoreConnect';
import { GooglePlayConsoleMonitor } from './monitors/googlePlayConsole';
import { SlackNotifier } from './notifiers/slack';
import { AppStoreConfig, GooglePlayConfig, NotificationPayload, SlackConfig } from './types';
import { VersionCacheManager, VersionCache } from './utils/versionCache';

async function run(): Promise<void> {
  try {
    // Initialize version cache manager
    const cacheManager = new VersionCacheManager();
    const previousCache = await cacheManager.loadPreviousVersions();

    const currentCache: VersionCache = {
      lastChecked: new Date().toISOString(),
    };

    // Get inputs
    const appStoreIssuerId = core.getInput('app-store-issuer-id');
    const appStoreKeyId = core.getInput('app-store-key-id');
    const appStorePrivateKey = core.getInput('app-store-private-key');
    const appStoreAppId = core.getInput('app-store-app-id');

    const googlePlayPackageName = core.getInput('google-play-package-name');
    const googlePlayServiceAccount = core.getInput('google-play-service-account');

    const slackWebhookUrl = core.getInput('slack-webhook-url');
    const slackBotToken = core.getInput('slack-bot-token');
    const slackChannel = core.getInput('slack-channel');
    const slackLanguage = core.getInput('slack-language') as 'en' | 'ja' || 'en';
    const slackMentionsInput = core.getInput('slack-mentions');

    if (!slackWebhookUrl && !slackBotToken) {
      throw new Error('Either slack-webhook-url or slack-bot-token is required');
    }

    if (slackBotToken && !slackChannel) {
      throw new Error('slack-channel is required when using slack-bot-token');
    }

    const slackMentions = slackMentionsInput
      ? slackMentionsInput.split(',').map(m => m.trim()).filter(m => m.length > 0)
      : [];

    const slackConfig: SlackConfig = {
      webhookUrl: slackWebhookUrl || undefined,
      botToken: slackBotToken || undefined,
      channel: slackChannel || undefined,
      language: slackLanguage,
      mentions: slackMentions.length > 0 ? slackMentions : undefined,
    };

    const notifier = new SlackNotifier(slackConfig);

    let appStoreStatusSent = false;
    let googlePlayStatusSent = false;

    // Monitor App Store Connect
    if (appStoreIssuerId && appStoreKeyId && appStorePrivateKey && appStoreAppId) {
      core.info('Monitoring App Store Connect...');

      const appStoreConfig: AppStoreConfig = {
        issuerId: appStoreIssuerId,
        keyId: appStoreKeyId,
        privateKey: appStorePrivateKey,
        appId: appStoreAppId,
      };

      const appStoreMonitor = new AppStoreConnectMonitor(appStoreConfig);

      try {
        const reviewInfo = await appStoreMonitor.getReviewStatus();

        if (reviewInfo) {
          core.info(`App Store status: ${reviewInfo.status}`);
          core.setOutput('app-store-status', reviewInfo.status);

          // Update current cache
          currentCache.appStore = {
            appId: reviewInfo.appId,
            version: reviewInfo.version,
            buildNumber: reviewInfo.buildNumber,
            status: reviewInfo.status,
          };

          // Check if version or build has changed
          const versionOrBuildChanged = cacheManager.hasVersionOrBuildChanged(
            'appStore',
            reviewInfo.version,
            reviewInfo.buildNumber,
            previousCache
          );

          // Check if recovered from rejection (same version/build but status changed from REJECTED to approved)
          const recoveredFromRejection = cacheManager.hasRecoveredFromRejection(
            'appStore',
            reviewInfo.status,
            previousCache
          );

          // Check if we should notify (status-based check)
          const shouldNotify = shouldSendNotification(reviewInfo.status);

          // Notify if: (version/build changed OR recovered from rejection) AND should notify
          if ((versionOrBuildChanged || recoveredFromRejection) && shouldNotify) {
            const previousVersion = previousCache?.appStore?.version;
            const previousBuild = previousCache?.appStore?.buildNumber;
            const previousStatus = previousCache?.appStore?.status;

            const payload: NotificationPayload = {
              platform: 'App Store',
              version: `${reviewInfo.version}${reviewInfo.buildNumber ? ` (${reviewInfo.buildNumber})` : ''}`,
              currentStatus: reviewInfo.status,
              previousStatus: previousStatus || undefined,
            };

            await notifier.sendNotification(payload);
            appStoreStatusSent = true;

            if (recoveredFromRejection) {
              core.info(`Sent App Store notification to Slack (recovered from rejection: ${previousStatus} -> ${reviewInfo.status})`);
            } else {
              core.info(`Sent App Store notification to Slack (version/build changed: v${previousVersion}(${previousBuild}) -> v${reviewInfo.version}(${reviewInfo.buildNumber}))`);
            }
          } else if (!versionOrBuildChanged && !recoveredFromRejection) {
            core.info('App Store version/build has not changed and not recovered from rejection, skipping notification');
          } else {
            core.info('App Store status does not require notification');
          }
        } else {
          core.info('No App Store review information available');
        }
      } catch (error) {
        core.warning(`Failed to monitor App Store Connect: ${error}`);
      }
    } else {
      core.info('Skipping App Store Connect monitoring (missing configuration)');
    }

    // Monitor Google Play Console
    if (googlePlayPackageName && googlePlayServiceAccount) {
      core.info('Monitoring Google Play Console...');

      const googlePlayConfig: GooglePlayConfig = {
        packageName: googlePlayPackageName,
        serviceAccount: googlePlayServiceAccount,
      };

      const googlePlayMonitor = new GooglePlayConsoleMonitor(googlePlayConfig);

      try {
        const reviewInfo = await googlePlayMonitor.getReviewStatus();

        if (reviewInfo) {
          core.info(`Google Play status: ${reviewInfo.status}`);
          core.setOutput('google-play-status', reviewInfo.status);

          // Update current cache
          currentCache.googlePlay = {
            packageName: reviewInfo.packageName,
            versionCode: reviewInfo.versionCode,
            versionName: reviewInfo.versionName,
            status: reviewInfo.status,
          };

          // Check if version has changed
          const versionChanged = cacheManager.hasVersionOrBuildChanged(
            'googlePlay',
            reviewInfo.versionCode,
            undefined,
            previousCache
          );

          // Check if recovered from rejection
          const recoveredFromRejection = cacheManager.hasRecoveredFromRejection(
            'googlePlay',
            reviewInfo.status,
            previousCache
          );

          // Check if we should notify (status-based check)
          const shouldNotify = shouldSendNotification(reviewInfo.status);

          // Notify if: (version changed OR recovered from rejection) AND should notify
          if ((versionChanged || recoveredFromRejection) && shouldNotify) {
            const previousVersionCode = previousCache?.googlePlay?.versionCode;
            const previousStatus = previousCache?.googlePlay?.status;

            const payload: NotificationPayload = {
              platform: 'Google Play',
              version: reviewInfo.versionCode.toString(),
              currentStatus: reviewInfo.status,
              previousStatus: previousStatus || undefined,
            };

            await notifier.sendNotification(payload);
            googlePlayStatusSent = true;

            if (recoveredFromRejection) {
              core.info(`Sent Google Play notification to Slack (recovered from rejection: ${previousStatus} -> ${reviewInfo.status})`);
            } else {
              core.info(`Sent Google Play notification to Slack (version changed: ${previousVersionCode} -> ${reviewInfo.versionCode})`);
            }
          } else if (!versionChanged && !recoveredFromRejection) {
            core.info('Google Play version has not changed and not recovered from rejection, skipping notification');
          } else {
            core.info('Google Play status does not require notification');
          }
        } else {
          core.info('No Google Play review information available');
        }
      } catch (error) {
        core.warning(`Failed to monitor Google Play Console: ${error}`);
      }
    } else {
      core.info('Skipping Google Play Console monitoring (missing configuration)');
    }

    // Save current cache for next run
    await cacheManager.saveCurrentVersions(currentCache);

    // Set output
    core.setOutput('notification-sent', appStoreStatusSent || googlePlayStatusSent);

    core.info('Store review monitoring completed successfully');
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

function shouldSendNotification(status: string): boolean {
  const statusLower = status.toLowerCase();

  // Notify on these statuses
  const notifyStatuses = [
    'pending_developer_release',
    'pending_apple_release',
    'ready_for_sale',
    'rejected',
    'metadata_rejected',
    'invalid_binary',
    'completed',
  ];

  return notifyStatuses.some((s) => statusLower.includes(s.toLowerCase()));
}

run();
