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
                data.data.me.premiums.VIEW_VOTES = true;
                data.data.me.premiums.INTROS = true;
                data.data.me.premiums.HELICOPTER = true;
                data.data.me.premiums.ALIST_PREMIUM = true;
                data.data.me.premiums.INC_LIKES = true;
                data.data.me.premiums.BOOST = true;
                data.data.me.premiums.ADFREE = true;
                data.data.me.premiums.INCOGNITO = true;
                data.data.me.premiums.READ_RECEIPTS = true;
                data.data.me.premiums.A_LIST = true;
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
