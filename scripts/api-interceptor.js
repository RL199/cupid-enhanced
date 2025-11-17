// This script intercepts and modifies API responses
(function () {
    'use strict';

    console.log('###API interceptor injected###');

    // Override Response.prototype.text to intercept and modify API responses
    const originalText = Response.prototype.text;

    Response.prototype.text = async function () {
        const text = await originalText.call(this);

        // Only process GraphQL responses
        if (!this.url.includes('graphql')) {
            return text;
        }

        try {
            const data = JSON.parse(text);

            // Handle "who liked you" data
            if (data?.data?.me?.likes?.data) {
                console.log('###Intercepted likes data - unblurring images###');

                // Replace blurred images with real ones
                data.data.me.likes.data.forEach((like) => {
                    if (like.primaryImage) {
                        like.primaryImageBlurred = like.primaryImage;
                    }
                });

                return JSON.stringify(data);
            }

            return text;
        } catch (e) {
            // If parsing fails, return original text
            return text;
        }
    };
})();
