// API Response Interceptor - Runs in MAIN world to modify responses before page sees them
(function () {
    'use strict';

    console.log('###Cupid Enhanced: API Interceptor Loaded###');

    let settings = {
        staffMode: true,
        anonymousMessageRead: true
    };

    // =============================================================================
    // API Interceptor Constants
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

    // Analytics operations to block (GraphQL)
    const BLOCKED_OPERATIONS = [
        'WebLogAnalyticsEvents',
        'webLogAnalyticsEvents'
        // 'WebE2PStaffbar', // Staff tracking
        // 'WebUpdateStats', // Stats tracking
        // 'webUpdateStats'
    ];

    // URLs to block entirely (Cloudflare, analytics, etc.)
    const BLOCKED_URLS = [
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

    // Premium features found in module 88074 (lowercase and uppercase variants)
    const PREMIUM_FEATURES = [
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

    // =============================================================================
    // Header Capture for Background Script API Requests
    // =============================================================================

    // Store captured headers
    let capturedHeaders = {};

    // Store last broadcast user ID to avoid redundant messages
    let lastBroadcastUserId = null;

    // Track latest likes pagination cursor from requests
    let lastLikesRequestCursor = null;
    let lastLikesRequestOperation = null;

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

    function normalizeImageUrl(url) {
        if (!url || typeof url !== 'string') return null;
        return url.split('?')[0];
    }

    function safeBase64Decode(value) {
        if (!value || typeof value !== 'string') return null;
        try {
            return atob(value);
        } catch {
            return null;
        }
    }

    function extractLikesImageUrl(item) {
        if (!item || typeof item !== 'object') return null;

        if (item.user?.primaryImage?.square225) return item.user.primaryImage.square225;
        if (item.user?.primaryImage?.original) return item.user.primaryImage.original;

        if (item.primaryImage?.square225) return item.primaryImage.square225;
        if (item.primaryImage?.original) return item.primaryImage.original;

        if (item.primaryImageBlurred?.square225) return item.primaryImageBlurred.square225;

        return null;
    }

    function collectLikesProfileMappings(data) {
        const likes = data?.data?.me?.likes;
        if (!likes?.data || !Array.isArray(likes.data) || likes.data.length === 0) return;

        const entries = [];
        const afterCursor = likes.pageInfo?.after;
        const decodedAfter = safeBase64Decode(afterCursor);

        if (decodedAfter) {
            const lastItem = likes.data[likes.data.length - 1];
            const lastImage = normalizeImageUrl(extractLikesImageUrl(lastItem));
            if (lastImage) {
                entries.push({ profileId: decodedAfter, imageUrl: lastImage, cursor: afterCursor });
            }
        }

        if (lastLikesRequestCursor) {
            const decodedRequest = safeBase64Decode(lastLikesRequestCursor);
            const firstItem = likes.data[0];
            const firstImage = normalizeImageUrl(extractLikesImageUrl(firstItem));
            if (decodedRequest && firstImage) {
                entries.push({ profileId: decodedRequest, imageUrl: firstImage, cursor: lastLikesRequestCursor });
            }
        }

        likes.data.forEach(item => {
            const userId = item?.user?.id;
            const imageUrl = normalizeImageUrl(extractLikesImageUrl(item));
            if (userId && imageUrl) {
                entries.push({ profileId: userId, imageUrl });
            }
        });

        if (entries.length > 0) {
            window.postMessage({
                type: 'LIKES_PROFILE_CURSOR_MAP',
                operation: lastLikesRequestOperation,
                entries
            }, '*');
        }
    }

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

        // Broadcast user ID to content script (only if changed)
        if (me.id && me.id !== lastBroadcastUserId) {
            lastBroadcastUserId = me.id;
            window.postMessage({
                type: 'OKCUPID_USER_ID',
                userId: me.id
            }, '*');
        }

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
        PREMIUM_FEATURES.forEach(feature => {
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

    // Intercept fetch to modify request payloads (for experiment overrides)
    window.fetch = async function (input, init) {
        const url = typeof input === 'string' ? input : input.url;

        // Block tracking/analytics URLs FIRST (before any other processing)
        if (BLOCKED_URLS.some(blocked => url.includes(blocked))) {
            return new Response('', { status: 200 });
        }

        // Capture headers from OkCupid API requests
        if (url.includes('okcupid.com') && init?.headers) {
            captureHeaders(init.headers);
        }

        // Block QA/test server requests that cause DNS errors
        if (url.includes('qa1.match.com') || url.includes('qa2.match.com')) {
            return new Response('', { status: 200 });
        }

        // Block analytics requests
        if (url.includes('graphql') && init?.body) {
            try {
                const body = JSON.parse(init.body);

                // Stop read receipt mutations when anonymous mode is enabled
                if (settings.anonymousMessageRead &&
                    (body.operationName === 'WebConversationMessageRead' || body.operationName === 'webConversationMessageRead')) {
                    console.log('[Cupid Enhanced] Blocked WebConversationMessageRead (anonymous mode)');
                    return new Response(JSON.stringify({
                        data: {
                            conversationMessageRead: {
                                __typename: 'MutationPayload',
                                success: true
                            }
                        }
                    }), {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
                if (BLOCKED_OPERATIONS.includes(body.operationName)) {
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

            collectLikesProfileMappings(data);

            if (modified) {
                return JSON.stringify(data);
            }

            return text;
        } catch (e) {
            console.error('Interceptor error:', e);
            return text;
        }
    };

    // =============================================================================
    // Console API - Expose functions to window for use in browser console
    // =============================================================================

    // Store pending promises waiting for responses from content script
    const pendingRequests = new Map();
    let requestId = 0;

    // Listen for responses from the content script (isolated world)
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        if (event.data.type === 'CUPID_API_RESPONSE') {
            const { id, success, data, error } = event.data;
            const pending = pendingRequests.get(id);
            if (pending) {
                pendingRequests.delete(id);
                if (success) {
                    pending.resolve(data);
                } else {
                    pending.reject(new Error(error));
                }
            }
        }
    });

    /**
     * Send a request to the content script and wait for response
     */
    function sendToContentScript(action, payload = {}) {
        return new Promise((resolve, reject) => {
            const id = ++requestId;
            pendingRequests.set(id, { resolve, reject });

            window.postMessage({
                type: 'CUPID_API_REQUEST',
                id,
                action,
                payload
            }, '*');

            // Timeout after 30 seconds
            setTimeout(() => {
                if (pendingRequests.has(id)) {
                    pendingRequests.delete(id);
                    reject(new Error('Request timed out'));
                }
            }, 30000);
        });
    }

    /**
     * Cupid Enhanced Console API
     * Access via window.cupidAPI in the browser console
     */
    window.cupidAPI = {
        /**
         * Get current user's read receipt token count and other premium features
         * @returns {Promise<object>}
         */
        getTokenCounts: () => sendToContentScript('getTokenCounts'),

        /**
         * Get likes cap information
         * @returns {Promise<object>}
         */
        getLikesCap: () => sendToContentScript('getLikesCap'),

        /**
         * Get the featured question with matching users (Question of the Day)
         * @param {string[]} [excludedUserIds=[]] - Array of user IDs to exclude from results
         * @returns {Promise<object>}
         */
        getFeaturedQuestion: (excludedUserIds = []) => sendToContentScript('getFeaturedQuestion', { excludedUserIds }),

        /**
         * Get basic profile information for a user
         * @param {string} targetId - The user ID to get profile info for
         * @returns {Promise<object>}
         */
        getMatchProfile: (targetId) => sendToContentScript('getMatchProfile', { targetId }),

        /**
         * Get a conversation thread with a specific user
         * @param {string} targetId - User ID from messages URL (e.g., /messages/12345678)
         * @param {number} [limit=50] - Number of messages to fetch
         * @param {string} [before] - Pagination cursor for older messages (use message ID)
         * @returns {Promise<object>}
         */
        getConversationThread: (targetId, limit = 50, before = null) =>
            sendToContentScript('getConversationThread', { targetId, limit, before }),

        /**
         * Get all conversations and matches (Messages Main)
         * @param {string} userId - The current user's ID
         * @param {string} [filter='ALL'] - Filter type: 'ALL', 'REPLIES', 'MATCHES'
         * @param {string} [after] - Pagination cursor for more results
         * @returns {Promise<object>}
         */
        getMessagesMain: (userId, filter = 'ALL', after = null) =>
            sendToContentScript('getMessagesMain', { userId, filter, after }),

        /**
         * Vote on a user (like/pass)
         * @param {string} targetId - User ID to vote on
         * @param {string} vote - Vote type: 'LIKE', 'PASS', or 'SUPERLIKE'
         * @param {string} [voteSource='INCOMING_LIKES_SUPERLIKE_INTRO'] - Source of vote (INCOMING_LIKES_SUPERLIKE_INTRO, INCOMING_LIKES, etc.)
         * @returns {Promise<object>}
         */
        vote: (targetId, vote = 'LIKE', voteSource = 'INCOMING_LIKES_SUPERLIKE_INTRO') =>
            sendToContentScript('vote', { targetId, vote, voteSource }),

        /**
         * Make a general GraphQL request
         * @param {string} operationName - GraphQL operation name
         * @param {string} query - GraphQL query string
         * @param {object} variables - GraphQL variables
         * @returns {Promise<object>}
         */
        graphQL: (operationName, query, variables = {}) =>
            sendToContentScript('graphQL', { operationName, query, variables }),

        /**
         * Make a general API request
         * @param {string} url - API URL
         * @param {object} options - Request options (method, body, headers)
         * @returns {Promise<object>}
         */
        request: (url, options = {}) => sendToContentScript('request', { url, options }),

        /**
         * Show help information
         */
        help: () => {
            console.log(`
%c🏹 Cupid Enhanced Console API %c

Available commands:

%cawait cupidAPI.getTokenCounts()%c
    - Check your token counts (read receipts, boosts, superlikes)

%cawait cupidAPI.getLikesCap()%c
  - Get likes remaining and reset time

%cawait cupidAPI.getFeaturedQuestion()%c
  - Get the featured question with matching users
  - Optional param: array of user IDs to exclude

%cawait cupidAPI.getMatchProfile('USER_ID')%c
  - Get basic profile info (name, age, location, match %)

%cawait cupidAPI.getConversationThread('USER_ID')%c
  - Fetch messages with a user
  - Optional 2nd param: number of messages (default: 50)
  - Optional 3rd param: pagination cursor for older messages

%cawait cupidAPI.getMessagesMain('USER_ID')%c
  - Get all conversations and matches
  - 1st param: your user ID (required)
  - Optional 2nd param: filter ('ALL', 'REPLIES', 'MATCHES')
  - Optional 3rd param: pagination cursor for more results

%cawait cupidAPI.vote('USER_ID', 'LIKE')%c
  - Vote on a user: 'LIKE', 'PASS', or 'SUPERLIKE'
  - Optional 3rd param: voteSource (default: 'INCOMING_LIKES_SUPERLIKE_INTRO')

%cawait cupidAPI.graphQL(operationName, query, variables)%c
  - Make a custom GraphQL request

%cawait cupidAPI.request(url, options)%c
  - Make a custom API request

%cExample:%c
    const status = await cupidAPI.getTokenCounts();
    console.log('Read Receipt Tokens:', status.data.me.readReceiptTokenCount);
`,
                'color: #ff1493; font-size: 16px; font-weight: bold;',
                '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #00bfff; font-family: monospace;', '',
                'color: #32cd32; font-style: italic;', ''
            );
        }
    };

    // Log availability on load
    console.log('%c🏹 Cupid Enhanced API available! Type %ccupidAPI.help()%c for commands.',
        'color: #ff1493;',
        'color: #00bfff; font-family: monospace;',
        'color: #ff1493;'
    );
})();
