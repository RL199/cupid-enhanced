# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.3]

### Added
- Pass and like buttons on profile stack cards in the "Interested in You" section (needs to be fetched using the new "Fetch Interested Profiles" button first to work).

### Changed
- Don't show user guides and Onboarding popups for users to avoid annoying.
- Interested profiles fetch button now shown in every section of the site instead of just the "Interested in You" section.

### Fixed


## [1.4.2]

### Fixed
- handle images from additional cdn domain czno.com

## [1.4.1]

### Fixed
- Fixed an issue where the photo upload button was not working correctly.

## [1.4.0]

### Added
- Indicator in feed if the profile liked you or not.
- Translate button for profile essays in feed to translate them using Google Translate.

### Changed
- "Interested in You" centered grid layout.
- The horizontal scroll feature is now always enabled without any toggle.

### Fixed
- Interested profiles fetch button fetching wrong profiles.
- Incoming Likes header loading slowly.

## [1.3.0]

### Added
- New option to disable sending read receipts for messages (anonymous message read).
- Added like and pass buttons to Cupid's Picks profiles.
- New option to add a high resolution photo upload button on the site.
- Button to fetch all interested profiles (including likes you) and view them in the interested profiles page.

### Fixed
- likes remaining count not updating correctly.


## [1.2.0]

### Added
- Bypass user photo requirements to unlock functions that require having photos, like sending likes and passes.
- New option to enable staff mode in the settings popup.
- "Open OkCupid" button in the popup to quickly open the site.
- Add description for each popup setting for better clarity.
- Block sending analytics data to OkCupid servers.
- Bypass voting limits on "featured questions" section.

### Fixed
- Fix issue with photo date display on fullscreen profile photos view not displaying correctly.
- Fix minor bug when scrolling horizontally in fullscreen profile photos view causing layout issues.
- "Likes You" page layout applying incorrectly in message inbox.

### Removed
- Remove "Likes Count" , "Unblur Images", "Hide Promotions" settings from popup as they are turned on by default and don't have any reason to be toggled off.


## [1.1.0]

### Added
- Better Likes You Layout feature (new popup setting)
- Display photos dates on fullscreen profile photos view.
- See all intros you've received.
- horizontal scroll support for full profile photos view using mouse wheel.
- Enable the option to set dealbreakers in preferences and filter discover results accordingly.

### Changed
- Local storage log of visited profiles now includes first photo URL, view date, name, age and location.
- Dark mode improvements.
- Default setting for dark mode and better likes you layout are off for new users.
- Updated rewind button to work as original site behavior (go back to previous profile in discover).

## [1.0.0]

### Added
- Display photo upload dates on discover page photos (Better Discover Page feature)
- Display a box layout in the Enhance Discover Page feature with: oldest photo date, newest photo date, likes remaining count, and likes count reset time.
- Horizontal scroll support for Discover page using mouse wheel (new popup setting)
- ctrl+enter shortcut to send intro messages
- Spoof Premium Badge feature to show premium badge without premium subscription
- See all of who was interested in you and sort the list.
- Hide the incognito banner via Block Premium Ads feature
- Dark mode support (new experimental popup setting)
- Rewind button support

### Changed
- Centered layout for Enhance Discover Page feature
- Renamed titles in popup settings for clarity
- Updated location of extension assets

### Removed
- "Enhance Interested Profile Photos" option, as a better feature is now always enabled.

## [0.9.0] - 2025-11-18

### Added

- First stable release with core features:
  - Enhance Interested Profile Photos
  - Enhance Discover Page
  - Block Premium Ads
