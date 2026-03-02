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
const VARIABLE_NAME = 'STORE_REVIEW_CACHE';
class VersionCacheManager {
    constructor() {
        const token = process.env.GITHUB_TOKEN || core.getInput('github-token');
        this.octokit = github.getOctokit(token);
        this.owner = github.context.repo.owner;
        this.repo = github.context.repo.repo;
    }
    async loadPreviousVersions() {
        try {
            core.info('Loading previous version cache from repository variable...');
            const { data } = await this.octokit.rest.actions.getRepoVariable({
                owner: this.owner,
                repo: this.repo,
                name: VARIABLE_NAME,
            });
            const versionCache = JSON.parse(data.value);
            core.info(`Loaded previous versions: ${JSON.stringify(versionCache)}`);
            return versionCache;
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
            core.info('Saving current version cache to repository variable...');
            const value = JSON.stringify(versionCache);
            try {
                await this.octokit.rest.actions.updateRepoVariable({
                    owner: this.owner,
                    repo: this.repo,
                    name: VARIABLE_NAME,
                    value,
                });
            }
            catch (error) {
                if (error instanceof Error && 'status' in error && error.status === 404) {
                    await this.octokit.rest.actions.createRepoVariable({
                        owner: this.owner,
                        repo: this.repo,
                        name: VARIABLE_NAME,
                        value,
                    });
                }
                else {
                    throw error;
                }
            }
            core.info('Cache saved successfully');
        }
        catch (error) {
            core.warning(`Failed to save current versions: ${error}`);
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