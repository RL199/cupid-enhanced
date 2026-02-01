'use strict';

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

    console.log(logo, 'color: #ff1493; font-weight: bold;');
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

    // Initialize photo upload feature
    initPhotoUpload();

    // Fetch and display likes cap data after a short delay to allow headers to be captured
    setTimeout(fetchAndDisplayLikesCap, 100);
}

/**
 * Fetch likes cap data and update the UI on page load
 * Retrieves current likes remaining and reset time from OkCupid API
 * and displays them in the extension UI
 */
async function fetchAndDisplayLikesCap() {
    try {
        const result = await getLikesCap();

        if (result?.data?.me?.likesCap) {
            const likesCap = result.data.me.likesCap;

            // Update the UI with initial likes data
            if (likesCap.likesRemaining !== undefined) {
                localStorage.setItem(STORAGE_KEYS.likesRemaining, likesCap.likesRemaining);
                updateElementText('likes-remaining', `Likes Remaining: ${likesCap.likesRemaining} (max 500)`);
            }

            if (likesCap.resetTime) {
                const readableTime = new Date(likesCap.resetTime).toLocaleString();
                localStorage.setItem(STORAGE_KEYS.likesResetTime, readableTime);
                updateElementText('likes-reset-time', `Next Likes Reset: ${readableTime}`);
            }
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
            sortedMessages.forEach(msg => {
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

/**
 * Get all conversations and matches (Messages Main)
 * Fetches the list of all conversations, matches, and intros
 *
 * @param {string} userId - The current user's ID (required)
 * @param {string} filter - Filter type: 'ALL', 'REPLIES', 'MATCHES' (default: 'ALL')
 * @param {string} after - Pagination cursor for more results (optional)
 * @returns {Promise<object>} Conversations and matches data
 *
 * @example
 * // Get all messages for current user
 * const messages = await getMessagesMain('14cAht3gR2YjiDMvh6cvYA2');
 *
 * @example
 * // Get messages where it's your turn to reply
 * const yourTurn = await getMessagesMain('14cAht3gR2YjiDMvh6cvYA2', 'REPLIES');
 */
async function getMessagesMain(userId, filter = 'ALL', after = null) {
    const query = `fragment UserPrimaryImagesFragment on User {
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

fragment ConversationMatch on Match {
  senderLikeTime
  senderVote
  targetLikeTime
  targetVote
  targetLikeViaSpotlight
  targetLikeViaSuperBoost
  senderMessageTime
  targetMessageTime
  matchPercent
  user {
    id
    displayname
    username
    age
    isOnline
    ...UserPrimaryImagesFragment
    __typename
  }
  __typename
}

fragment ConversationFragment on Conversation {
  threadid
  time
  isUnread
  sentTime
  receivedTime
  status
  correspondent {
    ...ConversationMatch
    __typename
  }
  snippet {
    text
    sender {
      id
      __typename
    }
    __typename
  }
  attachmentPreviews {
    ... on ReactionUpdate {
      originalMessage
      reaction
      updateType
      __typename
    }
    ... on GifAttachmentPreview {
      id
      __typename
    }
    ... on PhotoAttachmentPreview {
      id
      __typename
    }
    __typename
  }
  __typename
}

fragment MutualMatchFragment on MutualMatch {
  status
  isUnread
  match {
    ...ConversationMatch
    __typename
  }
  __typename
}

fragment NotificationCountsFragment on User {
  notificationCounts {
    likesMutual
    likesIncoming
    likesAndViews
    messages
    intros
    __typename
  }
  __typename
}

fragment ConversationsAndMatches on User {
  ...NotificationCountsFragment
  conversationsAndMatches(filter: $filter, after: $after) {
    data {
      ...ConversationFragment
      ...MutualMatchFragment
      __typename
    }
    pageInfo {
      hasMore
      after
      total
      __typename
    }
    __typename
  }
  __typename
}

query WebGetMessagesMain($userid: String!, $filter: ConversationsAndMatchesFilter!, $after: String) {
  user(id: $userid) {
    id
    ...ConversationsAndMatches
    __typename
  }
}`;

    const variables = {
        userid: userId,
        filter: filter,
        ...(after && { after })
    };

    try {
        console.log('[Cupid Enhanced] Fetching messages main for user:', userId, 'filter:', filter);
        const result = await okcupidGraphQL('WebGetMessagesMain', query, variables);
        console.log('[Cupid Enhanced] Messages Main Response:', result);

        if (result?.data?.user) {
            const userData = result.data.user;
            const conversationsData = userData.conversationsAndMatches;
            const notifications = userData.notificationCounts;

            console.log('[Cupid Enhanced] ═══════════════════════════════════════');
            console.log('[Cupid Enhanced] Messages Main Summary');
            console.log('[Cupid Enhanced] ───────────────────────────────────────');
            console.log('[Cupid Enhanced] Notification Counts:');
            console.log('[Cupid Enhanced]   - Mutual Likes:', notifications?.likesMutual ?? 'N/A');
            console.log('[Cupid Enhanced]   - Incoming Likes:', notifications?.likesIncoming ?? 'N/A');
            console.log('[Cupid Enhanced]   - Messages:', notifications?.messages ?? 'N/A');
            console.log('[Cupid Enhanced]   - Intros:', notifications?.intros ?? 'N/A');
            console.log('[Cupid Enhanced] ───────────────────────────────────────');

            const items = conversationsData?.data || [];
            console.log('[Cupid Enhanced] Total Items:', conversationsData?.pageInfo?.total ?? items.length);
            console.log('[Cupid Enhanced] Has More:', conversationsData?.pageInfo?.hasMore ?? false);

            if (items.length > 0) {
                console.log('[Cupid Enhanced] ───────────────────────────────────────');
                console.log('[Cupid Enhanced] Conversations/Matches:');
                items.forEach((item, index) => {
                    if (item.__typename === 'Conversation') {
                        const correspondent = item.correspondent;
                        const user = correspondent?.user;
                        const unread = item.isUnread ? ' [UNREAD]' : '';
                        console.log(
                            `[Cupid Enhanced] ${index + 1}. ${user?.displayname || 'Unknown'} (${user?.age || '?'})${unread}`
                        );
                        console.log(
                            `[Cupid Enhanced]    ID: ${user?.id || 'N/A'}, Match: ${correspondent?.matchPercent || 0}%`
                        );
                        console.log(`[Cupid Enhanced]    Last: "${item.snippet?.text?.substring(0, 50) || ''}..."`);
                    } else if (item.__typename === 'MutualMatch') {
                        const match = item.match;
                        const user = match?.user;
                        const unread = item.isUnread ? ' [UNREAD]' : '';
                        console.log(
                            `[Cupid Enhanced] ${index + 1}. [MATCH] ${user?.displayname || 'Unknown'} (${user?.age || '?'})${unread}`
                        );
                        console.log(
                            `[Cupid Enhanced]    ID: ${user?.id || 'N/A'}, Match: ${match?.matchPercent || 0}%`
                        );
                    }
                });
            }

            console.log('[Cupid Enhanced] ═══════════════════════════════════════');

            if (conversationsData?.pageInfo?.hasMore && conversationsData?.pageInfo?.after) {
                console.log('[Cupid Enhanced] More items available. Use after:', conversationsData.pageInfo.after);
            }
        }

        return result;
    } catch (error) {
        console.error('[Cupid Enhanced] Failed to get messages main:', error.message);
        throw error;
    }
}

// =============================================================================
// Photo Upload Feature
// =============================================================================

// Current user ID (will be populated from API responses)
let currentUserId = null;

/**
 * Upload a photo to OkCupid via background script
 * @param {File} file - The image file to upload
 * @param {object} settings - Upload settings
 * @param {number} settings.maxDimension - Max dimension in pixels
 * @param {number} settings.quality - Quality 0-1
 * @param {string} settings.outputFormat - Output MIME type
 * @returns {Promise<object>} Upload result
 */
async function uploadPhotoToOkCupid(file, settings) {
    const { maxDimension, quality, outputFormat } = settings;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                // Load the image to get dimensions and resize if needed
                const img = new Image();
                img.onload = async () => {
                    // Create canvas for resizing
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // Calculate new dimensions (maintain aspect ratio)
                    let { width, height } = img;

                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round((height / width) * maxDimension);
                            width = maxDimension;
                        } else {
                            width = Math.round((width / height) * maxDimension);
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // Draw image with high quality
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    ctx.drawImage(img, 0, 0, width, height);

                    // Determine file extension based on format
                    const extMap = {
                        'image/jpeg': '.jpg',
                        'image/png': '.png',
                        'image/webp': '.webp'
                    };
                    const ext = extMap[outputFormat] || '.jpg';

                    // Convert to blob
                    canvas.toBlob(
                        async blob => {
                            try {
                                // Convert blob to base64
                                const base64Reader = new FileReader();
                                base64Reader.onload = async () => {
                                    const base64Data = base64Reader.result.split(',')[1];

                                    // Get user ID
                                    const userId = await getCurrentUserId();
                                    if (!userId) {
                                        reject(new Error('Could not determine user ID. Please refresh the page.'));
                                        return;
                                    }

                                    // Send to background script for upload
                                    chrome.runtime.sendMessage(
                                        {
                                            type: 'UPLOAD_PHOTO',
                                            photoData: {
                                                imageBase64: base64Data,
                                                mimeType: outputFormat,
                                                filename: file.name.replace(/\.[^.]+$/, ext),
                                                userId: userId,
                                                width: width,
                                                height: height
                                            }
                                        },
                                        response => {
                                            if (chrome.runtime.lastError) {
                                                reject(new Error(chrome.runtime.lastError.message));
                                            } else if (response?.success) {
                                                resolve(response);
                                            } else {
                                                reject(new Error(response?.error || 'Upload failed'));
                                            }
                                        }
                                    );
                                };
                                base64Reader.onerror = () => reject(new Error('Failed to encode image'));
                                base64Reader.readAsDataURL(blob);
                            } catch (error) {
                                reject(error);
                            }
                        },
                        outputFormat,
                        quality
                    );
                };

                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Get the current user's ID
 * @returns {Promise<string|null>} User ID or null
 */
async function getCurrentUserId() {
    if (currentUserId) return currentUserId;
    return null;
}

/**
 * Create and inject the photo upload UI
 */
function createPhotoUploadUI() {
    // Don't create if already exists
    if (document.getElementById('cupid-photo-upload-container')) return;

    // Create floating upload button
    const uploadButton = document.createElement('button');
    uploadButton.id = 'cupid-photo-upload-btn';
    uploadButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>Upload Photo</span>
    `;
    uploadButton.title = 'Upload High Resolution Photo (Cupid Enhanced)';

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'cupid-photo-input';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';

    // Create modal for preview/upload
    const modal = document.createElement('div');
    modal.id = 'cupid-photo-upload-modal';
    modal.innerHTML = `
        <div class="cupid-modal-content">
            <div class="cupid-modal-header">
                <h3>Upload High Resolution Photo</h3>
                <button class="cupid-modal-close">&times;</button>
            </div>
            <div class="cupid-modal-body">
                <div class="cupid-preview-area" id="cupid-preview-area">
                    <p>Select an image to preview</p>
                </div>
                <div class="cupid-upload-info" id="cupid-upload-info"></div>
                <div class="cupid-upload-settings">
                    <div class="cupid-setting-row">
                        <label for="cupid-max-dimension">Max Dimension (px):</label>
                        <input type="number" id="cupid-max-dimension" value="10000" min="100" max="20000" step="100">
                    </div>
                    <div class="cupid-setting-row">
                        <label for="cupid-quality">Quality (%):</label>
                        <input type="number" id="cupid-quality" value="100" min="10" max="100" step="5">
                    </div>
                    <div class="cupid-setting-row">
                        <label for="cupid-format">Output Format:</label>
                        <select id="cupid-format">
                            <option value="image/jpeg">JPEG</option>
                            <option value="image/png">PNG</option>
                            <option value="image/webp">WebP</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="cupid-modal-footer">
                <button class="cupid-btn cupid-btn-secondary" id="cupid-select-file-btn">Select Image</button>
                <button class="cupid-btn cupid-btn-primary" id="cupid-upload-btn" disabled>Upload</button>
            </div>
        </div>
    `;

    // Create container
    const container = document.createElement('div');
    container.id = 'cupid-photo-upload-container';
    container.appendChild(uploadButton);
    container.appendChild(fileInput);
    container.appendChild(modal);

    document.body.appendChild(container);

    // Inject styles
    injectPhotoUploadStyles();

    // Setup event handlers
    setupPhotoUploadEvents(uploadButton, fileInput, modal);
}

/**
 * Inject CSS styles for the photo upload UI
 */
function injectPhotoUploadStyles() {
    if (document.getElementById('cupid-photo-upload-styles')) return;

    const styles = `
        #cupid-photo-upload-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 20px;
            background: linear-gradient(135deg, #ff1493, #ff69b4);
            color: white;
            border: none;
            border-radius: 50px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(255, 20, 147, 0.4);
            transition: all 0.3s ease;
        }

        #cupid-photo-upload-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(255, 20, 147, 0.5);
        }

        #cupid-photo-upload-btn:active {
            transform: translateY(0);
        }

        #cupid-photo-upload-btn svg {
            width: 20px;
            height: 20px;
        }

        #cupid-photo-upload-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            z-index: 10001;
            justify-content: center;
            align-items: center;
        }

        #cupid-photo-upload-modal.active {
            display: flex;
        }

        .cupid-modal-content {
            background: #1a1a1a;
            border-radius: 16px;
            width: 90%;
            max-width: 500px;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
        }

        .cupid-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #333;
            flex-shrink: 0;
        }

        .cupid-modal-header h3 {
            margin: 0;
            color: #fff;
            font-size: 18px;
        }

        .cupid-modal-close {
            background: none;
            border: none;
            color: #888;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            line-height: 1;
        }

        .cupid-modal-close:hover {
            color: #fff;
        }

        .cupid-modal-body {
            padding: 20px;
            overflow-y: auto;
            flex: 1;
        }

        .cupid-preview-area {
            width: 100%;
            min-height: 150px;
            max-height: 300px;
            border: 2px dashed #444;
            border-radius: 12px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            background: #0d0d0d;
        }

        .cupid-preview-area p {
            color: #666;
            font-size: 14px;
        }

        .cupid-preview-area img {
            max-width: 100%;
            max-height: 400px;
            object-fit: contain;
        }

        .cupid-upload-info {
            margin-top: 15px;
            padding: 12px;
            background: #252525;
            border-radius: 8px;
            font-size: 13px;
            color: #aaa;
        }

        .cupid-upload-info:empty {
            display: none;
        }

        .cupid-upload-settings {
            margin-top: 15px;
            padding: 15px;
            background: #252525;
            border-radius: 8px;
        }

        .cupid-setting-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
        }

        .cupid-setting-row:last-child {
            margin-bottom: 0;
        }

        .cupid-setting-row label {
            color: #ccc;
            font-size: 13px;
        }

        .cupid-setting-row input,
        .cupid-setting-row select {
            width: 120px;
            padding: 8px 10px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 6px;
            color: #fff;
            font-size: 13px;
        }

        .cupid-setting-row input:focus,
        .cupid-setting-row select:focus {
            outline: none;
            border-color: #ff1493;
        }

        .cupid-modal-footer {
            display: flex;
            gap: 12px;
            padding: 20px;
            border-top: 1px solid #333;
            flex-shrink: 0;
            background: #1a1a1a;
        }

        .cupid-btn {
            flex: 1;
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .cupid-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .cupid-btn-secondary {
            background: #333;
            color: #fff;
        }

        .cupid-btn-secondary:hover:not(:disabled) {
            background: #444;
        }

        .cupid-btn-primary {
            background: linear-gradient(135deg, #ff1493, #ff69b4);
            color: #fff;
        }

        .cupid-btn-primary:hover:not(:disabled) {
            box-shadow: 0 4px 15px rgba(255, 20, 147, 0.4);
        }

        .cupid-upload-progress {
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            margin-top: 10px;
            overflow: hidden;
        }

        .cupid-upload-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #ff1493, #ff69b4);
            width: 0%;
            transition: width 0.3s ease;
        }

        .cupid-upload-status {
            margin-top: 10px;
            padding: 10px;
            border-radius: 6px;
            font-size: 13px;
        }

        .cupid-upload-status.success {
            background: rgba(46, 204, 113, 0.2);
            color: #2ecc71;
        }

        .cupid-upload-status.error {
            background: rgba(231, 76, 60, 0.2);
            color: #e74c3c;
        }

        .cupid-upload-status.uploading {
            background: rgba(52, 152, 219, 0.2);
            color: #3498db;
        }
    `;

    const styleEl = document.createElement('style');
    styleEl.id = 'cupid-photo-upload-styles';
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
}

/**
 * Setup event handlers for photo upload UI
 */
function setupPhotoUploadEvents(uploadButton, fileInput, modal) {
    const previewArea = document.getElementById('cupid-preview-area');
    const uploadInfo = document.getElementById('cupid-upload-info');
    const selectFileBtn = document.getElementById('cupid-select-file-btn');
    const uploadBtn = document.getElementById('cupid-upload-btn');
    const closeBtn = modal.querySelector('.cupid-modal-close');
    const maxDimensionInput = document.getElementById('cupid-max-dimension');
    const qualityInput = document.getElementById('cupid-quality');
    const formatSelect = document.getElementById('cupid-format');

    let selectedFile = null;
    let originalImageDimensions = { width: 0, height: 0 };
    let originalImageDataUrl = null;
    let estimatedFileSize = null;

    // Helper to format file size
    const formatFileSize = bytes => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Helper to get current settings from inputs
    const getUploadSettings = () => ({
        maxDimension: parseInt(maxDimensionInput.value, 10) || 3000,
        quality: (parseInt(qualityInput.value, 10) || 95) / 100,
        outputFormat: formatSelect.value || 'image/jpeg'
    });

    // Helper to calculate final dimensions
    const calculateFinalDimensions = (origWidth, origHeight, maxDim) => {
        let width = origWidth;
        let height = origHeight;
        if (width > maxDim || height > maxDim) {
            if (width > height) {
                height = Math.round((height / width) * maxDim);
                width = maxDim;
            } else {
                width = Math.round((width / height) * maxDim);
                height = maxDim;
            }
        }
        return { width, height };
    };

    // Calculate estimated file size by rendering to canvas
    const calculateEstimatedSize = async () => {
        if (!originalImageDataUrl || !originalImageDimensions.width) return null;

        const settings = getUploadSettings();
        const { width, height } = calculateFinalDimensions(
            originalImageDimensions.width,
            originalImageDimensions.height,
            settings.maxDimension
        );

        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    blob => {
                        resolve(blob ? blob.size : null);
                    },
                    settings.outputFormat,
                    settings.quality
                );
            };
            img.onerror = () => resolve(null);
            img.src = originalImageDataUrl;
        });
    };

    // Helper to update the info display
    const updateInfoDisplay = async () => {
        if (!selectedFile || !originalImageDimensions.width) return;
        const settings = getUploadSettings();
        const { width, height } = calculateFinalDimensions(
            originalImageDimensions.width,
            originalImageDimensions.height,
            settings.maxDimension
        );
        const formatName =
            {
                'image/jpeg': 'JPEG',
                'image/png': 'PNG',
                'image/webp': 'WebP'
            }[settings.outputFormat] || 'JPEG';

        // Show loading state for file size
        uploadInfo.innerHTML = `
            <strong>File:</strong> ${selectedFile.name}<br>
            <strong>Original Size:</strong> ${originalImageDimensions.width} x ${originalImageDimensions.height} (${formatFileSize(selectedFile.size)})<br>
            <strong>Upload Size:</strong> ${width} x ${height}<br>
            <strong>Format:</strong> ${selectedFile.type} → ${formatName}<br>
            <strong>Quality:</strong> ${settings.quality * 100}%<br>
            <strong>Est. File Size:</strong> <em>Calculating...</em>
        `;

        // Calculate actual estimated size
        estimatedFileSize = await calculateEstimatedSize();

        uploadInfo.innerHTML = `
            <strong>File:</strong> ${selectedFile.name}<br>
            <strong>Original Size:</strong> ${originalImageDimensions.width} x ${originalImageDimensions.height} (${formatFileSize(selectedFile.size)})<br>
            <strong>Upload Size:</strong> ${width} x ${height}<br>
            <strong>Format:</strong> ${selectedFile.type} → ${formatName}<br>
            <strong>Quality:</strong> ${settings.quality * 100}%<br>
            <strong>Est. File Size:</strong> ${estimatedFileSize ? formatFileSize(estimatedFileSize) : 'Unknown'}
        `;
    };

    // Update info when settings change
    maxDimensionInput.addEventListener('change', updateInfoDisplay);
    qualityInput.addEventListener('change', updateInfoDisplay);
    formatSelect.addEventListener('change', updateInfoDisplay);

    // Open modal
    uploadButton.addEventListener('click', () => {
        modal.classList.add('active');
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        resetUploadUI();
    });

    // Close on backdrop click
    modal.addEventListener('click', e => {
        if (e.target === modal) {
            modal.classList.remove('active');
            resetUploadUI();
        }
    });

    // Select file button
    selectFileBtn.addEventListener('click', () => {
        fileInput.click();
    });

    // File selected
    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showUploadStatus('Please select an image file', 'error');
            return;
        }

        selectedFile = file;
        uploadBtn.disabled = false;

        // Show preview
        const reader = new FileReader();
        reader.onload = e => {
            originalImageDataUrl = e.target.result;
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Preview">`;

            // Get image dimensions and update info
            const img = new Image();
            img.onload = () => {
                originalImageDimensions = { width: img.width, height: img.height };
                updateInfoDisplay();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Upload button
    uploadBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        uploadBtn.disabled = true;
        selectFileBtn.disabled = true;
        showUploadStatus('Uploading photo...', 'uploading');

        try {
            const settings = getUploadSettings();
            const result = await uploadPhotoToOkCupid(selectedFile, settings);
            console.log('[Cupid Enhanced] Photo uploaded successfully:', result);
            showUploadStatus('Photo uploaded successfully! Refresh your profile to see it.', 'success');

            // Reset after success
            setTimeout(() => {
                modal.classList.remove('active');
                resetUploadUI();
            }, 2000);
        } catch (error) {
            console.error('[Cupid Enhanced] Upload failed:', error);
            showUploadStatus(`Upload failed: ${error.message}`, 'error');
            uploadBtn.disabled = false;
            selectFileBtn.disabled = false;
        }
    });

    function showUploadStatus(message, type) {
        let statusEl = modal.querySelector('.cupid-upload-status');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.className = 'cupid-upload-status';
            modal.querySelector('.cupid-modal-body').appendChild(statusEl);
        }
        statusEl.className = `cupid-upload-status ${type}`;
        statusEl.textContent = message;
    }

    function resetUploadUI() {
        selectedFile = null;
        originalImageDimensions = { width: 0, height: 0 };
        originalImageDataUrl = null;
        estimatedFileSize = null;
        fileInput.value = '';
        previewArea.innerHTML = '<p>Select an image to preview</p>';
        uploadInfo.innerHTML = '';
        uploadBtn.disabled = true;
        selectFileBtn.disabled = false;
        const statusEl = modal.querySelector('.cupid-upload-status');
        if (statusEl) statusEl.remove();
    }
}

/**
 * Initialize photo upload feature
 */
function initPhotoUpload() {
    // Only show if setting is enabled and on OkCupid
    if (currentSettings.photoUploadButton && window.location.hostname.includes('okcupid.com')) {
        createPhotoUploadUI();
        console.log('[Cupid Enhanced] Photo upload feature initialized');
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
    document.addEventListener('keydown', event => {
        if (event.ctrlKey && event.key === 'Enter') {
            const sendLikeButton = document.querySelector(SELECTORS.sendButton);
            sendLikeButton?.click();
            if (sendLikeButton) event.preventDefault();
        }
    });
}

function setupPassButtonListener() {
    document.addEventListener('click', event => {
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
    window.addEventListener('message', event => {
        if (event.source !== window) return;

        const { type, count, time, userId } = event.data;

        if (type === 'LIKES_REMAINING_COUNT') {
            localStorage.setItem(STORAGE_KEYS.likesRemaining, count);
            updateElementText('likes-remaining', `Likes Remaining: ${count} (max 500)`);
        }

        if (type === 'LIKES_RESET_TIME') {
            const readableTime = new Date(time).toLocaleString();
            localStorage.setItem(STORAGE_KEYS.likesResetTime, readableTime);
            updateElementText('likes-reset-time', `Next Likes Reset: ${readableTime}`);
        }

        // Capture user ID from API interceptor
        if (type === 'OKCUPID_USER_ID' && userId) {
            currentUserId = userId;
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
    const scrollHandler = event => {
        if (!currentSettings.horizontalScroll) return;

        // Check if we're in the fullscreen photo modal
        const fullscreenModal = document.querySelector('#OkModal .photo-overlay-images');
        if (fullscreenModal) {
            handleFullscreenPhotoScroll(event);
            return;
        }

        // Default discover page horizontal scroll
        if (event.deltaY !== 0) return;

        const button =
            event.deltaX < 0
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
    chrome.runtime.onMessage.addListener(message => {
        if (message.type === 'SETTINGS_UPDATED') {
            currentSettings = message.settings;
            sendSettingsToMainWorld();
            applySettings();
        }
    });

    window.addEventListener('message', async event => {
        if (event.source !== window) return;

        if (event.data.type === 'REQUEST_SETTINGS') {
            sendSettingsToMainWorld();
        }

        // Forward captured headers from MAIN world to background service worker
        if (event.data.type === 'OKCUPID_HEADERS_CAPTURED') {
            chrome.runtime
                .sendMessage({
                    type: 'OKCUPID_HEADERS_UPDATE',
                    headers: event.data.headers
                })
                .catch(err => {
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
                    case 'getMessagesMain':
                        result = await getMessagesMain(payload.userId, payload.filter, payload.after);
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

                window.postMessage(
                    {
                        type: 'CUPID_API_RESPONSE',
                        id,
                        success: true,
                        data: result
                    },
                    '*'
                );
            } catch (error) {
                window.postMessage(
                    {
                        type: 'CUPID_API_RESPONSE',
                        id,
                        success: false,
                        error: error.message
                    },
                    '*'
                );
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
    observers.doubleTakeButtons = setupDoubleTakeButtonsObserver();

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

function getCurrentUserIdFromDOM() {
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

    const userId = getCurrentUserIdFromDOM();

    if (userId && userId === lastFetchedUserId) {
        updatePhotoDateDisplay();
        return;
    }

    const photoUrls = getDiscoverPagePhotoUrls();
    if (photoUrls.length === 0) return;

    isFetchingMetadata = true;

    if (userId !== lastFetchedUserId) {
        imageMetadataCache = {};
        lastFetchedUserId = userId;
    }

    try {
        const results = await Promise.all(
            photoUrls.map(async url => ({
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

    const formatDate = date =>
        date.toLocaleDateString(undefined, {
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
            const id = typeof p === 'object' && p !== null ? p.userId : p;
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

    const userId = getCurrentUserIdFromDOM();
    if (userId) {
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
// DoubleTake Profile Buttons
// =============================================================================

/**
 * Get the user ID from the profile page
 * Extracts from the URL or from data attributes
 * @returns {string|null} The user ID
 */
function getProfileUserId() {
    // Try to get from URL first (/profile/USER_ID)
    const urlMatch = window.location.pathname.match(/\/profile\/([^\/\?]+)/);
    if (urlMatch) {
        return urlMatch[1];
    }

    // Try to get from actionbar if available
    const actionBar = document.querySelector('.actionbar2015');
    if (actionBar) {
        // Look for user ID in various places
        const userIdButton = document.querySelector('[class*="ID:"]');
        if (userIdButton) {
            const idMatch = userIdButton.textContent.match(/ID:\s*([^\s]+)/);
            if (idMatch) return idMatch[1];
        }
    }

    return null;
}

/**
 * Check if the current profile is a DoubleTake profile (missing like/pass buttons)
 * @returns {boolean} True if it's a DoubleTake profile
 */
function isDoubleTakeProfile() {
    // Check if we're on a profile page
    if (!window.location.pathname.startsWith('/profile/')) {
        return false;
    }

    // Check if the profile-userinfo-buttons section exists but lacks like/pass buttons
    const buttonsContainer = document.querySelector('.profile-userinfo-buttons .profile-pill-buttons');
    if (!buttonsContainer) {
        return false;
    }

    // DoubleTake profiles have only superlike button, no like/pass buttons
    const hasLikeButton = buttonsContainer.querySelector(
        '#like-button, [data-cy="profile.likeButton"]:not([class*="superlike"])'
    );
    const hasPassButton = buttonsContainer.querySelector('#pass-button, [data-cy="profile.passButton"]');

    return !hasLikeButton && !hasPassButton;
}

/**
 * Inject like and pass buttons into DoubleTake profile
 */
function injectDoubleTakeButtons() {
    const buttonsContainer = document.querySelector('.profile-userinfo-buttons .profile-pill-buttons');
    if (!buttonsContainer) {
        return;
    }

    // Check if buttons already exist
    if (buttonsContainer.querySelector('.cupid-doubletake-pass, .cupid-doubletake-like')) {
        return;
    }

    const userId = getProfileUserId();
    if (!userId) {
        console.warn('[Cupid Enhanced] Could not get user ID for DoubleTake profile');
        return;
    }

    const superlikeButton = buttonsContainer.querySelector('.superlike-button-scene');

    // Create Pass button
    const passButton = document.createElement('button');
    passButton.className =
        'm7MoWm4gQWQMUVIOiHSo pass-pill-button profile-pill-buttons-button profile-pill-buttons-button--superlike cupid-doubletake-pass';
    passButton.id = 'doubletake-pass-button';
    passButton.innerHTML = `
        <div class="pass-pill-button-inner">
            <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M.716.716a1.25 1.25 0 0 1 1.768 0L12.8 11.033 23.116.716a1.25 1.25 0 0 1 1.666-.091l.102.091a1.25 1.25 0 0 1 0 1.768L14.567 12.8l10.317 10.316a1.25 1.25 0 0 1 .091 1.666l-.091.102a1.25 1.25 0 0 1-1.768 0L12.8 14.567 2.484 24.884a1.25 1.25 0 0 1-1.666.091l-.102-.091a1.25 1.25 0 0 1 0-1.768L11.033 12.8.716 2.484A1.25 1.25 0 0 1 .625.818z" fill="#1A1A1A" fill-rule="nonzero"></path>
            </svg>PASS
        </div>
    `;

    // Create Like button
    const likeButton = document.createElement('button');
    likeButton.className =
        'm7MoWm4gQWQMUVIOiHSo likes-pill-button profile-pill-buttons-button profile-pill-buttons-button--superlike likes-pill-button--prioritylike cupid-doubletake-like';
    likeButton.id = 'doubletake-like-button';
    likeButton.innerHTML = `
        <div class="likes-pill-button-inner">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M23.267 2C28.067 2 32 6.134 32 11.134c0 4.373-3.712 9.146-7.492 12.873.005-.106.01-.213.01-.32v-6.692l4.376.365c.504.042.802-.564.464-.941-1.172-1.308-3.15-3.597-4.459-5.56-1.231-1.847-2.255-3.984-2.847-5.319-.204-.46-.897-.46-1.1 0-.593 1.335-1.617 3.472-2.849 5.32-1.308 1.962-3.286 4.251-4.459 5.559-.337.377-.039.983.465.941l4.41-.368V29.19a46.594 46.594 0 0 1-1.92 1.41c-.2.133-.399.2-.599.2-.2 0-.333-.067-.533-.2C14.799 30.199 0 20 0 11.134 0 6.134 3.933 2 8.733 2 11.667 2 14.4 3.533 16 6c1.6-2.467 4.333-4 7.267-4zm-13.6 4.333c-3 0-5.4 2.4-5.4 5.4 0 .534.466 1 1 1 .533 0 1-.466 1-1 0-1.866 1.533-3.4 3.4-3.4.533 0 1-.467 1-1 0-.533-.467-1-1-1z" fill="#fff"></path>
            </svg>PRIORITY LIKE
        </div>
    `;

    // Add click handlers
    passButton.addEventListener('click', async e => {
        e.preventDefault();
        passButton.disabled = true;
        try {
            console.log('[Cupid Enhanced] Passing on user:', userId);
            await voteOnUser(userId, 'PASS', 'DOUBLETAKE');
            console.log('[Cupid Enhanced] Successfully passed on user');
            // Navigate back or to next profile
            window.history.back();
        } catch (error) {
            console.error('[Cupid Enhanced] Failed to pass on user:', error);
            passButton.disabled = false;
        }
    });

    likeButton.addEventListener('click', async e => {
        e.preventDefault();
        likeButton.disabled = true;
        try {
            console.log('[Cupid Enhanced] Liking user:', userId);
            const result = await voteOnUser(userId, 'LIKE', 'DOUBLETAKE');
            console.log('[Cupid Enhanced] Successfully liked user:', result);

            // Check if it's a mutual match
            if (result?.data?.userVote?.voteResults?.[0]?.isMutualLike) {
                console.log('[Cupid Enhanced] 🎉 Mutual match!');
            }

            // Navigate back or to next profile
            window.history.back();
        } catch (error) {
            console.error('[Cupid Enhanced] Failed to like user:', error);
            likeButton.disabled = false;
        }
    });

    // Insert buttons before superlike button
    if (superlikeButton) {
        buttonsContainer.insertBefore(passButton, superlikeButton);
        buttonsContainer.insertBefore(likeButton, superlikeButton);
    } else {
        buttonsContainer.appendChild(passButton);
        buttonsContainer.appendChild(likeButton);
    }

    console.log('[Cupid Enhanced] Injected like/pass buttons for DoubleTake profile');
}

/**
 * Setup observer to inject buttons on DoubleTake profiles
 */
function setupDoubleTakeButtonsObserver() {
    let debounceTimer = null;

    const checkAndInject = () => {
        // Check for profile pages
        if (isDoubleTakeProfile()) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                injectDoubleTakeButtons();
            }, 100);
        }

        // Check for stack view cards
        if (isDoubleTakeStackView()) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                injectDoubleTakeStackButtons();
            }, 100);
        }
    };

    // Check immediately
    checkAndInject();

    // Watch for page changes
    return createBodyObserver(checkAndInject);
}

// =============================================================================
// DoubleTake Stack View Buttons
// =============================================================================

/**
 * Check if we're on the DoubleTake stack view
 * @returns {boolean} True if on stack view
 */
function isDoubleTakeStackView() {
    return document.querySelector('.standouts-cards') !== null;
}

/**
 * Get user ID from a standouts card profile link
 * @param {Element} card - The standouts-wrapper element
 * @returns {string|null} The user ID
 */
function getUserIdFromStackCard(card) {
    const profileLink = card.querySelector('.standouts-photo-wrapper');
    if (!profileLink) return null;

    const href = profileLink.getAttribute('href');
    if (!href) return null;

    // Extract user ID from URL like: /profile/USER_ID?cf=doubletake
    const match = href.match(/\/profile\/([^\/\?]+)/);
    return match ? match[1] : null;
}

/**
 * Inject like and pass buttons into all DoubleTake stack cards
 */
function injectDoubleTakeStackButtons() {
    const cards = document.querySelectorAll('.standouts-wrapper');

    cards.forEach(card => {
        // Check if buttons already exist
        if (card.querySelector('.cupid-stack-pass, .cupid-stack-like')) {
            return;
        }

        const userId = getUserIdFromStackCard(card);
        if (!userId) {
            console.warn('[Cupid Enhanced] Could not get user ID from stack card');
            return;
        }

        const superlikeButton = card.querySelector('.standouts-superlike');
        if (!superlikeButton) return;

        // Create a container for our buttons
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'cupid-stack-buttons';
        buttonsContainer.style.cssText = `
            position: absolute;
            bottom: -35px;
            left: 43%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 12px;
            z-index: 10;
        `;

        // Create Pass button (smaller round button)
        const passButton = document.createElement('button');
        passButton.className = 'cupid-stack-pass';
        passButton.setAttribute('aria-label', 'Pass');
        passButton.style.cssText = `
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        `;
        passButton.innerHTML = `
            <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
                <path d="M.716.716a1.25 1.25 0 0 1 1.768 0L12.8 11.033 23.116.716a1.25 1.25 0 0 1 1.666-.091l.102.091a1.25 1.25 0 0 1 0 1.768L14.567 12.8l10.317 10.316a1.25 1.25 0 0 1 .091 1.666l-.091.102a1.25 1.25 0 0 1-1.768 0L12.8 14.567 2.484 24.884a1.25 1.25 0 0 1-1.666.091l-.102-.091a1.25 1.25 0 0 1 0-1.768L11.033 12.8.716 2.484A1.25 1.25 0 0 1 .625.818z" fill="#1A1A1A" fill-rule="nonzero"></path>
            </svg>
        `;

        // Create Like button (larger round button)
        const likeButton = document.createElement('button');
        likeButton.className = 'cupid-stack-like';
        likeButton.setAttribute('aria-label', 'Like');
        likeButton.style.cssText = `
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff1493 0%, #ff69b4 100%);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        `;
        likeButton.innerHTML = `
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M23.267 2C28.067 2 32 6.134 32 11.134c0 4.373-3.712 9.146-7.492 12.873.005-.106.01-.213.01-.32v-6.692l4.376.365c.504.042.802-.564.464-.941-1.172-1.308-3.15-3.597-4.459-5.56-1.231-1.847-2.255-3.984-2.847-5.319-.204-.46-.897-.46-1.1 0-.593 1.335-1.617 3.472-2.849 5.32-1.308 1.962-3.286 4.251-4.459 5.559-.337.377-.039.983.465.941l4.41-.368V29.19a46.594 46.594 0 0 1-1.92 1.41c-.2.133-.399.2-.599.2-.2 0-.333-.067-.533-.2C14.799 30.199 0 20 0 11.134 0 6.134 3.933 2 8.733 2 11.667 2 14.4 3.533 16 6c1.6-2.467 4.333-4 7.267-4zm-13.6 4.333c-3 0-5.4 2.4-5.4 5.4 0 .534.466 1 1 1 .533 0 1-.466 1-1 0-1.866 1.533-3.4 3.4-3.4.533 0 1-.467 1-1 0-.533-.467-1-1-1z" fill="#fff"></path>
            </svg>
        `;

        // Add hover effects
        passButton.addEventListener('mouseenter', () => {
            passButton.style.filter = 'brightness(1.3)';
        });
        passButton.addEventListener('mouseleave', () => {
            passButton.style.filter = 'brightness(1)';
        });

        likeButton.addEventListener('mouseenter', () => {
            likeButton.style.filter = 'brightness(1.3)';
        });
        likeButton.addEventListener('mouseleave', () => {
            likeButton.style.filter = 'brightness(1)';
        });

        // Add click handlers
        passButton.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            passButton.disabled = true;
            passButton.style.opacity = '0.5';

            try {
                console.log('[Cupid Enhanced] Passing on stack card user:', userId);
                await voteOnUser(userId, 'PASS', 'DOUBLETAKE');
                console.log('[Cupid Enhanced] Successfully passed on user');

                // Animate card removal
                card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                card.style.transform = 'translateX(-100%) rotate(-10deg)';
                card.style.opacity = '0';

                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            } catch (error) {
                console.error('[Cupid Enhanced] Failed to pass on user:', error);
                passButton.disabled = false;
                passButton.style.opacity = '1';
            }
        });

        likeButton.addEventListener('click', async e => {
            e.preventDefault();
            e.stopPropagation();
            likeButton.disabled = true;
            likeButton.style.opacity = '0.5';

            try {
                console.log('[Cupid Enhanced] Liking stack card user:', userId);
                const result = await voteOnUser(userId, 'LIKE', 'DOUBLETAKE');
                console.log('[Cupid Enhanced] Successfully liked user:', result);

                // Check if it's a mutual match
                if (result?.data?.userVote?.voteResults?.[0]?.isMutualLike) {
                    console.log('[Cupid Enhanced] 🎉 Mutual match!');
                }

                // Animate card removal
                card.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
                card.style.transform = 'translateX(100%) rotate(10deg)';
                card.style.opacity = '0';

                setTimeout(() => {
                    card.style.display = 'none';
                }, 300);
            } catch (error) {
                console.error('[Cupid Enhanced] Failed to like user:', error);
                likeButton.disabled = false;
                likeButton.style.opacity = '1';
            }
        });

        // Add buttons to container
        buttonsContainer.appendChild(passButton);
        buttonsContainer.appendChild(likeButton);

        // Insert container into the card
        card.style.position = 'relative';
        card.appendChild(buttonsContainer);

        console.log('[Cupid Enhanced] Injected like/pass buttons for stack card:', userId);
    });
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
