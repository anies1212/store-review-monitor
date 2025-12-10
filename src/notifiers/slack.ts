import { IncomingWebhook } from '@slack/webhook';
import { WebClient } from '@slack/web-api';
import { NotificationPayload, SlackConfig } from '../types';
import { getMessages, Language } from '../types/i18n';

export class SlackNotifier {
  private webhook?: IncomingWebhook;
  private webClient?: WebClient;
  private config: SlackConfig;
  private language: Language;

  constructor(config: SlackConfig) {
    this.config = config;
    this.language = config.language || 'en';

    if (config.webhookUrl) {
      this.webhook = new IncomingWebhook(config.webhookUrl);
    }

    if (config.botToken) {
      this.webClient = new WebClient(config.botToken);
    }

    if (!config.webhookUrl && !config.botToken) {
      throw new Error('Either webhookUrl or botToken must be provided for Slack notifications');
    }

    if (config.botToken && !config.channel) {
      throw new Error('Channel is required when using botToken');
    }
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    const messages = getMessages(this.language);
    const color = this.getStatusColor(payload.currentStatus);
    const emoji = this.getStatusEmoji(payload.currentStatus);

    // Build mention text
    const mentionText = this.config.mentions && this.config.mentions.length > 0
      ? this.config.mentions.map(m => `<@${m}>`).join(' ') + ' '
      : '';

    const headerText = `${emoji} ${payload.platform} ${messages.reviewStatusUpdate}`;
    const fallbackText = messages.fallbackMessage(payload.platform, this.formatStatus(payload.currentStatus));

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: headerText,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*${messages.platform}:*\n${payload.platform}`,
          },
          {
            type: 'mrkdwn',
            text: `*${messages.version}:*\n${payload.version}`,
          },
          {
            type: 'mrkdwn',
            text: `*${messages.currentStatus}:*\n${this.formatStatus(payload.currentStatus)}`,
          },
          ...(payload.previousStatus
            ? [
                {
                  type: 'mrkdwn',
                  text: `*${messages.previousStatus}:*\n${this.formatStatus(payload.previousStatus)}`,
                },
              ]
            : []),
        ],
      },
      ...(payload.appName
        ? [
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*${messages.appName}:*\n${payload.appName}`,
                },
              ],
            },
          ]
        : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${messages.checkedAt}: ${new Date().toISOString()}`,
          },
        ],
      },
    ];

    if (this.webhook) {
      // Use webhook
      const message = {
        text: mentionText + headerText,
        blocks: blocks,
        attachments: [
          {
            color: color,
            fallback: fallbackText,
          },
        ],
      };

      await this.webhook.send(message);
    } else if (this.webClient && this.config.channel) {
      // Use Web API with bot token
      await this.webClient.chat.postMessage({
        channel: this.config.channel,
        text: mentionText + headerText,
        blocks: blocks,
        attachments: [
          {
            color: color,
            fallback: fallbackText,
          },
        ],
      });
    }
  }

  private getStatusColor(status: string): string {
    const statusLower = status.toLowerCase();

    if (
      statusLower.includes('approved') ||
      statusLower.includes('ready_for_sale') ||
      statusLower.includes('completed') ||
      statusLower.includes('pending_developer_release')
    ) {
      return 'good'; // Green
    }

    if (
      statusLower.includes('rejected') ||
      statusLower.includes('invalid')
    ) {
      return 'danger'; // Red
    }

    if (
      statusLower.includes('in_review') ||
      statusLower.includes('processing')
    ) {
      return 'warning'; // Yellow
    }

    return '#808080'; // Gray
  }

  private getStatusEmoji(status: string): string {
    const statusLower = status.toLowerCase();

    if (
      statusLower.includes('approved') ||
      statusLower.includes('ready_for_sale') ||
      statusLower.includes('completed') ||
      statusLower.includes('pending_developer_release')
    ) {
      return '✅';
    }

    if (
      statusLower.includes('rejected') ||
      statusLower.includes('invalid')
    ) {
      return '❌';
    }

    if (
      statusLower.includes('in_review') ||
      statusLower.includes('processing')
    ) {
      return '⏳';
    }

    return 'ℹ️';
  }

  private formatStatus(status: string): string {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}
