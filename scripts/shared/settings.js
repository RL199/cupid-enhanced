// =============================================================================
// Shared Settings & Constants
// This file is loaded by popup.js, okcupid-content.js, and api-interceptor.js
// =============================================================================
//
// IMPORTANT: We use 'var' instead of 'const' because when multiple content scripts
// are injected into the same context (ISOLATED world), const/let create block-scoped
// variables that don't properly share across files. 'var' creates function-scoped
// variables that are accessible globally across all content script files.
// See: https://stackoverflow.com/questions/9515704

var SETTINGS_KEY = 'cupidEnhancedSettings';

var DEFAULT_SETTINGS = {
    staffMode: false,
    enhanceDiscoverPage: true,
    enhanceLikesYouPage: false,
    horizontalScroll: true,
    darkMode: false,
    anonymousMessageRead: false,
    photoUploadButton: false
};

var STORAGE_KEYS = {
    likesRemaining: 'previous_likes_remaining',
    likesResetTime: 'likes_reset_time',
    likesCount: 'previous_likes_count',
    visitedProfiles: 'visited_profiles'
};
