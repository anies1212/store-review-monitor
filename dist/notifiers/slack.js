"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackNotifier = void 0;
const webhook_1 = require("@slack/webhook");
const web_api_1 = require("@slack/web-api");
const i18n_1 = require("../types/i18n");
class SlackNotifier {
    constructor(config) {
        this.config = config;
        this.language = config.language || "en";
        if (config.webhookUrl) {
            this.webhook = new webhook_1.IncomingWebhook(config.webhookUrl);
        }
        if (config.botToken) {
            this.webClient = new web_api_1.WebClient(config.botToken);
        }
        if (!config.webhookUrl && !config.botToken) {
            throw new Error("Either webhookUrl or botToken must be provided for Slack notifications");
        }
        if (config.botToken && !config.channel) {
            throw new Error("Channel is required when using botToken");
        }
    }
    async sendNotification(payload) {
        const messages = (0, i18n_1.getMessages)(this.language);
        const color = this.getStatusColor(payload.currentStatus);
        const emoji = this.getStatusEmoji(payload.currentStatus);
        // Build mention text
        const mentionText = this.config.mentions && this.config.mentions.length > 0
            ? this.config.mentions.map((m) => `<@${m}>`).join(" ") + " "
            : "";
        const headerText = `${emoji} ${payload.platform} ${messages.reviewStatusUpdate}`;
        const fallbackText = messages.fallbackMessage(payload.platform, this.formatStatusWithLanguage(payload.currentStatus));
        const blocks = [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: headerText,
                    emoji: true,
                },
            },
            {
                type: "section",
                fields: [
                    {
                        type: "mrkdwn",
                        text: `*${messages.platform}:*\n${payload.platform}`,
                    },
                    {
                        type: "mrkdwn",
                        text: `*${messages.version}:*\n${payload.version}`,
                    },
                    {
                        type: "mrkdwn",
                        text: `*${messages.currentStatus}:*\n${this.formatStatusWithLanguage(payload.currentStatus)}`,
                    },
                    ...(payload.previousStatus
                        ? [
                            {
                                type: "mrkdwn",
                                text: `*${messages.previousStatus}:*\n${this.formatStatusWithLanguage(payload.previousStatus)}`,
                            },
                        ]
                        : []),
                ],
            },
            ...(payload.appName
                ? [
                    {
                        type: "section",
                        fields: [
                            {
                                type: "mrkdwn",
                                text: `*${messages.appName}:*\n${payload.appName}`,
                            },
                        ],
                    },
                ]
                : []),
            {
                type: "context",
                elements: [
                    {
                        type: "mrkdwn",
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
        }
        else if (this.webClient && this.config.channel) {
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
    getStatusColor(status) {
        const statusLower = status.toLowerCase();
        if (statusLower.includes("approved") ||
            statusLower.includes("ready_for_sale") ||
            statusLower.includes("completed") ||
            statusLower.includes("pending_developer_release")) {
            return "good"; // Green
        }
        if (statusLower.includes("rejected") || statusLower.includes("invalid")) {
            return "danger"; // Red
        }
        if (statusLower.includes("in_review") ||
            statusLower.includes("processing")) {
            return "warning"; // Yellow
        }
        return "#808080"; // Gray
    }
    getStatusEmoji(status) {
        const statusLower = status.toLowerCase();
        if (statusLower.includes("approved") ||
            statusLower.includes("ready_for_sale") ||
            statusLower.includes("completed") ||
            statusLower.includes("pending_developer_release")) {
            return "✅";
        }
        if (statusLower.includes("rejected") || statusLower.includes("invalid")) {
            return "❌";
        }
        if (statusLower.includes("in_review") ||
            statusLower.includes("processing")) {
            return "⏳";
        }
        return "ℹ️";
    }
    formatStatusWithLanguage(status) {
        const formatted = this.formatStatus(status);
        if (this.language !== "ja") {
            return formatted;
        }
        const ja = statusJaMap[status.toUpperCase()];
        return ja ? `${ja}（${formatted}）` : formatted;
    }
    formatStatus(status) {
        return status
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(" ");
    }
}
exports.SlackNotifier = SlackNotifier;
const statusJaMap = {
    WAITING_FOR_REVIEW: "審査待ち",
    IN_REVIEW: "審査中",
    PENDING_DEVELOPER_RELEASE: "リリースできる状態",
    PROCESSING_FOR_APP_STORE: "App Store処理中",
    PENDING_APPLE_RELEASE: "Appleリリース待ち",
    READY_FOR_SALE: "販売中",
    REJECTED: "リジェクト",
    METADATA_REJECTED: "メタデータリジェクト",
    REMOVED_FROM_SALE: "販売停止",
    DEVELOPER_REJECTED: "開発者によるリジェクト",
    DEVELOPER_REMOVED_FROM_SALE: "開発者による販売停止",
    INVALID_BINARY: "無効なバイナリ",
    DRAFT: "下書き",
    INPROGRESS: "公開中",
    HALTED: "公開停止",
    COMPLETED: "公開完了",
};
//# sourceMappingURL=slack.js.map