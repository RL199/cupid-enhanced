// API Response Interceptor - Runs in MAIN world to modify responses before page sees them
(function () {
    'use strict';

    console.log('###API interceptor injected###');

    const SETTINGS_KEY = 'cupidEnhancedSettings';
    let settings = {
        unblurImages: true,
        likesCount: true
    };

    // Listen for settings from isolated world
    window.addEventListener('message', (event) => {
        if (event.source === window && event.data.type === 'SETTINGS_TO_MAIN') {
            settings = event.data.settings;
        }
    });

    // Request settings immediately
    window.postMessage({ type: 'REQUEST_SETTINGS' }, '*');

    const originalText = Response.prototype.text;

    Response.prototype.text = async function () {
        const text = await originalText.call(this);
        const { url } = this;

        if (!url.includes('graphql')) return text;

        try {
            const data = JSON.parse(text);
            let modified = false;

            //fetch likes remaining count
            if (data?.data?.userVote?.likesRemaining != null) {
                // send chrome message to content script
                window.postMessage({
                    type: 'LIKES_REMAINING_COUNT',
                    count: data.data.userVote.likesRemaining
                }, '*');
            }
            // fetch likes remaining reset time
            if (data?.data?.userVote?.likesCapResetTime != null) {
                // send chrome message to content script
                window.postMessage({
                    type: 'LIKES_RESET_TIME',
                    time: data.data.userVote.likesCapResetTime
                }, '*');
            }

            // Inject Premium Status
            if (data?.data?.me) {
                if (!data.data.me.premiums) {
                    data.data.me.premiums = {};
                }
                // Enable all premium features to bypass paywalls
                data.data.me.premiums.VIEW_VOTES = true;  // see who was interested in you
                data.data.me.premiums.ALIST_PREMIUM = true; // Display premium badge
                data.data.me.premiums.ALIST_PREMIUM_PLUS = true; // Display premium plus badge

                // Premium features found in module 88074
                data.data.me.premiums.intoyou = true; // See who likes you
                data.data.me.premiums.comfree = true; // Ad-free
                data.data.me.premiums.unlimited_likes = true;
                data.data.me.premiums.intros = true;
                data.data.me.premiums.dealbreakers = true;
                data.data.me.premiums.see_more_people = true;
                data.data.me.premiums.questions = true;
                data.data.me.premiums.superlikes = true;
                data.data.me.premiums.rewind = true;
                data.data.me.premiums.question_search = true;
                data.data.me.premiums.who_likes_you = true;
                data.data.me.premiums.question_answers = true;
                data.data.me.premiums.likes_list_sort = true;
                data.data.me.premiums.priority_likes = true;
                data.data.me.premiums.read_receipts = true;
                data.data.me.premiums.boost = true;
                data.data.me.premiums.incognito = true;

                // Additional flags
                data.data.me.hasIncognito = true;

                modified = true;
            }

            // Recursively unblur all images in the response
            if (settings.unblurImages) {
                const unblur = (obj) => {
                    if (!obj || typeof obj !== 'object') return;
                    if (obj.primaryImage && obj.primaryImageBlurred) {
                        obj.primaryImageBlurred = obj.primaryImage;
                        modified = true;
                    }
                    for (const key in obj) {
                        if (obj[key] && typeof obj[key] === 'object') {
                            unblur(obj[key]);
                        }
                    }
                };
                unblur(data);
            }

            if (modified) {
                return JSON.stringify(data);
            }

            return text;
        } catch {
            return text;
        }
    };
})();
