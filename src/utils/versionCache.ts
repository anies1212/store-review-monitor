import * as core from '@actions/core';
import * as artifact from '@actions/artifact';
import * as fs from 'fs';
import * as path from 'path';

export interface VersionCache {
  appStore?: {
    appId: string;
    version: string;
    buildNumber?: string;
    status: string;
  };
  googlePlay?: {
    packageName: string;
    versionCode: number;
    versionName?: string;
    status: string;
  };
  lastChecked: string;
}

const ARTIFACT_NAME = 'store-review-versions';
const CACHE_FILE_NAME = 'versions.json';

export class VersionCacheManager {
  private artifactClient = artifact.create();

  /**
   * Load the previous version cache from artifact
   */
  async loadPreviousVersions(): Promise<VersionCache | null> {
    try {
      core.info('Loading previous version cache from artifact...');

      // Create a temporary directory for downloading
      const downloadPath = path.join(process.cwd(), '.version-cache');
      if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      // Download the artifact
      const downloadResult = await this.artifactClient.downloadArtifact(
        ARTIFACT_NAME,
        downloadPath
      );

      core.info(`Artifact downloaded to: ${downloadResult.downloadPath}`);

      // Read the cache file
      const cacheFilePath = path.join(downloadPath, CACHE_FILE_NAME);
      if (fs.existsSync(cacheFilePath)) {
        const cacheContent = fs.readFileSync(cacheFilePath, 'utf-8');
        const cache = JSON.parse(cacheContent) as VersionCache;
        core.info(`Loaded previous versions: ${JSON.stringify(cache)}`);
        return cache;
      }

      core.info('No cache file found in artifact');
      return null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unable to find')) {
        core.info('No previous artifact found (first run)');
      } else {
        core.warning(`Failed to load previous versions: ${error}`);
      }
      return null;
    }
  }

  /**
   * Save the current version cache to artifact
   */
  async saveCurrentVersions(cache: VersionCache): Promise<void> {
    try {
      core.info('Saving current version cache to artifact...');

      // Create a temporary directory for uploading
      const uploadPath = path.join(process.cwd(), '.version-cache-upload');
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }

      // Write the cache file
      const cacheFilePath = path.join(uploadPath, CACHE_FILE_NAME);
      fs.writeFileSync(cacheFilePath, JSON.stringify(cache, null, 2), 'utf-8');

      core.info(`Cache file created at: ${cacheFilePath}`);

      // Upload the artifact
      const uploadResult = await this.artifactClient.uploadArtifact(
        ARTIFACT_NAME,
        [cacheFilePath],
        uploadPath,
        {
          continueOnError: false,
        }
      );

      core.info(`Artifact uploaded successfully: ${uploadResult.artifactName}`);

      // Clean up temporary directory
      fs.rmSync(uploadPath, { recursive: true, force: true });
    } catch (error) {
      core.warning(`Failed to save current versions: ${error}`);
    }
  }

  /**
   * Check if the version or build has changed
   */
  hasVersionOrBuildChanged(
    platform: 'appStore' | 'googlePlay',
    currentVersion: string | number,
    currentBuild?: string | number,
    previousCache: VersionCache | null
  ): boolean {
    if (!previousCache) {
      core.info(`No previous cache found for ${platform}, treating as changed`);
      return true;
    }

    const previousData = previousCache[platform];
    if (!previousData) {
      core.info(`No previous data found for ${platform}, treating as changed`);
      return true;
    }

    if (platform === 'appStore') {
      const versionChanged = previousData.version !== currentVersion;
      const buildChanged = currentBuild && previousData.buildNumber !== currentBuild;
      const changed = versionChanged || buildChanged;
      core.info(
        `App Store comparison: v${previousData.version}(${previousData.buildNumber}) vs v${currentVersion}(${currentBuild}) - Changed: ${changed}`
      );
      return changed;
    } else {
      const versionChanged = previousData.versionCode !== currentVersion;
      core.info(
        `Google Play version comparison: ${previousData.versionCode} vs ${currentVersion} - Changed: ${versionChanged}`
      );
      return versionChanged;
    }
  }

  /**
   * Check if status changed from REJECTED to approved status
   */
  hasRecoveredFromRejection(
    platform: 'appStore' | 'googlePlay',
    currentStatus: string,
    previousCache: VersionCache | null
  ): boolean {
    if (!previousCache) {
      return false;
    }

    const previousData = previousCache[platform];
    if (!previousData) {
      return false;
    }

    const previousStatus = previousData.status.toLowerCase();
    const currentStatusLower = currentStatus.toLowerCase();

    // Check if previous status was rejected
    const wasRejected = previousStatus.includes('rejected');

    // Check if current status is approved/success
    const isApproved =
      currentStatusLower.includes('ready_for_sale') ||
      currentStatusLower.includes('pending_developer_release') ||
      currentStatusLower.includes('pending_apple_release') ||
      currentStatusLower.includes('completed');

    const recovered = wasRejected && isApproved;
    if (recovered) {
      core.info(`${platform} recovered from rejection: ${previousStatus} -> ${currentStatus}`);
    }

    return recovered;
  }
}
