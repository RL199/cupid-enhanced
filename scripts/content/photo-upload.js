// =============================================================================
// Photo Upload Feature
// Provides UI and functionality for uploading high-resolution photos to OkCupid
// Requires: api-helpers.js, settings.js, selectors.js
// =============================================================================
'use strict';
/* exported initPhotoUpload */

// Current user ID (will be populated from API responses)
let currentUserId = null;
let photoUploadPlacementObserver = null;

const UPLOAD_BUTTON_HTML = `
    <div class="navbar-link-icon-container" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="navbar-link-icon">
            <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-1.8c1.77 0 3.2-1.43 3.2-3.2s-1.43-3.2-3.2-3.2-3.2 1.43-3.2 3.2 1.43 3.2 3.2 3.2z" fill="currentColor"></path>
        </svg>
    </div>
    <h1 class="navbar-link-text">Upload Photo</h1>
`;

/**
 * Helper to calculate final dimensions maintaining aspect ratio
 */
function calculateFinalDimensions(origWidth, origHeight, maxDim) {
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
}

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
                const newDims = calculateFinalDimensions(width, height, maxDimension);
                width = newDims.width;
                height = newDims.height;
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

    // Step 2: Get image dimensions from the processed blob
    const { width: imgWidth, height: imgHeight } = await new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(processedBlob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to read processed image dimensions'));
        };
        img.src = url;
    });

    // Step 3: Convert blob to base64 for sending via message
    const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // Remove the data:mime;base64, prefix
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read image as base64'));
        reader.readAsDataURL(processedBlob);
    });

    // Step 4: Get current user ID
    if (!currentUserId) {
        currentUserId = await getCurrentUserId();
    }

    // Step 5: Upload via background script (multipart upload to /image)
    console.log('[Cupid Enhanced] Uploading photo via background script...');
    const result = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                type: 'UPLOAD_PHOTO',
                photoData: {
                    imageBase64,
                    mimeType,
                    filename: file.name || `photo.${extension}`,
                    userId: currentUserId,
                    width: imgWidth,
                    height: imgHeight
                }
            },
            response => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response?.success) {
                    resolve(response.data);
                } else {
                    reject(new Error(response?.error || 'Upload failed'));
                }
            }
        );
    });

    console.log('[Cupid Enhanced] Photo upload complete:', result);
    return result;
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

function getNavbarLinksContainer() {
    return document.querySelector('.navbar-links');
}

function mountPhotoUploadButton(uploadButton) {
    const navbarLinks = getNavbarLinksContainer();
    if (!navbarLinks) {
        uploadButton.hidden = true;
        return;
    }

    uploadButton.hidden = false;
    if (uploadButton.parentElement !== navbarLinks) {
        navbarLinks.appendChild(uploadButton);
    }
}

function observePhotoUploadButtonPlacement(uploadButton) {
    if (photoUploadPlacementObserver) return;

    photoUploadPlacementObserver = new MutationObserver(() => {
        mountPhotoUploadButton(uploadButton);
    });

    photoUploadPlacementObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Create and inject the photo upload UI into the page
 */
function createPhotoUploadUI() {
    // Check if UI already exists
    const existingButton = document.getElementById('cupid-photo-upload-btn');
    if (existingButton) {
        existingButton.type = 'button';
        existingButton.className = 'navbar-link';
        existingButton.style.cursor = 'pointer';
        if (!existingButton.querySelector('.navbar-link-text')) {
            existingButton.innerHTML = UPLOAD_BUTTON_HTML;
        }
        mountPhotoUploadButton(existingButton);
        observePhotoUploadButtonPlacement(existingButton);
        return;
    }

    // Inject styles
    injectPhotoUploadStyles();

    // Create upload button
    const uploadButton = document.createElement('button');
    uploadButton.id = 'cupid-photo-upload-btn';
    uploadButton.type = 'button';
    uploadButton.className = 'navbar-link';
    uploadButton.style.cursor = 'pointer';
    uploadButton.innerHTML = UPLOAD_BUTTON_HTML;
    uploadButton.title = 'Upload high-res photo';
    uploadButton.hidden = true;
    document.body.appendChild(uploadButton);
    mountPhotoUploadButton(uploadButton);
    observePhotoUploadButtonPlacement(uploadButton);

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
