// =============================================================================
// DoubleTake Profile Buttons
// Injects like/pass buttons into DoubleTake profile and stack views
// Requires: api-helpers.js (voteOnUser function), ui-enhancements.js (createBodyObserver)
// =============================================================================
'use strict';

/**
 * Get the user ID from the profile page
 * @returns {string|null} The user ID
 */
function getProfileUserId() {
    const urlMatch = window.location.pathname.match(/\/profile\/([^\/\?]+)/);
    if (urlMatch) {
        return urlMatch[1];
    }

    const actionBar = document.querySelector('.actionbar2015');
    if (actionBar) {
        const userIdButton = document.querySelector('[class*="ID:"]');
        if (userIdButton) {
            const idMatch = userIdButton.textContent.match(/ID:\s*([^\s]+)/);
            if (idMatch) return idMatch[1];
        }
    }

    return null;
}

/**
 * Check if the current profile is a DoubleTake profile
 * @returns {boolean} True if it's a DoubleTake profile
 */
function isDoubleTakeProfile() {
    if (!window.location.pathname.startsWith('/profile/')) {
        return false;
    }

    const buttonsContainer = document.querySelector('.profile-userinfo-buttons .profile-pill-buttons');
    if (!buttonsContainer) {
        return false;
    }

    const hasLikeButton = buttonsContainer.querySelector(
        '#like-button, [data-cy="profile.likeButton"]:not([class*="superlike"])'
    );
    const hasPassButton = buttonsContainer.querySelector('#pass-button, [data-cy="profile.passButton"]');

    return !hasLikeButton && !hasPassButton;
}

/**
 * Inject like and pass buttons into DoubleTake profile
 */
function injectDoubleTakeButtons() {
    const buttonsContainer = document.querySelector('.profile-userinfo-buttons .profile-pill-buttons');
    if (!buttonsContainer) return;

    if (buttonsContainer.querySelector('.cupid-doubletake-pass, .cupid-doubletake-like')) {
        return;
    }

    const userId = getProfileUserId();
    if (!userId) {
        console.warn('[Cupid Enhanced] Could not get user ID for DoubleTake profile');
        return;
    }

    const superlikeButton = buttonsContainer.querySelector('.superlike-button-scene');

    // Create Pass button
    const passButton = document.createElement('button');
    passButton.className =
        'm7MoWm4gQWQMUVIOiHSo pass-pill-button profile-pill-buttons-button profile-pill-buttons-button--superlike cupid-doubletake-pass';
    passButton.id = 'doubletake-pass-button';
    passButton.innerHTML = `
        <div class="pass-pill-button-inner">
            <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M.716.716a1.25 1.25 0 0 1 1.768 0L12.8 11.033 23.116.716a1.25 1.25 0 0 1 1.666-.091l.102.091a1.25 1.25 0 0 1 0 1.768L14.567 12.8l10.317 10.316a1.25 1.25 0 0 1 .091 1.666l-.091.102a1.25 1.25 0 0 1-1.768 0L12.8 14.567 2.484 24.884a1.25 1.25 0 0 1-1.666.091l-.102-.091a1.25 1.25 0 0 1 0-1.768L11.033 12.8.716 2.484A1.25 1.25 0 0 1 .625.818z" fill="#1A1A1A" fill-rule="nonzero"></path>
            </svg>PASS
        </div>
    `;

    // Create Like button
    const likeButton = document.createElement('button');
    likeButton.className =
        'm7MoWm4gQWQMUVIOiHSo likes-pill-button profile-pill-buttons-button profile-pill-buttons-button--superlike likes-pill-button--prioritylike cupid-doubletake-like';
    likeButton.id = 'doubletake-like-button';
    likeButton.innerHTML = `
        <div class="likes-pill-button-inner">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M23.267 2C28.067 2 32 6.134 32 11.134c0 4.373-3.712 9.146-7.492 12.873.005-.106.01-.213.01-.32v-6.692l4.376.365c.504.042.802-.564.464-.941-1.172-1.308-3.15-3.597-4.459-5.56-1.231-1.847-2.255-3.984-2.847-5.319-.204-.46-.897-.46-1.1 0-.593 1.335-1.617 3.472-2.849 5.32-1.308 1.962-3.286 4.251-4.459 5.559-.337.377-.039.983.465.941l4.41-.368V29.19a46.594 46.594 0 0 1-1.92 1.41c-.2.133-.399.2-.599.2-.2 0-.333-.067-.533-.2C14.799 30.199 0 20 0 11.134 0 6.134 3.933 2 8.733 2 11.667 2 14.4 3.533 16 6c1.6-2.467 4.333-4 7.267-4zm-13.6 4.333c-3 0-5.4 2.4-5.4 5.4 0 .534.466 1 1 1 .533 0 1-.466 1-1 0-1.866 1.533-3.4 3.4-3.4.533 0 1-.467 1-1 0-.533-.467-1-1-1z" fill="#fff"></path>
            </svg>PRIORITY LIKE
        </div>
    `;

    // Add click handlers
    passButton.addEventListener('click', async e => {
        e.preventDefault();
        passButton.disabled = true;
        try {
            await voteOnUser(userId, 'PASS', 'DOUBLETAKE');
            window.history.back();
        } catch (error) {
            console.error('[Cupid Enhanced] Failed to pass on user:', error);
            passButton.disabled = false;
        }
    });

    likeButton.addEventListener('click', async e => {
        e.preventDefault();
        likeButton.disabled = true;
        try {
            await voteOnUser(userId, 'LIKE', 'DOUBLETAKE');
            window.history.back();
        } catch (error) {
            console.error('[Cupid Enhanced] Failed to like user:', error);
            likeButton.disabled = false;
        }
    });

    if (superlikeButton) {
        buttonsContainer.insertBefore(passButton, superlikeButton);
        buttonsContainer.insertBefore(likeButton, superlikeButton);
    } else {
        buttonsContainer.appendChild(passButton);
        buttonsContainer.appendChild(likeButton);
    }

}

/**
 * Setup observer to inject buttons on DoubleTake profiles
 */
function setupDoubleTakeButtonsObserver() {
    let debounceTimer = null;

    const checkAndInject = () => {
        if (isDoubleTakeProfile()) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                injectDoubleTakeButtons();
            }, 100);
        }

        if (isDoubleTakeStackView()) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                injectDoubleTakeStackButtons();
            }, 100);
        }
    };

    checkAndInject();

    return createBodyObserver(checkAndInject);
}

// =============================================================================
// DoubleTake Stack View Buttons
// =============================================================================

/**
 * Check if we're on the DoubleTake stack view
 * @returns {boolean} True if on stack view
 */
function isDoubleTakeStackView() {
    return document.querySelector('.standouts-cards') !== null;
}

/**
 * Get user ID from a standouts card profile link
 * @param {Element} card - The standouts-wrapper element
 * @returns {string|null} The user ID
 */
function getUserIdFromStackCard(card) {
    const profileLink = card.querySelector('.standouts-photo-wrapper');
    if (!profileLink) return null;

    const href = profileLink.getAttribute('href');
    if (!href) return null;

    const match = href.match(/\/profile\/([^\/\?]+)/);
    return match ? match[1] : null;
}

/**
 * Inject like and pass buttons into all DoubleTake stack cards
 */
function injectDoubleTakeStackButtons() {
    const cards = document.querySelectorAll('.standouts-wrapper');

    cards.forEach(card => {
        if (card.querySelector('.cupid-stack-pass, .cupid-stack-like')) {
            return;
        }

        const userId = getUserIdFromStackCard(card);
        if (!userId) {
            console.warn('[Cupid Enhanced] Could not get user ID from stack card');
            return;
        }

        const superlikeButton = card.querySelector('.standouts-superlike');
        if (!superlikeButton) return;

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'cupid-stack-buttons';
        buttonsContainer.style.cssText = `
            position: absolute;
            bottom: -35px;
            left: 43%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10;
        `;

        // Create Pass button
        const passButton = document.createElement('button');
        passButton.className = 'cupid-stack-pass';
        passButton.setAttribute('aria-label', 'Pass');
        passButton.style.cssText = `
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        `;
        passButton.innerHTML = `
            <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
                <path d="M.716.716a1.25 1.25 0 0 1 1.768 0L12.8 11.033 23.116.716a1.25 1.25 0 0 1 1.666-.091l.102.091a1.25 1.25 0 0 1 0 1.768L14.567 12.8l10.317 10.316a1.25 1.25 0 0 1 .091 1.666l-.091.102a1.25 1.25 0 0 1-1.768 0L12.8 14.567 2.484 24.884a1.25 1.25 0 0 1-1.666.091l-.102-.091a1.25 1.25 0 0 1 0-1.768L11.033 12.8.716 2.484A1.25 1.25 0 0 1 .625.818z" fill="#1A1A1A" fill-rule="nonzero"></path>
            </svg>
        `;

        // Create Like button
        const likeButton = document.createElement('button');
        likeButton.className = 'cupid-stack-like';
        likeButton.setAttribute('aria-label', 'Like');
        likeButton.style.cssText = `
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff1493 0%, #ff69b4 100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        `;
        likeButton.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.267 2C28.067 2 32 6.134 32 11.134c0 4.373-3.712 9.146-7.492 12.873.005-.106.01-.213.01-.32v-6.692l4.376.365c.504.042.802-.564.464-.941-1.172-1.308-3.15-3.597-4.459-5.56-1.231-1.847-2.255-3.984-2.847-5.319-.204-.46-.897-.46-1.1 0-.593 1.335-1.617 3.472-2.849 5.32-1.308 1.962-3.286 4.251-4.459 5.559-.337.377-.039.983.465.941l4.41-.368V29.19a46.594 46.594 0 0 1-1.92 1.41c-.2.133-.399.2-.599.2-.2 0-.333-.067-.533-.2C14.799 30.199 0 20 0 11.134 0 6.134 3.933 2 8.733 2 11.667 2 14.4 3.533 16 6c1.6-2.467 4.333-4 7.267-4zm-13.6 4.333c-3 0-5.4 2.4-5.4 5.4 0 .534.466 1 1 1 .533 0 1-.466 1-1 0-1.866 1.533-3.4 3.4-3.4.533 0 1-.467 1-1 0-.533-.467-1-1-1z" fill="#fff"></path>
            </svg>
        `;

        // Add hover effects
        passButton.addEventListener('mouseenter', () => { passButton.style.filter = 'brightness(1.3)'; });
        passButton.addEventListener('mouseleave', () => { passButton.style.filter = 'brightness(1)'; });
        likeButton.addEventListener('mouseenter', () => { likeButton.style.filter = 'brightness(1.3)'; });
        likeButton.addEventListener('mouseleave', () => { likeButton.style.filter = 'brightness(1)'; });

        // Add click handlers
        passButton.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            passButton.disabled = true;
            passButton.style.opacity = '0.5';

            try {
                console.log('[Cupid Enhanced] Passing on stack card user:', userId);
                await voteOnUser(userId, 'PASS', 'DOUBLETAKE');
                console.log('[Cupid Enhanced] Successfully passed on user');

                card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                card.style.transform = 'translateX(-100%) rotate(-10deg)';
                card.style.opacity = '0';

                setTimeout(() => { card.style.display = 'none'; }, 300);
            } catch (error) {
                console.error('[Cupid Enhanced] Failed to pass on user:', error);
                passButton.disabled = false;
                passButton.style.opacity = '1';
            }
        });

        likeButton.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            likeButton.disabled = true;
            likeButton.style.opacity = '0.5';

            try {
                console.log('[Cupid Enhanced] Liking stack card user:', userId);
                const result = await voteOnUser(userId, 'LIKE', 'DOUBLETAKE');
                console.log('[Cupid Enhanced] Successfully liked user:', result);

                if (result?.data?.userVote?.voteResults?.[0]?.isMutualLike) {
                    console.log('[Cupid Enhanced] 🎉 Mutual match!');
                }

                card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                card.style.transform = 'translateX(100%) rotate(10deg)';
                card.style.opacity = '0';

                setTimeout(() => { card.style.display = 'none'; }, 300);
            } catch (error) {
                console.error('[Cupid Enhanced] Failed to like user:', error);
                likeButton.disabled = false;
                likeButton.style.opacity = '1';
            }
        });

        buttonsContainer.appendChild(passButton);
        buttonsContainer.appendChild(likeButton);

        card.style.position = 'relative';
        card.appendChild(buttonsContainer);

    });
}
