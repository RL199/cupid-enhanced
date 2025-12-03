"use strict";

console.log('###Cupid content script loaded###');

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

let currentSettings = { ...DEFAULT_SETTINGS };
let observers = {};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Main initialization
async function init() {
    await loadSettings();
    listenForLikesRemaining();
    listenForLikesCount();
    listenForSettingsUpdates();
    setupObservers();
    updateLikesIncomingCount();
    setupKeyboardShortcuts();
    if (currentSettings.darkMode) {
        enableDarkMode();
    }
}

// Setup keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Ctrl+Enter to send like when comment tray is open
        if (event.ctrlKey && event.key === 'Enter') {
            const sendLikeButton = document.querySelector('button[data-cy="messenger.sendButton"]');
            if (sendLikeButton) {
                event.preventDefault();
                sendLikeButton.click();
            }
        }
    });
}

// Enable dark mode on the site
function enableDarkMode() {
    // Inject dark mode styles
    if (!document.getElementById('cupid-dark-mode-styles')) {
        const style = document.createElement('style');
        style.id = 'cupid-dark-mode-styles';
        style.textContent = `
            /* Main backgrounds */

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

            .dt-section-title{
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

            .RdZlPEHL94PdRZqJm_GF{
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
            .dt-section{
            border: 2px solid #e6e6e6 !important;
            }


            .dt-section-title,
            .profilesection-title {
                color: #1a1a1a !important;
                background-color: #fff !important;
            }

            /* Photo fade overlays - change from white to black */
            .sliding-pagination-fade.right,
            .sliding-pagination-fade.left {
                background: linear-gradient(to right, rgba(26, 26, 26, 0), rgba(26, 26, 26, 1)) !important;
            }

            .sliding-pagination-fade.left {
                background: linear-gradient(to left, rgba(26, 26, 26, 0), rgba(26, 26, 26, 1)) !important;
            }
        `;
        document.head.appendChild(style);
    }
}

// Disable dark mode
function disableDarkMode() {
    const styleElement = document.getElementById('cupid-dark-mode-styles');
    if (styleElement) {
        styleElement.remove();
    }
}

function listenForLikesRemaining() {
    window.addEventListener('message', (event) => {
        if (event.source === window && event.data.type === 'LIKES_REMAINING_COUNT') {
            const count = event.data.count;
            localStorage.setItem('previous_likes_remaining', count);
            //if the Cupid Enhanced section exists, update the displayed value
            const likesRemainingElement = document.getElementById('likes-remaining');
            if (likesRemainingElement) {
                likesRemainingElement.textContent = `Likes Remaining: ${count}`;
            }
        }
        if (event.source === window && event.data.type === 'LIKES_RESET_TIME') {
            const time = event.data.time;
            // convert epoch to readable date
            const readableTime = new Date(time).toLocaleString();
            localStorage.setItem('likes_reset_time', readableTime);

            //if the Cupid Enhanced section exists, update the displayed value
            const likesResetTimeElement = document.getElementById('likes-reset-time');
            if (likesResetTimeElement) {
                likesResetTimeElement.textContent = `Next Likes Reset: ${readableTime}`;
            }
        }
    });
}

// Add horizontal scroll support for discover page
function addScrollLeftRightClicks() {
    const scrollHandler = (event) => {
        if (!currentSettings.horizontalScroll) return;
        if (event.deltaY != 0) return; // only horizontal scroll

        const leftButton = document.querySelector('.sliding-pagination-button.prev');
        const rightButton = document.querySelector('.sliding-pagination-button.next');

        if (event.deltaX < 0) {
            leftButton?.click();
        } else {
            rightButton?.click();
        }
    };

    window.addEventListener('wheel', scrollHandler);
    observers.horizontalScroll = { disconnect: () => window.removeEventListener('wheel', scrollHandler) };
}

// Load settings from storage
async function loadSettings() {
    const result = await chrome.storage.local.get([SETTINGS_KEY]);
    currentSettings = { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };

    // Send settings to MAIN world for API interceptor
    sendSettingsToMainWorld();
}

// Send settings to MAIN world
function sendSettingsToMainWorld() {
    window.postMessage({
        type: 'SETTINGS_TO_MAIN',
        settings: currentSettings
    }, '*');
}

// Listen for settings updates from popup
function listenForSettingsUpdates() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SETTINGS_UPDATED') {
            currentSettings = message.settings;
            sendSettingsToMainWorld();
            applySettings();
        }
    });

    // Listen for settings requests from MAIN world
    window.addEventListener('message', (event) => {
        if (event.source === window && event.data.type === 'REQUEST_SETTINGS') {
            sendSettingsToMainWorld();
        }
    });
}

// Apply current settings by starting/stopping observers
function applySettings() {
    // Clean up existing observers
    Object.values(observers).forEach(observer => observer?.disconnect());
    observers = {};

    // Handle dark mode
    if (currentSettings.darkMode) {
        enableDarkMode();
    } else {
        disableDarkMode();
    }

    // Reapply based on current settings
    setupObservers();
}

// Setup all mutation observers based on settings
function setupObservers() {
    if (currentSettings.enhanceInterestedPhotos) {
        observers.interestedPhotos = enhanceInterestedUsersPhotos();
    }
    if (currentSettings.enhanceDiscoverPage) {
        observers.discoverPage = enhanceDiscoverPage();
    }
    if (currentSettings.blockPremiumAds) {
        observers.premiumAds = blockPremiumAds();
    }
    if (currentSettings.horizontalScroll) {
        addScrollLeftRightClicks();
    }
}

// Likes count management
function updateLikesIncomingCount() {
    if (!currentSettings.likesCount) return;

    const count = parseInt(localStorage.getItem('previous_likes_count') || '0', 10);
    updateLikesUI(count);
}

function updateLikesUI(count) {
    if (!currentSettings.likesCount || !count || count <= 0) return;

    const likesCountElement = document.querySelector('.count');
    if (likesCountElement) {
        likesCountElement.textContent = count;
        replaceInterestWithLikes();
    }
}

function replaceInterestWithLikes() {
    document.querySelectorAll('.navbar-link-text').forEach(element => {
        if (element.textContent.includes('Interest')) {
            element.textContent = 'Likes';
        }
    });
}

function listenForLikesCount() {
    // Poll local storage periodically for likes count updates
    setInterval(() => {
        if (currentSettings.likesCount) {
            updateLikesIncomingCount();
        }
    }, 2000); // Check every 2 seconds
}

function enhanceDiscoverPage() {
    const enhancements = [
        { selector: '.desktop-dt-content', styles: { maxWidth: '90%', justifyContent: 'center' } },
        { selector: '.desktop-dt-right', styles: { marginLeft: '10px' } },
        { selector: '.sliding-pagination-inner-content', styles: { width: 'fit-content', justifyContent: 'center' } },
        { selector: '.sliding-pagination', styles: { display: 'inline-flex', justifyContent: 'center' } }
    ];

    let debounceTimer = null;

    const observer = new MutationObserver(() => {
        if (!currentSettings.enhanceDiscoverPage) return;

        enhancements.forEach(({ selector, styles }) => {
            document.querySelectorAll(selector).forEach(element => {
                Object.assign(element.style, styles);
            });
        });

        // Debounce the section update to prevent rapid firing
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            addCupidEnhancedSection();
        }, 300);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}

// Store image metadata cache
let imageMetadataCache = {};
let isFetchingMetadata = false; // Prevent redundant fetches
let lastFetchedUserId = null; // Track which user's photos we've fetched

// Regex to extract image URL from background-image CSS
const BACKGROUND_IMAGE_REGEX = /url\(["']?(https:\/\/pictures\.match\.com\/photos\/[^"')]+)["']?\)/i;

// Extract base URL (without query params) from full URL
function getBaseImageUrl(url) {
    return url.split('?')[0];
}

// Get current user ID from the page
function getCurrentUserId() {
    const wrapper = document.querySelector('.desktop-dt-wrapper');
    return wrapper?.getAttribute('data-user-id') || null;
}

// Get all profile photo URLs from the current discover page
function getDiscoverPagePhotoUrls() {
    const photoUrls = [];
    const photoContainer = document.querySelector('.sliding-pagination-inner-content');

    if (!photoContainer) return photoUrls;

    // Find all elements with background-image containing pictures.match.com
    photoContainer.querySelectorAll('[style*="background-image"]').forEach(element => {
        const style = element.getAttribute('style') || '';
        const match = style.match(BACKGROUND_IMAGE_REGEX);
        if (match && match[1]) {
            photoUrls.push(match[1]); // Keep full URL with query params for fetching
        }
    });

    return [...new Set(photoUrls)]; // Remove duplicates
}

// Fetch Last-Modified header for an image URL
async function fetchImageLastModified(imageUrl) {
    try {
        const response = await fetch(imageUrl, { method: 'GET' });
        const lastModified = response.headers.get('Last-Modified');
        console.log('[Cupid Enhanced] Fetched:', imageUrl, 'Last-Modified:', lastModified);
        return lastModified;
    } catch (e) {
        console.log('[Cupid Enhanced] Failed to fetch:', imageUrl, e);
        return null;
    }
}

// Fetch metadata for all discovered images
async function fetchAllImageMetadata() {
    // Prevent concurrent fetches
    if (isFetchingMetadata) return;
    
    const currentUserId = getCurrentUserId();
    
    // Skip if we already fetched for this user
    if (currentUserId && currentUserId === lastFetchedUserId) {
        updatePhotoDateDisplay();
        return;
    }

    const photoUrls = getDiscoverPagePhotoUrls();
    
    if (photoUrls.length === 0) return;

    isFetchingMetadata = true;
    
    // Clear cache when switching users
    if (currentUserId !== lastFetchedUserId) {
        imageMetadataCache = {};
        lastFetchedUserId = currentUserId;
    }

    console.log('[Cupid Enhanced] Fetching metadata for', photoUrls.length, 'images');

    try {
        // Fetch all in parallel
        const results = await Promise.all(
            photoUrls.map(async (url) => {
                const lastModified = await fetchImageLastModified(url);
                return { url: getBaseImageUrl(url), lastModified };
            })
        );

        // Update cache with results
        results.forEach(({ url, lastModified }) => {
            if (lastModified) {
                imageMetadataCache[url] = lastModified;
            }
        });

        updatePhotoDateDisplay();
    } finally {
        isFetchingMetadata = false;
    }
}

// Update the photo date display with oldest/newest dates
function updatePhotoDateDisplay() {
    const newestElement = document.getElementById('newest-photo-date');
    const oldestElement = document.getElementById('oldest-photo-date');

    if (!newestElement || !oldestElement) return;

    const photoUrls = getDiscoverPagePhotoUrls().map(getBaseImageUrl);

    if (photoUrls.length === 0) {
        newestElement.textContent = 'Newest Photo Upload: No photos found';
        oldestElement.textContent = 'Oldest Photo Upload: No photos found';
        return;
    }

    // Get Last-Modified dates for photos we have metadata for
    const photoDates = [];
    photoUrls.forEach(url => {
        const lastModified = imageMetadataCache[url];
        if (lastModified) {
            photoDates.push({
                url,
                date: new Date(lastModified)
            });
        }
    });

    if (photoDates.length === 0) {
        newestElement.textContent = 'Newest Photo Upload: Loading...';
        oldestElement.textContent = 'Oldest Photo Upload: Loading...';
        return;
    }

    // Sort by date
    photoDates.sort((a, b) => a.date - b.date);

    const oldest = photoDates[0];
    const newest = photoDates[photoDates.length - 1];

    const formatDate = (date) => date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    newestElement.textContent = `Newest Photo Upload: ${formatDate(newest.date)}`;
    oldestElement.textContent = `Oldest Photo Upload: ${formatDate(oldest.date)}`;
}

function addCupidEnhancedSection() {
    const rightPanel = document.querySelector('.desktop-dt-right');
    if (!rightPanel) return;

    // Check if we need to fetch for a new user
    const currentUserId = getCurrentUserId();
    const needsFetch = currentUserId && currentUserId !== lastFetchedUserId;

    if (document.querySelector('.cupid-enhanced-section')) {
        // Section exists, only fetch if it's a new user
        if (needsFetch && !isFetchingMetadata) {
            fetchAllImageMetadata();
        }
        return;
    }

    // Create the Cupid Enhanced section
    const section = document.createElement('div');
    section.className = 'dt-section cupid-enhanced-section';

    const title = document.createElement('h3');
    title.className = 'dt-section-title';
    title.textContent = 'Cupid Enhanced';

    const likesRemaining = localStorage.getItem('previous_likes_remaining') || 'Make first vote to display';
    const likesResetTime = localStorage.getItem('likes_reset_time') || 'Make first vote to display';

    const content = document.createElement('div');
    content.className = 'dt-section-content';
    content.innerHTML = `
        <div class="matchprofile-details-text" id="newest-photo-date">Newest Photo Upload: Loading...</div>
        <div class="matchprofile-details-text" id="oldest-photo-date">Oldest Photo Upload: Loading...</div>
        <div class="matchprofile-details-text" id="likes-remaining">Likes Remaining: ${likesRemaining}</div>
        <div class="matchprofile-details-text" id="likes-reset-time">Next Likes Reset: ${likesResetTime}</div>
    `;

    section.appendChild(title);
    section.appendChild(content);

    // Insert as the first child of desktop-dt-right
    rightPanel.insertBefore(section, rightPanel.firstChild);

    // Fetch image metadata directly
    fetchAllImageMetadata();
}

function enhanceInterestedUsersPhotos() {
    const observer = new MutationObserver(() => {
        if (!currentSettings.enhanceInterestedPhotos) return;

        // Remove max height restriction from photos
        document.querySelectorAll('.CNr1suk9pEF3nlOENwde.eJG7lHzUvRC0ejcywkgI').forEach(photo => {
            photo.style.maxHeight = 'none';
        });

        // Hide foggy overlay
        document.querySelectorAll('.yfl1DI6BaFRYLQuLCe55').forEach(overlay => {
            overlay.style.display = 'none';
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}

function blockPremiumAds() {
    const selectorsToHide = [
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

    const observer = new MutationObserver(() => {
        if (!currentSettings.blockPremiumAds) return;

        selectorsToHide.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (element.style.display !== 'none') {
                    element.style.display = 'none';
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}
