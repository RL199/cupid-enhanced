// API Response Interceptor - Runs in MAIN world to modify responses before page sees them
(function () {
    'use strict';

    console.log('###Cupid Enhanced: API Interceptor Loaded###');

    const SETTINGS_KEY = 'cupidEnhancedSettings';
    let settings = {
        staffMode: false
    };

    // =============================================================================
    // Header Capture for Background Script API Requests
    // =============================================================================
    
    // Headers we want to capture from OkCupid requests
    const HEADERS_TO_CAPTURE = [
        'authorization',
        'x-okcupid-auth-v',
        'x-okcupid-device-id',
        'x-okcupid-locale',
        'x-okcupid-platform',
        'x-okcupid-version'
    ];

    // Store captured headers
    let capturedHeaders = {};

    /**
     * Extract and store headers from a request
     * @param {Headers|object} headers - Request headers
     */
    function captureHeaders(headers) {
        if (!headers) return;
        
        const headersObj = headers instanceof Headers 
            ? Object.fromEntries(headers.entries())
            : headers;

        let updated = false;
        for (const [key, value] of Object.entries(headersObj)) {
            const lowerKey = key.toLowerCase();
            if (HEADERS_TO_CAPTURE.includes(lowerKey) && value) {
                capturedHeaders[key] = value;
                updated = true;
            }
        }

        if (updated) {
            // Send captured headers to isolated world (which forwards to background)
            window.postMessage({
                type: 'OKCUPID_HEADERS_CAPTURED',
                headers: capturedHeaders
            }, '*');
        }
    }

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
        if (data?.data?.userVote) {
            // Force desired values
            data.data.userVote.shouldTrackLikesCapReached = false; // not sure if it does anything
            data.data.userVote.__typename = 'UserVotePayload';
            // fetch likes remaining count
            window.postMessage({
                type: 'LIKES_REMAINING_COUNT',
                count: data.data.userVote.likesRemaining
            }, '*');
            // fetch likes remaining reset time
            if (data.data.userVote.likesCapResetTime != null) {
                window.postMessage({
                    type: 'LIKES_RESET_TIME',
                    time: data.data.userVote.likesCapResetTime
                }, '*');
            }
        }
    };

    const handlePremium = (data) => {
        if (!data?.data?.me) return false;

        const me = data.data.me;
        const session = data.data.session;

        if (session) {
            session.isStaff = settings.staffMode;
            session.isInEU = false; // not sure if this does anything
            // session.guestId = '2DZnGaELZWAH2Pxi8yCKrA2'; //TODO: research about guestId usage
            session.__typename = 'Session';

            // Inject Session Gatekeeper Checks
            if (!session.gatekeeperChecks) {
                session.gatekeeperChecks = {};
            }
            session.gatekeeperChecks.ONBOARDING_MANDATORY_REDIRECT = false;
            session.gatekeeperChecks.TERMS_MANDATORY_REDIRECT = false;
            session.gatekeeperChecks.SMS_MANDATORY_REDIRECT = false;
            session.gatekeeperChecks.INCOGNITO_TERMED_MANDATORY_REDIRECT = false;
            session.gatekeeperChecks.__typename = 'GatekeeperChecks';
        }

        me.isAlist = true;
        me.isAdFree = true;
        me.isIncognito = true; // Incognito mode (not sure if this does anything)
        me.hasMetPhotoRequirements = true; // Bypass user photo requirements

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
        // Disable negative gatekeepers to hide banners/upsells
        me.gatekeeperChecks.BILLING_WOES = false;
        me.gatekeeperChecks.ALIST_DISCOUNT_MASTHEAD = false;
        me.gatekeeperChecks.INTOYOU_MASTHEAD = true; // Enable 'Into You' feature

        // --- INJECTED GATEKEEPERS START ---
        // 1. Unlock Dealbreakers (Enable filtering)
        me.gatekeeperChecks.PREFERENCES_AGE_DEALBREAKER = true;
        me.gatekeeperChecks.PREFERENCES_DISTANCE_DEALBREAKER = true;
        me.gatekeeperChecks.PREFERENCES_HEIGHT_DEALBREAKER = true;
        me.gatekeeperChecks.PREFERENCES_SMOKING_DEALBREAKER = true;
        me.gatekeeperChecks.PREFERENCES_RELIGION_DEALBREAKER = true;
        me.gatekeeperChecks.PREFERENCES_HASKIDS_DEALBREAKER = true;
        me.gatekeeperChecks.PREFERENCES_WANTSKIDS_DEALBREAKER = true;

        // 2. Remove CRM/Upsells (Clean UI)
        me.gatekeeperChecks.CRM_BOOST = false;
        me.gatekeeperChecks.CRM_UPGRADE = false;
        me.gatekeeperChecks.CRM_PREMIUM = false;
        me.gatekeeperChecks.CRM_SUBSCRIPTION_DISCOUNT_PROMO = false;
        me.gatekeeperChecks.ONBOARDING_UPSELL = false;
        me.gatekeeperChecks.CONVERSATIONLIST_EMPTYSTATE_BOOST = false;
        me.gatekeeperChecks.CONVERSATIONLIST_SEE_WHO_LIKES_YOU = false;

        // 3. Enable Superlikes
        me.gatekeeperChecks.DISCOVER_MATCHPERCENTAGE_SUPERLIKE = true;
        me.gatekeeperChecks.DISCOVER_PASSPORT_SUPERLIKE = true;
        me.gatekeeperChecks.LIKES_YOULIKESUPERLIKE = true;
        me.gatekeeperChecks.FULLPROFILE_SUPERLIKE = true;

        // 4. Incognito & Privacy
        me.gatekeeperChecks.SELF_PROFILE_INCOGNITO = true;
        me.gatekeeperChecks.SETTINGS_PRIVACY_INCOGNITO = true;
        me.gatekeeperChecks.HEADER_BANNER_INCOGNITO = true;

        // 5. Advanced Search
        me.gatekeeperChecks.QUESTION_SEARCH = true;
        me.gatekeeperChecks.QUESTIONSEARCH_PREFERENCES = true;
        me.gatekeeperChecks.CONVERSATION_READ_RECEIPT = true;
        // --- INJECTED GATEKEEPERS END ---

        // Disable paywall gatekeepers (false = don't show paywall)
        me.gatekeeperChecks.DISCOVER_LIKESCAP = false;
        me.gatekeeperChecks.FULLPROFILE_LIKESCAP = false;
        me.gatekeeperChecks.DISCOVER_SUPERLIKE_UPGRADEMODAL = false;
        me.gatekeeperChecks.LIKES_SEEWHOLIKESYOU_CTA = false;
        me.gatekeeperChecks.LIKES_LIKESYOU_BLURTAP = false;
        me.gatekeeperChecks.LIKES_LIKESYOU_SCROLL = false;

        // Enable ad removal gatekeepers (true = remove ads)
        me.gatekeeperChecks.DISCOVER_REMOVE_ADS = true;
        me.gatekeeperChecks.FULLPROFILE_REMOVE_ADS = true;
        me.gatekeeperChecks.LIKESYOU_REMOVE_ADS = true;

        if (!me.premiums) {
            me.premiums = {};
        }
        // Enable all premium features to bypass paywalls
        me.premiums.VIEW_VOTES = true; // View who voted for you
        me.premiums.ALIST_BASIC = true;
        me.premiums.ALIST_PREMIUM = true;
        me.premiums.ALIST_PREMIUM_PLUS = true; //Display Premium Plus badge

        me.premiums.ADFREE = true; // Ad Free experience
        me.premiums.INTROS = true; // Access to Intros
        me.premiums.INCOGNITO_BUNDLE = true; // Incognito mode
        me.premiums.UNLIMITED_REWINDS = true; // Unlimited rewinds
        me.premiums.READ_RECEIPTS = true; // Read receipts for messages
        me.premiums.SEE_PUBLIC_QUESTIONS = true; // See public question answers
        me.premiums.__typename = 'Premiums';


        // Premium features found in module 88074 (lowercase and uppercase variants)
        const features = [
            'intoyou', 'INTO_YOU',
            'comfree', 'ad_free', 'AD_FREE', 'ADFREE',
            'unlimited_likes', 'UNLIMITED_LIKES', 'UNLIMTED_LIKES',
            'intros', 'INTROS',
            'dealbreakers', 'DEALBREAKERS',
            'see_more_people', 'SEE_MORE_PEOPLE',
            'questions', 'QUESTIONS',
            'superlikes', 'superlikes_3', 'SUPERLIKES_3', 'superlikes_15', 'SUPERLIKES_15',
            'rewind', 'REWIND',
            'question_search', 'QUESTION_SEARCH',
            'who_likes_you', 'see_who_likes_you', 'SEE_WHO_LIKES_YOU',
            'question_answers', 'QUESTION_ANSWERS',
            'likes_list_sort', 'LIKES_LIST_SORT',
            'priority_likes', 'PRIORITY_LIKES',
            'read_receipts', 'READ_RECEIPTS',
            'passport', 'PASSPORT',
            'boost', 'BOOST',
            'super_boost', 'SUPER_BOOST',
            'views', 'VIEWS',
            'profile_visitors', 'PROFILE_VISITORS',
            'match_search', 'MATCH_SEARCH',
            'advanced_filters', 'ADVANCED_FILTERS',
            'message_filters', 'MESSAGE_FILTERS'
        ];

        features.forEach(feature => {
            me.premiums[feature] = true;
        });

        return true;
    };

    const handleUnblur = (data) => {
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

    const originalFetch = window.fetch;

    // Analytics operations to block (GraphQL)
    const blockedOperations = [
        'WebLogAnalyticsEvents',
        'webLogAnalyticsEvents',
        // 'WebE2PStaffbar', // Staff tracking
        // 'WebUpdateStats', // Stats tracking
        // 'webUpdateStats'
    ];

    // URLs to block entirely (Cloudflare, analytics, etc.)
    const blockedUrls = [
        '/cdn-cgi/rum', // Cloudflare Real User Monitoring
        'cloudflareinsights.com', // Cloudflare analytics beacon
        '/beacon.min.js', // Cloudflare beacon script
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.com/tr', // Facebook pixel
        'doubleclick.net',
        'hotjar.com',
        'amplitude.com',
        'mixpanel.com',
        'segment.io',
        'sentry.io'
    ];

    // Intercept fetch to modify request payloads (for experiment overrides)
    window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : input.url;

        // Capture headers from OkCupid API requests
        if (url.includes('okcupid.com') && init?.headers) {
            captureHeaders(init.headers);
        }

        // Block QA/test server requests that cause DNS errors
        if (url.includes('qa1.match.com') || url.includes('qa2.match.com')) {
            return new Response('', { status: 200 });
        }

        // Block tracking/analytics URLs entirely
        if (blockedUrls.some(blocked => url.includes(blocked))) {
            return new Response('', { status: 200 });
        }

        // Block analytics requests
        if (url.includes('graphql') && init?.body) {
            try {
                const body = JSON.parse(init.body);
                if (blockedOperations.includes(body.operationName)) {
                    // Return a fake successful response
                    return new Response(JSON.stringify({ data: null }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            } catch (e) {
                // Continue if parse fails
            }
        }

        // Only intercept GraphQL requests with a body
        if (url.includes('graphql') && init?.body) {
            try {
                const body = JSON.parse(init.body);

                // Disable premium pricing requests in WebBillingUpgradeEligibility
                if (body.operationName === 'WebBillingUpgradeEligibility' && body.variables) {
                    body.variables.includePremium = false;
                    body.variables.includePremiumPlus = false;
                    init.body = JSON.stringify(body);
                }

                // Change voteSource from FEATURED_QUESTION to DOUBLETAKE in WebUserVote to bypass question voting limits
                if (body.operationName === 'WebUserVote' && body.variables?.input?.votes) {
                    let modified = false;
                    body.variables.input.votes.forEach(vote => {
                        if (vote.voteSource === 'FEATURED_QUESTION') {
                            vote.voteSource = 'INCOMING_LIKES_SUPERLIKE_INTRO';
                            modified = true;
                        }
                    });
                    if (modified) {
                        init.body = JSON.stringify(body);
                    }
                }

                // // Intercept userrowsIncomingLikes to modify 'after' pagination cursor
                // if ((body.operationName === 'userrowsIncomingLikes' || body.operationName === 'userrowsOutgoingLikes') && body.variables) {
                //     const customString = 'HN_AicAyegpZRCgF6-Uusg2'; // Enter the raw string you want to encode
                //     // Encode in Base64
                //     body.variables.after = btoa(customString);
                //     init.body = JSON.stringify(body);
                //     console.log(`[Cupid Enhanced] Intercepted userrowsIncomingLikes after cursor: ${body.variables.after} (raw: ${customString})`);
                // }

            } catch (e) {
                // Not JSON or parse error, continue with original
            }
        }

        return originalFetch.call(this, input, init);
    };


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
