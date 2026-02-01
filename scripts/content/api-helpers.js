// =============================================================================
// API Helper Functions (communicates with background service worker)
// Provides functions to communicate with OkCupid's API through the background script
// =============================================================================
'use strict';

/**
 * Check if the extension context is still valid.
 * Returns false if the extension has been reloaded/updated while the page is still open.
 * @returns {boolean} True if extension context is valid
 */
function isExtensionContextValid() {
    try {
        return !!chrome.runtime?.id;
    } catch {
        return false;
    }
}

/**
 * General purpose OkCupid API request function
 * Makes requests through the background service worker to bypass CORS
 *
 * @param {string} url - Full URL or just the endpoint path (e.g., '/graphql/WebLikesCap')
 * @param {object} options - Request options
 * @param {string} options.method - HTTP method: 'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'
 * @param {object|string} options.body - Request body (will be JSON stringified if object)
 * @param {object} options.headers - Additional headers to include
 * @returns {Promise<object>} Response data
 */
async function okcupidAPI(url, options = {}) {
    const fullUrl = url.startsWith('http')
        ? url
        : `https://e2p-okapi.api.okcupid.com${url.startsWith('/') ? '' : '/'}${url}`;

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                type: 'OKCUPID_API_REQUEST',
                url: fullUrl,
                options: {
                    method: options.method || 'POST',
                    body: options.body,
                    headers: options.headers
                }
            },
            response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response?.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Unknown error'));
                }
            }
        );
    });
}

/**
 * Make a GraphQL request to OkCupid API
 * This is a convenience wrapper around okcupidAPI for GraphQL operations
 *
 * @param {string} operationName - GraphQL operation name (see OKCUPID_OPERATIONS)
 * @param {string} query - GraphQL query string
 * @param {object} variables - GraphQL variables (optional)
 * @returns {Promise<object>} Response data
 */
async function okcupidGraphQL(operationName, query, variables = {}) {
    return okcupidAPI(`/graphql/${operationName}`, {
        method: 'POST',
        body: {
            operationName,
            variables,
            query
        }
    });
}

/**
 * @deprecated Use okcupidAPI instead for more flexibility
 * Make a raw API request to OkCupid through the background service worker
 */
async function okcupidRequest(url, options = {}) {
    return okcupidAPI(url, options);
}

/**
 * Get likes cap information from OkCupid API
 * @returns {Promise<object>} Likes cap data
 */
async function getLikesCap() {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'GET_LIKES_CAP' }, response => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || 'Unknown error'));
            }
        });
    });
}

/**
 * Vote on a user (like/pass/superlike)
 * @param {string} targetId - The user ID to vote on
 * @param {string} vote - Vote type: 'LIKE', 'PASS', or 'SUPERLIKE'
 * @param {string} voteSource - Source of vote (default: 'DOUBLETAKE')
 * @returns {Promise<object>} Response with vote result
 */
async function voteOnUser(targetId, vote = 'LIKE', voteSource = 'DOUBLETAKE') {
    const query = `mutation WebUserVote($input: UserVoteInput!) {
  userVote(input: $input) {
    success
    voteResults {
      success
      statusCode
      isMutualLike
      isViaSpotlight
      isViaSuperBoost
      votesRemainingInSource
      __typename
    }
    shouldTrackLikesCapReached
    likesRemaining
    likesCapResetTime
    __typename
  }
}`;

    const variables = {
        input: {
            votes: [
                {
                    targetId: targetId,
                    vote: vote.toUpperCase(),
                    voteSource: voteSource,
                    userMetadata: null,
                    comment: null
                }
            ]
        }
    };

    try {
        const result = await okcupidGraphQL('WebUserVote', query, variables);
        console.log(`[Cupid Enhanced] Vote ${vote} on ${targetId}:`, result);
        return result;
    } catch (error) {
        console.error(`[Cupid Enhanced] Vote failed:`, error);
        throw error;
    }
}
