// =============================================================================
// CSS Styles Constants
// Large CSS style strings used for dark mode and page enhancements
// =============================================================================

var DARK_MODE_STYLES = `
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

    /*============================================
       MESSAGES - Dark background and light text
       =========================================== */
    .t659_29vzMkU6QQL2q0j,
    .x8amgHNYP_nXx626A_lY,
    .quickmatch-blank-body {
        color: #ffffff !important;
    }

    .dt-comment-fab svg path ,
    .matchprofile-details-icon path,
    .matchprofile-details svg path {
        fill: #ffffff !important;
    }

    .WK2PEQwFZVjNdD26XECA {
        border: 2px solid white !important;
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

var LIKES_YOU_STYLES = `
    /* Expand container width */
    .userrows-content,
    .userrows-card-container
    {
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

    .cupid-open-profile-icon {
        position: absolute;
        top: 0px;
        right: 0px;
        width: 26px;
        /* height: 28px; */
        border-radius: 0% 0% 0% 50%;
        background: #e00095;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        cursor: pointer;
        border: none;
    }

    .cupid-open-profile-icon svg {
        width: 16px;
        height: 16px;
        fill: #ffffff;
    }

    .cupid-fetch-likes-wrapper {
        position: fixed;
        bottom: 24px;
        right: 24px;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        z-index: 1000000;
    }

    .cupid-fetch-likes-ids {
        background: #ff1493;
        color: #ffffff;
        border: none;
        border-radius: 24px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: background 0.2s, transform 0.1s;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .cupid-fetch-likes-ids:hover {
        background: #e01280;
        transform: scale(1.03);
    }

    .cupid-fetch-likes-ids.cupid-fetch-active {
        background: #dc3545;
    }

    .cupid-fetch-likes-ids.cupid-fetch-active:hover {
        background: #c82333;
    }

    .cupid-fetch-likes-ids:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none;
    }

    .cupid-fetch-spinner {
        width: 16px;cupid-fetch-likes-wrapper
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: cupid-spin 0.8s linear infinite;
    }

    @keyframes cupid-spin {
        to { transform: rotate(360deg); }
    }

    .cupid-fetch-likes-status {
        background: rgba(0, 0, 0, 0.8);
        color: #ffffff;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 14px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .cupid-fetch-likes-status:empty {
        display: none;
    }
`;
