"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCacheManager = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const CACHE_BRANCH = 'store-review-cache';
const CACHE_FILE_PATH = 'cache/versions.json';
class VersionCacheManager {
    constructor() {
        const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
        this.octokit = github.getOctokit(token);
        this.owner = github.context.repo.owner;
        this.repo = github.context.repo.repo;
    }
    async loadPreviousVersions() {
        try {
            core.info('Loading previous version cache from cache branch...');
            const { data } = await this.octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: CACHE_FILE_PATH,
                ref: CACHE_BRANCH,
            });
            if ('content' in data) {
                const content = Buffer.from(data.content, 'base64').toString('utf-8');
                const versionCache = JSON.parse(content);
                core.info(`Loaded previous versions: ${JSON.stringify(versionCache)}`);
                return versionCache;
            }
            core.info('Cache file found but no content');
            return null;
        }
        catch (error) {
            if (error instanceof Error && 'status' in error && error.status === 404) {
                core.info('No previous cache found (first run)');
            }
            else {
                core.warning(`Failed to load previous versions: ${error}`);
            }
            return null;
        }
    }
    async saveCurrentVersions(versionCache) {
        try {
            core.info('Saving current version cache to cache branch...');
            const content = Buffer.from(JSON.stringify(versionCache, null, 2)).toString('base64');
            // Ensure cache branch exists
            await this.ensureCacheBranch();
            // Check if file already exists to get its SHA
            let fileSha;
            try {
                const { data } = await this.octokit.rest.repos.getContent({
                    owner: this.owner,
                    repo: this.repo,
                    path: CACHE_FILE_PATH,
                    ref: CACHE_BRANCH,
                });
                if ('sha' in data) {
                    fileSha = data.sha;
                }
            }
            catch {
                // File doesn't exist yet
            }
            await this.octokit.rest.repos.createOrUpdateFileContents({
                owner: this.owner,
                repo: this.repo,
                path: CACHE_FILE_PATH,
                message: `chore: update store review cache [skip ci]`,
                content,
                branch: CACHE_BRANCH,
                ...(fileSha ? { sha: fileSha } : {}),
            });
            core.info('Cache saved successfully');
        }
        catch (error) {
            core.warning(`Failed to save current versions: ${error}`);
        }
    }
    async ensureCacheBranch() {
        try {
            await this.octokit.rest.repos.getBranch({
                owner: this.owner,
                repo: this.repo,
                branch: CACHE_BRANCH,
            });
        }
        catch (error) {
            if (error instanceof Error && 'status' in error && error.status === 404) {
                core.info(`Creating cache branch: ${CACHE_BRANCH}`);
                // Get default branch SHA
                const { data: ref } = await this.octokit.rest.git.getRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: `heads/${github.context.ref.replace('refs/heads/', '')}`,
                });
                await this.octokit.rest.git.createRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: `refs/heads/${CACHE_BRANCH}`,
                    sha: ref.object.sha,
                });
                core.info(`Cache branch created: ${CACHE_BRANCH}`);
            }
            else {
                throw error;
            }
        }
    }
    hasVersionOrBuildChanged(platform, currentVersion, previousCache, currentBuild) {
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
            core.info(`App Store comparison: v${previousData.version}(${previousData.buildNumber}) vs v${currentVersion}(${currentBuild}) - Changed: ${changed}`);
            return changed;
        }
        else if (platform === 'googlePlay' && 'versionCode' in previousData) {
            const versionChanged = previousData.versionCode !== currentVersion;
            core.info(`Google Play version comparison: ${previousData.versionCode} vs ${currentVersion} - Changed: ${versionChanged}`);
            return versionChanged;
        }
        return true;
    }
    hasRecoveredFromRejection(platform, currentStatus, previousCache) {
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
        const isApproved = currentStatusLower.includes('ready_for_sale') ||
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
exports.VersionCacheManager = VersionCacheManager;
//# sourceMappingURL=versionCache.js.map