package main

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/bitrise-io/go-steputils/v2/stepconf"
	"github.com/bitrise-io/go-utils/v2/command"
	"github.com/bitrise-io/go-utils/v2/env"
	"github.com/bitrise-io/go-utils/v2/log"
	"github.com/golang-jwt/jwt/v5"
)

// Config represents the step configuration
type Config struct {
	// App Store Connect
	AppStoreIssuerID   stepconf.Secret `env:"app_store_issuer_id"`
	AppStoreKeyID      stepconf.Secret `env:"app_store_key_id"`
	AppStorePrivateKey stepconf.Secret `env:"app_store_private_key"`
	AppStoreAppID      string          `env:"app_store_app_id"`

	// Google Play
	GooglePlayPackageName   string          `env:"google_play_package_name"`
	GooglePlayServiceAccount stepconf.Secret `env:"google_play_service_account"`

	// Slack
	SlackWebhookURL string          `env:"slack_webhook_url"`
	SlackBotToken   stepconf.Secret `env:"slack_bot_token"`
	SlackChannel    string          `env:"slack_channel"`
	SlackLanguage   string          `env:"slack_language"`
	SlackMentions   string          `env:"slack_mentions"`

	// Cache
	CachePath string `env:"cache_path"`
}

// VersionCache represents the cached version information
type VersionCache struct {
	LastChecked string              `json:"lastChecked"`
	AppStore    *AppStoreCacheEntry `json:"appStore,omitempty"`
	GooglePlay  *GooglePlayCacheEntry `json:"googlePlay,omitempty"`
}

type AppStoreCacheEntry struct {
	AppID       string `json:"appId"`
	Version     string `json:"version"`
	BuildNumber string `json:"buildNumber,omitempty"`
	Status      string `json:"status"`
}

type GooglePlayCacheEntry struct {
	PackageName string `json:"packageName"`
	VersionCode int64  `json:"versionCode"`
	VersionName string `json:"versionName,omitempty"`
	Status      string `json:"status"`
}

// AppStoreReviewInfo represents App Store review information
type AppStoreReviewInfo struct {
	AppID       string
	Version     string
	BuildNumber string
	Status      string
}

// GooglePlayReviewInfo represents Google Play review information
type GooglePlayReviewInfo struct {
	PackageName string
	VersionCode int64
	Status      string
}

// Messages for different languages
type Messages struct {
	ReviewStatusUpdate string
	Platform           string
	Version            string
	CurrentStatus      string
	PreviousStatus     string
	CheckedAt          string
	AppName            string
}

var messagesEN = Messages{
	ReviewStatusUpdate: "Review Status Update",
	Platform:           "Platform",
	Version:            "Version",
	CurrentStatus:      "Current Status",
	PreviousStatus:     "Previous Status",
	CheckedAt:          "Checked at",
	AppName:            "App Name",
}

var messagesJA = Messages{
	ReviewStatusUpdate: "レビューステータス更新",
	Platform:           "プラットフォーム",
	Version:            "バージョン",
	CurrentStatus:      "現在のステータス",
	PreviousStatus:     "前回のステータス",
	CheckedAt:          "確認日時",
	AppName:            "アプリ名",
}

func main() {
	logger := log.NewLogger()
	envRepo := env.NewRepository()
	cmdFactory := command.NewFactory(envRepo)

	exitCode := run(logger, envRepo, cmdFactory)
	os.Exit(exitCode)
}

func run(logger log.Logger, envRepo env.Repository, cmdFactory command.Factory) int {
	var cfg Config
	parser := stepconf.NewInputParser(envRepo)
	if err := parser.Parse(&cfg); err != nil {
		logger.Errorf("Failed to parse config: %s", err)
		return 1
	}

	stepconf.Print(cfg)

	// Validate config
	if err := validateConfig(cfg); err != nil {
		logger.Errorf("Configuration error: %s", err)
		return 1
	}

	// Set default cache path
	if cfg.CachePath == "" {
		cacheDir := envRepo.Get("BITRISE_CACHE_DIR")
		if cacheDir == "" {
			cacheDir = "/tmp"
		}
		cfg.CachePath = filepath.Join(cacheDir, "store-review-versions.json")
	}

	// Load previous cache
	previousCache := loadCache(cfg.CachePath, logger)

	// Initialize current cache
	currentCache := &VersionCache{
		LastChecked: time.Now().UTC().Format(time.RFC3339),
	}

	appStoreStatusSent := false
	googlePlayStatusSent := false

	// Monitor App Store Connect
	if cfg.AppStoreIssuerID != "" && cfg.AppStoreKeyID != "" && cfg.AppStorePrivateKey != "" && cfg.AppStoreAppID != "" {
		logger.Infof("Monitoring App Store Connect...")

		reviewInfo, err := getAppStoreReviewStatus(cfg, logger)
		if err != nil {
			logger.Warnf("Failed to monitor App Store Connect: %s", err)
		} else if reviewInfo != nil {
			logger.Infof("App Store status: %s", reviewInfo.Status)

			// Export output
			if err := exportEnvVar("STORE_REVIEW_APP_STORE_STATUS", reviewInfo.Status); err != nil {
				logger.Warnf("Failed to export App Store status: %s", err)
			}

			// Update current cache
			currentCache.AppStore = &AppStoreCacheEntry{
				AppID:       reviewInfo.AppID,
				Version:     reviewInfo.Version,
				BuildNumber: reviewInfo.BuildNumber,
				Status:      reviewInfo.Status,
			}

			// Check if version or build has changed
			versionOrBuildChanged := hasVersionOrBuildChanged("appStore", reviewInfo.Version, reviewInfo.BuildNumber, previousCache)

			// Check if recovered from rejection
			recoveredFromRejection := hasRecoveredFromRejection("appStore", reviewInfo.Status, previousCache)

			// Check if we should notify
			shouldNotify := shouldSendNotification(reviewInfo.Status)

			if (versionOrBuildChanged || recoveredFromRejection) && shouldNotify {
				var previousStatus string
				if previousCache != nil && previousCache.AppStore != nil {
					previousStatus = previousCache.AppStore.Status
				}

				version := reviewInfo.Version
				if reviewInfo.BuildNumber != "" {
					version = fmt.Sprintf("%s (%s)", reviewInfo.Version, reviewInfo.BuildNumber)
				}

				err := sendSlackNotification(cfg, "App Store", version, reviewInfo.Status, previousStatus, logger)
				if err != nil {
					logger.Warnf("Failed to send Slack notification: %s", err)
				} else {
					appStoreStatusSent = true
					if recoveredFromRejection {
						logger.Donef("Sent App Store notification to Slack (recovered from rejection: %s -> %s)", previousStatus, reviewInfo.Status)
					} else {
						logger.Donef("Sent App Store notification to Slack (version/build changed)")
					}
				}
			} else if !versionOrBuildChanged && !recoveredFromRejection {
				logger.Infof("App Store version/build has not changed and not recovered from rejection, skipping notification")
			} else {
				logger.Infof("App Store status does not require notification")
			}
		} else {
			logger.Infof("No App Store review information available")
		}
	} else {
		logger.Infof("Skipping App Store Connect monitoring (missing configuration)")
	}

	// Monitor Google Play Console
	if cfg.GooglePlayPackageName != "" && cfg.GooglePlayServiceAccount != "" {
		logger.Infof("Monitoring Google Play Console...")

		reviewInfo, err := getGooglePlayReviewStatus(cfg, logger)
		if err != nil {
			logger.Warnf("Failed to monitor Google Play Console: %s", err)
		} else if reviewInfo != nil {
			logger.Infof("Google Play status: %s", reviewInfo.Status)

			// Export output
			if err := exportEnvVar("STORE_REVIEW_GOOGLE_PLAY_STATUS", reviewInfo.Status); err != nil {
				logger.Warnf("Failed to export Google Play status: %s", err)
			}

			// Update current cache
			currentCache.GooglePlay = &GooglePlayCacheEntry{
				PackageName: reviewInfo.PackageName,
				VersionCode: reviewInfo.VersionCode,
				Status:      reviewInfo.Status,
			}

			// Check if version has changed
			versionChanged := hasVersionOrBuildChanged("googlePlay", fmt.Sprintf("%d", reviewInfo.VersionCode), "", previousCache)

			// Check if recovered from rejection
			recoveredFromRejection := hasRecoveredFromRejection("googlePlay", reviewInfo.Status, previousCache)

			// Check if we should notify
			shouldNotify := shouldSendNotification(reviewInfo.Status)

			if (versionChanged || recoveredFromRejection) && shouldNotify {
				var previousStatus string
				if previousCache != nil && previousCache.GooglePlay != nil {
					previousStatus = previousCache.GooglePlay.Status
				}

				err := sendSlackNotification(cfg, "Google Play", fmt.Sprintf("%d", reviewInfo.VersionCode), reviewInfo.Status, previousStatus, logger)
				if err != nil {
					logger.Warnf("Failed to send Slack notification: %s", err)
				} else {
					googlePlayStatusSent = true
					if recoveredFromRejection {
						logger.Donef("Sent Google Play notification to Slack (recovered from rejection: %s -> %s)", previousStatus, reviewInfo.Status)
					} else {
						logger.Donef("Sent Google Play notification to Slack (version changed)")
					}
				}
			} else if !versionChanged && !recoveredFromRejection {
				logger.Infof("Google Play version has not changed and not recovered from rejection, skipping notification")
			} else {
				logger.Infof("Google Play status does not require notification")
			}
		} else {
			logger.Infof("No Google Play review information available")
		}
	} else {
		logger.Infof("Skipping Google Play Console monitoring (missing configuration)")
	}

	// Save current cache
	saveCache(cfg.CachePath, currentCache, logger)

	// Export notification sent status
	notificationSent := "false"
	if appStoreStatusSent || googlePlayStatusSent {
		notificationSent = "true"
	}
	if err := exportEnvVar("STORE_REVIEW_NOTIFICATION_SENT", notificationSent); err != nil {
		logger.Warnf("Failed to export notification sent status: %s", err)
	}

	logger.Donef("Store review monitoring completed successfully")
	return 0
}

func validateConfig(cfg Config) error {
	if cfg.SlackWebhookURL == "" && cfg.SlackBotToken == "" {
		return fmt.Errorf("either slack_webhook_url or slack_bot_token is required")
	}

	if cfg.SlackBotToken != "" && cfg.SlackChannel == "" {
		return fmt.Errorf("slack_channel is required when using slack_bot_token")
	}

	return nil
}

func loadCache(path string, logger log.Logger) *VersionCache {
	data, err := os.ReadFile(path)
	if err != nil {
		logger.Infof("No previous cache found at %s", path)
		return nil
	}

	var cache VersionCache
	if err := json.Unmarshal(data, &cache); err != nil {
		logger.Warnf("Failed to parse cache file: %s", err)
		return nil
	}

	return &cache
}

func saveCache(path string, cache *VersionCache, logger log.Logger) {
	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		logger.Warnf("Failed to create cache directory: %s", err)
		return
	}

	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		logger.Warnf("Failed to marshal cache: %s", err)
		return
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		logger.Warnf("Failed to save cache: %s", err)
		return
	}

	logger.Infof("Cache saved to %s", path)
}

func hasVersionOrBuildChanged(platform string, version string, buildNumber string, previousCache *VersionCache) bool {
	if previousCache == nil {
		return true
	}

	switch platform {
	case "appStore":
		if previousCache.AppStore == nil {
			return true
		}
		if previousCache.AppStore.Version != version {
			return true
		}
		if buildNumber != "" && previousCache.AppStore.BuildNumber != buildNumber {
			return true
		}
		return false
	case "googlePlay":
		if previousCache.GooglePlay == nil {
			return true
		}
		return fmt.Sprintf("%d", previousCache.GooglePlay.VersionCode) != version
	}
	return true
}

func hasRecoveredFromRejection(platform string, currentStatus string, previousCache *VersionCache) bool {
	if previousCache == nil {
		return false
	}

	rejectedStatuses := []string{"rejected", "metadata_rejected", "invalid_binary", "halted"}
	approvedStatuses := []string{"ready_for_sale", "pending_developer_release", "completed"}

	var previousStatus string
	switch platform {
	case "appStore":
		if previousCache.AppStore == nil {
			return false
		}
		previousStatus = strings.ToLower(previousCache.AppStore.Status)
	case "googlePlay":
		if previousCache.GooglePlay == nil {
			return false
		}
		previousStatus = strings.ToLower(previousCache.GooglePlay.Status)
	default:
		return false
	}

	currentStatusLower := strings.ToLower(currentStatus)

	wasRejected := false
	for _, s := range rejectedStatuses {
		if strings.Contains(previousStatus, s) {
			wasRejected = true
			break
		}
	}

	isApproved := false
	for _, s := range approvedStatuses {
		if strings.Contains(currentStatusLower, s) {
			isApproved = true
			break
		}
	}

	return wasRejected && isApproved
}

func shouldSendNotification(status string) bool {
	statusLower := strings.ToLower(status)
	notifyStatuses := []string{
		"pending_developer_release",
		"pending_apple_release",
		"ready_for_sale",
		"rejected",
		"metadata_rejected",
		"invalid_binary",
		"completed",
	}

	for _, s := range notifyStatuses {
		if strings.Contains(statusLower, s) {
			return true
		}
	}
	return false
}

func getAppStoreReviewStatus(cfg Config, logger log.Logger) (*AppStoreReviewInfo, error) {
	token, err := generateAppStoreToken(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Get the latest app store version
	url := fmt.Sprintf("https://api.appstoreconnect.apple.com/v1/apps/%s/appStoreVersions?filter[platform]=IOS&limit=1&sort=-createdDate", cfg.AppStoreAppID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("App Store Connect API error: %s - %s", resp.Status, string(body))
	}

	var versionsResp struct {
		Data []struct {
			ID         string `json:"id"`
			Attributes struct {
				VersionString string `json:"versionString"`
				AppStoreState string `json:"appStoreState"`
			} `json:"attributes"`
			Relationships struct {
				Build struct {
					Data struct {
						ID string `json:"id"`
					} `json:"data"`
				} `json:"build"`
			} `json:"relationships"`
		} `json:"data"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&versionsResp); err != nil {
		return nil, err
	}

	if len(versionsResp.Data) == 0 {
		return nil, nil
	}

	latestVersion := versionsResp.Data[0]

	// Try to get build number
	var buildNumber string
	if latestVersion.Relationships.Build.Data.ID != "" {
		buildURL := fmt.Sprintf("https://api.appstoreconnect.apple.com/v1/builds/%s", latestVersion.Relationships.Build.Data.ID)
		buildReq, err := http.NewRequest("GET", buildURL, nil)
		if err == nil {
			buildReq.Header.Set("Authorization", "Bearer "+token)
			buildResp, err := client.Do(buildReq)
			if err == nil {
				defer buildResp.Body.Close()
				if buildResp.StatusCode == http.StatusOK {
					var buildData struct {
						Data struct {
							Attributes struct {
								Version string `json:"version"`
							} `json:"attributes"`
						} `json:"data"`
					}
					if json.NewDecoder(buildResp.Body).Decode(&buildData) == nil {
						buildNumber = buildData.Data.Attributes.Version
					}
				}
			}
		}
	}

	return &AppStoreReviewInfo{
		AppID:       cfg.AppStoreAppID,
		Version:     latestVersion.Attributes.VersionString,
		BuildNumber: buildNumber,
		Status:      latestVersion.Attributes.AppStoreState,
	}, nil
}

func generateAppStoreToken(cfg Config) (string, error) {
	now := time.Now()
	exp := now.Add(20 * time.Minute)

	claims := jwt.MapClaims{
		"iss": string(cfg.AppStoreIssuerID),
		"iat": now.Unix(),
		"exp": exp.Unix(),
		"aud": "appstoreconnect-v1",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodES256, claims)
	token.Header["kid"] = string(cfg.AppStoreKeyID)

	// Decode private key
	privateKeyStr := string(cfg.AppStorePrivateKey)
	if !strings.Contains(privateKeyStr, "BEGIN PRIVATE KEY") {
		decoded, err := base64.StdEncoding.DecodeString(privateKeyStr)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 private key: %w", err)
		}
		privateKeyStr = string(decoded)
	}

	block, _ := pem.Decode([]byte(privateKeyStr))
	if block == nil {
		return "", fmt.Errorf("failed to parse PEM block")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	ecdsaKey, ok := key.(*ecdsa.PrivateKey)
	if !ok {
		return "", fmt.Errorf("private key is not ECDSA")
	}

	return token.SignedString(ecdsaKey)
}

func getGooglePlayReviewStatus(cfg Config, logger log.Logger) (*GooglePlayReviewInfo, error) {
	accessToken, err := getGoogleAccessToken(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to get access token: %w", err)
	}

	client := &http.Client{Timeout: 30 * time.Second}

	// Create edit
	editURL := fmt.Sprintf("https://androidpublisher.googleapis.com/androidpublisher/v3/applications/%s/edits", cfg.GooglePlayPackageName)
	editReq, err := http.NewRequest("POST", editURL, bytes.NewBuffer([]byte("{}")))
	if err != nil {
		return nil, err
	}
	editReq.Header.Set("Authorization", "Bearer "+accessToken)
	editReq.Header.Set("Content-Type", "application/json")

	editResp, err := client.Do(editReq)
	if err != nil {
		return nil, err
	}
	defer editResp.Body.Close()

	if editResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(editResp.Body)
		return nil, fmt.Errorf("Google Play API error: %s - %s", editResp.Status, string(body))
	}

	var editData struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(editResp.Body).Decode(&editData); err != nil {
		return nil, err
	}

	// Get tracks
	tracksURL := fmt.Sprintf("https://androidpublisher.googleapis.com/androidpublisher/v3/applications/%s/edits/%s/tracks", cfg.GooglePlayPackageName, editData.ID)
	tracksReq, err := http.NewRequest("GET", tracksURL, nil)
	if err != nil {
		return nil, err
	}
	tracksReq.Header.Set("Authorization", "Bearer "+accessToken)

	tracksResp, err := client.Do(tracksReq)
	if err != nil {
		return nil, err
	}
	defer tracksResp.Body.Close()

	var tracksData struct {
		Tracks []struct {
			Track    string `json:"track"`
			Releases []struct {
				Status       string  `json:"status"`
				VersionCodes []int64 `json:"versionCodes"`
			} `json:"releases"`
		} `json:"tracks"`
	}
	if err := json.NewDecoder(tracksResp.Body).Decode(&tracksData); err != nil {
		return nil, err
	}

	// Clean up edit
	deleteURL := fmt.Sprintf("https://androidpublisher.googleapis.com/androidpublisher/v3/applications/%s/edits/%s", cfg.GooglePlayPackageName, editData.ID)
	deleteReq, err := http.NewRequest("DELETE", deleteURL, nil)
	if err == nil {
		deleteReq.Header.Set("Authorization", "Bearer "+accessToken)
		client.Do(deleteReq)
	}

	// Find production track
	for _, track := range tracksData.Tracks {
		if track.Track == "production" && len(track.Releases) > 0 {
			release := track.Releases[0]
			var versionCode int64
			if len(release.VersionCodes) > 0 {
				versionCode = release.VersionCodes[0]
			}
			return &GooglePlayReviewInfo{
				PackageName: cfg.GooglePlayPackageName,
				VersionCode: versionCode,
				Status:      release.Status,
			}, nil
		}
	}

	return nil, nil
}

func getGoogleAccessToken(cfg Config) (string, error) {
	// Parse service account JSON
	serviceAccountJSON := string(cfg.GooglePlayServiceAccount)
	if !strings.Contains(serviceAccountJSON, "{") {
		decoded, err := base64.StdEncoding.DecodeString(serviceAccountJSON)
		if err != nil {
			return "", fmt.Errorf("failed to decode base64 service account: %w", err)
		}
		serviceAccountJSON = string(decoded)
	}

	var serviceAccount struct {
		ClientEmail string `json:"client_email"`
		PrivateKey  string `json:"private_key"`
	}
	if err := json.Unmarshal([]byte(serviceAccountJSON), &serviceAccount); err != nil {
		return "", fmt.Errorf("failed to parse service account JSON: %w", err)
	}

	// Create JWT
	now := time.Now()
	claims := jwt.MapClaims{
		"iss":   serviceAccount.ClientEmail,
		"scope": "https://www.googleapis.com/auth/androidpublisher",
		"aud":   "https://oauth2.googleapis.com/token",
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	block, _ := pem.Decode([]byte(serviceAccount.PrivateKey))
	if block == nil {
		return "", fmt.Errorf("failed to parse PEM block")
	}

	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", fmt.Errorf("failed to parse private key: %w", err)
	}

	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return "", fmt.Errorf("private key is not RSA")
	}

	assertion, err := token.SignedString(rsaKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	// Exchange JWT for access token
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", url.Values{
		"grant_type": {"urn:ietf:params:oauth:grant-type:jwt-bearer"},
		"assertion":  {assertion},
	})
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	if tokenResp.Error != "" {
		return "", fmt.Errorf("OAuth error: %s", tokenResp.Error)
	}

	return tokenResp.AccessToken, nil
}

func sendSlackNotification(cfg Config, platform, version, currentStatus, previousStatus string, logger log.Logger) error {
	messages := messagesEN
	if cfg.SlackLanguage == "ja" {
		messages = messagesJA
	}

	emoji := getStatusEmoji(currentStatus)
	color := getStatusColor(currentStatus)

	// Build mention text
	var mentionText string
	if cfg.SlackMentions != "" {
		mentions := strings.Split(cfg.SlackMentions, ",")
		for i, m := range mentions {
			mentions[i] = fmt.Sprintf("<@%s>", strings.TrimSpace(m))
		}
		mentionText = strings.Join(mentions, " ") + " "
	}

	headerText := fmt.Sprintf("%s %s %s", emoji, platform, messages.ReviewStatusUpdate)

	fields := []map[string]interface{}{
		{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*%s:*\n%s", messages.Platform, platform),
		},
		{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*%s:*\n%s", messages.Version, version),
		},
		{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*%s:*\n%s", messages.CurrentStatus, formatStatus(currentStatus)),
		},
	}

	if previousStatus != "" {
		fields = append(fields, map[string]interface{}{
			"type": "mrkdwn",
			"text": fmt.Sprintf("*%s:*\n%s", messages.PreviousStatus, formatStatus(previousStatus)),
		})
	}

	blocks := []map[string]interface{}{
		{
			"type": "header",
			"text": map[string]interface{}{
				"type":  "plain_text",
				"text":  headerText,
				"emoji": true,
			},
		},
		{
			"type":   "section",
			"fields": fields,
		},
		{
			"type": "context",
			"elements": []map[string]interface{}{
				{
					"type": "mrkdwn",
					"text": fmt.Sprintf("%s: %s", messages.CheckedAt, time.Now().UTC().Format(time.RFC3339)),
				},
			},
		},
	}

	payload := map[string]interface{}{
		"text":   mentionText + headerText,
		"blocks": blocks,
		"attachments": []map[string]interface{}{
			{
				"color":    color,
				"fallback": fmt.Sprintf("%s review status: %s", platform, currentStatus),
			},
		},
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	if cfg.SlackWebhookURL != "" {
		resp, err := http.Post(cfg.SlackWebhookURL, "application/json", bytes.NewBuffer(jsonPayload))
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("Slack webhook error: %s - %s", resp.Status, string(body))
		}
	} else if cfg.SlackBotToken != "" {
		payload["channel"] = cfg.SlackChannel
		jsonPayload, _ = json.Marshal(payload)

		req, err := http.NewRequest("POST", "https://slack.com/api/chat.postMessage", bytes.NewBuffer(jsonPayload))
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+string(cfg.SlackBotToken))
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{Timeout: 30 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		var slackResp struct {
			OK    bool   `json:"ok"`
			Error string `json:"error"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&slackResp); err != nil {
			return err
		}

		if !slackResp.OK {
			return fmt.Errorf("Slack API error: %s", slackResp.Error)
		}
	}

	return nil
}

func getStatusEmoji(status string) string {
	statusLower := strings.ToLower(status)

	if strings.Contains(statusLower, "approved") ||
		strings.Contains(statusLower, "ready_for_sale") ||
		strings.Contains(statusLower, "completed") ||
		strings.Contains(statusLower, "pending_developer_release") {
		return "✅"
	}

	if strings.Contains(statusLower, "rejected") ||
		strings.Contains(statusLower, "invalid") {
		return "❌"
	}

	if strings.Contains(statusLower, "in_review") ||
		strings.Contains(statusLower, "processing") {
		return "⏳"
	}

	return "ℹ️"
}

func getStatusColor(status string) string {
	statusLower := strings.ToLower(status)

	if strings.Contains(statusLower, "approved") ||
		strings.Contains(statusLower, "ready_for_sale") ||
		strings.Contains(statusLower, "completed") ||
		strings.Contains(statusLower, "pending_developer_release") {
		return "good"
	}

	if strings.Contains(statusLower, "rejected") ||
		strings.Contains(statusLower, "invalid") {
		return "danger"
	}

	if strings.Contains(statusLower, "in_review") ||
		strings.Contains(statusLower, "processing") {
		return "warning"
	}

	return "#808080"
}

func formatStatus(status string) string {
	words := strings.Split(status, "_")
	for i, word := range words {
		if len(word) > 0 {
			words[i] = strings.ToUpper(string(word[0])) + strings.ToLower(word[1:])
		}
	}
	return strings.Join(words, " ")
}

func exportEnvVar(key, value string) error {
	envmanPath := os.Getenv("ENVMAN_ENVSTORE_PATH")
	if envmanPath == "" {
		// Fallback for local testing
		return os.Setenv(key, value)
	}

	// Read existing envstore
	var envstore map[string]string
	data, err := os.ReadFile(envmanPath)
	if err == nil {
		json.Unmarshal(data, &envstore)
	}
	if envstore == nil {
		envstore = make(map[string]string)
	}

	envstore[key] = value

	// Write back
	data, err = json.Marshal(envstore)
	if err != nil {
		return err
	}

	return os.WriteFile(envmanPath, data, 0644)
}
