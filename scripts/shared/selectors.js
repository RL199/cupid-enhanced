// =============================================================================
// DOM Selectors Constants
// CSS selectors used throughout the extension
// =============================================================================

var SELECTORS = {
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

var PREMIUM_AD_SELECTORS = [
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

var DISCOVER_PAGE_ENHANCEMENTS = [
    { selector: '.desktop-dt-content', styles: { maxWidth: '90%', justifyContent: 'center' } },
    { selector: '.desktop-dt-right', styles: { marginLeft: '10px' } },
    { selector: '.sliding-pagination-inner-content', styles: { width: 'fit-content', justifyContent: 'center' } },
    { selector: '.sliding-pagination', styles: { display: 'inline-flex', justifyContent: 'center' } }
];

var BACKGROUND_IMAGE_REGEX = /url\([\"']?(https:\/\/pictures\.match\.com\/photos\/[^\"')]+)[\"']?\)/i;

var PHOTO_DATE_LABEL_STYLES = `
    position: absolute;
    bottom: 10px;
    left: 50%;
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

var LIKED_BY_INDICATOR_STYLES = `
    .cupid-liked-by-active {
        font-weight: 600;
    }
`;

var TRANSLATE_BUTTON_STYLES = `
    .dt-section-title:has(.cupid-translate-btn) {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .cupid-translate-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin: 0;
        padding: 4px 10px;
        background: #1a1a2e;
        color: #e0e0e0;
        border: 1px solid #444;
        border-radius: 16px;
        font-size: 14px;
        font-weight: normal;
        cursor: pointer;
        transition: background 0.2s, border-color 0.2s;
        flex-shrink: 0;
    }
    .cupid-translate-btn:hover {
        background: #2a2a4e;
        border-color: #888;
    }
`;
