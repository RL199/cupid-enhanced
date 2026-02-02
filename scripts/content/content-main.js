// =============================================================================
// Content Script Main Entry Point
// Initializes and coordinates all content script modules
// Requires: All other content script modules to be loaded first
// =============================================================================
'use strict';

console.log('###Cupid content script loaded###');

// =============================================================================
// Console Logo Display
// =============================================================================

function displayConsoleLogo() {
    const logo = `
%c
 ♥♥♥♥♥♥ ♥♥    ♥♥ ♥♥♥♥♥♥  ♥♥ ♥♥♥♥♥♥      ♥♥♥♥♥♥♥ ♥♥♥    ♥♥ ♥♥   ♥♥  ♥♥♥♥♥  ♥♥♥    ♥♥  ♥♥♥♥♥♥ ♥♥♥♥♥♥♥ ♥♥♥♥♥♥
♥♥      ♥♥    ♥♥ ♥♥   ♥♥ ♥♥ ♥♥   ♥♥     ♥♥      ♥♥♥♥   ♥♥ ♥♥   ♥♥ ♥♥   ♥♥ ♥♥♥♥   ♥♥ ♥♥      ♥♥      ♥♥   ♥♥
♥♥      ♥♥    ♥♥ ♥♥♥♥♥♥  ♥♥ ♥♥   ♥♥     ♥♥♥♥♥   ♥♥ ♥♥  ♥♥ ♥♥♥♥♥♥♥ ♥♥♥♥♥♥♥ ♥♥ ♥♥  ♥♥ ♥♥      ♥♥♥♥♥   ♥♥   ♥♥
♥♥      ♥♥    ♥♥ ♥♥      ♥♥ ♥♥   ♥♥     ♥♥      ♥♥  ♥♥ ♥♥ ♥♥   ♥♥ ♥♥   ♥♥ ♥♥  ♥♥ ♥♥ ♥♥      ♥♥      ♥♥   ♥♥
 ♥♥♥♥♥♥  ♥♥♥♥♥♥  ♥♥      ♥♥ ♥♥♥♥♥♥      ♥♥♥♥♥♥♥ ♥♥   ♥♥♥♥ ♥♥   ♥♥ ♥♥   ♥♥ ♥♥   ♥♥♥♥  ♥♥♥♥♥♥ ♥♥♥♥♥♥♥ ♥♥♥♥♥♥

`;

    console.log(logo, 'color: #ff1493; font-weight: bold;');
}

// =============================================================================
// Initialization
// =============================================================================

async function init() {
    displayConsoleLogo();
    await loadSettings();
    setupEventListeners();
    setupObservers();
    updateLikesIncomingCount();

    if (currentSettings.darkMode) {
        enableDarkMode();
    }

    // Initialize photo upload feature
    initPhotoUpload();

    // Fetch and display likes cap data after a short delay to allow headers to be captured
    setTimeout(fetchAndDisplayLikesCap, 100);
}

/**
 * Fetch likes cap data and update the UI on page load
 */
async function fetchAndDisplayLikesCap() {
    try {
        const result = await getLikesCap();

        if (result?.data?.me?.likesCap) {
            const likesCap = result.data.me.likesCap;

            if (likesCap.likesRemaining !== undefined) {
                localStorage.setItem(STORAGE_KEYS.likesRemaining, likesCap.likesRemaining);
                updateElementText('likes-remaining', `Likes Remaining: ${likesCap.likesRemaining} (max 500)`);
            }

            if (likesCap.resetTime) {
                const readableTime = new Date(likesCap.resetTime).toLocaleString();
                localStorage.setItem(STORAGE_KEYS.likesResetTime, readableTime);
                updateElementText('likes-reset-time', `Next Likes Reset: ${readableTime}`);
            }
        }
    } catch (error) {
        if (!error.message?.includes('403')) {
            console.error('[Cupid Enhanced] API test failed:', error.message);
        }
    }
}

// =============================================================================
// Event Listeners Setup
// =============================================================================

function setupEventListeners() {
    setupKeyboardShortcuts();
    listenForLikesData();
    listenForSettingsUpdates();
    startLikesCountPolling();
    setupPassButtonListener();
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', event => {
        if (event.ctrlKey && event.key === 'Enter') {
            const sendLikeButton = document.querySelector(SELECTORS.sendButton);
            sendLikeButton?.click();
            if (sendLikeButton) event.preventDefault();
        }
    });
}

function setupPassButtonListener() {
    document.addEventListener('click', event => {
        const actionButton = event.target.closest(SELECTORS.actionButton);
        if (actionButton) {
            resetPhotoDateDisplay();
            resetLikesDataDisplay();
        }
    });
}

function resetLikesDataDisplay() {
    const likesRemainingElement = document.getElementById('likes-remaining');
    const likesResetTimeElement = document.getElementById('likes-reset-time');
    if (likesRemainingElement) likesRemainingElement.textContent = 'Likes Remaining: Loading...';
    if (likesResetTimeElement) likesResetTimeElement.textContent = 'Next Likes Reset: Loading...';
}

function resetPhotoDateDisplay() {
    const newestElement = document.getElementById('newest-photo-date');
    const oldestElement = document.getElementById('oldest-photo-date');
    setPhotoDateText(newestElement, oldestElement, 'Loading...');
}

// =============================================================================
// Start Initialization
// =============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
