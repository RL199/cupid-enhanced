// =============================================================================
// UI Enhancements
// DOM manipulation, observers, and visual enhancements for OkCupid pages
// Requires: settings.js, selectors.js, styles.js
// =============================================================================
'use strict';

// =============================================================================
// State
// =============================================================================

var currentSettings = { ...DEFAULT_SETTINGS };
var observers = {};
var imageMetadataCache = {};
var isFetchingMetadata = false;
var lastFetchedUserId = null;

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
    window.addEventListener('message', event => {
        if (event.source !== window) return;

        const { type, count, time, userId } = event.data;

        if (type === 'LIKES_REMAINING_COUNT') {
            localStorage.setItem(STORAGE_KEYS.likesRemaining, count);
            updateElementText('likes-remaining', `Likes Remaining: ${count} (max 500)`);
        }

        if (type === 'LIKES_RESET_TIME') {
            const readableTime = new Date(time).toLocaleString();
            localStorage.setItem(STORAGE_KEYS.likesResetTime, readableTime);
            updateElementText('likes-reset-time', `Next Likes Reset: ${readableTime}`);
        }

        // Capture user ID from API interceptor
        if (type === 'OKCUPID_USER_ID' && userId) {
            currentUserId = userId;
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
    const scrollHandler = event => {
        if (!currentSettings.horizontalScroll) return;

        // Check if we're in the fullscreen photo modal
        const fullscreenModal = document.querySelector('#OkModal .photo-overlay-images');
        if (fullscreenModal) {
            handleFullscreenPhotoScroll(event);
            return;
        }

        // Default discover page horizontal scroll
        if (event.deltaY !== 0) return;

        const button =
            event.deltaX < 0
                ? document.querySelector(SELECTORS.prevButton)
                : document.querySelector(SELECTORS.nextButton);

        button?.click();
    };

    window.addEventListener('wheel', scrollHandler, { passive: false });
    observers.horizontalScroll = {
        disconnect: () => window.removeEventListener('wheel', scrollHandler, { passive: false })
    };
}

function handleFullscreenPhotoScroll(event) {
    if (event.deltaX === 0) return;
    event.preventDefault();

    const keyCode = event.deltaX > 0 ? 'ArrowRight' : 'ArrowLeft';
    const keyEvent = new KeyboardEvent('keydown', {
        key: keyCode,
        code: keyCode,
        bubbles: true,
        cancelable: true
    });

    document.dispatchEvent(keyEvent);
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
    chrome.runtime.onMessage.addListener(message => {
        if (message.type === 'SETTINGS_UPDATED') {
            currentSettings = message.settings;
            sendSettingsToMainWorld();
            applySettings();
        }
    });

    window.addEventListener('message', async event => {
        if (event.source !== window) return;

        if (event.data.type === 'REQUEST_SETTINGS') {
            sendSettingsToMainWorld();
        }

        // Forward captured headers from MAIN world to background service worker
        if (event.data.type === 'OKCUPID_HEADERS_CAPTURED') {
            chrome.runtime
                .sendMessage({
                    type: 'OKCUPID_HEADERS_UPDATE',
                    headers: event.data.headers
                })
                .catch(err => {
                    console.debug('[Cupid Enhanced] Header update pending:', err.message);
                });
        }

        // Handle Console API requests from MAIN world
        if (event.data.type === 'CUPID_API_REQUEST') {
            handleConsoleAPIRequest(event.data);
        }
    });
}

async function handleConsoleAPIRequest(data) {
    const { id, action, payload } = data;

    try {
        let result;

        switch (action) {
            case 'getTokenCounts':
                result = await getTokenCounts();
                break;
            case 'getLikesCap':
                result = await getLikesCap();
                break;
            case 'getFeaturedQuestion':
                result = await getFeaturedQuestion(payload.excludedUserIds);
                break;
            case 'getMatchProfile':
                result = await getMatchProfile(payload.targetId);
                break;
            case 'getConversationThread':
                result = await getConversationThread(payload.targetId, payload.limit, payload.before);
                break;
            case 'getMessagesMain':
                result = await getMessagesMain(payload.userId, payload.filter, payload.after);
                break;
            case 'vote':
                result = await voteOnUser(payload.targetId, payload.vote, payload.voteSource);
                break;
            case 'graphQL':
                result = await okcupidGraphQL(payload.operationName, payload.query, payload.variables);
                break;
            case 'request':
                result = await okcupidAPI(payload.url, payload.options);
                break;
            default:
                throw new Error(`Unknown action: ${action}`);
        }

        window.postMessage({ type: 'CUPID_API_RESPONSE', id, success: true, data: result }, '*');
    } catch (error) {
        window.postMessage({ type: 'CUPID_API_RESPONSE', id, success: false, error: error.message }, '*');
    }
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
        { key: 'likesYouPage', setting: 'enhanceLikesYouPage', fn: enhanceLikesYouPage }
    ];

    observerConfig.forEach(({ key, setting, fn }) => {
        if (currentSettings[setting]) {
            observers[key] = fn();
        }
    });

    // Features that are always enabled
    observers.premiumAds = blockPremiumAds();
    observers.doubleTakeButtons = setupDoubleTakeButtonsObserver();

    if (currentSettings.horizontalScroll) {
        setupHorizontalScroll();
    }

    observers.fullscreenPhotos = setupFullscreenPhotoObserver();
}

function setupFullscreenPhotoObserver() {
    let debounceTimer = null;

    return createBodyObserver(() => {
        const photoOverlay = document.querySelector('#OkModal .photo-overlay-images');
        if (!photoOverlay) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            displayPhotoDatesOnFullscreenImages();
        }, 100);
    });
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
        updateLikesIncomingCount();
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

function getCurrentUserIdFromDOM() {
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
        const response = await fetch(imageUrl, { method: 'HEAD' });
        return response.headers.get('Last-Modified');
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to fetch headers:', imageUrl, error);
        return null;
    }
}

async function fetchAllImageMetadata() {
    if (isFetchingMetadata) return;

    const userId = getCurrentUserIdFromDOM();

    if (userId && userId === lastFetchedUserId) {
        updatePhotoDateDisplay();
        return;
    }

    const photoUrls = getDiscoverPagePhotoUrls();
    if (photoUrls.length === 0) return;

    isFetchingMetadata = true;

    if (userId !== lastFetchedUserId) {
        imageMetadataCache = {};
        lastFetchedUserId = userId;
    }

    try {
        const results = await Promise.all(
            photoUrls.map(async url => ({
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

    const formatDate = date =>
        date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

    setPhotoDateText(newestElement, oldestElement, formatDate(photoDates.at(-1)), formatDate(photoDates[0]));
}

function setPhotoDateText(newestEl, oldestEl, newestStatus, oldestStatus = newestStatus) {
    if (!newestEl || !oldestEl) return;
    newestEl.textContent = `Newest Photo Upload: ${newestStatus}`;
    oldestEl.textContent = `Oldest Photo Upload: ${oldestStatus}`;
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

async function displayPhotoDatesOnFullscreenImages() {
    const photoOverlay = document.querySelector('#OkModal .photo-overlay-images');
    if (!photoOverlay) return;

    const slides = photoOverlay.querySelectorAll('[aria-label^="Slide image"]');

    for (const slide of slides) {
        const imageContainer = slide.querySelector('div[class*="Yb6VSqG3RppfEoug5fci"]');
        if (!imageContainer) continue;

        const imgEl = imageContainer.querySelector('img[src*="pictures.match.com"]');
        if (!imgEl) continue;

        const buttonEl = imgEl.closest('button');
        if (!buttonEl) continue;

        const url = getBaseImageUrl(imgEl.src);

        if (!imageMetadataCache[url]) {
            const lastModified = await fetchImageLastModified(imgEl.src);
            if (lastModified) {
                imageMetadataCache[url] = lastModified;
            }
        }

        const lastModified = imageMetadataCache[url];

        if (lastModified) {
            const date = new Date(lastModified);
            const dateString = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            let label = buttonEl.querySelector('.cupid-photo-date-fullscreen');
            if (!label) {
                label = document.createElement('div');
                label.className = 'cupid-photo-date-fullscreen';
                label.style.cssText = PHOTO_DATE_LABEL_STYLES;
                buttonEl.style.position = 'relative';
                buttonEl.appendChild(label);
            }

            if (label.textContent !== dateString) {
                label.textContent = dateString;
            }
        }
    }
}

// =============================================================================
// Cupid Enhanced Section
// =============================================================================

async function saveVisitedProfile(userId, photoUrl, name, age, location) {
    if (!isExtensionContextValid()) return;

    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.visitedProfiles]);
        let profiles = result[STORAGE_KEYS.visitedProfiles] || [];

        profiles = profiles.filter(p => {
            const id = typeof p === 'object' && p !== null ? p.userId : p;
            return id !== userId;
        });

        profiles.push({ userId, photoUrl, name, age, location, timestamp: Date.now() });
        await chrome.storage.local.set({ [STORAGE_KEYS.visitedProfiles]: profiles });
    } catch (error) {
        if (!error.message?.includes('Extension context invalidated')) {
            console.error('[Cupid Enhanced] Could not save visited profile:', error.message);
        }
    }
}

function addCupidEnhancedSection() {
    const rightPanel = document.querySelector(SELECTORS.rightPanel);
    if (!rightPanel) return;

    const userId = getCurrentUserIdFromDOM();
    if (userId) {
        const photoUrls = getDiscoverPagePhotoUrls();
        const firstPhotoUrl = photoUrls.length > 0 ? getBaseImageUrl(photoUrls[0]) : null;

        const nameElement = document.querySelector('.card-content-header__text');
        const name = nameElement ? nameElement.textContent.trim() : null;

        const locationElement = document.querySelector('.card-content-header__location');
        let age = null;
        let location = null;
        if (locationElement) {
            const text = locationElement.textContent.trim();
            const parts = text.split('•').map(s => s.trim());
            if (parts.length > 0) age = parts[0];
            if (parts.length > 1) location = parts[1];
        }

        saveVisitedProfile(currentUserId, firstPhotoUrl, name, age, location);
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

    let likesRemaining = localStorage.getItem(STORAGE_KEYS.likesRemaining) || 'Make first vote to display';
    let likesResetTime = localStorage.getItem(STORAGE_KEYS.likesResetTime) || 'Make first vote to display';

    if (likesResetTime < Date.now()) {
        likesResetTime = 'Reset time passed, make a vote to update';
        likesRemaining = 'Make vote to display';
    }

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
        PREMIUM_AD_SELECTORS.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (element.style.display !== 'none') {
                    element.style.display = 'none';
                }
            });
        });
    });
}
