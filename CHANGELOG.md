# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2025-11-18

### Added

- Beautiful dark-themed popup interface with gradient colors matching the logo
- Settings popup with toggle switches for all 5 features
- Clickable setting items - click anywhere on the row to toggle
- Real-time settings synchronization across all extension contexts
- Vanilla JavaScript implementation (removed React dependency for better CSP compliance)
- Gradient toggle switches with visual feedback
- Enhanced UI with purple theme matching the SVG logo colors
- Persistent settings storage using Chrome Storage API

### Changed

- Migrated popup from React to vanilla JavaScript for better performance
- Updated popup header to use full-width cupid-enhanced.svg banner
- Removed card-style container for cleaner edge-to-edge design
- Simplified settings UI to single-column layout for better readability
- Updated all colors to match logo gradient (#FF4F9A, #FF7AB3, #7C3AED)
- Changed background from white to dark purple gradient theme
- Reduced header padding for better space utilization
- Removed "Made with ♥" footer text

### Fixed

- CSP (Content Security Policy) violations from React CDN imports
- Toggle slider gradient rendering issues
- Settings not properly syncing between popup and content scripts
- Message passing between MAIN and ISOLATED worlds

## [0.8.0] - 2025-11-17

### Added

- API interceptor to modify GraphQL responses in MAIN world
- Unblur profile images feature by replacing primaryImageBlurred with primaryImage
- Show actual likes count feature - removes 99+ limitation
- Real likes count display with "Interest" → "Likes" text replacement
- Block premium ads feature with 8 selector targeting
- Enhance Discover Page feature for improved layout
- Enhance Interested Photos feature for better photo display
- Settings management system with chrome.storage integration
- MutationObserver-based DOM monitoring for dynamic changes
- Message passing infrastructure between content scripts

### Changed

- Modernized codebase with async/await patterns
- Improved code structure with early returns and optional chaining
- Split content scripts into MAIN world (api-interceptor.js) and ISOLATED world (okcupid-content.js)

### Fixed

- Chrome.storage API unavailable in MAIN world context
- Settings not persisting across browser sessions
