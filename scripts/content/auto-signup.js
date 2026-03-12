// =============================================================================
// Auto-Signup Module
// Automates the OkCupid signup flow on /signup page
// =============================================================================
'use strict';

/**
 * Set a React-controlled input's value by using the native setter
 * and dispatching an input event so React picks up the change.
 */
function setReactInputValue(input, value) {
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Wait for an element matching the selector to appear in the DOM.
 */
function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timeout waiting for ${selector}`));
        }, timeout);
    });
}

/**
 * Wait for the Next button to become clickable (blue / enabled) and click it.
 */
async function clickNextWhenReady() {
    // Multiple possible next button selectors
    const selectors = ['button[data-cy="onboarding.nextButton"]', 'button[data-cy="detailsEditor.saveButton"]'];

    // Poll until a next button is enabled
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds at 100ms intervals

        const interval = setInterval(() => {
            for (const sel of selectors) {
                const btn = document.querySelector(sel);
                if (btn && !btn.disabled) {
                    clearInterval(interval);
                    btn.click();
                    resolve();
                    return;
                }
            }
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error('Next button never became clickable'));
            }
        }, 100);
    });
}

/**
 * Wait for a specific onboarding step to appear.
 */
function waitForStep(stepName, timeout = 15000) {
    const selector = `[data-cy="onboarding.stepContainer"][data-step="${stepName}"]`;
    return waitForElement(selector, timeout);
}

/**
 * Fetch a temporary email address from 10minutemail via the background script.
 */
async function fetchTempEmail() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'FETCH_TEMP_EMAIL' }, response => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (response?.success && response.email) {
                resolve(response.email);
            } else {
                reject(new Error(response?.error || 'Failed to fetch temp email'));
            }
        });
    });
}

// =============================================================================
// Step Handlers
// =============================================================================

async function handleEmailStep() {
    console.log('[Cupid Enhanced] Signup: Handling EMAIL step');
    const emailInput = await waitForElement('input[data-cy="signup.emailField"]');

    const email = await fetchTempEmail();
    console.log('[Cupid Enhanced] Signup: Got temp email:', email);

    setReactInputValue(emailInput, email);

    // Small delay to let React validate
    await new Promise(r => setTimeout(r, 500));
    await clickNextWhenReady();
}

async function handleRealNameStep() {
    console.log('[Cupid Enhanced] Signup: Handling REALNAME step');
    const nameInput = await waitForElement('input[data-cy="detailsEditor.realNameField"]');

    setReactInputValue(nameInput, '---');

    await new Promise(r => setTimeout(r, 500));
    await clickNextWhenReady();
}

async function handleLocationStep() {
    console.log('[Cupid Enhanced] Signup: Handling LOCATION step');

    // Select Israel from the country dropdown
    const countrySelect = await waitForElement('select[data-cy="detailsEditor.countrySelect"]');
    const nativeSelectSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    nativeSelectSetter.call(countrySelect, 'IL');
    countrySelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait for city input to update after country change
    await new Promise(r => setTimeout(r, 1000));

    const cityInput = await waitForElement('input[data-cy="detailsEditor.locationField"]');
    setReactInputValue(cityInput, 'Beersheba');

    // Wait for city validation/autocomplete
    await new Promise(r => setTimeout(r, 1500));
    await clickNextWhenReady();
}

async function handleGenderStep() {
    console.log('[Cupid Enhanced] Signup: Handling GENDER_BINARY step');
    // Click the label containing "Woman" text
    await waitForElement('input[name="gender"]');
    const labels = document.querySelectorAll('label[role="radio"]');
    for (const label of labels) {
        if (label.querySelector('.oknf-radio-label')?.textContent.trim() === 'Woman') {
            label.click();
            break;
        }
    }

    await new Promise(r => setTimeout(r, 500));
    await clickNextWhenReady();
}

async function handleGenderPreferenceStep() {
    console.log('[Cupid Enhanced] Signup: Handling GENDER_PREFERENCE step');
    // Click the label containing "Men" text
    await waitForElement('input[name="gender-preference"]');
    const labels = document.querySelectorAll('label[role="checkbox"]');
    for (const label of labels) {
        if (label.querySelector('.oknf-checkbox-label')?.textContent.trim() === 'Men') {
            label.click();
            break;
        }
    }

    await new Promise(r => setTimeout(r, 500));
    await clickNextWhenReady();
}

async function handleBirthdateStep() {
    console.log('[Cupid Enhanced] Signup: Handling BIRTHDATE step');
    const monthInput = await waitForElement('input#onboarding-birthdate-MONTH');
    const dayInput = await waitForElement('input#onboarding-birthdate-DAY');
    const yearInput = await waitForElement('input#onboarding-birthdate-YEAR');

    setReactInputValue(monthInput, '1');
    await new Promise(r => setTimeout(r, 200));
    setReactInputValue(dayInput, '1');
    await new Promise(r => setTimeout(r, 200));
    setReactInputValue(yearInput, '1999');

    await new Promise(r => setTimeout(r, 500));
    await clickNextWhenReady();
}

async function handlePasswordStep() {
    console.log('[Cupid Enhanced] Signup: Handling PASSWORD step');
    const passwordInput = await waitForElement('input[data-cy="signup.passwordField"]');

    setReactInputValue(passwordInput, '444-dante-444');

    await new Promise(r => setTimeout(r, 500));
    await clickNextWhenReady();
}

// =============================================================================
// Main Signup Flow
// =============================================================================

const STEP_HANDLERS = {
    EMAIL: handleEmailStep,
    REALNAME: handleRealNameStep,
    LOCATION: handleLocationStep,
    GENDER_BINARY: handleGenderStep,
    GENDER_PREFERENCE: handleGenderPreferenceStep,
    BIRTHDATE: handleBirthdateStep,
    PASSWORD: handlePasswordStep
};

/**
 * Observe the signup page and handle each step as it appears.
 */
function observeSignupSteps() {
    const handledSteps = new Set();

    function checkCurrentStep() {
        const stepContainer = document.querySelector('[data-cy="onboarding.stepContainer"]');
        if (!stepContainer) return;

        const step = stepContainer.getAttribute('data-step');
        if (!step || handledSteps.has(step)) return;

        const handler = STEP_HANDLERS[step];
        if (handler) {
            handledSteps.add(step);
            handler().catch(err => {
                console.error(`[Cupid Enhanced] Signup: Error on step ${step}:`, err);
                // Allow retry on error
                handledSteps.delete(step);
            });
        }
    }

    // Check immediately
    checkCurrentStep();

    // Observe for step changes
    const observer = new MutationObserver(() => checkCurrentStep());
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-step']
    });
}

/**
 * Check if the current page is a Cloudflare challenge/verification page.
 */
function isCloudflareChallenge() {
    return (
        document.title.includes('Just a moment') ||
        !!document.querySelector('#challenge-running, #challenge-form, .cf-browser-verification') ||
        document.body?.textContent?.includes('Performing security verification')
    );
}

/**
 * Initialize the auto-signup feature if on the signup page.
 */
function initAutoSignup() {
    // Never run on Cloudflare challenge pages
    const checkAndRun = () => {
        if (isCloudflareChallenge()) {
            console.log('[Cupid Enhanced] Signup: Cloudflare challenge detected, waiting...');
            return;
        }
        runAutoSignup();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndRun);
    } else {
        checkAndRun();
    }
}

function runAutoSignup() {
    if (window.location.pathname.startsWith('/signup')) {
        // Wait for the actual onboarding form before activating
        const activate = async () => {
            try {
                await waitForElement('[data-cy="onboarding.stepContainer"]', 30000);
                console.log('[Cupid Enhanced] Signup: Auto-signup activated');
                observeSignupSteps();
            } catch (_e) {
                console.log('[Cupid Enhanced] Signup: No onboarding form found, skipping');
            }
        };
        activate();
        return;
    }

    // Post-signup: send superlike via API then logout
    if (
        window.location.pathname === '/discover' &&
        new URLSearchParams(window.location.search).has('onboarding_complete')
    ) {
        console.log('[Cupid Enhanced] Signup: Onboarding complete, will send actions after headers are captured...');

        const sendPostSignupActions = async () => {
            await new Promise(r => setTimeout(r, 5000));

            // 1. Send regular likes
            for (const targetId of ENV.LIKE_TARGET_IDS) {
                try {
                    console.log(`[Cupid Enhanced] Signup: Liking ${targetId}`);
                    const result = await voteOnUser(targetId, 'LIKE', 'DOUBLETAKE');
                    console.log(`[Cupid Enhanced] Signup: Like result for ${targetId}:`, result);
                    await new Promise(r => setTimeout(r, 1000));
                } catch (err) {
                    console.error(`[Cupid Enhanced] Signup: Like failed for ${targetId}:`, err);
                }
            }

            // 2. Send intros (like with comment)
            for (const target of ENV.INTRO_TARGET_IDS) {
                try {
                    console.log(`[Cupid Enhanced] Signup: Sending intro to ${target.id}`);
                    const result = await introVoteOnUser(target.id, target.message);
                    console.log(`[Cupid Enhanced] Signup: Intro result for ${target.id}:`, result);
                    await new Promise(r => setTimeout(r, 1000));
                } catch (err) {
                    console.error(`[Cupid Enhanced] Signup: Intro failed for ${target.id}:`, err);
                }
            }

            // 3. Send superlike
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`[Cupid Enhanced] Signup: Superlike attempt ${attempt}/${maxRetries}`);
                    const result = await superlikeUser(ENV.SUPERLIKE_TARGET_ID, 'hfggfffd');
                    console.log('[Cupid Enhanced] Signup: Superlike result:', result);

                    if (result?.data?.userSuperlike?.success) {
                        // Increment the superlike counter
                        const data = await chrome.storage.local.get('superlike_cycle_count');
                        const newCount = (data.superlike_cycle_count || 0) + 1;
                        await chrome.storage.local.set({ superlike_cycle_count: newCount });
                        console.log(
                            `[Cupid Enhanced] Signup: Superlike succeeded! (${newCount}/${ENV.SUPERLIKE_COUNT})`
                        );

                        if (newCount >= ENV.SUPERLIKE_COUNT) {
                            console.log('[Cupid Enhanced] Signup: Reached superlike limit, stopping.');
                            await chrome.storage.local.remove('superlike_cycle_count');
                            return;
                        }

                        await new Promise(r => setTimeout(r, 2000));
                        // Navigate to logout; the logout handler will restart the cycle
                        window.location.href = 'https://www.okcupid.com/logout';
                        return;
                    }

                    console.warn('[Cupid Enhanced] Signup: Superlike returned error, retrying...');
                    await new Promise(r => setTimeout(r, 3000));
                } catch (err) {
                    console.error(`[Cupid Enhanced] Signup: Attempt ${attempt} failed:`, err);
                    if (attempt < maxRetries) {
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }
            }
            console.error('[Cupid Enhanced] Signup: All superlike attempts failed');
        };
        sendPostSignupActions();
        return;
    }

    // After logout, wait 10s ± 2s then restart the signup cycle
    if (window.location.pathname === '/logout' || window.location.pathname === '/login') {
        const delay = 100000 + Math.floor(Math.random() * 4001) - 2000; // 8000–12000ms
        console.log(`[Cupid Enhanced] Signup: Logged out. Restarting signup in ${delay}ms...`);
        setTimeout(() => {
            window.location.href = 'https://www.okcupid.com/signup';
        }, delay);
        return;
    }
}

// Start immediately
initAutoSignup();
