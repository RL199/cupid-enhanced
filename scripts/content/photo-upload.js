// =============================================================================
// Photo Upload Feature
// Provides UI and functionality for uploading high-resolution photos to OkCupid
// Requires: api-helpers.js, settings.js, selectors.js
// =============================================================================
'use strict';

// Current user ID (will be populated from API responses)
var currentUserId = null;

/**
 * Upload a photo to OkCupid using a multi-step process:
 * 1. Request an upload URL from OkCupid
 * 2. Upload the image to S3
 * 3. Confirm the upload with OkCupid
 *
 * @param {File} file - The image file to upload
 * @param {object} options - Optional settings
 * @param {number} options.maxDimension - Max width/height (default: 3000)
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.95)
 * @param {string} options.outputFormat - 'image/jpeg', 'image/png', or 'image/webp' (default: 'image/jpeg')
 * @returns {Promise<object>} Upload result from OkCupid
 */
async function uploadPhotoToOkCupid(file, options = {}) {
    const { maxDimension = 3000, quality = 0.95, outputFormat = 'image/jpeg' } = options;

    // Step 1: Load and optionally resize the image
    const processedBlob = await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let width = img.width;
            let height = img.height;
            const inputIsJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
            const outputIsJpeg = outputFormat === 'image/jpeg';
            const needsResize = width > maxDimension || height > maxDimension;

            // If input is already JPEG and output is JPEG and no resize needed, use original file
            if (inputIsJpeg && outputIsJpeg && !needsResize) {
                console.log('[Cupid Enhanced] Using original JPEG without re-encoding');
                resolve(file);
                return;
            }

            // Calculate new dimensions if resize needed
            if (needsResize) {
                if (width > height) {
                    height = Math.round((height / width) * maxDimension);
                    width = maxDimension;
                } else {
                    width = Math.round((width / height) * maxDimension);
                    height = maxDimension;
                }
            }

            // Create canvas and draw image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(
                blob => {
                    if (blob) {
                        console.log(
                            `[Cupid Enhanced] Image processed: ${img.width}x${img.height} -> ${width}x${height}, format: ${outputFormat}, quality: ${quality}`
                        );
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create image blob'));
                    }
                },
                outputFormat,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });

    // Determine file extension
    const formatToExt = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    const extension = formatToExt[outputFormat] || 'jpg';
    const mimeType = outputFormat;

    // Step 2: Get upload URL from OkCupid
    console.log('[Cupid Enhanced] Requesting upload URL...');
    const uploadUrlResponse = await okcupidRequest('/photo/uploadurl', {
        method: 'POST',
        body: {
            filesize: processedBlob.size,
            extension: extension
        }
    });

    if (!uploadUrlResponse || !uploadUrlResponse.upload_url) {
        throw new Error('Failed to get upload URL from OkCupid');
    }

    console.log('[Cupid Enhanced] Got upload URL, uploading to S3...');

    // Step 3: Upload to S3
    const s3Response = await fetch(uploadUrlResponse.upload_url, {
        method: 'PUT',
        headers: {
            'Content-Type': mimeType
        },
        body: processedBlob
    });

    if (!s3Response.ok) {
        throw new Error(`S3 upload failed: ${s3Response.status} ${s3Response.statusText}`);
    }

    console.log('[Cupid Enhanced] S3 upload complete, confirming with OkCupid...');

    // Step 4: Confirm the photo with OkCupid
    // Get current user ID if we don't have it
    if (!currentUserId) {
        currentUserId = await getCurrentUserId();
    }

    const confirmResponse = await okcupidRequest('/photo/confirm', {
        method: 'POST',
        body: {
            key: uploadUrlResponse.key,
            userid: currentUserId,
            caption: '',
            is_private: false
        }
    });

    console.log('[Cupid Enhanced] Photo upload complete:', confirmResponse);
    return confirmResponse;
}

/**
 * Get the current user's ID from the OkCupid API
 * @returns {Promise<string>} User ID
 */
async function getCurrentUserId() {
    if (currentUserId) return currentUserId;

    const response = await okcupidRequest('/profile/me');
    if (response && response.userid) {
        currentUserId = response.userid;
        return currentUserId;
    }
    throw new Error('Could not get current user ID');
}

/**
 * Create and inject the photo upload UI into the page
 */
function createPhotoUploadUI() {
    // Check if UI already exists
    if (document.getElementById('cupid-photo-upload-btn')) return;

    // Inject styles
    injectPhotoUploadStyles();

    // Create upload button
    const uploadButton = document.createElement('button');
    uploadButton.id = 'cupid-photo-upload-btn';
    uploadButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
        </svg>
        Upload Photo
    `;
    uploadButton.title = 'Upload high-res photo';
    document.body.appendChild(uploadButton);

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'cupid-photo-file-input';
    document.body.appendChild(fileInput);

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'cupid-photo-upload-modal';
    modal.innerHTML = `
        <div class="cupid-modal-content">
            <div class="cupid-modal-header">
                <h3>Upload Photo</h3>
                <button class="cupid-modal-close">&times;</button>
            </div>
            <div class="cupid-modal-body">
                <div class="cupid-preview-area" id="cupid-preview-area">
                    <p>Select an image to preview</p>
                </div>
                <div class="cupid-upload-info" id="cupid-upload-info"></div>
                <div class="cupid-upload-settings">
                    <div class="cupid-setting-row">
                        <label for="cupid-max-dimension">Max Dimension</label>
                        <input type="number" id="cupid-max-dimension" value="3000" min="100" max="10000">
                    </div>
                    <div class="cupid-setting-row">
                        <label for="cupid-quality">Quality (%)</label>
                        <input type="number" id="cupid-quality" value="95" min="1" max="100">
                    </div>
                    <div class="cupid-setting-row">
                        <label for="cupid-format">Format</label>
                        <select id="cupid-format">
                            <option value="image/jpeg" selected>JPEG</option>
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
    document.body.appendChild(modal);

    // Setup events
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
            max-width: 450px;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            display: flex;
            flex-direction: column;
        }

        .cupid-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-bottom: 1px solid #333;
            flex-shrink: 0;
        }

        .cupid-modal-header h3 {
            margin: 0;
            color: #fff;
            font-size: 16px;
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
            padding: 12px 16px;
            overflow-y: auto;
            flex: 1;
        }

        .cupid-preview-area {
            width: 100%;
            min-height: 100px;
            max-height: 180px;
            border: 2px dashed #444;
            border-radius: 8px;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
            background: #0d0d0d;
        }

        .cupid-preview-area p {
            color: #666;
            font-size: 13px;
        }

        .cupid-preview-area img {
            max-width: 100%;
            max-height: 180px;
            object-fit: contain;
        }

        .cupid-upload-info {
            margin-top: 10px;
            padding: 8px 10px;
            background: #252525;
            border-radius: 6px;
            font-size: 12px;
            color: #aaa;
            line-height: 1.4;
        }

        .cupid-upload-info:empty {
            display: none;
        }

        .cupid-upload-settings {
            margin-top: 10px;
            padding: 10px 12px;
            background: #252525;
            border-radius: 6px;
        }

        .cupid-setting-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }

        .cupid-setting-row:last-child {
            margin-bottom: 0;
        }

        .cupid-setting-row label {
            color: #ccc;
            font-size: 12px;
        }

        .cupid-setting-row input,
        .cupid-setting-row select {
            width: 100px;
            padding: 6px 8px;
            background: #1a1a1a;
            border: 1px solid #444;
            border-radius: 4px;
            color: #fff;
            font-size: 12px;
        }

        .cupid-setting-row input:focus,
        .cupid-setting-row select:focus {
            outline: none;
            border-color: #ff1493;
        }

        .cupid-modal-footer {
            display: flex;
            gap: 10px;
            padding: 12px 16px;
            border-top: 1px solid #333;
            flex-shrink: 0;
            background: #1a1a1a;
        }

        .cupid-btn {
            flex: 1;
            padding: 10px 16px;
            border: none;
            border-radius: 6px;
            font-size: 13px;
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
            margin-top: 8px;
            padding: 8px;
            border-radius: 4px;
            font-size: 12px;
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

    // Helper to update the info display
    const updateInfoDisplay = () => {
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

        // Check if re-encoding will be skipped
        const inputIsJpeg = selectedFile.type === 'image/jpeg' || selectedFile.type === 'image/jpg';
        const outputIsJpeg = settings.outputFormat === 'image/jpeg';
        const needsResize =
            originalImageDimensions.width > settings.maxDimension ||
            originalImageDimensions.height > settings.maxDimension;
        const willSkipReencode = inputIsJpeg && outputIsJpeg && !needsResize;

        const formatLine = willSkipReencode
            ? `<strong>Format:</strong> JPEG (no conversion needed)`
            : `<strong>Format:</strong> ${selectedFile.type} → ${formatName}`;

        const qualityLine = willSkipReencode
            ? `<strong>Quality:</strong> Original (preserved)`
            : `<strong>Quality:</strong> ${settings.quality * 100}%`;

        uploadInfo.innerHTML = `
            <strong>File:</strong> ${selectedFile.name}<br>
            <strong>Original Size:</strong> ${originalImageDimensions.width} x ${originalImageDimensions.height}<br>
            <strong>Upload Size:</strong> ${width} x ${height}<br>
            ${formatLine}<br>
            ${qualityLine}
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
        showUploadStatus('Uploading photo... it may take a moment', 'uploading');

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
            // Check for 500 error which often means the image is too large
            let errorMsg = error.message;
            if (error.message.includes('500')) {
                errorMsg = 'Server error (500). Try a smaller resolution or different image.';
            }
            showUploadStatus(`Upload failed: ${errorMsg}`, 'error');
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
    }
}
