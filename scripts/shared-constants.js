// Shared constants for Cupid Enhanced
// This file is loaded by popup.js, okcupid-content.js, and api-interceptor.js
// Note: When loaded in MAIN world (api-interceptor.js), this runs in a separate context
// from ISOLATED world (okcupid-content.js), so constants are duplicated but not shared

const SETTINGS_KEY = 'cupidEnhancedSettings';

const DEFAULT_SETTINGS = {
    staffMode: false,
    enhanceDiscoverPage: true,
    enhanceLikesYouPage: false,
    horizontalScroll: true,
    darkMode: false,
    anonymousMessageRead: false
};

// =============================================================================
// API Interceptor Constants (MAIN world)
// =============================================================================

// Headers we want to capture from OkCupid requests
const HEADERS_TO_CAPTURE = [
    'authorization',
    'x-okcupid-auth-v',
    'x-okcupid-device-id',
    'x-okcupid-locale',
    'x-okcupid-platform',
    'x-okcupid-version'
];

// Analytics operations to block (GraphQL)
const BLOCKED_OPERATIONS = [
    'WebLogAnalyticsEvents',
    'webLogAnalyticsEvents'
    // 'WebE2PStaffbar', // Staff tracking
    // 'WebUpdateStats', // Stats tracking
    // 'webUpdateStats'
];

// URLs to block entirely (Cloudflare, analytics, etc.)
const BLOCKED_URLS = [
    '/cdn-cgi/rum', // Cloudflare Real User Monitoring
    'cloudflareinsights.com', // Cloudflare analytics beacon
    '/beacon.min.js', // Cloudflare beacon script
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.com/tr', // Facebook pixel
    'doubleclick.net',
    'hotjar.com',
    'amplitude.com',
    'mixpanel.com',
    'segment.io',
    'sentry.io'
];

// Premium features found in module 88074 (lowercase and uppercase variants)
const PREMIUM_FEATURES = [
    'intoyou', 'INTO_YOU',
    'comfree', 'ad_free', 'AD_FREE', 'ADFREE',
    'unlimited_likes', 'UNLIMITED_LIKES', 'UNLIMTED_LIKES',
    'intros', 'INTROS',
    'dealbreakers', 'DEALBREAKERS',
    'see_more_people', 'SEE_MORE_PEOPLE',
    'questions', 'QUESTIONS',
    'superlikes', 'superlikes_3', 'SUPERLIKES_3', 'superlikes_15', 'SUPERLIKES_15',
    'rewind', 'REWIND',
    'question_search', 'QUESTION_SEARCH',
    'who_likes_you', 'see_who_likes_you', 'SEE_WHO_LIKES_YOU',
    'question_answers', 'QUESTION_ANSWERS',
    'likes_list_sort', 'LIKES_LIST_SORT',
    'priority_likes', 'PRIORITY_LIKES',
    'read_receipts', 'READ_RECEIPTS',
    'passport', 'PASSPORT',
    'boost', 'BOOST',
    'super_boost', 'SUPER_BOOST',
    'views', 'VIEWS',
    'profile_visitors', 'PROFILE_VISITORS',
    'match_search', 'MATCH_SEARCH',
    'advanced_filters', 'ADVANCED_FILTERS',
    'message_filters', 'MESSAGE_FILTERS'
];

// =============================================================================
// Content script constants (ISOLATED world)
// =============================================================================

// OkCupid API - Available GraphQL Operations
const OKCUPID_OPERATIONS = {
    // Queries
    queries: {
        // User/Profile
        WebGetIdForUsername: 'WebGetIdForUsername',
        WebGetUserData: 'WebGetUserData',
        WebProfilePublic: 'WebProfilePublic',
        WebGetPublicProfileDetails: 'WebGetPublicProfileDetails',
        WebUserPublicPhotos: 'WebUserPublicPhotos',
        WebGetMatchPercentage: 'WebGetMatchPercentage',
        WebMatchProfileDesktopWrapper: 'WebMatchProfileDesktopWrapper',
        WebMatchProfileQuestionsEntry: 'WebMatchProfileQuestionsEntry',
        WebGetSelfieVerificationStatus: 'WebGetSelfieVerificationStatus',

        // Likes/Matches
        userrowsIncomingLikes: 'userrowsIncomingLikes',
        userrowsOutgoingLikes: 'userrowsOutgoingLikes',
        userrowsIntros: 'userrowsIntros',
        getUserrowsTabCounts: 'getUserrowsTabCounts',
        WebLikesCap: 'WebLikesCap',

        // Stacks/Discover
        WebStack: 'WebStack',
        WebStackUsers: 'WebStackUsers',
        WebJustForYouStack: 'WebJustForYouStack',
        WebInitialStackData: 'WebInitialStackData',
        WebStacksMenu: 'WebStacksMenu',
        WebStacksSelfData: 'WebStacksSelfData',

        // Messages
        WebGetMessagesMain: 'WebGetMessagesMain',
        WebConversationThread: 'WebConversationThread',
        WebMessengerOverflowMenu: 'WebMessengerOverflowMenu',

        // Questions
        WebGetNextQuestion: 'WebGetNextQuestion',
        WebGetQuestionAnswerForUser: 'WebGetQuestionAnswerForUser',
        WebQuestionSearch: 'WebQuestionSearch',
        WebQuestionSearchMatches: 'WebQuestionSearchMatches',
        WebQuestionSearchFeaturedQuestion: 'WebQuestionSearchFeaturedQuestion',
        WebQuestionSearchLanding: 'WebQuestionSearchLanding',
        WebQuestionSearchRecommendedQuestions: 'WebQuestionSearchRecommendedQuestions',
        WebCompatibilityQuestion: 'WebCompatibilityQuestion',
        WebGetBinaryQuestions: 'WebGetBinaryQuestions',

        // Settings/Preferences
        WebGetGlobalPreferences: 'WebGetGlobalPreferences',
        WebSettingsPage: 'WebSettingsPage',
        WebGetSettingsEmail: 'WebGetSettingsEmail',
        WebGetUserGuide: 'WebGetUserGuide',
        webStepsToSuccess: 'webStepsToSuccess',

        // Billing
        WebBillingUpgradeEligibility: 'WebBillingUpgradeEligibility',
        WebGetRateCard: 'WebGetRateCard',

        // Other
        WebGetGatekeeper: 'WebGetGatekeeper',
        webGetExperiment: 'webGetExperiment',
        WebQuickmatchNotifications: 'WebQuickmatchNotifications',
        WebLocationQuery: 'WebLocationQuery',
        WebLocationNearest: 'WebLocationNearest',
        WebGetStaffbarUserInfo: 'WebGetStaffbarUserInfo',
        WebProfilePillButtonsDataQuery: 'WebProfilePillButtonsDataQuery',
        getUserPhotosForSelfview: 'getUserPhotosForSelfview'
    },

    // Mutations
    mutations: {
        // Voting/Likes
        WebUserVote: 'WebUserVote',
        WebUserSuperlike: 'WebUserSuperlike',

        // Messages
        WebConversationMessageSend: 'WebConversationMessageSend',
        WebConversationMessageRead: 'WebConversationMessageRead',
        WebMatchEventSendMessage: 'WebMatchEventSendMessage',

        // Questions
        WebAnswerQuestion: 'WebAnswerQuestion',
        WebSkipQuestion: 'WebSkipQuestion',
        WebAnswerCompatibilityQuestion: 'WebAnswerCompatibilityQuestion',
        WebSkipCompatibilityQuestion: 'WebSkipCompatibilityQuestion',

        // User Actions
        WebBlockUser: 'WebBlockUser',
        WebUnblockUser: 'WebUnblockUser',
        WebUnmatchUser: 'WebUnmatchUser',
        WebUserReportSubmit: 'WebUserReportSubmit',
        WebUnreportUser: 'WebUnreportUser',
        WebMarkMatchRead: 'WebMarkMatchRead',
        WebMarViewed: 'WebMarViewed',

        // Photos
        WebUserRemovePhoto: 'WebUserRemovePhoto',
        WebOnboardingRemovePhoto: 'WebOnboardingRemovePhoto',
        userUpdatePhotoOrder: 'userUpdatePhotoOrder',
        userUpdatePhotoCaption: 'userUpdatePhotoCaption',
        OnboardingOrderPhotos: 'OnboardingOrderPhotos',

        // Settings
        WebSavePreference: 'WebSavePreference',
        WebUpdatePrivacySettings: 'WebUpdatePrivacySettings',
        WebUpdateDeviceLocation: 'WebUpdateDeviceLocation',
        WebUpdateUnitPreference: 'WebUpdateUnitPreference',
        WebMarkUserGuideAsSeen: 'WebMarkUserGuideAsSeen',

        // Auth
        WebLoginWithEmail: 'WebLoginWithEmail',
        WebRefreshToken: 'WebRefreshToken',
        WebAnonToken: 'WebAnonToken',
        WebSmsInitiate: 'WebSmsInitiate',
        WebSmsAuthenticate: 'WebSmsAuthenticate',
        WebPhone2FAInitiate: 'WebPhone2FAInitiate',
        WebPhone2FAAuthenticate: 'WebPhone2FAAuthenticate',
        WebEmail2FA: 'WebEmail2FA',
        authOTPSend: 'authOTPSend',
        authTSPRefreshTokenCreate: 'authTSPRefreshTokenCreate',

        // Billing/Payments
        WebInitPaypal: 'WebInitPaypal',
        purchaseWithPayPal: 'purchaseWithPayPal',
        WebSavePayPalToken: 'WebSavePayPalToken',
        WebAdyenCCPurchase: 'WebAdyenCCPurchase',
        WebUpdateAdyenCreditCard: 'WebUpdateAdyenCreditCard',
        WebPurchaseWithStoredPayment: 'WebPurchaseWithStoredPayment',
        WebRemoveStoredPaymentMethod: 'WebRemoveStoredPaymentMethod',
        webUpgradeSubscription: 'webUpgradeSubscription',
        WebTicketExchange: 'WebTicketExchange',
        webIncrementRateCardViews: 'webIncrementRateCardViews',

        // Analytics/Tracking
        WebLog: 'WebLog',
        WebLogAnalyticsEvents: 'WebLogAnalyticsEvents',
        WebUpdateStats: 'WebUpdateStats',
        WebViewTrackingIncrement: 'WebViewTrackingIncrement',
        WebMarkExperiment: 'WebMarkExperiment',
        WebSetExperimentGroup: 'WebSetExperimentGroup',
        WebEventAttributionTrack: 'WebEventAttributionTrack',
        WebPaymentConfirmationTrack: 'WebPaymentConfirmationTrack',
        WebPaymentEntryTrack: 'WebPaymentEntryTrack',
        WebRateCardViewedTrack: 'WebRateCardViewedTrack',
        WebSessionCrm: 'WebSessionCrm',

        // Boost
        markBoostReportSeen: 'markBoostReportSeen',
        WebMarkBoostReportSeen: 'WebMarkBoostReportSeen',
        activateReadReceipt: 'activateReadReceipt',

        // xMatch/Transfer
        WebXTransferCreate: 'WebXTransferCreate',
        WebXMatchTransferStart: 'WebXMatchTransferStart',
        WebxMatchTransferComplete: 'WebxMatchTransferComplete',
        WebxMatchTransferImpression: 'WebxMatchTransferImpression',
        WebxMatchTransferPresented: 'WebxMatchTransferPresented',
        WebxMatchMoreSites: 'WebxMatchMoreSites',
        WebxMatchMoreSitesImpression: 'WebxMatchMoreSitesImpression',
        WebxMatchMoreSitesPresented: 'WebxMatchMoreSitesPresented',
        WebxMatchMoreSitesSelected: 'WebxMatchMoreSitesSelected',

        // Staffbar (Admin)
        WebStaffbarLoginAsThem: 'WebStaffbarLoginAsThem',
        WebStaffbarSendLike: 'WebStaffbarSendLike',
        WebStaffbarSendSuperLike: 'WebStaffbarSendSuperLike',
        WebStaffbarSendShortMessage: 'WebStaffbarSendShortMessage',
        WebStaffbarSendLongMessage: 'WebStaffbarSendLongMessage',
        WebStaffbarSetIpCountryOverride: 'WebStaffbarSetIpCountryOverride',
        WebStaffbarUpdateOpenModel: 'WebStaffbarUpdateOpenModel',

        // Other
        WebFinishOnboarding: 'WebFinishOnboarding',
        WebAccountReactivate: 'WebAccountReactivate',
        updateGuestLandingPath: 'updateGuestLandingPath',
        updateGuestReferrer: 'updateGuestReferrer'
    }
};

const STORAGE_KEYS = {
    likesRemaining: 'previous_likes_remaining',
    likesResetTime: 'likes_reset_time',
    likesCount: 'previous_likes_count',
    visitedProfiles: 'visited_profiles'
};

const SELECTORS = {
    sendButton: 'button[data-cy="messenger.sendButton"]',
    discoverWrapper: '.desktop-dt-wrapper',
    rightPanel: '.desktop-dt-right',
    photoContainer: '.sliding-pagination-inner-content',
    likesCount: '.count',
    navbarLinkText: '.navbar-link-text',
    prevButton: '.sliding-pagination-button.prev',
    nextButton: '.sliding-pagination-button.next',
    cupidSection: '.cupid-enhanced-section',
    actionButton: '.dt-action-buttons-button'
};

const PREMIUM_AD_SELECTORS = [
    '.premium-promo-link-anchor',
    '.dt-tags-like-instructions',
    '.RCnxRpTKlcKwgM1UlXlj.yvmovGzlmTO5T6yg_ckm',
    '.navbar-boost',
    '.LHLUIR30CVKQDOC2rJps',
    '.IUE4LujuCAt32rrowE9e',
    '.sIZ02EKchd4I0KnGgDgF.t1LDnewkFIu_5Qelhi_u',
    '.MgfNUNvEHRmbdo7IccK9.sidebar-with-card-view',
    '.okmasthead.incognito-masthead',
    '.J8RXzumIQVAo3qnCBqHr',
    '.profile-content-ad',
    '.read-receipt-cta'
];

const DISCOVER_PAGE_ENHANCEMENTS = [
    { selector: '.desktop-dt-content', styles: { maxWidth: '90%', justifyContent: 'center' } },
    { selector: '.desktop-dt-right', styles: { marginLeft: '10px' } },
    { selector: '.sliding-pagination-inner-content', styles: { width: 'fit-content', justifyContent: 'center' } },
    { selector: '.sliding-pagination', styles: { display: 'inline-flex', justifyContent: 'center' } }
];

const PHOTO_DATE_LABEL_STYLES = `
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: bold;
    pointer-events: none;
    z-index: 100;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
`;

const BACKGROUND_IMAGE_REGEX = /url\(["']?(https:\/\/pictures\.match\.com\/photos\/[^"')]+)["']?\)/i;

const DARK_MODE_STYLES = `
    /* ===========================================
       GLOBAL DARK MODE
       =========================================== */

    /* Force dark backgrounds */
    body, main, .pageMain, .userrows-content, .userrows-main, .userrows-card-container {
        background-color: #121212ff !important;
    }

    /* Global text & icons */
    h1, h2, h3, h4, button {
        color: #ffffff !important;
    }

    /*============================================
       MESSAGES - Dark background and light text
       =========================================== */
    .t659_29vzMkU6QQL2q0j,
    .x8amgHNYP_nXx626A_lY,
    .quickmatch-blank-body {
        color: #ffffff !important;
    }

    .dt-comment-fab svg path ,
    .matchprofile-details-icon path,
    .matchprofile-details svg path {
        fill: #ffffff !important;
    }

    .WK2PEQwFZVjNdD26XECA {
        border: 2px solid white !important;
    }

    /* ===========================================
       LIKES YOU PAGE - Card Fixes
       =========================================== */

    /* Card top half (photo area) - black background for missing images */
    .userrows-main a > div:first-child {
        background-color: #1a1a1a !important;
        border-color: #1a1a1a !important;
    }

    .woVgqTcOq5JxwG6vYaRv {
        color: #0000bf !important;
    }

    /* The image itself - transparent to show the background-image */
    .userrows-main a > div:first-child > div[style*="url"] {
        background-color: transparent !important;
        opacity: 1 !important;
        visibility: visible !important;
        z-index: 1 !important;
    }

    /* Overlay fix - make non-image overlays transparent */
    .userrows-main a > div:first-child > div:not([style*="url"]):not(.SqqfnFrP2JvSxoesgTec) {
        background: transparent !important;
        background-color: transparent !important;
    }

    /* Keep the info overlay (SqqfnFrP2JvSxoesgTec) visible */
    .SqqfnFrP2JvSxoesgTec {
        z-index: 999999999999 !important;
        pointer-events: auto !important;
        position: relative !important;
    }

    /* Bottom half (text info) */
    .userrows-main a > div:last-child {
        background-color: #1a1a1a !important;
    }

    /* Buttons */
    button {
        background-color: #222 !important;
    }

    /* ===========================================
       DISCOVER PAGE & PROFILE
       =========================================== */

    /* Card backgrounds */
    .desktop-dt-wrapper,
    .dt-section,
    .dt-section-content,
    .card-content-header,
    .profile-questions-entry,
    .desktop-dt-top,
    #profile,
    .profile-nudge-text,
    .profile-essay,
    .profile-essay-header,
    .k6uyo105F1doQ1ZUZE6M,
    .profile-essay-contents,
    .profile-essay-respond.profile-essay-respond--liked,
    .profilesection {
        background-color: #1a1a1a !important;
        color: #fff !important;
    }

    .dt-section-title {
        border-start-start-radius: 0 !important;
        border-start-end-radius: 0 !important;
    }

    div.tUbfLrJUCHtIlWpDjR_S {
        background-color: transparent !important;
    }

    /* Text colors */
    .card-content-header__text,
    .card-content-header__location,
    .matchprofile-details-text,
    .dt-essay-text,
    .superlike-button-label,
    .dt-action-buttons-button.like,
    .profilesection-title {
        color: #fff !important;
    }

    .oSOt1sUnt8oxUGlZ0Sjl,
    .profile-questions-entry-filters,
    .profile-questions-entry-circles-button,
    .overflow-button {
    background-color: transparent !important;
    }

    .dgJAAI7joMGaC8PFJ7NM.jezzEjGPHApK6sZ6lEhA{
        border: 2px solid deepskyblue !important;
    }

    .yprhCCjFc1H5G2uEgbuS{
        border: 2px solid deepskyblue !important;
    }

    .dt-essay-expand-button, .dt-essay-collapse-button {
        color: deepskyblue !important;
    }

    .LYEfdMzXSYIrT9DJmry7:hover:before {
        opacity: 0.3 !important;
        transform: scale(1) !important;
    }

    .dt-essay-expand {
        background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, #1a1a1a 45%, #1a1a1a 100%) !important;
    }

    .RdZlPEHL94PdRZqJm_GF {
        line-height: normal !important;
    }

    .FhQz9_b2kDEEGYsYah5k,
    .match-percentage.match-percentage--circle {
        color: #fff !important;
    }

    .match-percentage.match-percentage--circle {
        border-color: #fff !important;
    }

    .desktop-dt-top,
    .dt-section {
        border: 2px solid #e6e6e6 !important;
    }

    .dt-section-title,
    .profilesection-title {
        color: #1a1a1a !important;
        background-color: #fff !important;
    }

    /* Photo fade overlays */
    .sliding-pagination-fade.right,
    .sliding-pagination-fade.left {
        background: linear-gradient(to right, rgba(26, 26, 26, 0), rgba(26, 26, 26, 1)) !important;
    }

    .sliding-pagination-fade.left {
        background: linear-gradient(to left, rgba(26, 26, 26, 0), rgba(26, 26, 26, 1)) !important;
    }

    .yhiooHkKxDD3bSd9Svs4.s2IzO3FJ1CYcQrS7Kiwa:before {
        background: linear-gradient(270deg, #121212  30%, rgba(34, 34, 34, 0.5) 80%, rgba(34, 34, 34, 0) 100%) !important;
    }
    .yhiooHkKxDD3bSd9Svs4.Jd_Ct99A9ZvnQzJUn1bi:before {
        background: linear-gradient(90deg, #121212  30%, rgba(34, 34, 34, 0.5) 80%, rgba(34, 34, 34, 0) 100%) !important;
    }
`;

const LIKES_YOU_STYLES = `
    /* Expand container width */
    .userrows-content,
    .userrows-card-container
    {
        max-width: 100% !important;
        width: 100% !important;
    }
    .userrows-content-main {
        max-width: 100% !important;
        width: 100% !important;
        flex: 1 1 auto !important;
        margin-inline-start: 0 !important;
    }

    .userrows-content-sort{
        max-width: 100% !important;
        position: center !important;
        justify-items: center !important;
    }

    /* Override JS Grid/Masonry Layout */
    .incoming-likes-voting-list > div > div,
    .jBtTsboeLJtQL55nQsEi > div {
        display: grid !important;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)) !important;
        height: auto !important;
        position: relative !important;
        gap: 10px !important;
        padding-bottom: 20px !important;
        justify-content: center !important;
        margin: 0 auto !important;
    }

    /* Reset individual card positioning */
    .incoming-likes-voting-list > div > div > div,
    .userrows-main > div > div > div {
        position: relative !important;
        top: auto !important;
        left: auto !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
    }

    /* Ensure inner content fills the card */
    .incoming-likes-voting-list > div > div > div a,
    .userrows-main > div > div > div a {
        width: 100% !important;
        display: block !important;
    }
`;
