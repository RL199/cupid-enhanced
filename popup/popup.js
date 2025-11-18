const SETTINGS_KEY = 'cupidEnhancedSettings';

const DEFAULT_SETTINGS = {
    unblurImages: true,
    likesCount: true,
    enhanceDiscoverPage: true,
    enhanceInterestedPhotos: true,
    blockPremiumAds: true
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
    renderSettings();
}

// Create a setting item element
function createSettingItem(text, key) {
    const item = document.createElement('div');
    item.className = 'setting-item';

    const info = document.createElement('div');
    info.className = 'setting-info';

    const titleEl = document.createElement('h3');
    titleEl.className = 'setting-title';
    titleEl.textContent = text;

    info.appendChild(titleEl);

    const label = document.createElement('label');
    label.className = 'toggle-switch';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = currentSettings[key];
    input.addEventListener('change', () => handleToggle(key));

    const slider = document.createElement('span');
    slider.className = 'toggle-slider';

    label.appendChild(input);
    label.appendChild(slider);

    item.appendChild(info);
    item.appendChild(label);

    // Make entire item clickable to toggle
    item.addEventListener('click', (e) => {
        // Don't double-toggle if clicking directly on the toggle switch
        if (!e.target.closest('.toggle-switch')) {
            handleToggle(key);
        }
    });

    return item;
}

// Render all settings
function renderSettings() {
    const visualContainer = document.getElementById('settings-visual');
    const dataContainer = document.getElementById('settings-data');

    // Clear containers
    visualContainer.innerHTML = '';
    dataContainer.innerHTML = '';

    // Visual enhancements
    visualContainer.appendChild(createSettingItem(
        'Unblur Profile Images',
        'unblurImages'
    ));

    visualContainer.appendChild(createSettingItem(
        'Enhance Discover Page',
        'enhanceDiscoverPage'
    ));

    visualContainer.appendChild(createSettingItem(
        'Enhance Interested Photos',
        'enhanceInterestedPhotos'
    ));

    // Data & Interface
    dataContainer.appendChild(createSettingItem(
        "Show Actual Likes Count",
        'likesCount'
    ));

    dataContainer.appendChild(createSettingItem(
        'Block Premium Ads',
        'blockPremiumAds'
    ));
}

// Initialize popup
async function init() {
    try {
        await loadSettings();
        renderSettings();
    } catch (error) {
        console.error('Failed to initialize popup:', error);
        // Show error in UI
        document.body.innerHTML = '<div style="padding: 20px; color: #ef4444;">Failed to load settings. Please reload the extension.</div>';
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
