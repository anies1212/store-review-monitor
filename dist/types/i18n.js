"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messages = void 0;
exports.getMessages = getMessages;
const enMessages = {
    reviewStatusUpdate: 'Review Status Update',
    platform: 'Platform',
    version: 'Version',
    currentStatus: 'Current Status',
    previousStatus: 'Previous Status',
    appName: 'App Name',
    checkedAt: 'Checked at',
    fallbackMessage: (platform, status) => `${platform} review status changed to ${status}`,
};
const jaMessages = {
    reviewStatusUpdate: '審査ステータス更新',
    platform: 'プラットフォーム',
    version: 'バージョン',
    currentStatus: '現在のステータス',
    previousStatus: '前回のステータス',
    appName: 'アプリ名',
    checkedAt: '確認日時',
    fallbackMessage: (platform, status) => `${platform}の審査ステータスが${status}に変更されました`,
};
exports.messages = {
    en: enMessages,
    ja: jaMessages,
};
function getMessages(language) {
    return exports.messages[language] || exports.messages.en;
}
//# sourceMappingURL=i18n.js.map