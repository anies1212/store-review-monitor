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
const artifact_1 = require("@actions/artifact");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ARTIFACT_NAME = "store-review-cache";
const CACHE_FILE = "versions.json";
class VersionCacheManager {
    constructor() {
        this.token = process.env.GITHUB_TOKEN || core.getInput("github-token");
        this.octokit = github.getOctokit(this.token);
        this.owner = github.context.repo.owner;
        this.repo = github.context.repo.repo;
        this.artifactClient = new artifact_1.DefaultArtifactClient();
    }
    async loadPreviousVersions() {
        try {
            core.info("Loading previous version cache from artifacts...");
            const latestArtifact = await this.findLatestArtifact();
            if (!latestArtifact) {
                core.info("No previous cache artifact found (first run)");
                return null;
            }
            const tempDir = path.join(process.env.RUNNER_TEMP || "/tmp", "cache-download");
            fs.mkdirSync(tempDir, { recursive: true });
            const downloadResponse = await this.artifactClient.downloadArtifact(latestArtifact.id, {
                path: tempDir,
                findBy: {
                    token: this.token,
                    workflowRunId: latestArtifact.workflowRunId,
                    repositoryOwner: this.owner,
                    repositoryName: this.repo,
                },
            });
            const filePath = path.join(downloadResponse.downloadPath || tempDir, CACHE_FILE);
            if (!fs.existsSync(filePath)) {
                core.info("Cache file not found in artifact");
                return null;
            }
            const content = fs.readFileSync(filePath, "utf-8");
            const versionCache = JSON.parse(content);
            core.info(`Loaded previous versions: ${JSON.stringify(versionCache)}`);
            return versionCache;
        }
        catch (error) {
            core.warning(`Failed to load previous versions: ${error}`);
            return null;
        }
    }
    async saveCurrentVersions(versionCache) {
        try {
            core.info("Saving current version cache as artifact...");
            const tempDir = path.join(process.env.RUNNER_TEMP || "/tmp", "cache-upload");
            fs.mkdirSync(tempDir, { recursive: true });
            const filePath = path.join(tempDir, CACHE_FILE);
            fs.writeFileSync(filePath, JSON.stringify(versionCache, null, 2));
            await this.artifactClient.uploadArtifact(ARTIFACT_NAME, [filePath], tempDir, { retentionDays: 90 });
            core.info("Cache saved successfully as artifact");
        }
        catch (error) {
            core.warning(`Failed to save current versions: ${error}`);
        }
    }
    async findLatestArtifact() {
        try {
            const { data } = await this.octokit.rest.actions.listArtifactsForRepo({
                owner: this.owner,
                repo: this.repo,
                name: ARTIFACT_NAME,
                per_page: 1,
            });
            if (data.total_count === 0 || data.artifacts.length === 0) {
                return null;
            }
            const latest = data.artifacts[0];
            return {
                id: latest.id,
                workflowRunId: latest.workflow_run?.id ?? 0,
            };
        }
        catch (error) {
            core.warning(`Failed to find latest artifact: ${error}`);
            return null;
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
        if (platform === "appStore" && "version" in previousData) {
            const versionChanged = previousData.version !== currentVersion;
            const buildChanged = currentBuild !== undefined && previousData.buildNumber !== currentBuild;
            const changed = versionChanged || buildChanged;
            core.info(`App Store comparison: v${previousData.version}(${previousData.buildNumber}) vs v${currentVersion}(${currentBuild}) - Changed: ${changed}`);
            return changed;
        }
        else if (platform === "googlePlay" && "versionCode" in previousData) {
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
        const wasRejected = previousStatus.includes("rejected");
        const isApproved = currentStatusLower.includes("ready_for_sale") ||
            currentStatusLower.includes("pending_developer_release") ||
            currentStatusLower.includes("pending_apple_release") ||
            currentStatusLower.includes("completed");
        const recovered = wasRejected && isApproved;
        if (recovered) {
            core.info(`${platform} recovered from rejection: ${previousStatus} -> ${currentStatus}`);
        }
        return recovered;
    }
    hasCacheChanged(currentCache, previousCache) {
        if (!previousCache) {
            return true;
        }
        const currentWithoutTimestamp = {
            appStore: currentCache.appStore,
            googlePlay: currentCache.googlePlay,
        };
        const previousWithoutTimestamp = {
            appStore: previousCache.appStore,
            googlePlay: previousCache.googlePlay,
        };
        return (JSON.stringify(currentWithoutTimestamp) !==
            JSON.stringify(previousWithoutTimestamp));
    }
}
exports.VersionCacheManager = VersionCacheManager;
//# sourceMappingURL=versionCache.js.map