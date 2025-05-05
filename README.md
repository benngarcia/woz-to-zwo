# woz-to-zwo

A browser extension that creates and downloads custom workout files (.zwo) based on workout details from whatsonzwift.com.

## Features

- Adds a "Download .zwo" button to workout pages on whatsonzwift.com
- Parses workout segments automatically
- Generates standard .zwo files compatible with Zwift
- Handles various workout segment types including:
  - Steady state intervals
  - Ramp segments
  - Interval sets (IntervalsT) with repeat, on/off durations and powers
- Includes cadence targets when specified in the workout

## Installation

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the extension directory
5. The extension will activate automatically when you visit whatsonzwift.com workout pages

## Usage

1. Visit any workout page on whatsonzwift.com (e.g., https://whatsonzwift.com/workouts/...)
2. Click the "Download .zwo" button that appears on the page
3. The .zwo file will download automatically
4. Import the downloaded file into Zwift

## Testing

The extension includes automated tests to verify the HTML parsing functionality and ZWO generation:

```bash
# Install development dependencies
npm install

# Run the test suite
npm test
```

The tests verify:
- Duration parsing (minutes, seconds)
- Steady state segment parsing (with and without cadence)
- Ramp segment parsing
- Interval segment parsing (with various formats)
- XML generation for different segment types

## Current Limitations

- Only works on whatsonzwift.com workout pages
- May not correctly parse all complex workout structures
- Limited support for specialized segment types (e.g., free rides, text events)
- No customization options for the generated workout files (Use zwofactory.com)
- Does not support workout descriptions
- The extension is currently in beta and may contain bugs

## License

See the [LICENSE](LICENSE) file for details. 
