"use strict";

console.log('###Cupid content script loaded###');

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Main initialization
function init() {
    listenForLikesCount();
    setupObservers();
    updateLikesIncomingCount();
}

// Setup all mutation observers
function setupObservers() {
    enhanceInterestedUsersPhotos();
    enhanceDiscoverPage();
    blockPremiumAds();
}

// Likes count management
async function updateLikesIncomingCount() {
    const { likesIncomingCount = 0 } = await chrome.storage.local.get(['likesIncomingCount']);
    updateLikesUI(likesIncomingCount);
}

function updateLikesUI(count) {
    if (!count || count <= 0) return;

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
    window.addEventListener('message', async (event) => {
        if (event.source !== window || event.data.type !== 'SAVE_LIKES_COUNT') return;

        const { count } = event.data;

        await chrome.storage.local.set({ likesIncomingCount: count });
        updateLikesUI(count);
    });
}

function enhanceDiscoverPage() {
    const enhancements = [
        { selector: '.desktop-dt-content', styles: { maxWidth: '90%', justifyContent: 'center' } },
        { selector: '.desktop-dt-right', styles: { marginLeft: '10px' } },
        { selector: '.sliding-pagination-inner-content', styles: { width: 'fit-content' } }
    ];

    const observer = new MutationObserver(() => {
        enhancements.forEach(({ selector, styles }) => {
            document.querySelectorAll(selector).forEach(element => {
                Object.assign(element.style, styles);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function enhanceInterestedUsersPhotos() {
    const observer = new MutationObserver(() => {
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
        '.MgfNUNvEHRmbdo7IccK9.sidebar-with-card-view'
    ];

    const observer = new MutationObserver(() => {
        selectorsToHide.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (element.style.display !== 'none') {
                    element.style.display = 'none';
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}
