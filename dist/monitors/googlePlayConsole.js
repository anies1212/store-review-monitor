"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GooglePlayConsoleMonitor = void 0;
const axios_1 = __importDefault(require("axios"));
const types_1 = require("../types");
class GooglePlayConsoleMonitor {
    constructor(config) {
        this.baseURL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
        this.config = config;
        // Parse service account JSON
        let serviceAccountJson = config.serviceAccount;
        if (!serviceAccountJson.includes('{')) {
            // Decode base64 if needed
            serviceAccountJson = Buffer.from(serviceAccountJson, 'base64').toString('utf-8');
        }
        this.serviceAccount = JSON.parse(serviceAccountJson);
    }
    async getReviewStatus() {
        try {
            const accessToken = await this.getAccessToken();
            // Get edits (drafts) for the app
            const editsResponse = await axios_1.default.post(`${this.baseURL}/applications/${this.config.packageName}/edits`, {}, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            const editId = editsResponse.data.id;
            // Get tracks to find the latest version in review
            const tracksResponse = await axios_1.default.get(`${this.baseURL}/applications/${this.config.packageName}/edits/${editId}/tracks`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            // Find production track
            const productionTrack = tracksResponse.data.tracks?.find((track) => track.track === 'production');
            if (!productionTrack || !productionTrack.releases || productionTrack.releases.length === 0) {
                console.log('No production releases found');
                return null;
            }
            const latestRelease = productionTrack.releases[0];
            const versionCode = latestRelease.versionCodes?.[0];
            const status = this.mapStatus(latestRelease.status);
            // Clean up the edit
            await axios_1.default.delete(`${this.baseURL}/applications/${this.config.packageName}/edits/${editId}`, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            return {
                packageName: this.config.packageName,
                versionCode: versionCode,
                status: status,
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                console.error('Google Play Console API Error:', error.response?.data || error.message);
            }
            else {
                console.error('Error fetching Google Play review status:', error);
            }
            throw error;
        }
    }
    async getAccessToken() {
        const now = Math.floor(Date.now() / 1000);
        const exp = now + 3600; // 1 hour
        const jwtHeader = {
            alg: 'RS256',
            typ: 'JWT',
        };
        const jwtClaim = {
            iss: this.serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/androidpublisher',
            aud: 'https://oauth2.googleapis.com/token',
            iat: now,
            exp: exp,
        };
        // Use jsonwebtoken to sign the JWT
        const jwt = require('jsonwebtoken');
        const assertion = jwt.sign(jwtClaim, this.serviceAccount.private_key, {
            algorithm: 'RS256',
            header: jwtHeader,
        });
        // Exchange JWT for access token
        const response = await axios_1.default.post('https://oauth2.googleapis.com/token', new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: assertion,
        }).toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return response.data.access_token;
    }
    mapStatus(status) {
        switch (status) {
            case 'draft':
                return types_1.GooglePlayReviewStatus.DRAFT;
            case 'inProgress':
                return types_1.GooglePlayReviewStatus.IN_PROGRESS;
            case 'halted':
                return types_1.GooglePlayReviewStatus.HALTED;
            case 'completed':
                return types_1.GooglePlayReviewStatus.COMPLETED;
            default:
                return types_1.GooglePlayReviewStatus.DRAFT;
        }
    }
}
exports.GooglePlayConsoleMonitor = GooglePlayConsoleMonitor;
//# sourceMappingURL=googlePlayConsole.js.map