const SETTINGS_KEY = 'cupidEnhancedSettings';

const DEFAULT_SETTINGS = {
    unblurImages: true,
    likesCount: true,
    enhanceDiscoverPage: true,
    enhanceLikesYouPage: false,
    blockPremiumAds: true,
    horizontalScroll: true,
    darkMode: false
};

let currentSettings = { ...DEFAULT_SETTINGS };

// Load settings from storage
async function loadSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get([SETTINGS_KEY], (result) => {
            if (result[SETTINGS_KEY]) {
                currentSettings = result[SETTINGS_KEY];
            }
            resolve(currentSettings);
        });
    });
}

// Save settings to storage
async function saveSettings(settings) {
    currentSettings = settings;
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });

    // Notify content script
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await chrome.tabs.sendMessage(tab.id, {
                type: 'SETTINGS_UPDATED',
                settings: settings
            }).catch(() => {
                // Tab might not have content script yet, ignore error
            });
        }
    } catch (error) {
        // Ignore errors when querying tabs
    }
}

// Toggle a setting
async function handleToggle(key) {
    const newSettings = { ...currentSettings, [key]: !currentSettings[key] };
    await saveSettings(newSettings);
    updateUI();
}

// Update UI to reflect current settings
function updateUI() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][data-key]');
    checkboxes.forEach(checkbox => {
        const key = checkbox.dataset.key;
        checkbox.checked = currentSettings[key];
    });
}

// Setup event listeners
function setupEventListeners() {
    // Add listeners to all checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"][data-key]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            handleToggle(checkbox.dataset.key);
        });
    });

    // Make entire setting items clickable
    const settingItems = document.querySelectorAll('.setting-item');
    settingItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Don't double-toggle if clicking directly on the toggle switch
            if (!e.target.closest('.toggle-switch')) {
                const key = item.dataset.setting;
                handleToggle(key);
            }
        });
    });
}

// Display version from manifest
function displayVersion() {
    const manifest = chrome.runtime.getManifest();
    const versionElement = document.getElementById('version');
    if (versionElement) {
        versionElement.textContent = `v${manifest.version}`;
    }
}

// Initialize popup
async function init() {
    try {
        displayVersion();
        await loadSettings();
        updateUI();
        setupEventListeners();
    } catch (error) {
        console.error('Failed to initialize popup:', error);
        document.body.innerHTML = '<div style="padding: 20px; color: #ef4444;">Failed to load settings. Please reload the extension.</div>';
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
