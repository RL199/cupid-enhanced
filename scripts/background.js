'use strict';

// =============================================================================
// OkCupid API Request Handler
// =============================================================================

// Store captured headers from the content script
let capturedOkCupidHeaders = {};

/**
 * Get all cookies for OkCupid domain
 * @returns {Promise<string>} Cookie string formatted for request header
 */
async function getOkCupidCookies() {
    try {
        const cookies = await chrome.cookies.getAll({ domain: '.okcupid.com' });
        return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } catch (error) {
        console.error('[Cupid Enhanced] Error getting cookies:', error);
        return '';
    }
}

/**
 * Make an authenticated request to OkCupid API
 * @param {string} url - The API endpoint URL
 * @param {object} options - Request options (method, body, headers)
 * @returns {Promise<object>} Response data
 */
async function makeOkCupidRequest(url, options = {}) {
    const cookieString = await getOkCupidCookies();
    
    // Default headers for OkCupid API
    const defaultHeaders = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        'x-okcupid-locale': 'en',
        'x-okcupid-platform': 'DESKTOP',
        'Origin': 'https://www.okcupid.com',
        'Referer': 'https://www.okcupid.com/'
    };

    // Merge headers: defaults < captured headers < request-specific headers
    const headers = {
        ...defaultHeaders,
        ...capturedOkCupidHeaders,
        ...options.headers
    };

    // Add cookies if we have them
    if (cookieString) {
        headers['Cookie'] = cookieString;
    }

    try {
        const response = await fetch(url, {
            method: options.method || 'POST',
            headers: headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, data };
    } catch (error) {
        console.error('[Cupid Enhanced] API Request failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * GraphQL request helper for OkCupid
 * @param {string} operationName - GraphQL operation name
 * @param {string} query - GraphQL query string
 * @param {object} variables - GraphQL variables
 * @returns {Promise<object>} Response data
 */
async function graphqlRequest(operationName, query, variables = {}) {
    const url = 'https://e2p-okapi.api.okcupid.com/graphql/' + operationName;
    
    return makeOkCupidRequest(url, {
        method: 'POST',
        body: {
            operationName,
            variables,
            query
        }
    });
}

// =============================================================================
// Message Handlers
// =============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle captured headers from content script
    if (message.type === 'OKCUPID_HEADERS_UPDATE') {
        capturedOkCupidHeaders = {
            ...capturedOkCupidHeaders,
            ...message.headers
        };
        console.log('[Cupid Enhanced] Headers updated:', Object.keys(capturedOkCupidHeaders));
        sendResponse({ success: true });
        return false;
    }

    // Handle API request from content script
    if (message.type === 'OKCUPID_API_REQUEST') {
        makeOkCupidRequest(message.url, message.options)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }

    // Handle GraphQL request from content script
    if (message.type === 'OKCUPID_GRAPHQL_REQUEST') {
        graphqlRequest(message.operationName, message.query, message.variables)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }

    // Example: WebLikesCap query
    if (message.type === 'GET_LIKES_CAP') {
        const query = `fragment LikesCapFragment on User {
  likesCap {
    likesRemaining
    resetTime
    viewCount
    __typename
  }
  __typename
}

query WebLikesCap {
  me {
    id
    ...LikesCapFragment
    __typename
  }
}`;
        
        graphqlRequest('WebLikesCap', query, {})
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    return false;
});

// Log when service worker starts
console.log('[Cupid Enhanced] Background service worker started');
