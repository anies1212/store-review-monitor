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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppStoreConnectMonitor = void 0;
const axios_1 = __importDefault(require("axios"));
const jwt = __importStar(require("jsonwebtoken"));
class AppStoreConnectMonitor {
    constructor(config) {
        this.baseURL = 'https://api.appstoreconnect.apple.com/v1';
        this.config = config;
    }
    async getReviewStatus() {
        try {
            const token = this.generateToken();
            // Get app information
            const appResponse = await axios_1.default.get(`${this.baseURL}/apps/${this.config.appId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            // Get the latest app store version
            const versionsResponse = await axios_1.default.get(`${this.baseURL}/apps/${this.config.appId}/appStoreVersions`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                params: {
                    'filter[platform]': 'IOS',
                    'limit': 1,
                    'sort': '-createdDate',
                },
            });
            if (!versionsResponse.data.data || versionsResponse.data.data.length === 0) {
                console.log('No app store versions found');
                return null;
            }
            const latestVersion = versionsResponse.data.data[0];
            const status = latestVersion.attributes.appStoreState;
            const version = latestVersion.attributes.versionString;
            // Get the build number from the build relationship
            let buildNumber;
            try {
                const buildRelationship = latestVersion.relationships?.build?.data;
                if (buildRelationship?.id) {
                    const buildResponse = await axios_1.default.get(`${this.baseURL}/builds/${buildRelationship.id}`, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                    });
                    buildNumber = buildResponse.data.data?.attributes?.version;
                }
            }
            catch (error) {
                console.warn('Failed to fetch build number:', error);
            }
            return {
                appId: this.config.appId,
                version: version,
                buildNumber: buildNumber,
                status: status,
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error('App Store Connect API Error:', error.response?.data || error.message);
            }
            else {
                console.error('Error fetching App Store review status:', error);
            }
            throw error;
        }
    }
    generateToken() {
        const now = Math.floor(Date.now() / 1000);
        const exp = now + 20 * 60; // 20 minutes
        const payload = {
            iss: this.config.issuerId,
            iat: now,
            exp: exp,
            aud: 'appstoreconnect-v1',
        };
        // Decode base64 private key if needed
        let privateKey = this.config.privateKey;
        if (!privateKey.includes('BEGIN PRIVATE KEY')) {
            privateKey = Buffer.from(privateKey, 'base64').toString('utf-8');
        }
        const token = jwt.sign(payload, privateKey, {
            algorithm: 'ES256',
            keyid: this.config.keyId,
        });
        return token;
    }
}
exports.AppStoreConnectMonitor = AppStoreConnectMonitor;
//# sourceMappingURL=appStoreConnect.js.map