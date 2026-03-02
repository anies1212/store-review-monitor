"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GooglePlayReviewStatus = exports.AppStoreReviewStatus = void 0;
var AppStoreReviewStatus;
(function (AppStoreReviewStatus) {
    AppStoreReviewStatus["WAITING_FOR_REVIEW"] = "WAITING_FOR_REVIEW";
    AppStoreReviewStatus["IN_REVIEW"] = "IN_REVIEW";
    AppStoreReviewStatus["PENDING_DEVELOPER_RELEASE"] = "PENDING_DEVELOPER_RELEASE";
    AppStoreReviewStatus["PROCESSING_FOR_APP_STORE"] = "PROCESSING_FOR_APP_STORE";
    AppStoreReviewStatus["PENDING_APPLE_RELEASE"] = "PENDING_APPLE_RELEASE";
    AppStoreReviewStatus["READY_FOR_SALE"] = "READY_FOR_SALE";
    AppStoreReviewStatus["REJECTED"] = "REJECTED";
    AppStoreReviewStatus["METADATA_REJECTED"] = "METADATA_REJECTED";
    AppStoreReviewStatus["REMOVED_FROM_SALE"] = "REMOVED_FROM_SALE";
    AppStoreReviewStatus["DEVELOPER_REJECTED"] = "DEVELOPER_REJECTED";
    AppStoreReviewStatus["DEVELOPER_REMOVED_FROM_SALE"] = "DEVELOPER_REMOVED_FROM_SALE";
    AppStoreReviewStatus["INVALID_BINARY"] = "INVALID_BINARY";
})(AppStoreReviewStatus || (exports.AppStoreReviewStatus = AppStoreReviewStatus = {}));
var GooglePlayReviewStatus;
(function (GooglePlayReviewStatus) {
    GooglePlayReviewStatus["DRAFT"] = "draft";
    GooglePlayReviewStatus["IN_PROGRESS"] = "inProgress";
    GooglePlayReviewStatus["HALTED"] = "halted";
    GooglePlayReviewStatus["COMPLETED"] = "completed";
})(GooglePlayReviewStatus || (exports.GooglePlayReviewStatus = GooglePlayReviewStatus = {}));
//# sourceMappingURL=index.js.map