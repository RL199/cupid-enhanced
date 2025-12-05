// API Response Interceptor - Runs in MAIN world to modify responses before page sees them
(function () {
    'use strict';

    console.log('###Cupid Enhanced: API Interceptor Loaded###');

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

    // --- Handlers ---

    const handleLikes = (data) => {
        // fetch likes remaining count
        if (data?.data?.userVote?.likesRemaining != null) {
            window.postMessage({
                type: 'LIKES_REMAINING_COUNT',
                count: data.data.userVote.likesRemaining
            }, '*');
        }
        // fetch likes remaining reset time
        if (data?.data?.userVote?.likesCapResetTime != null) {
            window.postMessage({
                type: 'LIKES_RESET_TIME',
                time: data.data.userVote.likesCapResetTime
            }, '*');
        }
    };

    const handlePremium = (data) => {
        if (!data?.data?.me) return false;

        const me = data.data.me;
        me.hasIncognito = true;
        me.isIncognito = true;
        me.isAlist = true;
        me.isAdFree = true;

        // Inject Billing Eligibility to hide upsells
        if (!me.billingSubscriptionUpgradeEligibility) {
            me.billingSubscriptionUpgradeEligibility = {};
        }
        // 2 = INELIGIBLE (hides 'Upgrade' buttons)
        me.billingSubscriptionUpgradeEligibility.premium = {
            eligibleUpgrades: [{ eligibilityStatus: 2 }]
        };
        me.billingSubscriptionUpgradeEligibility.premiumPlus = {
            eligibleUpgrades: [{ eligibilityStatus: 2 }]
        };

        // Inject Gatekeeper Checks (found in desktop_header_banner.js)
        if (!me.gatekeeperChecks) {
            me.gatekeeperChecks = {};
        }
        // Disable negative gatekeepers to hide banners
        me.gatekeeperChecks.BILLING_WOES = false;
        me.gatekeeperChecks.ALIST_DISCOUNT_MASTHEAD = false;
        me.gatekeeperChecks.INTOYOU_MASTHEAD = true; // Enable 'Into You' feature if available

        if (!me.premiums) {
            me.premiums = {};
        }
        // Enable all premium features to bypass paywalls
        me.premiums.VIEW_VOTES = true; // View who voted for you
        me.premiums.ALIST_PREMIUM = true; //Display Alist Premium badge
        me.premiums.ALIST_PREMIUM_PLUS = true;
        me.premiums.ALIST_BASIC = true;

        // Premium features found in module 88074 (lowercase and uppercase variants)
        const features = [
            'intoyou', 'INTO_YOU',
            'comfree', 'ad_free', 'AD_FREE', 'ADFREE',
            'unlimited_likes', 'UNLIMITED_LIKES', 'UNLIMTED_LIKES',
            'intros', 'INTROS',
            'dealbreakers', 'DEALBREAKERS',
            'see_more_people',
            'questions', 'QUESTIONS',
            'superlikes', 'superlikes_3', 'SUPERLIKES_3', 'superlikes_15', 'SUPERLIKES_15',
            'rewind', 'REWIND',
            'question_search', 'QUESTION_SEARCH',
            'who_likes_you', 'see_who_likes_you', 'SEE_WHO_LIKES_YOU',
            'question_answers', 'QUESTION_ANSWERS',
            'likes_list_sort', 'LIKES_LIST_SORT',
            'priority_likes', 'PRIORITY_LIKES',
            'read_receipts', 'READ_RECEIPTS',
            'boost', 'BOOST',
            'incognito', 'INCOGNITO'
        ];

        features.forEach(feature => {
            me.premiums[feature] = true;
        });

        return true;
    };

    const handleUnblur = (data) => {
        if (!settings.unblurImages) return false;
        let modified = false;
        const traverse = (obj) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj.primaryImage && obj.primaryImageBlurred) {
                obj.primaryImageBlurred = obj.primaryImage;
                modified = true;
            }
            for (const key in obj) {
                traverse(obj[key]);
            }
        };
        traverse(data);
        return modified;
    };

    // --- Response Interceptor ---

    const originalText = Response.prototype.text;

    Response.prototype.text = async function () {
        const text = await originalText.call(this);
        const { url } = this;

        if (!url.includes('graphql')) return text;

        try {
            const data = JSON.parse(text);
            let modified = false;

            // Run handlers
            handleLikes(data);
            if (handlePremium(data)) modified = true;
            if (handleUnblur(data)) modified = true;

            if (modified) {
                return JSON.stringify(data);
            }

            return text;
        } catch (e) {
            console.error('Interceptor error:', e);
            return text;
        }
    };
})();
