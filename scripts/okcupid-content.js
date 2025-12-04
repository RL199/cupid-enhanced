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
    enhanceInterestedPhotos: true,
    blockPremiumAds: true,
    horizontalScroll: true,
    darkMode: true
};

const STORAGE_KEYS = {
    likesRemaining: 'previous_likes_remaining',
    likesResetTime: 'likes_reset_time',
    likesCount: 'previous_likes_count'
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
    cupidSection: '.cupid-enhanced-section'
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
    '.profile-content-ad'
];

const DISCOVER_PAGE_ENHANCEMENTS = [
    { selector: '.desktop-dt-content', styles: { maxWidth: '90%', justifyContent: 'center' } },
    { selector: '.desktop-dt-right', styles: { marginLeft: '10px' } },
    { selector: '.sliding-pagination-inner-content', styles: { width: 'fit-content', justifyContent: 'center' } },
    { selector: '.sliding-pagination', styles: { display: 'inline-flex', justifyContent: 'center' } }
];

const BACKGROUND_IMAGE_REGEX = /url\(["']?(https:\/\/pictures\.match\.com\/photos\/[^"')]+)["']?\)/i;

const DARK_MODE_STYLES = `
    /* Card backgrounds */
    .desktop-dt-wrapper,
    .dt-section,
    .dt-section-content,
    .card-content-header,
    .profile-questions-entry,
    .lMKCh7F9nqebnDd56PN0,
    .desktop-dt-top,
    #profile,
    .profile-nudge-text,
    .profile-essay,
    .profile-essay-header,
    .userrows-content,
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

    .dt-essay-expand-button, .dt-essay-collapse-button {
        color: deepskyblue !important;
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

// =============================================================================
// Dark Mode
// =============================================================================

function enableDarkMode() {
    if (document.getElementById('cupid-dark-mode-styles')) return;

    const style = document.createElement('style');
    style.id = 'cupid-dark-mode-styles';
    style.textContent = DARK_MODE_STYLES;
    document.head.appendChild(style);
}

function disableDarkMode() {
    document.getElementById('cupid-dark-mode-styles')?.remove();
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
            updateElementText('likes-remaining', `Likes Remaining: ${count}`);
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
        { key: 'interestedPhotos', setting: 'enhanceInterestedPhotos', fn: enhanceInterestedUsersPhotos },
        { key: 'discoverPage', setting: 'enhanceDiscoverPage', fn: enhanceDiscoverPage },
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

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(addCupidEnhancedSection, 300);
    });
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

// =============================================================================
// Cupid Enhanced Section
// =============================================================================

function addCupidEnhancedSection() {
    const rightPanel = document.querySelector(SELECTORS.rightPanel);
    if (!rightPanel) return;

    const currentUserId = getCurrentUserId();
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
        <div class="matchprofile-details-text" id="likes-remaining">Likes Remaining: ${likesRemaining}</div>
        <div class="matchprofile-details-text" id="likes-reset-time">Next Likes Reset: ${likesResetTime}</div>
    `;

    section.append(title, content);
    return section;
}

// =============================================================================
// Interested Photos Enhancement
// =============================================================================

function enhanceInterestedUsersPhotos() {
    return createBodyObserver(() => {
        if (!currentSettings.enhanceInterestedPhotos) return;

        document.querySelectorAll('.CNr1suk9pEF3nlOENwde.eJG7lHzUvRC0ejcywkgI').forEach(photo => {
            photo.style.maxHeight = 'none';
        });

        document.querySelectorAll('.yfl1DI6BaFRYLQuLCe55').forEach(overlay => {
            overlay.style.display = 'none';
        });
    });
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
