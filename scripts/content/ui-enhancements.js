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
var interestedProfileMap = {};
var interestedProfileMapLoaded = false;
var interestedTotalFromResponse = null;
var interestedFetchAborted = false;

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

        const { type, count, time, userId, entries } = event.data;

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

        if (type === 'INTERESTED_PROFILE_CURSOR_MAP' && Array.isArray(entries) && entries.length > 0) {
            updateInterestedProfileMap(entries);
        }
    });
}

function updateElementText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

// =============================================================================
// Interested Profile Mapping
// =============================================================================

async function loadInterestedProfileMap() {
    if (interestedProfileMapLoaded || !isExtensionContextValid()) return;

    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.interestedProfileMap]);
        interestedProfileMap = result[STORAGE_KEYS.interestedProfileMap] || {};
        interestedProfileMapLoaded = true;
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to load interested profile map:', error.message);
    }
}

function updateInterestedProfileMap(entries) {
    if (!isExtensionContextValid() || !isLikesIncomingTab()) return 0;

    let updated = false;
    let addedCount = 0;

    entries.forEach(entry => {
        const imageUrl = normalizeImageUrl(entry?.imageUrl);
        const profileId = entry?.profileId;
        if (!imageUrl || !profileId) return;

        if (interestedProfileMap[imageUrl] !== profileId) {
            interestedProfileMap[imageUrl] = profileId;
            updated = true;
            addedCount += 1;
        }
    });

    if (updated) {
        chrome.storage.local.set({ [STORAGE_KEYS.interestedProfileMap]: interestedProfileMap }).catch(error => {
            console.error('[Cupid Enhanced] Failed to persist interested profile map:', error.message);
        });
    }

    return addedCount;
}

function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    return url.split('?')[0];
}

function base64EncodeCursor(value) {
    if (!value || typeof value !== 'string') return null;
    try {
        return btoa(value);
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to base64 encode cursor:', error.message);
        return null;
    }
}

function base64DecodeCursor(value) {
    if (!value || typeof value !== 'string') return null;
    try {
        return atob(value);
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to base64 decode cursor:', error.message);
        return null;
    }
}

function getInterestedSortOptions() {
    return [
        'LIKES_VIEWS_GLOBAL',
        'LAST_LOGIN_DESCENDING',
        'DISTANCE_ASCENDING',
        'MATCH_SCORE_DESCENDING',
        'JOIN_DATE_DESCENDING',
        'VIEWED_ME',
        'AGE_ASCENDING',
        'AGE_DESCENDING'
    ];
}

function getInterestedInYouCount() {
    const tabsContainer = document.querySelector('[data-cy="likesPage.tabs"]');
    const candidates = tabsContainer
        ? tabsContainer.querySelectorAll('a, [role="tab"], button')
        : document.querySelectorAll('a, [role="tab"], button');

    for (const candidate of candidates) {
        const text = candidate.textContent || '';
        if (!text.includes('Interested in You')) continue;
        const match = text.match(/\((\d+)\)/);
        if (match) {
            const parsed = parseInt(match[1], 10);
            if (!Number.isNaN(parsed)) return parsed;
        }
    }

    return null;
}

function getInterestedProfileIdCount() {
    const ids = Object.values(interestedProfileMap).filter(Boolean);
    return new Set(ids).size;
}

function getInterestedTargetCount() {
    const domCount = getInterestedInYouCount();
    if (typeof interestedTotalFromResponse === 'number' && typeof domCount === 'number') {
        return Math.max(interestedTotalFromResponse, domCount);
    }
    if (typeof interestedTotalFromResponse === 'number') return interestedTotalFromResponse;
    return domCount;
}

function getInterestedHeaderContainer() {
    const likesPage = document.querySelector('[data-cy="likesPage"]');
    if (!likesPage) return null;

    // Mount directly on likesPage for fixed positioning
    return likesPage;
}

function ensureInterestedFetchButton() {
    const headerContainer = getInterestedHeaderContainer();
    if (!headerContainer) {
        console.debug('[Cupid Enhanced] Interested button: header container not found');
        return;
    }

    if (headerContainer.querySelector('.cupid-fetch-interested-wrapper')) {
        console.debug('[Cupid Enhanced] Interested button: already mounted');
        return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'cupid-fetch-interested-wrapper';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cupid-fetch-interested-ids';
    button.textContent = 'Fetch Interested Profiles';
    button.addEventListener('click', () => {
        handleInterestedFetchButtonClick(button);
    });

    const status = document.createElement('div');
    status.className = 'cupid-fetch-interested-status';
    status.textContent = '';

    wrapper.append(button, status);
    headerContainer.appendChild(wrapper);
}

function collectUserImageUrls(user) {
    const urls = new Set();
    const primaryImage = user?.primaryImage;
    if (primaryImage) {
        [
            primaryImage.original,
            primaryImage.square800,
            primaryImage.square400,
            primaryImage.square225,
            primaryImage.square160,
            primaryImage.square120,
            primaryImage.square100,
            primaryImage.square82,
            primaryImage.square60
        ]
            .map(normalizeImageUrl)
            .filter(Boolean)
            .forEach(url => urls.add(url));
    }

    return [...urls];
}

function extractInterestedImageUrl(item) {
    if (!item || typeof item !== 'object') return null;

    if (item.user?.primaryImage?.square225) return item.user.primaryImage.square225;
    if (item.user?.primaryImage?.original) return item.user.primaryImage.original;

    if (item.primaryImage?.square225) return item.primaryImage.square225;
    if (item.primaryImage?.original) return item.primaryImage.original;

    if (item.primaryImageBlurred?.square225) return item.primaryImageBlurred.square225;

    return null;
}

function extractInterestedProfileEntries(result) {
    const entries = [];
    if (result?.errors?.length) {
        console.warn('[Cupid Enhanced] Interested fetch: response errors', result.errors);
    }

    const likes = result?.data?.me?.likes;
    if (typeof likes?.pageInfo?.total === 'number') {
        interestedTotalFromResponse = likes.pageInfo.total;
    }
    const likesData = likes?.data;
    if (!Array.isArray(likesData) || likesData.length === 0) {
        return entries;
    }

    const firstImage = normalizeImageUrl(extractInterestedImageUrl(likesData[0]));
    const lastImage = normalizeImageUrl(extractInterestedImageUrl(likesData[likesData.length - 1]));

    const afterCursor = likes?.pageInfo?.after;
    const decodedAfter = base64DecodeCursor(afterCursor);
    if (decodedAfter && lastImage) {
        entries.push({ profileId: decodedAfter, imageUrl: lastImage, cursor: afterCursor });
    }

    likesData.forEach(item => {
        const user = item?.user;
        const profileId = user?.id;
        if (!profileId) return;

        const imageUrls = collectUserImageUrls(user);
        imageUrls.forEach(imageUrl => {
            entries.push({ imageUrl, profileId });
        });
    });

    return entries;
}

async function fetchInterestedForCursor(sort, afterCursor, maxRetries = 3) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await getIncomingLikes(sort, afterCursor || null);
            const entries = extractInterestedProfileEntries(response);
            const addedCount = entries.length ? updateInterestedProfileMap(entries) || 0 : 0;
            return { response, addedCount, error: null };
        } catch (error) {
            lastError = error;
            const status = error.message?.match(/status:\s*(\d+)/)?.[1];
            if (status === '502' || status === '503' || status === '429') {
                console.warn(`[Cupid Enhanced] Fetch error ${status}, retry ${attempt}/${maxRetries}...`);
                await sleep(500 * attempt);
                continue;
            }
            break;
        }
    }
    console.error('[Cupid Enhanced] Fetch failed after retries:', lastError?.message);
    return { response: null, addedCount: 0, error: lastError };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function collectAllImageUrlsFromItem(item) {
    const urls = new Set();
    if (!item || typeof item !== 'object') return urls;

    // Match items have full user data with all image sizes
    if (item.user) {
        collectUserImageUrls(item.user).forEach(url => urls.add(url));
    }

    // MatchPreview items have limited image data
    const square225 = normalizeImageUrl(item.primaryImage?.square225);
    if (square225) urls.add(square225);

    const blurred225 = normalizeImageUrl(item.primaryImageBlurred?.square225);
    if (blurred225) urls.add(blurred225);

    return urls;
}

async function pruneStaleProfiles(statusEl) {
    const allImageUrls = new Set();
    let afterCursor = null;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 50;

    while (hasMore && pageCount < maxPages && !interestedFetchAborted) {
        pageCount++;
        if (statusEl) statusEl.textContent = `Validating profiles... (page ${pageCount})`;

        try {
            const response = await getIncomingLikes('LAST_LOGIN_DESCENDING', afterCursor);
            const likes = response?.data?.me?.likes;
            const likesData = likes?.data;

            if (typeof likes?.pageInfo?.total === 'number') {
                interestedTotalFromResponse = likes.pageInfo.total;
            }

            if (Array.isArray(likesData)) {
                for (const item of likesData) {
                    collectAllImageUrlsFromItem(item).forEach(url => allImageUrls.add(url));
                }

                // Also add discovered entries to the map while we're at it
                const entries = extractInterestedProfileEntries(response);
                if (entries.length) updateInterestedProfileMap(entries);
            }

            hasMore = likes?.pageInfo?.hasMore === true;
            afterCursor = likes?.pageInfo?.after || null;

            if (!Array.isArray(likesData) || likesData.length === 0) break;

            await sleep(50);
        } catch (error) {
            console.error('[Cupid Enhanced] Prune validation failed:', error.message);
            break;
        }
    }

    if (allImageUrls.size === 0) {
        console.warn('[Cupid Enhanced] Prune: no image URLs collected, skipping removal');
        return 0;
    }

    const keysToRemove = Object.keys(interestedProfileMap).filter(url => !allImageUrls.has(url));

    if (keysToRemove.length > 0) {
        for (const key of keysToRemove) {
            delete interestedProfileMap[key];
        }
        console.log(`[Cupid Enhanced] Pruned ${keysToRemove.length} stale profile URL(s)`);
        try {
            await chrome.storage.local.set({ [STORAGE_KEYS.interestedProfileMap]: interestedProfileMap });
        } catch (error) {
            console.error('[Cupid Enhanced] Failed to persist pruned map:', error.message);
        }
    }

    if (statusEl) {
        const removed = keysToRemove.length;
        statusEl.textContent = removed > 0
            ? `Pruned ${removed} stale URL(s) • ${getInterestedProfileIdCount()} IDs remain`
            : `Validated ${allImageUrls.size} URLs • ${getInterestedProfileIdCount()} IDs`;
    }

    return keysToRemove.length;
}

const FETCHED_COMBOS_KEY = 'cupid_fetched_combos';

function loadFetchedCombos() {
    try {
        const stored = sessionStorage.getItem(FETCHED_COMBOS_KEY);
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
        return new Set();
    }
}

function saveFetchedCombos(combos) {
    try {
        sessionStorage.setItem(FETCHED_COMBOS_KEY, JSON.stringify([...combos]));
    } catch (error) {
        console.warn('[Cupid Enhanced] Failed to save fetched combos:', error.message);
    }
}

async function handleInterestedFetchButtonClick(button) {
    if (button.dataset.cupidBusy === 'true') {
        interestedFetchAborted = true;
        button.innerHTML = '<span class="cupid-fetch-spinner"></span> Stopping';
        button.disabled = true;
        return;
    }

    interestedFetchAborted = false;
    button.dataset.cupidBusy = 'true';
    const wrapper = button.closest('.cupid-fetch-interested-wrapper');
    const status = wrapper?.querySelector('.cupid-fetch-interested-status') || null;

    button.innerHTML = '<span class="cupid-fetch-spinner"></span> Stop';
    button.classList.add('cupid-fetch-active');
    if (status) status.textContent = 'Loading...';

    await loadInterestedProfileMap();

    // Prune stale profiles before fetching new ones
    if (!interestedFetchAborted) {
        await pruneStaleProfiles(status);
    }

    // Clear fetched combos after prune since the map may have changed
    sessionStorage.removeItem(FETCHED_COMBOS_KEY);

    const targetCount = getInterestedTargetCount();
    const initialCount = getInterestedProfileIdCount();
    let currentCount = initialCount;
    const sortOptions = getInterestedSortOptions();
    let totalAdded = 0;
    let requestCount = 0;
    let passes = 0;
    const maxPasses = 10;
    const fetchedCombos = loadFetchedCombos();

    while ((targetCount == null || currentCount < targetCount) && passes < maxPasses && !interestedFetchAborted) {
        passes += 1;
        let passAdded = 0;
        let errorCount = 0;
        let newCombosThisPass = 0;
        let reachedTarget = false;

        const profileIds = [...new Set(Object.values(interestedProfileMap).filter(Boolean))];
        const cursors = profileIds.map(base64EncodeCursor).filter(Boolean);

        for (const sort of sortOptions) {
            if (interestedFetchAborted || reachedTarget) break;

            const nullKey = `${sort}:__NULL__`;
            if (!fetchedCombos.has(nullKey)) {
                newCombosThisPass++;
                fetchedCombos.add(nullKey);
                saveFetchedCombos(fetchedCombos);
                const { addedCount, error } = await fetchInterestedForCursor(sort, null);
                if (error) errorCount++;
                totalAdded += addedCount;
                passAdded += addedCount;
                requestCount += 1;
                currentCount = getInterestedProfileIdCount();
                if (status) status.textContent = `${currentCount}/${targetCount ?? '?'} Profiles`;

                if (targetCount != null && currentCount >= targetCount) {
                    reachedTarget = true;
                    break;
                }
                await sleep(50);
            }

            for (const cursor of cursors) {
                if (interestedFetchAborted || reachedTarget) break;

                const comboKey = `${sort}:${cursor}`;
                if (fetchedCombos.has(comboKey)) continue;

                newCombosThisPass++;
                fetchedCombos.add(comboKey);
                saveFetchedCombos(fetchedCombos);
                const { addedCount, error } = await fetchInterestedForCursor(sort, cursor);
                if (error) errorCount++;
                totalAdded += addedCount;
                passAdded += addedCount;
                requestCount += 1;
                currentCount = getInterestedProfileIdCount();
                if (status) status.textContent = `${currentCount}/${targetCount ?? '?'} Profiles`;

                if (targetCount != null && currentCount >= targetCount) {
                    reachedTarget = true;
                    break;
                }
                await sleep(50);
            }
        }

        currentCount = getInterestedProfileIdCount();

        // Exit if target reached
        if (reachedTarget) {
            break;
        }

        // Exit if no new combinations were tried this pass
        if (newCombosThisPass === 0) {
            break;
        }

        if (passAdded === 0) {
            break;
        }

        await sleep(100);
    }

    const newProfilesAdded = currentCount - initialCount;
    const stoppedEarly = interestedFetchAborted;
    interestedFetchAborted = false;

    if (status) {
        const targetLabel = targetCount != null ? `${currentCount}/${targetCount}` : `${currentCount}`;
        const stopLabel = stoppedEarly ? 'Stopped' : 'Done';
        const newLabel = newProfilesAdded > 0 ? ` • +${newProfilesAdded} new` : '';
        status.textContent = `${stopLabel} • ${targetLabel} IDs${newLabel}`;
    }
    button.disabled = false;
    button.textContent = 'Fetch Interested Profiles';
    button.classList.remove('cupid-fetch-active');
    button.dataset.cupidBusy = 'false';
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
}

function listenForSettingsUpdates() {
    chrome.runtime.onMessage.addListener(message => {
        if (message.type === 'SETTINGS_UPDATED') {
            currentSettings = message.settings;
            applySettings();
        }
    });

    window.addEventListener('message', async event => {
        if (event.source !== window) return;

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

    observers.interestedFetch = setupInterestedFetchFeature();

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

    const observer = createBodyObserver(() => {
        if (!currentSettings.enhanceLikesYouPage) return;
        decorateInterestedCards();
    });

    return {
        disconnect: () => {
            observer?.disconnect();
            removeStyles('cupid-likes-you-styles');
        }
    };
}

function isLikesIncomingTab() {
    return !!document.querySelector('[data-cy="likesPage.tab"][data-type="likesIncoming"]');
}

function setupInterestedFetchFeature() {
    let initialized = false;

    const observer = createBodyObserver(() => {
        if (!isLikesIncomingTab()) return;

        if (!initialized) {
            initialized = true;
            loadInterestedProfileMap();
        }

        ensureInterestedFetchButton();
    });

    return observer;
}

function decorateInterestedCards() {
    const likesContainer = document.querySelector('[data-cy="likesPage.whoLikesYouContent"]');
    if (!likesContainer) return;

    const cards = likesContainer.querySelectorAll('a.WYYTav9yXPiJZmvkljJB, .incoming-likes-voting-list a');

    cards.forEach(card => {
        if (!card.dataset.cupidProfileBound) {
            card.dataset.cupidProfileBound = 'true';
            card.addEventListener(
                'click',
                event => {
                    const profileId = card.dataset.cupidProfileId;
                    if (!profileId) return;

                    event.preventDefault();
                    event.stopPropagation();
                    window.location.href = `https://www.okcupid.com/profile/${profileId}`;
                },
                true
            );
        }

        const imageEl = card.querySelector('[style*="background-image"]');
        const style = imageEl?.getAttribute('style') || '';
        const match = style.match(BACKGROUND_IMAGE_REGEX);
        const imageUrl = normalizeImageUrl(match?.[1]);
        if (!imageUrl) return;

        const profileId = interestedProfileMap[imageUrl];
        if (!profileId) return;

        const profileUrl = `https://www.okcupid.com/profile/${profileId}`;

        if (card.dataset.cupidProfileId !== profileId) {
            card.dataset.cupidProfileId = profileId;
            card.href = profileUrl;
            card.removeAttribute('target');
            card.removeAttribute('rel');
        }

        if (card.querySelector('.cupid-open-profile-icon')) return;

        const icon = document.createElement('button');
        icon.type = 'button';
        icon.className = 'cupid-open-profile-icon';
        icon.setAttribute('aria-label', 'Open profile in new tab');
        icon.innerHTML = `
            <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"></path>
                <path d="M5 5h6V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6h-2v6H5V5z"></path>
            </svg>
        `;

        icon.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            window.location.href = profileUrl;
        });

        card.style.position = 'relative';
        card.appendChild(icon);
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
