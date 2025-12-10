import axios from 'axios';
import { GooglePlayConfig, GooglePlayReviewInfo, GooglePlayReviewStatus } from '../types';

interface GooglePlayServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class GooglePlayConsoleMonitor {
  private config: GooglePlayConfig;
  private serviceAccount: GooglePlayServiceAccount;
  private baseURL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

  constructor(config: GooglePlayConfig) {
    this.config = config;

    // Parse service account JSON
    let serviceAccountJson = config.serviceAccount;
    if (!serviceAccountJson.includes('{')) {
      // Decode base64 if needed
      serviceAccountJson = Buffer.from(serviceAccountJson, 'base64').toString('utf-8');
    }
    this.serviceAccount = JSON.parse(serviceAccountJson);
  }

  async getReviewStatus(): Promise<GooglePlayReviewInfo | null> {
    try {
      const accessToken = await this.getAccessToken();

      // Get edits (drafts) for the app
      const editsResponse = await axios.post(
        `${this.baseURL}/applications/${this.config.packageName}/edits`,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const editId = editsResponse.data.id;

      // Get tracks to find the latest version in review
      const tracksResponse = await axios.get(
        `${this.baseURL}/applications/${this.config.packageName}/edits/${editId}/tracks`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      // Find production track
      const productionTrack = tracksResponse.data.tracks?.find(
        (track: any) => track.track === 'production'
      );

      if (!productionTrack || !productionTrack.releases || productionTrack.releases.length === 0) {
        console.log('No production releases found');
        return null;
      }

      const latestRelease = productionTrack.releases[0];
      const versionCode = latestRelease.versionCodes?.[0];
      const status = this.mapStatus(latestRelease.status);

      // Clean up the edit
      await axios.delete(
        `${this.baseURL}/applications/${this.config.packageName}/edits/${editId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      return {
        packageName: this.config.packageName,
        versionCode: versionCode,
        status: status,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Google Play Console API Error:', error.response?.data || error.message);
      } else {
        console.error('Error fetching Google Play review status:', error);
      }
      throw error;
    }
  }

  private async getAccessToken(): Promise<string> {
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
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: assertion,
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.access_token;
  }

  private mapStatus(status: string): GooglePlayReviewStatus {
    switch (status) {
      case 'draft':
        return GooglePlayReviewStatus.DRAFT;
      case 'inProgress':
        return GooglePlayReviewStatus.IN_PROGRESS;
      case 'halted':
        return GooglePlayReviewStatus.HALTED;
      case 'completed':
        return GooglePlayReviewStatus.COMPLETED;
      default:
        return GooglePlayReviewStatus.DRAFT;
    }
  }
}
