import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { AppStoreConfig, AppStoreReviewInfo, AppStoreReviewStatus } from '../types';

export class AppStoreConnectMonitor {
  private config: AppStoreConfig;
  private baseURL = 'https://api.appstoreconnect.apple.com/v1';

  constructor(config: AppStoreConfig) {
    this.config = config;
  }

  async getReviewStatus(): Promise<AppStoreReviewInfo | null> {
    try {
      const token = this.generateToken();

      // Get app information
      const appResponse = await axios.get(
        `${this.baseURL}/apps/${this.config.appId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Get app store versions with build relationship included
      const versionsResponse = await axios.get(
        `${this.baseURL}/apps/${this.config.appId}/appStoreVersions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            'filter[platform]': 'IOS',
            'include': 'build',
          },
        }
      );

      if (!versionsResponse.data.data || versionsResponse.data.data.length === 0) {
        console.log('No app store versions found');
        return null;
      }

      // Sort by createdDate descending to get the latest version
      const versions = versionsResponse.data.data.sort(
        (a: { attributes: { createdDate: string } }, b: { attributes: { createdDate: string } }) =>
          new Date(b.attributes.createdDate).getTime() - new Date(a.attributes.createdDate).getTime()
      );
      const latestVersion = versions[0];
      const status = latestVersion.attributes.appStoreState as AppStoreReviewStatus;
      const version = latestVersion.attributes.versionString;

      // Get the build number from the included data
      let buildNumber: string | undefined;
      const buildRelationship = latestVersion.relationships?.build?.data;
      if (buildRelationship?.id) {
        // Find the build in the included array
        const includedBuild = versionsResponse.data.included?.find(
          (item: { type: string; id: string }) =>
            item.type === 'builds' && item.id === buildRelationship.id
        );
        if (includedBuild?.attributes?.version) {
          buildNumber = includedBuild.attributes.version;
        }
      }

      return {
        appId: this.config.appId,
        version: version,
        buildNumber: buildNumber,
        status: status,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('App Store Connect API Error:', error.response?.data || error.message);
      } else {
        console.error('Error fetching App Store review status:', error);
      }
      throw error;
    }
  }

  private generateToken(): string {
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
