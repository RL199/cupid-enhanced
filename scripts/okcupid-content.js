"use strict";

console.log('###Cupid content script loaded###');

// =============================================================================
// API Helper Functions (communicates with background service worker)
// =============================================================================

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
 *
 * @example
 * // Simple GET request
 * const data = await okcupidAPI('https://www.okcupid.com/some-endpoint', { method: 'GET' });
 *
 * @example
 * // POST request with body
 * const data = await okcupidAPI('https://e2p-okapi.api.okcupid.com/graphql/WebLikesCap', {
 *     method: 'POST',
 *     body: { operationName: 'WebLikesCap', variables: {}, query: '...' }
 * });
 */
async function okcupidAPI(url, options = {}) {
    // If URL doesn't start with http, prepend the API base URL
    const fullUrl = url.startsWith('http')
        ? url
        : `https://e2p-okapi.api.okcupid.com${url.startsWith('/') ? '' : '/'}${url}`;

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'OKCUPID_API_REQUEST',
            url: fullUrl,
            options: {
                method: options.method || 'POST',
                body: options.body,
                headers: options.headers
            }
        }, response => {
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
 * Make a GraphQL request to OkCupid API
 * This is a convenience wrapper around okcupidAPI for GraphQL operations
 *
 * @param {string} operationName - GraphQL operation name (see OKCUPID_OPERATIONS)
 * @param {string} query - GraphQL query string
 * @param {object} variables - GraphQL variables (optional)
 * @returns {Promise<object>} Response data
 *
 * @example
 * const data = await okcupidGraphQL('WebLikesCap', `
 *     query WebLikesCap {
 *         me { id likesCap { likesRemaining resetTime } }
 *     }
 * `, {});
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
 *
 * @example
 * // Like a user
 * const result = await voteOnUser('abc123', 'LIKE');
 *
 * @example
 * // Pass on a user from incoming likes
 * const result = await voteOnUser('abc123', 'PASS', 'INCOMING_LIKES');
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
            votes: [{
                targetId: targetId,
                vote: vote.toUpperCase(),
                voteSource: voteSource,
                userMetadata: null,
                comment: null
            }]
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


// =============================================================================
// State
// =============================================================================

let currentSettings = { ...DEFAULT_SETTINGS };
let observers = {};
let imageMetadataCache = {};
let isFetchingMetadata = false;
let lastFetchedUserId = null;

// =============================================================================
// Initialization
// =============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function displayConsoleLogo() {
    const logo = `
%c
 ♥♥♥♥♥♥ ♥♥    ♥♥ ♥♥♥♥♥♥  ♥♥ ♥♥♥♥♥♥      ♥♥♥♥♥♥♥ ♥♥♥    ♥♥ ♥♥   ♥♥  ♥♥♥♥♥  ♥♥♥    ♥♥  ♥♥♥♥♥♥ ♥♥♥♥♥♥♥ ♥♥♥♥♥♥
♥♥      ♥♥    ♥♥ ♥♥   ♥♥ ♥♥ ♥♥   ♥♥     ♥♥      ♥♥♥♥   ♥♥ ♥♥   ♥♥ ♥♥   ♥♥ ♥♥♥♥   ♥♥ ♥♥      ♥♥      ♥♥   ♥♥
♥♥      ♥♥    ♥♥ ♥♥♥♥♥♥  ♥♥ ♥♥   ♥♥     ♥♥♥♥♥   ♥♥ ♥♥  ♥♥ ♥♥♥♥♥♥♥ ♥♥♥♥♥♥♥ ♥♥ ♥♥  ♥♥ ♥♥      ♥♥♥♥♥   ♥♥   ♥♥
♥♥      ♥♥    ♥♥ ♥♥      ♥♥ ♥♥   ♥♥     ♥♥      ♥♥  ♥♥ ♥♥ ♥♥   ♥♥ ♥♥   ♥♥ ♥♥  ♥♥ ♥♥ ♥♥      ♥♥      ♥♥   ♥♥
 ♥♥♥♥♥♥  ♥♥♥♥♥♥  ♥♥      ♥♥ ♥♥♥♥♥♥      ♥♥♥♥♥♥♥ ♥♥   ♥♥♥♥ ♥♥   ♥♥ ♥♥   ♥♥ ♥♥   ♥♥♥♥  ♥♥♥♥♥♥ ♥♥♥♥♥♥♥ ♥♥♥♥♥♥

`;

    console.log(
        logo,
        'color: #ff1493; font-weight: bold;'

    );
}

async function init() {
    displayConsoleLogo();
    await loadSettings();
    setupEventListeners();
    setupObservers();
    updateLikesIncomingCount();

    if (currentSettings.darkMode) {
        enableDarkMode();
    }

    // Test API request after a short delay to allow headers to be captured
    setTimeout(testLikesCapApi, 3000);
}

/**
 * Test function to verify API requests are working
 * Fetches likes cap info from OkCupid API through background service worker
 */
async function testLikesCapApi() {
    try {
        console.log('[Cupid Enhanced] Testing API request...');
        const result = await getLikesCap();
        console.log('[Cupid Enhanced] Likes Cap API Response:', result);

        if (result?.data?.me?.likesCap) {
            const likesCap = result.data.me.likesCap;
            console.log('[Cupid Enhanced] Likes Remaining:', likesCap.likesRemaining);
            console.log('[Cupid Enhanced] Reset Time:', likesCap.resetTime ? new Date(likesCap.resetTime).toLocaleString() : 'N/A');
            console.log('[Cupid Enhanced] View Count:', likesCap.viewCount);
        }
    } catch (error) {
        console.error('[Cupid Enhanced] API test failed:', error.message);
    }
}

/**
 * Get current user's token counts and other premium features status
 * @returns {Promise<object>} User premium features data
 */
async function getTokenCounts() {
    const query = `query WebGetALCTokenCounts {
  me {
    id
    readReceiptTokenCount
    boostTokenCount
    superlikeTokenCount
    __typename
  }
}`;

    try {
        console.log('[Cupid Enhanced] Fetching token counts...');
        const result = await okcupidGraphQL('WebGetALCTokenCounts', query, {});
        console.log('[Cupid Enhanced] Token Counts:', result);

        if (result?.data?.me) {
            const { readReceiptTokenCount, boostTokenCount, superlikeTokenCount } = result.data.me;
            console.log('[Cupid Enhanced] Read Receipt Tokens:', readReceiptTokenCount ?? 'N/A');
            console.log('[Cupid Enhanced] Boost Tokens:', boostTokenCount ?? 'N/A');
            console.log('[Cupid Enhanced] SuperLike Tokens:', superlikeTokenCount ?? 'N/A');
        }

        return result;
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to get token counts:', error.message);
        throw error;
    }
}

/**
 * Get the featured question with matching users
 * This is the "Question of the Day" feature that shows users who answered similarly
 *
 * @param {string[]} excludedUserIds - Array of user IDs to exclude from results (optional)
 * @returns {Promise<object>} Featured question data with matching users
 *
 * @example
 * const featured = await getFeaturedQuestion();
 * console.log(featured.data.me.recommendedQuestions.featuredQuestionWithMatches);
 */
async function getFeaturedQuestion(excludedUserIds = []) {
    const query = `fragment PhotoInfo on Photo {
  id
  caption
  original
  square60
  square82
  square100
  square120
  square160
  square225
  square400
  square800
  __typename
}

fragment UserPrimaryImagesFragment on User {
  primaryImage {
    id
    caption
    original
    square60
    square82
    square100
    square120
    square160
    square225
    square400
    square800
    __typename
  }
  __typename
}

fragment WiwSentencePreferences on User {
  globalPreferences {
    gender {
      values
      __typename
    }
    relationshipType {
      values
      __typename
    }
    connectionType {
      values
      __typename
    }
    __typename
  }
  __typename
}

fragment ProfileCommentAttachment on Attachment {
  ... on ProfileCommentPhoto {
    type
    photo {
      id
      square800
      __typename
    }
    __typename
  }
  ... on ProfileCommentInstagramPhoto {
    type
    instagramPhoto {
      caption
      original
      __typename
    }
    __typename
  }
  ... on ProfileCommentEssay {
    type
    essayTitle
    essayText
    __typename
  }
  __typename
}

fragment FirstMessageFragment on Match {
  senderLikes
  senderPassed
  senderVote
  firstMessage {
    id
    threadId
    text
    attachments {
      ...ProfileCommentAttachment
      __typename
    }
    __typename
  }
  __typename
}

fragment SelfDetails on User {
  children
  relationshipStatus
  relationshipType
  smoking
  weed
  drinking
  diet
  pets
  ethnicity
  politics
  bodyType
  height
  astrologicalSign
  knownLanguages
  pronounCategory
  customPronouns
  genders
  orientations
  identityTags
  realname
  religion {
    value
    modifier
    __typename
  }
  religiousBackground
  shabbatRoutine
  kosherHabits
  occupation {
    title
    status
    employer
    __typename
  }
  education {
    level
    school {
      name
      __typename
    }
    __typename
  }
  __typename
}

fragment Badges on User {
  badges {
    name
    __typename
  }
  __typename
}

fragment EssayFragment on Essay {
  id
  groupId
  groupTitle
  isPassion
  title
  placeholder
  rawContent
  processedContent
  __typename
}

fragment MatchFragment on Match {
  ...FirstMessageFragment
  matchPercent
  targetLikes
  targetVote
  senderLikes
  senderVote
  targetMessageTime
  targetLikeViaSpotlight
  targetLikeViaSuperBoost
  user {
    id
    displayname
    username
    age
    hasPhotos
    ...UserPrimaryImagesFragment
    userLocation {
      id
      publicName
      __typename
    }
    photos {
      ...PhotoInfo
      __typename
    }
    essaysWithUniqueIds {
      ...EssayFragment
      __typename
    }
    ...WiwSentencePreferences
    ...SelfDetails
    ...Badges
    __typename
  }
  __typename
}

fragment MatchSearchStackMatch on StackMatch {
  stream
  match {
    ...MatchFragment
    __typename
  }
  __typename
}

fragment MatchSearchMatchPreview on MatchPreview {
  primaryImageBlurred {
    square225
    __typename
  }
  primaryImage {
    id
    square225
    square400
    __typename
  }
  __typename
}

fragment SearchMatchSearchResults on MatchSearchResults {
  votesRemaining
  data {
    ... on StackMatch {
      ...MatchSearchStackMatch
      __typename
    }
    ... on MatchPreview {
      ...MatchSearchMatchPreview
      __typename
    }
    __typename
  }
  __typename
}

fragment SearchQuestion on Question {
  id
  text
  answers
  globalAnswerCount
  __typename
}

fragment SearchUserQuestionResponse on UserQuestionResponse {
  question {
    ...SearchQuestion
    __typename
  }
  target {
    answer
    sameAnswerCount
    __typename
  }
  __typename
}

fragment SearchQuestionWithMatches on QuestionWithMatches {
  questionId
  questionAnswer
  question {
    ...SearchUserQuestionResponse
    __typename
  }
  matches(excludedUserIds: $excludedUserIds) {
    ...SearchMatchSearchResults
    __typename
  }
  __typename
}

query WebQuestionSearchFeaturedQuestion($excludedUserIds: [String!]) {
  me {
    id
    recommendedQuestions {
      featuredQuestionWithMatches {
        ...SearchQuestionWithMatches
        __typename
      }
      __typename
    }
    __typename
  }
}`;

    const variables = excludedUserIds.length > 0 ? { excludedUserIds } : {};

    try {
        console.log('[Cupid Enhanced] Fetching featured question...');
        const result = await okcupidGraphQL('WebQuestionSearchFeaturedQuestion', query, variables);
        console.log('[Cupid Enhanced] Featured Question:', result);

        if (result?.data?.me?.recommendedQuestions?.featuredQuestionWithMatches) {
            const featured = result.data.me.recommendedQuestions.featuredQuestionWithMatches;
            const question = featured.question?.question;
            console.log('[Cupid Enhanced] Question:', question?.text);
            console.log('[Cupid Enhanced] Your answer index:', featured.questionAnswer);
            console.log('[Cupid Enhanced] Matches:', featured.matches?.data?.length ?? 0);
        }

        return result;
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to get featured question:', error.message);
        throw error;
    }
}

/**
 * Get basic profile information for a user
 * Fetches display name, age, location, match percentage, and primary image
 *
 * @param {string} targetId - The user ID to get profile info for
 * @returns {Promise<object>} Match profile data
 *
 * @example
 * const profile = await getMatchProfile('wA6EHJCyH2XVc-YAeKAb9g2');
 * console.log(profile.data.me.match.user.displayname);
 */
async function getMatchProfile(targetId) {
    const query = `fragment ProfileHead on User {
  id
  displayname
  age
  userLocation {
    id
    publicName
    __typename
  }
  __typename
}

fragment UserPrimaryImagesFragment on User {
  primaryImage {
    id
    caption
    original
    square60
    square82
    square100
    square120
    square160
    square225
    square400
    square800
    __typename
  }
  __typename
}

fragment PublicProfileActionBar on Match {
  matchPercent
  user {
    id
    displayname
    username
    ...UserPrimaryImagesFragment
    __typename
  }
  __typename
}

query WebMatchProfileDesktopWrapper($targetId: String!) {
  me {
    id
    match(id: $targetId) {
      ...PublicProfileActionBar
      user {
        id
        ...ProfileHead
        __typename
      }
      __typename
    }
    __typename
  }
}`;

    const variables = { targetId };

    try {
        console.log('[Cupid Enhanced] Fetching match profile for:', targetId);
        const result = await okcupidGraphQL('WebMatchProfileDesktopWrapper', query, variables);
        console.log('[Cupid Enhanced] Match Profile:', result);

        if (result?.data?.me?.match) {
            const match = result.data.me.match;
            const user = match.user;
            console.log('[Cupid Enhanced] Name:', user?.displayname);
            console.log('[Cupid Enhanced] Age:', user?.age);
            console.log('[Cupid Enhanced] Location:', user?.userLocation?.publicName);
            console.log('[Cupid Enhanced] Match %:', match.matchPercent);
        }

        return result;
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to get match profile:', error.message);
        throw error;
    }
}

/**
 * Get a conversation thread with a specific user
 * Fetches all messages exchanged with the correspondent
 *
 * @param {string} targetId - The user ID of the person you're chatting with
 * @param {number} limit - Number of messages to fetch (default: 50)
 * @param {string} before - Pagination cursor for older messages (optional)
 * @returns {Promise<object>} Conversation thread data with messages
 *
 * @example
 * // Get conversation from URL: /messages/12345678 -> targetId is 12345678
 * const thread = await getConversationThread('12345678');
 *
 * @example
 * // Get more messages with pagination
 * const thread = await getConversationThread('12345678', 100);
 */
async function getConversationThread(targetId, limit = 50, before = null) {
    const query = `fragment GifFragment on GifMedia {
  width
  height
  url
  __typename
}

fragment PhotoInfo on Photo {
  id
  caption
  original
  square60
  square82
  square100
  square120
  square160
  square225
  square400
  square800
  __typename
}

fragment MessageAttachmentFragment on Attachment {
  __typename
  ... on GifResult {
    id
    vendor
    gif {
      ...GifFragment
      __typename
    }
    medium {
      ...GifFragment
      __typename
    }
    tiny {
      ...GifFragment
      __typename
    }
    nano {
      ...GifFragment
      __typename
    }
    __typename
  }
  ... on ProfileCommentPhoto {
    type
    photo {
      ...PhotoInfo
      __typename
    }
    __typename
  }
  ... on ProfileCommentInstagramPhoto {
    type
    instagramPhoto {
      caption
      original
      __typename
    }
    __typename
  }
  ... on ProfileCommentEssay {
    type
    essayTitle
    essayText
    __typename
  }
  ... on ReactionUpdate {
    updateType
    __typename
  }
  ... on Reaction {
    reaction
    senderId
    __typename
  }
}

fragment MessageAttachmentsFragment on Message {
  attachments {
    ...MessageAttachmentFragment
    __typename
  }
  __typename
}

fragment CorrespondentFragment on Match {
  targetLikes
  isMutualLike
  targetVote
  senderVote
  matchPercent
  targetLikeViaSuperBoost
  targetLikeViaSpotlight
  senderBlocked
  firstMessage {
    text
    __typename
  }
  user {
    id
    displayname
    isOnline
    photos {
      ...PhotoInfo
      __typename
    }
    __typename
  }
  firstMessage {
    id
    text
    threadId
    ...MessageAttachmentsFragment
    __typename
  }
  __typename
}

fragment MessageFragment on Message {
  id
  senderId
  threadId
  text
  time
  readTime
  ...MessageAttachmentsFragment
  __typename
}

fragment ConversationThreadFragment on ConversationThread {
  id
  status
  pageInfo {
    hasMore
    total
    __typename
  }
  showScammerWarning
  showContentWarning
  showFeedbackAgentWarning
  showFullInboxWarning
  canMessage
  isReadReceiptActivated
  correspondent {
    ...CorrespondentFragment
    __typename
  }
  messages {
    ...MessageFragment
    __typename
  }
  __typename
}

query WebConversationThread($targetId: ID!, $limit: Int, $before: String, $isPolled: Boolean) {
  me {
    id
    conversationThread(
      targetId: $targetId
      limit: $limit
      before: $before
      isPolled: $isPolled
    ) {
      ...ConversationThreadFragment
      __typename
    }
    __typename
  }
}`;

    const variables = {
        targetId: targetId,
        isPolled: false,
        ...(limit && { limit }),
        ...(before && { before })
    };

    try {
        console.log('[Cupid Enhanced] Fetching conversation thread for:', targetId);
        const result = await okcupidGraphQL('WebConversationThread', query, variables);
        console.log('[Cupid Enhanced] Conversation Thread Response:', result);

        if (result?.data?.me?.conversationThread) {
            const thread = result.data.me.conversationThread;
            const correspondent = thread.correspondent;
            const messages = thread.messages || [];

            console.log('[Cupid Enhanced] ═══════════════════════════════════════');
            console.log('[Cupid Enhanced] Conversation with:', correspondent?.user?.displayname);
            console.log('[Cupid Enhanced] User ID:', correspondent?.user?.id);
            console.log('[Cupid Enhanced] Match %:', correspondent?.matchPercent);
            console.log('[Cupid Enhanced] Mutual Like:', correspondent?.isMutualLike);
            console.log('[Cupid Enhanced] Can Message:', thread.canMessage);
            console.log('[Cupid Enhanced] Read Receipt Active:', thread.isReadReceiptActivated);
            console.log('[Cupid Enhanced] Total Messages:', thread.pageInfo?.total);
            console.log('[Cupid Enhanced] ───────────────────────────────────────');

            // Display messages in a readable format (reverse to show oldest first)
            const sortedMessages = [...messages].reverse();
            sortedMessages.forEach((msg) => {
                const isFromMe = msg.senderId === result.data.me.id;
                const direction = isFromMe ? '→ You' : '← Them';
                const time = new Date(msg.time).toLocaleString();
                console.log(`[Cupid Enhanced] ${direction} (${time}): ${msg.text}`);
            });

            console.log('[Cupid Enhanced] ═══════════════════════════════════════');

            if (thread.pageInfo?.hasMore) {
                const oldestMsg = messages[messages.length - 1];
                console.log('[Cupid Enhanced] More messages available. Use before:', oldestMsg?.id);
            }
        }

        return result;
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to get conversation thread:', error.message);
        throw error;
    }
}

// =============================================================================
// Event Listeners Setup
// =============================================================================

function setupEventListeners() {
    setupKeyboardShortcuts();
    listenForLikesData();
    listenForSettingsUpdates();
    startLikesCountPolling();
    setupPassButtonListener();
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'Enter') {
            const sendLikeButton = document.querySelector(SELECTORS.sendButton);
            sendLikeButton?.click();
            if (sendLikeButton) event.preventDefault();
        }
    });
}

function setupPassButtonListener() {
    document.addEventListener('click', (event) => {
        const actionButton = event.target.closest(SELECTORS.actionButton);
        if (actionButton) {
            resetPhotoDateDisplay();
            resetLikesDataDisplay();
        }
    });
}

function resetLikesDataDisplay() {
    const likesRemainingElement = document.getElementById('likes-remaining');
    const likesResetTimeElement = document.getElementById('likes-reset-time');
    if (likesRemainingElement) likesRemainingElement.textContent = 'Likes Remaining: Loading...';
    if (likesResetTimeElement) likesResetTimeElement.textContent = 'Next Likes Reset: Loading...';
}

function resetPhotoDateDisplay() {
    const newestElement = document.getElementById('newest-photo-date');
    const oldestElement = document.getElementById('oldest-photo-date');
    setPhotoDateText(newestElement, oldestElement, 'Loading...');
}

// =============================================================================
// Style Injection Helpers
// =============================================================================

function injectStyles(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
}

function removeStyles(id) {
    document.getElementById(id)?.remove();
}

// =============================================================================
// Dark Mode
// =============================================================================

function enableDarkMode() {
    injectStyles('cupid-dark-mode-styles', DARK_MODE_STYLES);
}

function disableDarkMode() {
    removeStyles('cupid-dark-mode-styles');
}

// =============================================================================
// Likes Data Handling
// =============================================================================

function listenForLikesData() {
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;

        const { type, count, time } = event.data;

        if (type === 'LIKES_REMAINING_COUNT') {
            localStorage.setItem(STORAGE_KEYS.likesRemaining, count);
            updateElementText('likes-remaining', `Likes Remaining: ${count} (max 500)`);
        }

        if (type === 'LIKES_RESET_TIME') {
            const readableTime = new Date(time).toLocaleString();
            localStorage.setItem(STORAGE_KEYS.likesResetTime, readableTime);
            updateElementText('likes-reset-time', `Next Likes Reset: ${readableTime}`);
        }
    });
}

function updateElementText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

// =============================================================================
// Horizontal Scroll
// =============================================================================

function setupHorizontalScroll() {
    const scrollHandler = (event) => {
        if (!currentSettings.horizontalScroll) return;

        // Check if we're in the fullscreen photo modal
        const fullscreenModal = document.querySelector('#OkModal .photo-overlay-images');
        if (fullscreenModal) {
            handleFullscreenPhotoScroll(event);
            return;
        }

        // Default discover page horizontal scroll
        if (event.deltaY !== 0) return;

        const button = event.deltaX < 0
            ? document.querySelector(SELECTORS.prevButton)
            : document.querySelector(SELECTORS.nextButton);

        button?.click();
    };

    window.addEventListener('wheel', scrollHandler, { passive: false });
    observers.horizontalScroll = {
        disconnect: () => window.removeEventListener('wheel', scrollHandler, { passive: false })
    };
}

function handleFullscreenPhotoScroll(event) {
    // Only handle horizontal scroll in fullscreen modal
    if (event.deltaX === 0) return;

    event.preventDefault();

    // Emulate left/right arrow key press
    const keyCode = event.deltaX > 0 ? 'ArrowRight' : 'ArrowLeft';

    const keyEvent = new KeyboardEvent('keydown', {
        key: keyCode,
        code: keyCode,
        bubbles: true,
        cancelable: true
    });

    document.dispatchEvent(keyEvent);
}

// =============================================================================
// Settings Management
// =============================================================================

async function loadSettings() {
    const result = await chrome.storage.local.get([SETTINGS_KEY]);
    currentSettings = { ...DEFAULT_SETTINGS, ...result[SETTINGS_KEY] };
    sendSettingsToMainWorld();
}

function sendSettingsToMainWorld() {
    window.postMessage({ type: 'SETTINGS_TO_MAIN', settings: currentSettings }, '*');
}

function listenForSettingsUpdates() {
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'SETTINGS_UPDATED') {
            currentSettings = message.settings;
            sendSettingsToMainWorld();
            applySettings();
        }
    });

    window.addEventListener('message', async (event) => {
        if (event.source !== window) return;

        if (event.data.type === 'REQUEST_SETTINGS') {
            sendSettingsToMainWorld();
        }

        // Forward captured headers from MAIN world to background service worker
        if (event.data.type === 'OKCUPID_HEADERS_CAPTURED') {
            chrome.runtime.sendMessage({
                type: 'OKCUPID_HEADERS_UPDATE',
                headers: event.data.headers
            }).catch(err => {
                // Ignore errors when background is not ready
                console.debug('[Cupid Enhanced] Header update pending:', err.message);
            });
        }

        // Handle Console API requests from MAIN world
        if (event.data.type === 'CUPID_API_REQUEST') {
            const { id, action, payload } = event.data;

            try {
                let result;

                switch (action) {
                    case 'getTokenCounts':
                        result = await getTokenCounts();
                        break;
                    case 'getLikesCap':
                        result = await getLikesCap();
                        break;
                    case 'getFeaturedQuestion':
                        result = await getFeaturedQuestion(payload.excludedUserIds);
                        break;
                    case 'getMatchProfile':
                        result = await getMatchProfile(payload.targetId);
                        break;
                    case 'getConversationThread':
                        result = await getConversationThread(payload.targetId, payload.limit, payload.before);
                        break;
                    case 'vote':
                        result = await voteOnUser(payload.targetId, payload.vote, payload.voteSource);
                        break;
                    case 'graphQL':
                        result = await okcupidGraphQL(payload.operationName, payload.query, payload.variables);
                        break;
                    case 'request':
                        result = await okcupidAPI(payload.url, payload.options);
                        break;
                    default:
                        throw new Error(`Unknown action: ${action}`);
                }

                window.postMessage({
                    type: 'CUPID_API_RESPONSE',
                    id,
                    success: true,
                    data: result
                }, '*');
            } catch (error) {
                window.postMessage({
                    type: 'CUPID_API_RESPONSE',
                    id,
                    success: false,
                    error: error.message
                }, '*');
            }
        }
    });
}

function applySettings() {
    Object.values(observers).forEach(observer => observer?.disconnect());
    observers = {};

    currentSettings.darkMode ? enableDarkMode() : disableDarkMode();

    setupObservers();
}

// =============================================================================
// Observer Setup
// =============================================================================

function setupObservers() {
    const observerConfig = [
        { key: 'discoverPage', setting: 'enhanceDiscoverPage', fn: enhanceDiscoverPage },
        { key: 'likesYouPage', setting: 'enhanceLikesYouPage', fn: enhanceLikesYouPage }
    ];

    observerConfig.forEach(({ key, setting, fn }) => {
        if (currentSettings[setting]) {
            observers[key] = fn();
        }
    });

    // Features that are always enabled
    observers.premiumAds = blockPremiumAds();

    if (currentSettings.horizontalScroll) {
        setupHorizontalScroll();
    }

    // Always observe for fullscreen photo overlay (works on all pages)
    observers.fullscreenPhotos = setupFullscreenPhotoObserver();
}

function setupFullscreenPhotoObserver() {
    let debounceTimer = null;

    return createBodyObserver(() => {
        const photoOverlay = document.querySelector('#OkModal .photo-overlay-images');
        if (!photoOverlay) return;

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            displayPhotoDatesOnFullscreenImages();
        }, 100);
    });
}

function createBodyObserver(callback) {
    const observer = new MutationObserver(callback);
    observer.observe(document.body, { childList: true, subtree: true });
    return observer;
}

// =============================================================================
// Likes Count UI
// =============================================================================

function updateLikesIncomingCount() {
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.likesCount) || '0', 10);
    if (count > 0) updateLikesUI(count);
}

function updateLikesUI(count) {
    const likesElement = document.querySelector(SELECTORS.likesCount);
    if (likesElement) {
        likesElement.textContent = count;
        replaceInterestWithLikes();
    }
}

function replaceInterestWithLikes() {
    document.querySelectorAll(SELECTORS.navbarLinkText).forEach(element => {
        if (element.textContent.includes('Interest')) {
            element.textContent = 'Likes';
        }
    });
}

function startLikesCountPolling() {
    setInterval(() => {
        updateLikesIncomingCount();
    }, 2000);
}

// =============================================================================
// Discover Page Enhancement
// =============================================================================

function enhanceDiscoverPage() {
    let debounceTimer = null;

    return createBodyObserver(() => {
        if (!currentSettings.enhanceDiscoverPage) return;

        applyStylesToElements(DISCOVER_PAGE_ENHANCEMENTS);
        displayPhotoDatesOnImages();

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(addCupidEnhancedSection, 300);
    });
}

function enhanceLikesYouPage() {
    if (!currentSettings.enhanceLikesYouPage) return;

    injectStyles('cupid-likes-you-styles', LIKES_YOU_STYLES);

    return {
        disconnect: () => removeStyles('cupid-likes-you-styles')
    };
}

function applyStylesToElements(enhancements) {
    enhancements.forEach(({ selector, styles }) => {
        document.querySelectorAll(selector).forEach(el => Object.assign(el.style, styles));
    });
}

// =============================================================================
// Image Metadata
// =============================================================================

function getBaseImageUrl(url) {
    return url.split('?')[0];
}

function getCurrentUserId() {
    return document.querySelector(SELECTORS.discoverWrapper)?.getAttribute('data-user-id') || null;
}

function getDiscoverPagePhotoUrls() {
    const photoContainer = document.querySelector(SELECTORS.photoContainer);
    if (!photoContainer) return [];

    const urls = [];
    photoContainer.querySelectorAll('[style*="background-image"]').forEach(element => {
        const match = (element.getAttribute('style') || '').match(BACKGROUND_IMAGE_REGEX);
        if (match?.[1]) urls.push(match[1]);
    });

    return [...new Set(urls)];
}

// Fetch only headers (not image body) to get Last-Modified date
async function fetchImageLastModified(imageUrl) {
    try {
        const response = await fetch(imageUrl, { method: 'HEAD' });
        return response.headers.get('Last-Modified');
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to fetch headers:', imageUrl, error);
        return null;
    }
}

async function fetchAllImageMetadata() {
    if (isFetchingMetadata) return;

    const currentUserId = getCurrentUserId();

    if (currentUserId && currentUserId === lastFetchedUserId) {
        updatePhotoDateDisplay();
        return;
    }

    const photoUrls = getDiscoverPagePhotoUrls();
    if (photoUrls.length === 0) return;

    isFetchingMetadata = true;

    if (currentUserId !== lastFetchedUserId) {
        imageMetadataCache = {};
        lastFetchedUserId = currentUserId;
    }

    try {
        const results = await Promise.all(
            photoUrls.map(async (url) => ({
                url: getBaseImageUrl(url),
                lastModified: await fetchImageLastModified(url)
            }))
        );

        results.forEach(({ url, lastModified }) => {
            if (lastModified) imageMetadataCache[url] = lastModified;
        });

        updatePhotoDateDisplay();
        displayPhotoDatesOnImages();
    } finally {
        isFetchingMetadata = false;
    }
}

function updatePhotoDateDisplay() {
    const newestElement = document.getElementById('newest-photo-date');
    const oldestElement = document.getElementById('oldest-photo-date');

    if (!newestElement || !oldestElement) return;

    const photoUrls = getDiscoverPagePhotoUrls().map(getBaseImageUrl);

    if (photoUrls.length === 0) {
        setPhotoDateText(newestElement, oldestElement, 'No photos found');
        return;
    }

    const photoDates = photoUrls
        .map(url => imageMetadataCache[url])
        .filter(Boolean)
        .map(lastModified => new Date(lastModified))
        .sort((a, b) => a - b);

    if (photoDates.length === 0) {
        setPhotoDateText(newestElement, oldestElement, 'Loading...');
        return;
    }

    const formatDate = (date) => date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    setPhotoDateText(newestElement, oldestElement, formatDate(photoDates.at(-1)), formatDate(photoDates[0]));
}

function setPhotoDateText(newestEl, oldestEl, newestStatus, oldestStatus = newestStatus) {
    if (!newestEl || !oldestEl) return;
    newestEl.textContent = `Newest Photo Upload: ${newestStatus}`;
    oldestEl.textContent = `Oldest Photo Upload: ${oldestStatus}`;
}

function displayPhotoDatesOnImages() {
    const photoWrappers = document.querySelectorAll('.dt-photo');

    photoWrappers.forEach(wrapper => {
        const imageEl = wrapper.querySelector('[style*="background-image"]');
        if (!imageEl) return;

        const match = (imageEl.getAttribute('style') || '').match(BACKGROUND_IMAGE_REGEX);
        if (!match || !match[1]) return;

        const url = getBaseImageUrl(match[1]);
        const lastModified = imageMetadataCache[url];

        if (lastModified) {
            const date = new Date(lastModified);
            const dateString = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            let label = wrapper.querySelector('.cupid-photo-date');
            if (!label) {
                label = document.createElement('div');
                label.className = 'cupid-photo-date';
                label.style.cssText = `
                    position: absolute;
                    bottom: 10px;
                    left: 17%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: bold;
                    pointer-events: none;
                    z-index: 100;
                    white-space: nowrap;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                `;
                wrapper.style.position = 'relative';
                wrapper.appendChild(label);
            }

            if (label.textContent !== dateString) {
                label.textContent = dateString;
            }
        }
    });
}

async function displayPhotoDatesOnFullscreenImages() {
    const photoOverlay = document.querySelector('#OkModal .photo-overlay-images');
    if (!photoOverlay) return;

    const slides = photoOverlay.querySelectorAll('[aria-label^="Slide image"]');

    for (const slide of slides) {
        const imageContainer = slide.querySelector('div[class*="Yb6VSqG3RppfEoug5fci"]');
        if (!imageContainer) continue;

        const imgEl = imageContainer.querySelector('img[src*="pictures.match.com"]');
        if (!imgEl) continue;

        // Get the button that contains the image
        const buttonEl = imgEl.closest('button');
        if (!buttonEl) continue;

        const url = getBaseImageUrl(imgEl.src);

        // Fetch metadata if not already cached
        if (!imageMetadataCache[url]) {
            const lastModified = await fetchImageLastModified(imgEl.src);
            if (lastModified) {
                imageMetadataCache[url] = lastModified;
            }
        }

        const lastModified = imageMetadataCache[url];

        if (lastModified) {
            const date = new Date(lastModified);
            const dateString = date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            let label = buttonEl.querySelector('.cupid-photo-date-fullscreen');
            if (!label) {
                label = document.createElement('div');
                label.className = 'cupid-photo-date-fullscreen';
                label.style.cssText = PHOTO_DATE_LABEL_STYLES;
                buttonEl.style.position = 'relative';
                buttonEl.appendChild(label);
            }

            if (label.textContent !== dateString) {
                label.textContent = dateString;
            }
        }
    }
}

// =============================================================================
// Cupid Enhanced Section
// =============================================================================

async function saveVisitedProfile(userId, photoUrl, name, age, location) {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.visitedProfiles]);
        let profiles = result[STORAGE_KEYS.visitedProfiles] || [];

        // Remove existing entry for this user (handling both string and object formats)
        profiles = profiles.filter(p => {
            const id = (typeof p === 'object' && p !== null) ? p.userId : p;
            return id !== userId;
        });

        profiles.push({ userId, photoUrl, name, age, location, timestamp: Date.now() });
        await chrome.storage.local.set({ [STORAGE_KEYS.visitedProfiles]: profiles });
    } catch (error) {
        // Extension context may be invalidated after reload
        console.error('[Cupid Enhanced] Could not save visited profile:', error.message);
    }
}

function addCupidEnhancedSection() {
    const rightPanel = document.querySelector(SELECTORS.rightPanel);
    if (!rightPanel) return;

    const currentUserId = getCurrentUserId();
    if (currentUserId) {
        const photoUrls = getDiscoverPagePhotoUrls();
        const firstPhotoUrl = photoUrls.length > 0 ? getBaseImageUrl(photoUrls[0]) : null;

        const nameElement = document.querySelector('.card-content-header__text');
        const name = nameElement ? nameElement.textContent.trim() : null;

        const locationElement = document.querySelector('.card-content-header__location');
        let age = null;
        let location = null;
        if (locationElement) {
            const text = locationElement.textContent.trim();
            const parts = text.split('•').map(s => s.trim());
            if (parts.length > 0) age = parts[0];
            if (parts.length > 1) location = parts[1];
        }

        saveVisitedProfile(currentUserId, firstPhotoUrl, name, age, location);
    }

    const needsFetch = currentUserId && currentUserId !== lastFetchedUserId;

    if (document.querySelector(SELECTORS.cupidSection)) {
        if (needsFetch && !isFetchingMetadata) fetchAllImageMetadata();
        return;
    }

    const section = createCupidSection();
    rightPanel.insertBefore(section, rightPanel.firstChild);
    fetchAllImageMetadata();
}

function createCupidSection() {
    const section = document.createElement('div');
    section.className = 'dt-section cupid-enhanced-section';

    const title = document.createElement('h3');
    title.className = 'dt-section-title';
    title.textContent = 'Cupid Enhanced';

    const likesRemaining = localStorage.getItem(STORAGE_KEYS.likesRemaining) || 'Make first vote to display';
    const likesResetTime = localStorage.getItem(STORAGE_KEYS.likesResetTime) || 'Make first vote to display';

    if (likesResetTime < Date.now()) {
        likesResetTime = 'Reset time passed, make a vote to update';
        likesRemaining = 'Make vote to display';
    }

    const content = document.createElement('div');
    content.className = 'dt-section-content';
    content.innerHTML = `
        <div class="matchprofile-details-text" id="newest-photo-date">Newest Photo Upload: Loading...</div>
        <div class="matchprofile-details-text" id="oldest-photo-date">Oldest Photo Upload: Loading...</div>
        <div class="matchprofile-details-text" id="likes-remaining">Likes Remaining: ${likesRemaining} (max 500)</div>
        <div class="matchprofile-details-text" id="likes-reset-time">Next Likes Reset: ${likesResetTime}</div>
    `;

    section.append(title, content);
    return section;
}

// =============================================================================
// Premium Ads Blocking
// =============================================================================

function blockPremiumAds() {
    return createBodyObserver(() => {
        PREMIUM_AD_SELECTORS.forEach(selector => {
            document.querySelectorAll(selector).forEach(element => {
                if (element.style.display !== 'none') {
                    element.style.display = 'none';
                }
            });
        });
    });
}
