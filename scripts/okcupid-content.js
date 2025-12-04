"use strict";

console.log('###Cupid content script loaded###');

// =============================================================================
// Constants
// =============================================================================

const SETTINGS_KEY = 'cupidEnhancedSettings';
const DEFAULT_SETTINGS = {
    unblurImages: true,
    likesCount: true,
    enhanceDiscoverPage: true,
    enhanceLikesYouPage: true,
    blockPremiumAds: true,
    horizontalScroll: true,
    darkMode: true
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

const LIKES_YOU_PAGE_ENHANCEMENTS = [
    { selector: '.userrows-content', styles: { maxWidth: '95%', width: '95%', justifyContent: 'center' } },
    { selector: '.userrows-content-main', styles: { maxWidth: '100%', width: '100%', flex: '1 1 auto' } },
    { selector: '.userrows-main', styles: { maxWidth: '100%', width: '100%' } }
];

const HIDDEN_STACKS = [
    { id: 'BOOST_AD', label: 'Boost' },
    { id: 'CLIMATE_CHANGE', label: 'Climate Change' },
    { id: 'JUST_FOR_YOU', label: 'Recommended' },
    { id: 'MATCH_PERCENTAGE', label: 'Match %' },
    { id: 'MOST_QUESTIONS', label: 'Question Pros' },
    { id: 'NEARBY', label: 'Nearby' },
    { id: 'NEW_USERS', label: 'New Users' },
    { id: 'ONLINE_NOW', label: 'Online Now' },
    { id: 'PENPAL', label: 'Passport' },
    { id: 'POPULAR', label: 'Popular' },
    { id: 'PROMOTED_QUESTION', label: 'Promoted' },
    { id: 'PRO_CHOICE', label: 'Pro-Choice' },
    { id: 'STANDOUTS', label: 'Cupid’s Picks' },
    { id: 'SUPERLIKES', label: 'SuperLikes' },
    { id: 'VACCINATED', label: 'Vaccinated' }
];

const STACK_SLUGS = {
    'JUST_FOR_YOU': 'recommended',
    'POPULAR': 'popular',
    'NEW_USERS': 'new-users',
    'ONLINE_NOW': 'online',
    'MOST_QUESTIONS': 'questions',
    'MATCH_PERCENTAGE': 'match-percentage',
    'NEARBY': 'nearby',
    'PENPAL': 'passport',
    'SUPERLIKES': 'superlikes',
    'STANDOUTS': 'cupids-picks',
    'VACCINATED': 'vaccinated',
    'PRO_CHOICE': 'pro-choice',
    'CLIMATE_CHANGE': 'climate-change',
    'BOOST_AD': 'boost',
    'PROMOTED_QUESTION': 'promoted'
};

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
    svg, path {
        fill: #ffffff !important;
        stroke: none !important;
    }

    /*============================================
       MESSAGES - Dark background and light text
       =========================================== */
    .t659_29vzMkU6QQL2q0j,
    .x8amgHNYP_nXx626A_lY {
        color: #ffffff !important;
    }

    .WK2PEQwFZVjNdD26XECA {
        border: 2px solid white !important;
    }

    [id="stack-icon/just-for-you"] path,
    [id="stack-icon/just-for-you"] use,
    [id="stack-icon/just-for-you"] g {
        fill: #1a1a1a !important;
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
    .userrows-card-container,
    .Q8o8ldWxQdXz5zE0jhgx,
    .ogFfHbz4Rbttu2zVAYGe {
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

// =============================================================================
// State
// =============================================================================

let currentSettings = { ...DEFAULT_SETTINGS };
let observers = {};
let imageMetadataCache = {};
let isFetchingMetadata = false;
let lastFetchedUserId = null;

// =============================================================================
// Initialization
// =============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function init() {
    await loadSettings();
    setupEventListeners();
    setupObservers();
    updateLikesIncomingCount();

    if (currentSettings.darkMode) {
        enableDarkMode();
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
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            const sendLikeButton = document.querySelector(SELECTORS.sendButton);
            sendLikeButton?.click();
            if (sendLikeButton) event.preventDefault();
        }
    });
}

function setupPassButtonListener() {
    document.addEventListener('click', (event) => {
        const actionButton = event.target.closest(SELECTORS.actionButton);
        if (actionButton) {
            resetPhotoDateDisplay();
        }
    });
}

function resetPhotoDateDisplay() {
    const newestElement = document.getElementById('newest-photo-date');
    const oldestElement = document.getElementById('oldest-photo-date');
    setPhotoDateText(newestElement, oldestElement, 'Loading...');
    const likesRemainingElement = document.getElementById('likes-remaining');
    const likesResetTimeElement = document.getElementById('likes-reset-time');
    if (likesRemainingElement) likesRemainingElement.textContent = 'Likes Remaining: Loading...';
    if (likesResetTimeElement) likesResetTimeElement.textContent = 'Next Likes Reset: Loading...';
}

// =============================================================================
// Style Injection Helpers
// =============================================================================

function injectStyles(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
}

function removeStyles(id) {
    document.getElementById(id)?.remove();
}

// =============================================================================
// Dark Mode
// =============================================================================

function enableDarkMode() {
    injectStyles('cupid-dark-mode-styles', DARK_MODE_STYLES);
}

function disableDarkMode() {
    removeStyles('cupid-dark-mode-styles');
}

// =============================================================================
// Likes Data Handling
// =============================================================================

function listenForLikesData() {
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        const { type, count, time } = event.data;

        if (type === 'LIKES_REMAINING_COUNT') {
            localStorage.setItem(STORAGE_KEYS.likesRemaining, count);
            updateElementText('likes-remaining', `Likes Remaining: ${count} (max 500)`);
        }

        if (type === 'LIKES_RESET_TIME') {
            const readableTime = new Date(time).toLocaleString();
            localStorage.setItem(STORAGE_KEYS.likesResetTime, readableTime);
            updateElementText('likes-reset-time', `Next Likes Reset: ${readableTime}`);
        }
    });
}

function updateElementText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

// =============================================================================
// Horizontal Scroll
// =============================================================================

function setupHorizontalScroll() {
    const scrollHandler = (event) => {
        if (!currentSettings.horizontalScroll || event.deltaY !== 0) return;

        const button = event.deltaX < 0
            ? document.querySelector(SELECTORS.prevButton)
            : document.querySelector(SELECTORS.nextButton);

        button?.click();
    };

    window.addEventListener('wheel', scrollHandler);
    observers.horizontalScroll = {
        disconnect: () => window.removeEventListener('wheel', scrollHandler)
    };
}

// =============================================================================
// Settings Management
// =============================================================================

async function loadSettings() {
    const result = await chrome.storage.local.get([SETTINGS_KEY]);
    currentSettings = { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
    sendSettingsToMainWorld();
}

function sendSettingsToMainWorld() {
    window.postMessage({ type: 'SETTINGS_TO_MAIN', settings: currentSettings }, '*');
}

function listenForSettingsUpdates() {
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'SETTINGS_UPDATED') {
            currentSettings = message.settings;
            sendSettingsToMainWorld();
            applySettings();
        }
    });

    window.addEventListener('message', (event) => {
        if (event.source === window && event.data.type === 'REQUEST_SETTINGS') {
            sendSettingsToMainWorld();
        }
    });
}

function applySettings() {
    Object.values(observers).forEach(observer => observer?.disconnect());
    observers = {};

    currentSettings.darkMode ? enableDarkMode() : disableDarkMode();

    setupObservers();
}

// =============================================================================
// Observer Setup
// =============================================================================

function setupObservers() {
    const observerConfig = [
        { key: 'discoverPage', setting: 'enhanceDiscoverPage', fn: enhanceDiscoverPage },
        { key: 'likesYouPage', setting: 'enhanceLikesYouPage', fn: enhanceLikesYouPage },
        { key: 'premiumAds', setting: 'blockPremiumAds', fn: blockPremiumAds }
    ];

    observerConfig.forEach(({ key, setting, fn }) => {
        if (currentSettings[setting]) {
            observers[key] = fn();
        }
    });

    if (currentSettings.horizontalScroll) {
        setupHorizontalScroll();
    }
}

function createBodyObserver(callback) {
    const observer = new MutationObserver(callback);
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}

// =============================================================================
// Likes Count UI
// =============================================================================

function updateLikesIncomingCount() {
    if (!currentSettings.likesCount) return;

    const count = parseInt(localStorage.getItem(STORAGE_KEYS.likesCount) || '0', 10);
    if (count > 0) updateLikesUI(count);
}

function updateLikesUI(count) {
    const likesElement = document.querySelector(SELECTORS.likesCount);
    if (likesElement) {
        likesElement.textContent = count;
        replaceInterestWithLikes();
    }
}

function replaceInterestWithLikes() {
    document.querySelectorAll(SELECTORS.navbarLinkText).forEach(element => {
        if (element.textContent.includes('Interest')) {
            element.textContent = 'Likes';
        }
    });
}

function startLikesCountPolling() {
    setInterval(() => {
        if (currentSettings.likesCount) updateLikesIncomingCount();
    }, 2000);
}

// =============================================================================
// Discover Page Enhancement
// =============================================================================

function enhanceDiscoverPage() {
    let debounceTimer = null;

    return createBodyObserver(() => {
        if (!currentSettings.enhanceDiscoverPage) return;

        applyStylesToElements(DISCOVER_PAGE_ENHANCEMENTS);
        displayPhotoDatesOnImages();
        setupRewindButton();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(addCupidEnhancedSection, 300);
    });
}

function enhanceLikesYouPage() {
    if (!currentSettings.enhanceLikesYouPage) return;

    injectStyles('cupid-likes-you-styles', LIKES_YOU_STYLES);

    return {
        disconnect: () => removeStyles('cupid-likes-you-styles')
    };
}

function setupRewindButton() {
    const rewindButton = document.querySelector('.desktop-dt-top-rewind');
    if (!rewindButton || rewindButton.dataset.cupidRewindAttached) return;

    rewindButton.dataset.cupidRewindAttached = 'true';

    rewindButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const result = await chrome.storage.local.get([STORAGE_KEYS.visitedProfiles]);
        const profiles = result[STORAGE_KEYS.visitedProfiles] || [];
        const currentUserId = getCurrentUserId();

        let targetId = null;

        // Find the most recent profile that is NOT the current one
        for (let i = profiles.length - 1; i >= 0; i--) {
            if (profiles[i] !== currentUserId) {
                targetId = profiles[i];
                break;
            }
        }

        if (targetId) {
            window.location.href = `https://www.okcupid.com/profile/${targetId}`;
        } else {
            console.log('[Cupid Enhanced] No previous profile found in history.');
        }
    }, true);
}

function applyStylesToElements(enhancements) {
    enhancements.forEach(({ selector, styles }) => {
        document.querySelectorAll(selector).forEach(el => Object.assign(el.style, styles));
    });
}

// =============================================================================
// Image Metadata
// =============================================================================

function getBaseImageUrl(url) {
    return url.split('?')[0];
}

function getCurrentUserId() {
    return document.querySelector(SELECTORS.discoverWrapper)?.getAttribute('data-user-id') || null;
}

function getDiscoverPagePhotoUrls() {
    const photoContainer = document.querySelector(SELECTORS.photoContainer);
    if (!photoContainer) return [];

    const urls = [];
    photoContainer.querySelectorAll('[style*="background-image"]').forEach(element => {
        const match = (element.getAttribute('style') || '').match(BACKGROUND_IMAGE_REGEX);
        if (match?.[1]) urls.push(match[1]);
    });

    return [...new Set(urls)];
}

async function fetchImageLastModified(imageUrl) {
    try {
        const response = await fetch(imageUrl, { method: 'GET' });
        return response.headers.get('Last-Modified');
    } catch (error) {
        console.log('[Cupid Enhanced] Failed to fetch:', imageUrl, error);
        return null;
    }
}

async function fetchAllImageMetadata() {
    if (isFetchingMetadata) return;

    const currentUserId = getCurrentUserId();

    if (currentUserId && currentUserId === lastFetchedUserId) {
        updatePhotoDateDisplay();
        return;
    }

    const photoUrls = getDiscoverPagePhotoUrls();
    if (photoUrls.length === 0) return;

    isFetchingMetadata = true;

    if (currentUserId !== lastFetchedUserId) {
        imageMetadataCache = {};
        lastFetchedUserId = currentUserId;
    }

    console.log('[Cupid Enhanced] Fetching metadata for', photoUrls.length, 'images');

    try {
        const results = await Promise.all(
            photoUrls.map(async (url) => ({
                url: getBaseImageUrl(url),
                lastModified: await fetchImageLastModified(url)
            }))
        );

        results.forEach(({ url, lastModified }) => {
            if (lastModified) imageMetadataCache[url] = lastModified;
        });

        updatePhotoDateDisplay();
        displayPhotoDatesOnImages();
    } finally {
        isFetchingMetadata = false;
    }
}

function updatePhotoDateDisplay() {
    const newestElement = document.getElementById('newest-photo-date');
    const oldestElement = document.getElementById('oldest-photo-date');

    if (!newestElement || !oldestElement) return;

    const photoUrls = getDiscoverPagePhotoUrls().map(getBaseImageUrl);

    if (photoUrls.length === 0) {
        setPhotoDateText(newestElement, oldestElement, 'No photos found');
        return;
    }

    const photoDates = photoUrls
        .map(url => imageMetadataCache[url])
        .filter(Boolean)
        .map(lastModified => new Date(lastModified))
        .sort((a, b) => a - b);

    if (photoDates.length === 0) {
        setPhotoDateText(newestElement, oldestElement, 'Loading...');
        return;
    }

    const formatDate = (date) => date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    newestElement.textContent = `Newest Photo Upload: ${formatDate(photoDates.at(-1))}`;
    oldestElement.textContent = `Oldest Photo Upload: ${formatDate(photoDates[0])}`;
}

function setPhotoDateText(newestEl, oldestEl, status) {
    newestEl.textContent = `Newest Photo Upload: ${status}`;
    oldestEl.textContent = `Oldest Photo Upload: ${status}`;
}

function displayPhotoDatesOnImages() {
    const photoWrappers = document.querySelectorAll('.dt-photo');

    photoWrappers.forEach(wrapper => {
        const imageEl = wrapper.querySelector('[style*="background-image"]');
        if (!imageEl) return;

        const match = (imageEl.getAttribute('style') || '').match(BACKGROUND_IMAGE_REGEX);
        if (!match || !match[1]) return;

        const url = getBaseImageUrl(match[1]);
        const lastModified = imageMetadataCache[url];

        if (lastModified) {
            const date = new Date(lastModified);
            const dateString = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            let label = wrapper.querySelector('.cupid-photo-date');
            if (!label) {
                label = document.createElement('div');
                label.className = 'cupid-photo-date';
                label.style.cssText = `
                    position: absolute;
                    bottom: 10px;
                    left: 17%;
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
                wrapper.style.position = 'relative';
                wrapper.appendChild(label);
            }

            if (label.textContent !== dateString) {
                label.textContent = dateString;
            }
        }
    });
}

// =============================================================================
// Cupid Enhanced Section
// =============================================================================

async function saveVisitedProfile(userId) {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.visitedProfiles]);
        const profiles = result[STORAGE_KEYS.visitedProfiles] || [];

        //delete userId if it already exists to avoid duplicates
        const existingIndex = profiles.indexOf(userId);
        if (existingIndex !== -1) {
            profiles.splice(existingIndex, 1);
        }

        profiles.push(userId);
        await chrome.storage.local.set({ [STORAGE_KEYS.visitedProfiles]: profiles });
    } catch (error) {
        // Extension context may be invalidated after reload
        console.log('[Cupid Enhanced] Could not save visited profile:', error.message);
    }
}

function addCupidEnhancedSection() {
    const rightPanel = document.querySelector(SELECTORS.rightPanel);
    if (!rightPanel) return;

    const currentUserId = getCurrentUserId();
    if (currentUserId) {
        saveVisitedProfile(currentUserId);
    }

    const needsFetch = currentUserId && currentUserId !== lastFetchedUserId;

    if (document.querySelector(SELECTORS.cupidSection)) {
        if (needsFetch && !isFetchingMetadata) fetchAllImageMetadata();
        return;
    }

    const section = createCupidSection();
    rightPanel.insertBefore(section, rightPanel.firstChild);
    fetchAllImageMetadata();
}

function createCupidSection() {
    const section = document.createElement('div');
    section.className = 'dt-section cupid-enhanced-section';

    const title = document.createElement('h3');
    title.className = 'dt-section-title';
    title.textContent = 'Cupid Enhanced';

    const likesRemaining = localStorage.getItem(STORAGE_KEYS.likesRemaining) || 'Make first vote to display';
    const likesResetTime = localStorage.getItem(STORAGE_KEYS.likesResetTime) || 'Make first vote to display';

    const content = document.createElement('div');
    content.className = 'dt-section-content';
    content.innerHTML = `
        <div class="matchprofile-details-text" id="newest-photo-date">Newest Photo Upload: Loading...</div>
        <div class="matchprofile-details-text" id="oldest-photo-date">Oldest Photo Upload: Loading...</div>
        <div class="matchprofile-details-text" id="likes-remaining">Likes Remaining: ${likesRemaining} (max 500)</div>
        <div class="matchprofile-details-text" id="likes-reset-time">Next Likes Reset: ${likesResetTime}</div>
    `;

    section.append(title, content);
    return section;
}

// =============================================================================
// Premium Ads Blocking
// =============================================================================

function blockPremiumAds() {
    return createBodyObserver(() => {
        if (!currentSettings.blockPremiumAds) return;

        PREMIUM_AD_SELECTORS.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (element.style.display !== 'none') {
                    element.style.display = 'none';
                }
            });
        });
    });
}
