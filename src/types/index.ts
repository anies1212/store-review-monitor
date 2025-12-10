export interface AppStoreConfig {
  issuerId: string;
  keyId: string;
  privateKey: string;
  appId: string;
}

export interface GooglePlayConfig {
  packageName: string;
  serviceAccount: string;
}

export interface SlackConfig {
  webhookUrl?: string;
  botToken?: string;
  channel?: string;
  language?: 'en' | 'ja';
  mentions?: string[];
}

export interface MonitorConfig {
  appStore?: AppStoreConfig;
  googlePlay?: GooglePlayConfig;
  slack: SlackConfig;
}

export enum AppStoreReviewStatus {
  WAITING_FOR_REVIEW = 'WAITING_FOR_REVIEW',
  IN_REVIEW = 'IN_REVIEW',
  PENDING_DEVELOPER_RELEASE = 'PENDING_DEVELOPER_RELEASE',
  PROCESSING_FOR_APP_STORE = 'PROCESSING_FOR_APP_STORE',
  PENDING_APPLE_RELEASE = 'PENDING_APPLE_RELEASE',
  READY_FOR_SALE = 'READY_FOR_SALE',
  REJECTED = 'REJECTED',
  METADATA_REJECTED = 'METADATA_REJECTED',
  REMOVED_FROM_SALE = 'REMOVED_FROM_SALE',
  DEVELOPER_REJECTED = 'DEVELOPER_REJECTED',
  DEVELOPER_REMOVED_FROM_SALE = 'DEVELOPER_REMOVED_FROM_SALE',
  INVALID_BINARY = 'INVALID_BINARY',
}

export enum GooglePlayReviewStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'inProgress',
  HALTED = 'halted',
  COMPLETED = 'completed',
}

export interface AppStoreReviewInfo {
  appId: string;
  version: string;
  buildNumber?: string;
  status: AppStoreReviewStatus;
  statusChangedAt?: Date;
}

export interface GooglePlayReviewInfo {
  packageName: string;
  versionCode: number;
  versionName?: string;
  status: GooglePlayReviewStatus;
  statusChangedAt?: Date;
}

export interface ReviewStatus {
  appStore?: AppStoreReviewInfo;
  googlePlay?: GooglePlayReviewInfo;
  checkedAt: Date;
}

export interface NotificationPayload {
  platform: 'App Store' | 'Google Play';
  appName?: string;
  version: string;
  previousStatus?: string;
  currentStatus: string;
  statusChangedAt?: Date;
}
