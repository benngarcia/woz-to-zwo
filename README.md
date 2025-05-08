# WhatsOnZwift Workout Exporter

This [Chrome extension](https://chromewebstore.google.com/detail/woz2zwo/hhcdmphnaagcdaphbiepeefeioojfgjm?utm_source=item-share-cb) allows you to easily download Zwift workouts from the WhatsOnZwift website as .zwo files that can be imported directly into Zwift.

Download link: [https://chromewebstore.google.com/detail/woz2zwo/hhcdmphnaagcdaphbiepeefeioojfgjm](https://chromewebstore.google.com/detail/woz2zwo/hhcdmphnaagcdaphbiepeefeioojfgjm?utm_source=item-share-cb)


## Installation Guide

### A. Installing the Extension

#### Method 1: From the Chrome Web Store (Recommended)
1. Open the Google Chrome browser
2. Visit the [WhatsOnZwift Workout Exporter](https://chrome.google.com/webstore/detail/link-to-be-added) page on the Chrome Web Store
3. Click the "Add to Chrome" button
4. Click "Add Extension" when prompted
5. You'll see a small icon appear in your browser's toolbar

#### Method 2: Manual Installation
1. Download the extension.zip file from this repository
2. Unzip the file to a location on your computer
3. Open Chrome and type `chrome://extensions` in the address bar
4. Turn on "Developer mode" using the toggle in the top-right corner
5. Click the "Load unpacked" button
6. Navigate to the folder where you unzipped the extension and select it
7. The extension is now installed!

### B. Using the Extension

1. Visit the [WhatsOnZwift](https://whatsonzwift.com/workouts/) website
2. Browse and select a workout you're interested in
3. Once on the workout page, you'll see a green "Download .zwo" button below the workout details
4. If prompted, enter your FTP (Functional Threshold Power) value
5. Click the "Download .zwo" button to save the workout file to your computer
6. The file will be saved to your default downloads folder with the workout name

### C. Moving the Workout to Zwift

#### For Windows Users:
1. Locate the downloaded .zwo file in your Downloads folder
2. Move (or copy) the file to this folder:
   ```
   C:\Users\[YOUR USERNAME]\Documents\Zwift\Workouts\[YOUR ZWIFT USER ID]
   ```
   (Replace [YOUR USERNAME] with your Windows username and [YOUR ZWIFT USER ID] with your Zwift user ID number)
3. If the Workouts or your user ID folder doesn't exist, you can create them

#### For Mac Users:
1. Locate the downloaded .zwo file in your Downloads folder
2. Move (or copy) the file to this folder:
   ```
   /Users/[YOUR USERNAME]/Documents/Zwift/Workouts/[YOUR ZWIFT USER ID]
   ```
   (Replace [YOUR USERNAME] with your Mac username and [YOUR ZWIFT USER ID] with your Zwift user ID number)
3. If the Workouts or your user ID folder doesn't exist, you can create them

#### For iOS/iPadOS and Android Users:
1. The easiest method is to email the .zwo file to yourself
2. Open the email on your device and save the attachment
3. Open the Zwift app
4. Go to Training > Workouts > Custom Workouts
5. Your downloaded workout should appear in the list

#### Finding Your Zwift User ID
1. Log in to [Zwift.com](https://zwift.com)
2. Go to your profile page
3. Your Zwift ID appears in the URL as a number (e.g., https://zwift.com/athlete/12345678)

## Troubleshooting

- **Workout not showing in Zwift?** Make sure Zwift is closed when you add new workout files. Restart Zwift to see your new workouts.
- **Download button not appearing?** Make sure you're on a specific workout page on WhatsOnZwift, not the main workouts listing.
- **Need help?** Please create an issue on our GitHub page with details of your problem.

## Privacy

This extension does not collect any personal data. All workout processing happens locally in your browser.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
