export type Language = 'en' | 'ja';

export interface Messages {
  reviewStatusUpdate: string;
  platform: string;
  version: string;
  currentStatus: string;
  previousStatus: string;
  appName: string;
  checkedAt: string;
  fallbackMessage: (platform: string, status: string) => string;
}

const enMessages: Messages = {
  reviewStatusUpdate: 'Review Status Update',
  platform: 'Platform',
  version: 'Version',
  currentStatus: 'Current Status',
  previousStatus: 'Previous Status',
  appName: 'App Name',
  checkedAt: 'Checked at',
  fallbackMessage: (platform: string, status: string) =>
    `${platform} review status changed to ${status}`,
};

const jaMessages: Messages = {
  reviewStatusUpdate: '審査ステータス更新',
  platform: 'プラットフォーム',
  version: 'バージョン',
  currentStatus: '現在のステータス',
  previousStatus: '前回のステータス',
  appName: 'アプリ名',
  checkedAt: '確認日時',
  fallbackMessage: (platform: string, status: string) =>
    `${platform}の審査ステータスが${status}に変更されました`,
};

export const messages: Record<Language, Messages> = {
  en: enMessages,
  ja: jaMessages,
};

export function getMessages(language: Language): Messages {
  return messages[language] || messages.en;
}
