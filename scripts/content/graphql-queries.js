// =============================================================================
// GraphQL Query Functions
// Functions that execute specific GraphQL queries against OkCupid API
// Requires: api-helpers.js (okcupidGraphQL function)
// =============================================================================
'use strict';

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
  targetLikeViaSpotlight
  targetLikeViaSuperBoost
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
