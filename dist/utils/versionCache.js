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
const cache = __importStar(require("@actions/cache"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CACHE_KEY_PREFIX = 'store-review-versions-v1';
const CACHE_RESTORE_KEY = CACHE_KEY_PREFIX;
const CACHE_FILE_NAME = 'versions.json';
class VersionCacheManager {
    constructor() {
        this.cacheDirPath = path.join(process.cwd(), '.version-cache');
        this.cacheFilePath = path.join(this.cacheDirPath, CACHE_FILE_NAME);
    }
    async loadPreviousVersions() {
        try {
            core.info('Loading previous version cache...');
            if (!fs.existsSync(this.cacheDirPath)) {
                fs.mkdirSync(this.cacheDirPath, { recursive: true });
            }
            const cacheHit = await cache.restoreCache([this.cacheFilePath], CACHE_RESTORE_KEY, [CACHE_RESTORE_KEY]);
            if (!cacheHit) {
                core.info('No previous cache found (first run)');
                return null;
            }
            if (fs.existsSync(this.cacheFilePath)) {
                const cacheContent = fs.readFileSync(this.cacheFilePath, 'utf-8');
                const versionCache = JSON.parse(cacheContent);
                core.info(`Loaded previous versions: ${JSON.stringify(versionCache)}`);
                return versionCache;
            }
            core.info('Cache restored but file not found');
            return null;
        }
        catch (error) {
            core.warning(`Failed to load previous versions: ${error}`);
            return null;
        }
    }
    async saveCurrentVersions(versionCache) {
        try {
            core.info('Saving current version cache...');
            if (!fs.existsSync(this.cacheDirPath)) {
                fs.mkdirSync(this.cacheDirPath, { recursive: true });
            }
            fs.writeFileSync(this.cacheFilePath, JSON.stringify(versionCache, null, 2), 'utf-8');
            // Use timestamp in key to ensure uniqueness (cache keys are immutable)
            const cacheKey = `${CACHE_KEY_PREFIX}-${Date.now()}`;
            await cache.saveCache([this.cacheFilePath], cacheKey);
            core.info('Cache saved successfully');
        }
        catch (error) {
            if (error instanceof Error &&
                error.message.includes('already exists')) {
                core.info('Cache with this key already exists, will be updated on next change');
            }
            else {
                core.warning(`Failed to save current versions: ${error}`);
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