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
 * Supports all HTTP methods: GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH
 * 
 * @param {string} url - The API endpoint URL
 * @param {object} options - Request options
 * @param {string} options.method - HTTP method (default: 'POST')
 * @param {object|string} options.body - Request body (only for POST, PUT, PATCH)
 * @param {object} options.headers - Additional headers
 * @returns {Promise<object>} Response data
 */
async function makeOkCupidRequest(url, options = {}) {
    const cookieString = await getOkCupidCookies();
    const method = (options.method || 'POST').toUpperCase();
    
    // Default headers for OkCupid API
    const defaultHeaders = {
        'accept': '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'x-okcupid-locale': 'en',
        'x-okcupid-platform': 'DESKTOP',
        'Origin': 'https://www.okcupid.com',
        'Referer': 'https://www.okcupid.com/'
    };

    // Only add content-type for methods that have a body
    if (['POST', 'PUT', 'PATCH'].includes(method) && options.body) {
        defaultHeaders['content-type'] = 'application/json';
    }

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

    // Build fetch options
    const fetchOptions = {
        method: method,
        headers: headers,
        credentials: 'include'
    };

    // Only add body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method) && options.body) {
        fetchOptions.body = typeof options.body === 'string' 
            ? options.body 
            : JSON.stringify(options.body);
    }

    try {
        console.log('[Cupid Enhanced] Making request to:', url);
        console.log('[Cupid Enhanced] Request options:', JSON.stringify(fetchOptions, null, 2).substring(0, 500));
        const response = await fetch(url, fetchOptions);

        // For HEAD and OPTIONS, return status info
        if (['HEAD', 'OPTIONS'].includes(method)) {
            return { 
                success: true, 
                data: { 
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                }
            };
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Try to parse as JSON, fall back to text
        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
        
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
