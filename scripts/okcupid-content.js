"use strict";

console.log('###Cupid content script loaded###');

const SETTINGS_KEY = 'cupidEnhancedSettings';
const DEFAULT_SETTINGS = {
    unblurImages: true,
    likesCount: true,
    enhanceDiscoverPage: true,
    enhanceInterestedPhotos: true,
    blockPremiumAds: true,
    horizontalScroll: true
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
            const readableTime = new Date(time * 1000).toLocaleString();
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
        { selector: '.sliding-pagination-inner-content', styles: { width: 'fit-content' , justifyContent: 'center' } },
        { selector: '.sliding-pagination', styles: { display: 'inline-flex' , justifyContent: 'center'} }
    ];

    const observer = new MutationObserver(() => {
        if (!currentSettings.enhanceDiscoverPage) return;

        enhancements.forEach(({ selector, styles }) => {
            document.querySelectorAll(selector).forEach(element => {
                Object.assign(element.style, styles);
            });
        });

        // Add Cupid Enhanced info section
        addCupidEnhancedSection();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}

function addCupidEnhancedSection() {
    const rightPanel = document.querySelector('.desktop-dt-right');
    if (!rightPanel) return;

    if (document.querySelector('.cupid-enhanced-section')) {
        // Section exists, update photo dates if needed
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
        '.J8RXzumIQVAo3qnCBqHr'
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
