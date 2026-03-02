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
const artifact = __importStar(require("@actions/artifact"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ARTIFACT_NAME = 'store-review-versions';
const CACHE_FILE_NAME = 'versions.json';
class VersionCacheManager {
    constructor() {
        this.artifactClient = new artifact.DefaultArtifactClient();
    }
    /**
     * Load the previous version cache from artifact
     */
    async loadPreviousVersions() {
        try {
            core.info('Loading previous version cache from artifact...');
            // Create a temporary directory for downloading
            const downloadPath = path.join(process.cwd(), '.version-cache');
            if (!fs.existsSync(downloadPath)) {
                fs.mkdirSync(downloadPath, { recursive: true });
            }
            // Find and download the artifact
            const { artifact: foundArtifact } = await this.artifactClient.getArtifact(ARTIFACT_NAME);
            const downloadResult = await this.artifactClient.downloadArtifact(foundArtifact.id, { path: downloadPath });
            core.info(`Artifact downloaded to: ${downloadResult.downloadPath}`);
            // Read the cache file
            const cacheFilePath = path.join(downloadPath, CACHE_FILE_NAME);
            if (fs.existsSync(cacheFilePath)) {
                const cacheContent = fs.readFileSync(cacheFilePath, 'utf-8');
                const cache = JSON.parse(cacheContent);
                core.info(`Loaded previous versions: ${JSON.stringify(cache)}`);
                return cache;
            }
            core.info('No cache file found in artifact');
            return null;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Unable to find')) {
                core.info('No previous artifact found (first run)');
            }
            else {
                core.warning(`Failed to load previous versions: ${error}`);
            }
            return null;
        }
    }
    /**
     * Save the current version cache to artifact
     */
    async saveCurrentVersions(cache) {
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
            const uploadResult = await this.artifactClient.uploadArtifact(ARTIFACT_NAME, [cacheFilePath], uploadPath);
            core.info(`Artifact uploaded successfully: ${uploadResult.id}`);
            // Clean up temporary directory
            fs.rmSync(uploadPath, { recursive: true, force: true });
        }
        catch (error) {
            core.warning(`Failed to save current versions: ${error}`);
        }
    }
    /**
     * Check if the version or build has changed
     */
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
    /**
     * Check if status changed from REJECTED to approved status
     */
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
        // Check if previous status was rejected
        const wasRejected = previousStatus.includes('rejected');
        // Check if current status is approved/success
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