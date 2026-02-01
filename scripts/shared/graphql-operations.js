// =============================================================================
// GraphQL Operations Constants
// Defines all available OkCupid GraphQL operations
// =============================================================================

var OKCUPID_OPERATIONS = {
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
