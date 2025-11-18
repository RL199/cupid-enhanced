// API Response Interceptor - Runs in MAIN world to modify responses before page sees them
(function () {
    'use strict';

    console.log('###API interceptor injected###');

    const originalText = Response.prototype.text;

    Response.prototype.text = async function () {
        const text = await originalText.call(this);
        const { url } = this;

        if (!url.includes('graphql')) return text;

        try {
            const data = JSON.parse(text);

            // Unblur profile images in "who liked you" data
            if (data?.data?.me?.likes?.data) {
                data.data.me.likes.data.forEach(like => {
                    if (like.primaryImage) {
                        like.primaryImageBlurred = like.primaryImage;
                    }
                });
                return JSON.stringify(data);
            }

            // Send likes count to isolated world for storage
            if (data?.data?.me?.notificationCounts?.likesIncoming) {
                window.postMessage({
                    type: 'SAVE_LIKES_COUNT',
                    count: data.data.me.notificationCounts.likesIncoming
                }, '*');
            }

            return text;
        } catch {
            return text;
        }
    };
})();
