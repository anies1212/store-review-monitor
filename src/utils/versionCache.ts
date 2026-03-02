import * as core from '@actions/core';
import * as github from '@actions/github';

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

const VARIABLE_NAME = 'STORE_REVIEW_CACHE';

export class VersionCacheManager {
  private octokit;
  private owner: string;
  private repo: string;

  constructor() {
    const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
    this.octokit = github.getOctokit(token);
    this.owner = github.context.repo.owner;
    this.repo = github.context.repo.repo;
  }

  async loadPreviousVersions(): Promise<VersionCache | null> {
    try {
      core.info('Loading previous version cache from repository variable...');

      const { data } = await this.octokit.rest.actions.getRepoVariable({
        owner: this.owner,
        repo: this.repo,
        name: VARIABLE_NAME,
      });

      const versionCache = JSON.parse(data.value) as VersionCache;
      core.info(`Loaded previous versions: ${JSON.stringify(versionCache)}`);
      return versionCache;
    } catch (error) {
      if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
        core.info('No previous cache found (first run)');
      } else {
        core.warning(`Failed to load previous versions: ${error}`);
      }
      return null;
    }
  }

  async saveCurrentVersions(versionCache: VersionCache): Promise<void> {
    try {
      core.info('Saving current version cache to repository variable...');

      const value = JSON.stringify(versionCache);

      try {
        await this.octokit.rest.actions.updateRepoVariable({
          owner: this.owner,
          repo: this.repo,
          name: VARIABLE_NAME,
          value,
        });
      } catch (error) {
        if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
          await this.octokit.rest.actions.createRepoVariable({
            owner: this.owner,
            repo: this.repo,
            name: VARIABLE_NAME,
            value,
          });
        } else {
          throw error;
        }
      }

      core.info('Cache saved successfully');
    } catch (error) {
      core.warning(`Failed to save current versions: ${error}`);
    }
  }

  hasVersionOrBuildChanged(
    platform: 'appStore' | 'googlePlay',
    currentVersion: string | number,
    previousCache: VersionCache | null,
    currentBuild?: string | number
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

    if (platform === 'appStore' && 'version' in previousData) {
      const versionChanged = previousData.version !== currentVersion;
      const buildChanged = currentBuild !== undefined && previousData.buildNumber !== currentBuild;
      const changed = versionChanged || buildChanged;
      core.info(
        `App Store comparison: v${previousData.version}(${previousData.buildNumber}) vs v${currentVersion}(${currentBuild}) - Changed: ${changed}`
      );
      return changed;
    } else if (platform === 'googlePlay' && 'versionCode' in previousData) {
      const versionChanged = previousData.versionCode !== currentVersion;
      core.info(
        `Google Play version comparison: ${previousData.versionCode} vs ${currentVersion} - Changed: ${versionChanged}`
      );
      return versionChanged;
    }

    return true;
  }

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

    const wasRejected = previousStatus.includes('rejected');

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
