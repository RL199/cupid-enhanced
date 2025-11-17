"use strict";

console.log('###Cupid content script loaded###');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
    initializeContentScript();
}

function initializeContentScript() {
    enhanceInterestedUsersPhotos();
    enhanceDiscoverPage();
    blockPremiumAds();
}

function enhanceDiscoverPage() {
    const selectorsToEnhance = [
        { selector: ".desktop-dt-content", name: "discover photos" },
        { selector: ".desktop-dt-right", name: "discover right side content" },
        { selector: ".desktop-dt-left", name: "discover left side content" },
        { selector: "#profile-questions-entry", name: "profile section" },
        { selector: ".sliding-pagination-inner-content", name: "pagination section" }
    ];

    const observer = new MutationObserver((mutations, obs) => {

        const paginationSection = document.querySelectorAll(selectorsToEnhance[4].selector);
        if (paginationSection.length > 0) {
            paginationSection.forEach(section => {
                section.style.width = 'fit-content';
            });
            console.log(`###Enhanced ${selectorsToEnhance[4].name}###`);
        }

        const profileSections = document.querySelectorAll(selectorsToEnhance[3].selector);
        if (profileSections.length > 0) {
            profileSections.forEach(section => {
                // section.style.minWidth = '400px';
            });
            console.log(`###Enhanced ${selectorsToEnhance[3].name}###`);
        }

        const leftSideContent = document.querySelectorAll(selectorsToEnhance[2].selector);
        if (leftSideContent.length > 0) {
            leftSideContent.forEach(content => {
                // content.style.display = 'flex';
                // content.style.width = 'auto';
            });
            console.log(`###Enhanced ${selectorsToEnhance[2].name}###`);
        }

        const rightSideContent = document.querySelectorAll(selectorsToEnhance[1].selector);
        if (rightSideContent.length > 0) {
            rightSideContent.forEach(content => {
                content.style.marginLeft = '10px';
                // content.style.width = 'auto';
            });
            console.log(`###Enhanced ${selectorsToEnhance[1].name}###`);
        }

        const discoverPhotos = document.querySelectorAll(selectorsToEnhance[0].selector);
        if (discoverPhotos.length > 0) {
            discoverPhotos.forEach(element => {
                element.style.maxWidth = '90%';
                element.style.justifyContent = 'center';
            });
            console.log(`###Enhanced ${selectorsToEnhance[0].name}###`);
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function enhanceInterestedUsersPhotos() {
    const selectorsToEnhance = [
        { selector: ".CNr1suk9pEF3nlOENwde.eJG7lHzUvRC0ejcywkgI", name: "interested users photos" },
        { selector: ".yfl1DI6BaFRYLQuLCe55", name: "foggy overlay" }
    ];

    const observer = new MutationObserver((mutations, obs) => {

        const interestedUsersPhotos = document.querySelectorAll(selectorsToEnhance[0].selector);
        if (interestedUsersPhotos.length > 0) {
            // remove max height restriction from each element
            interestedUsersPhotos.forEach(photo => {
                photo.style.maxHeight = 'none';
            });
            console.log(`###Removed max-height restriction from ${selectorsToEnhance[0].name}###`);
        }

        const foggyOverlay = document.querySelector(selectorsToEnhance[1].selector);
        if (foggyOverlay) {
            foggyOverlay.style.display = 'none';
            console.log(`###Removed ${selectorsToEnhance[1].name}###`);
        }
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function blockPremiumAds() {
    const selectorsToHide = [
        { selector: ".premium-promo-link-anchor", name: "see who liked you tag" },
        { selector: ".dt-tags-like-instructions", name: "like instructions tag" },
        { selector: ".RCnxRpTKlcKwgM1UlXlj.yvmovGzlmTO5T6yg_ckm", name: "premium ad" },
        { selector: ".navbar-boost", name: "boost button" },
        { selector: ".LHLUIR30CVKQDOC2rJps", name: "download app banner" },
        { selector: ".IUE4LujuCAt32rrowE9e", name: "remove ads button" },
        { selector: ".sIZ02EKchd4I0KnGgDgF.t1LDnewkFIu_5Qelhi_u", name: "see who is interested button" },
        { selector: ".MgfNUNvEHRmbdo7IccK9.sidebar-with-card-view", name: "remove ads button on who liked you page" }
    ];

    const observer = new MutationObserver((mutations, obs) => {

        selectorsToHide.forEach(({ selector, name }) => {
            const element = document.querySelector(selector);
            if (element && element.style.display !== 'none') {
                // Hide instead of remove to avoid React errors
                element.style.display = 'none';
                console.log(`###Hidden ${name}###`);
            }
        });
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}
