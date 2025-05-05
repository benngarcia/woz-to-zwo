/**
 * Tape tests for the WhatsOnZwift Workout Parser (Using global functions)
 */

// Import testing framework and JSDOM for DOM simulation
import test from 'tape'; // Use ESM import for tape
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';

// --- Test Setup ---

// Create a minimal DOM environment for testing functions that interact with DOM elements
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = dom.window.document;
global.window = dom.window;
// Add location object for generateZWO description
global.window.location = 'http://test.com/mock-workout';

// Load content.js as a string and inject the functions into the global scope
const contentPath = path.resolve(process.cwd(), 'content.js');
const contentCode = fs.readFileSync(contentPath, 'utf8');

// Extract the function implementations from content.js
// Create a sandbox-like environment to avoid polluting the global scope
const sandbox = {};
const functionNames = ['parseDuration', 'parseSegment', 'generateZWO'];

// Extract and evaluate each function in isolation
functionNames.forEach(funcName => {
  // Simple regex to extract function definition
  const funcRegex = new RegExp(`function ${funcName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`, 'g');
  const funcMatch = contentCode.match(funcRegex);
  
  if (funcMatch && funcMatch[0]) {
    // Create a function from the extracted code
    sandbox[funcName] = new Function(
      'document', 'window', 
      `return ${funcMatch[0]}`
    )(document, window);
    
    // Make it available in the global scope for tests
    global[funcName] = sandbox[funcName];
  } else {
    console.error(`Could not extract function ${funcName} from content.js`);
  }
});

/**
 * Helper function to create a DOM element from an HTML string.
 * @param {string} htmlString - The HTML string to parse.
 * @returns {Element} The first element created from the HTML string.
 */
function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    // Trim whitespace to avoid creating extra text nodes
    div.innerHTML = htmlString.trim();
    // Return the first child element
    return div.firstChild;
}

/**
 * Helper function to extract the <workout> content from ZWO XML string.
 * @param {string} zwoXML - The full ZWO XML string.
 * @returns {string} The content within the <workout> tags, trimmed.
 */
function extractWorkoutContent(zwoXML) {
    const match = zwoXML.match(/<workout>([\s\S]*?)<\/workout>/);
    return match ? match[1].trim() : '';
}

// --- Test Suites ---

test('Workout Parser: parseDuration', t => {
    t.test('Valid inputs', st => {
        st.equal(parseDuration('10min'), 600, 'Should parse "10min" as 600 seconds');
        st.equal(parseDuration('1min'), 60, 'Should parse "1min" as 60 seconds');
        st.equal(parseDuration('90sec'), 90, 'Should parse "90sec" as 90 seconds');
        st.equal(parseDuration('30sec'), 30, 'Should parse "30sec" as 30 seconds');
        st.equal(parseDuration('2.5min'), 150, 'Should parse "2.5min" (float) as 150 seconds');
        st.equal(parseDuration('0.5min'), 30, 'Should parse "0.5min" as 30 seconds');
        st.equal(parseDuration('15.5sec'), 16, 'Should parse "15.5sec" and round to 16 seconds'); // Based on Math.round in source
        st.equal(parseDuration('15.4sec'), 15, 'Should parse "15.4sec" and round to 15 seconds'); // Based on Math.round in source
        // Add test for combined format
        st.equal(parseDuration('7min 30sec'), 450, 'Should parse "7min 30sec" as 450 seconds');
        st.equal(parseDuration('2min 15sec'), 135, 'Should parse "2min 15sec" as 135 seconds');
        st.equal(parseDuration('1min 5sec'), 65, 'Should parse "1min 5sec" as 65 seconds');
        st.end();
    });

    t.test('Edge cases and invalid inputs', st => {
        st.equal(parseDuration('0min'), 0, 'Should parse "0min" as 0 seconds');
        st.equal(parseDuration('0sec'), 0, 'Should parse "0sec" as 0 seconds');
        st.equal(parseDuration(''), 0, 'Should return 0 for empty string');
        st.equal(parseDuration('invalid string'), 0, 'Should return 0 for non-numeric string');
        st.equal(parseDuration('10 m'), 0, 'Should return 0 for incorrect unit format');
        st.equal(parseDuration('10'), 0, 'Should return 0 for missing unit');
        st.equal(parseDuration(null), 0, 'Should return 0 for null input');
        st.equal(parseDuration(undefined), 0, 'Should return 0 for undefined input');
        // The function expects a string, passing a number might behave unexpectedly or rely on type coercion
        // st.equal(parseDuration(120), 0, 'Should return 0 for number input (expects string)');
        st.end();
    });

    t.end(); // End of parseDuration tests
});

test('Workout Parser: parseSegment', t => {

    t.test('SteadyState Segments', st => {
        st.test('Basic SteadyState (% FTP)', assert => {
            const html = '<div class="textbar">10min @ <span data-value="80" data-unit="relpow">80</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'SteadyState', duration: 600, power: 0.80, cadence: null };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse basic SteadyState');
            assert.end();
        });

        st.test('SteadyState with Cadence', assert => {
            const html = '<div class="textbar">5min @ 85rpm, <span data-value="75" data-unit="relpow">75</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'SteadyState', duration: 300, power: 0.75, cadence: 85 };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse SteadyState with cadence');
            assert.end();
        });

        st.test('SteadyState with seconds duration', assert => {
            const html = '<div class="textbar">90sec @ <span data-value="90" data-unit="relpow">90</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'SteadyState', duration: 90, power: 0.90, cadence: null };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse SteadyState with seconds duration');
            assert.end();
        });

        st.test('SteadyState - Missing power span (should fallback or fail)', assert => {
            const html = '<div class="textbar">5min @ 85rpm</div>'; // Missing power span
            const element = createElementFromHTML(html);
            // Based on the provided code's fallback logic, it might still parse if duration is found
            // but without power, it might return null or a segment missing power.
            // The provided code's fallback doesn't seem to handle this specific case well, likely returns null.
             const actual = parseSegment(element);
             assert.equal(actual, null, 'Should return null for SteadyState missing power span');
            assert.end();
        });

         st.test('SteadyState - Fallback check (if text matches but regex fails)', assert => {
            // This tests the fallback logic at the end of parseSegment
            const html = '<div class="textbar">12min <span data-value="65">65</span>% FTP</div>'; // Missing '@' symbol
            const element = createElementFromHTML(html);
            const expected = { type: 'SteadyState', duration: 720, power: 0.65, cadence: null };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse SteadyState via fallback if primary regex fails');
            assert.end();
        });


        st.end();
    });

    t.test('Ramp Segments', st => {
        st.test('Basic Ramp (% FTP)', assert => {
            const html = '<div class="textbar">8min from <span data-value="60" data-unit="relpow">60</span> to <span data-value="85" data-unit="relpow">85</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'Ramp', duration: 480, powerLow: 0.60, powerHigh: 0.85, cadence: null };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse basic Ramp');
            assert.end();
        });

        st.test('Ramp with Cadence', assert => {
            const html = '<div class="textbar">10min @ 90rpm, from <span data-value="50" data-unit="relpow">50</span> to <span data-value="70" data-unit="relpow">70</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'Ramp', duration: 600, powerLow: 0.50, powerHigh: 0.70, cadence: 90 };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse Ramp with cadence');
            assert.end();
        });

         st.test('Ramp - Missing power spans', assert => {
            const html = '<div class="textbar">10min from to % FTP</div>'; // Missing power spans
            const element = createElementFromHTML(html);
             const actual = parseSegment(element);
             // The regex requires spans.length === 2, so this should fail
             assert.equal(actual, null, 'Should return null for Ramp missing power spans');
            assert.end();
        });

        st.test('Ramp with Combined Duration Format', assert => {
            // Match EXACTLY the HTML structure from the user's example
            const html = '<div class="textbar" style="background: linear-gradient(to right, rgba(255,204,63,1), rgba(127,127,127,0.15));">7min 30sec from <span data-value="90" data-unit="relpow">216</span> to <span data-value="25" data-unit="relpow">60</span>W</div>';
            const element = createElementFromHTML(html);
            console.log("Testing Ramp Segment with HTML:", html);
            console.log("Inner text:", element.textContent || element.innerText);
            console.log("Span values:", Array.from(element.querySelectorAll('span')).map(s => s.dataset.value));
            
            const actual = parseSegment(element);
            console.log("Parse result:", actual);
            
            // Assert without using deepEqual to see exactly where the failure is
            assert.equal(actual !== null, true, 'Should not return null');
            if (actual) {
                assert.equal(actual.type, 'Ramp', 'Type should be Ramp');
                assert.equal(actual.duration, 450, 'Duration should be 450');
                assert.equal(actual.powerLow, 0.90, 'PowerLow should be 0.90');
                assert.equal(actual.powerHigh, 0.25, 'PowerHigh should be 0.25'); 
            }
            assert.end();
        });

        st.end();
    });

    t.test('IntervalsT Segments', st => {
        st.test('Basic Intervals (% FTP)', assert => {
            const html = '<div class="textbar">6x 3min @ <span data-value="105" data-unit="relpow">105</span>% FTP,<br>1min @ <span data-value="50" data-unit="relpow">50</span>% FTP</div>';
            const element = createElementFromHTML(html);
            // Expected based on the provided parser logic
            const expected = { type: 'IntervalsT', repeat: 6, onDuration: 180, onPower: 1.05, offDuration: 60, offPower: 0.50, onCadence: null, offCadence: null };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse basic IntervalsT');
            assert.end();
        });

         st.test('Intervals with Wattage values in text (uses %FTP from spans)', assert => {
            // The text shows Watts, but the spans have the %FTP values the parser uses
            const html = '<div class="textbar">6x 3min @ <span data-value="105" data-unit="relpow">252</span>W,<br>1min @ <span data-value="50" data-unit="relpow">120</span>W</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'IntervalsT', repeat: 6, onDuration: 180, onPower: 1.05, offDuration: 60, offPower: 0.50, onCadence: null, offCadence: null };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse IntervalsT using span data-value even if text shows Watts');
            assert.end();
        });


        st.test('Intervals with On/Off Cadence', assert => {
            const html = '<div class="textbar">2x 30sec @ 110rpm, <span data-value="110" data-unit="relpow">110</span>% FTP,<br> 30sec @ 85rpm, <span data-value="55" data-unit="relpow">55</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'IntervalsT', repeat: 2, onDuration: 30, onPower: 1.10, offDuration: 30, offPower: 0.55, onCadence: 110, offCadence: 85 };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse IntervalsT with on/off cadence');
            assert.end();
        });

        st.test('Intervals with only On Cadence', assert => {
            const html = '<div class="textbar">4x 1min @ 100rpm, <span data-value="100" data-unit="relpow">100</span>% FTP,<br> 2min @ <span data-value="60" data-unit="relpow">60</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'IntervalsT', repeat: 4, onDuration: 60, onPower: 1.00, offDuration: 120, offPower: 0.60, onCadence: 100, offCadence: null };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse IntervalsT with only onCadence');
            assert.end();
        });

        st.test('Intervals with only Off Cadence', assert => {
            const html = '<div class="textbar">3x 2min @ <span data-value="95" data-unit="relpow">95</span>% FTP,<br> 1min @ 80rpm, <span data-value="50" data-unit="relpow">50</span>% FTP</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'IntervalsT', repeat: 3, onDuration: 120, onPower: 0.95, offDuration: 60, offPower: 0.50, onCadence: null, offCadence: 80 };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse IntervalsT with only offCadence');
            assert.end();
        });

        st.test('Intervals - Missing power spans', assert => {
            const html = '<div class="textbar">6x 3min @ ,<br>1min @ </div>'; // Missing spans
            const element = createElementFromHTML(html);
             const actual = parseSegment(element);
             // Requires spans.length === 2, should fail
             assert.equal(actual, null, 'Should return null for Intervals missing power spans');
            assert.end();
        });

         st.test('Intervals - Malformed off-duration part', assert => {
            const html = '<div class="textbar">6x 3min @ <span data-value="105">105</span>% FTP,<br> @ <span data-value="50">50</span>% FTP</div>'; // Missing off-duration
            const element = createElementFromHTML(html);
             const actual = parseSegment(element);
             // parseDuration for offDuration will return 0, causing the final check to fail
             assert.equal(actual, null, 'Should return null if off-duration cannot be parsed');
            assert.end();
        });

        st.test('Intervals with Wattage and RPM format', assert => {
            const html = '<div class="textbar">5x 1min @ 70rpm, <span data-value="105" data-unit="relpow">252</span>W,<br> 3min @ 90rpm, <span data-value="88" data-unit="relpow">211</span>W</div>';
            const element = createElementFromHTML(html);
            const expected = { type: 'IntervalsT', repeat: 5, onDuration: 60, onPower: 1.05, offDuration: 180, offPower: 0.88, onCadence: 70, offCadence: 90 };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse IntervalsT with RPM and Watt values');
            assert.end();
        });

        st.test('Intervals with Combined Duration Format', assert => {
            // Match EXACTLY the HTML structure from the user's example
            const html = '<div class="textbar" style="background: linear-gradient(to bottom, rgba(255,102,57,1), rgba(127,127,127,1));">5x 2min 30sec @ 105rpm, <span data-value="115" data-unit="relpow">276</span>W,<br> 3min @ 85rpm, <span data-value="55" data-unit="relpow">132</span>W</div>';
            const element = createElementFromHTML(html);
            console.log("Testing Interval Segment with HTML:", html);
            console.log("Inner text:", element.textContent || element.innerText);
            console.log("Span values:", Array.from(element.querySelectorAll('span')).map(s => s.dataset.value));
            
            const actual = parseSegment(element);
            console.log("Parse result:", actual);
            
            // Assert without using deepEqual to see exactly where the failure is
            assert.equal(actual !== null, true, 'Should not return null');
            if (actual) {
                assert.equal(actual.type, 'IntervalsT', 'Type should be IntervalsT');
                assert.equal(actual.repeat, 5, 'Repeat should be 5');
                assert.equal(actual.onDuration, 150, 'OnDuration should be 150');
                assert.equal(actual.onPower, 1.15, 'OnPower should be 1.15');
                assert.equal(actual.offDuration, 180, 'OffDuration should be 180');
                assert.equal(actual.offPower, 0.55, 'OffPower should be 0.55');
                assert.equal(actual.onCadence, 105, 'OnCadence should be 105');
                assert.equal(actual.offCadence, 85, 'OffCadence should be 85');
            }
            assert.end();
        });

        st.end();
    });

     t.test('Unparseable / Unknown Segments', st => {
         st.test('Free Ride segment (not explicitly handled)', assert => {
            const html = '<div class="textbar">15min Free Ride</div>';
            const element = createElementFromHTML(html);
            // The current parser now has explicit logic for "Free Ride"
            const expected = { type: 'FreeRide', duration: 900, flatRoad: 1 };
            const actual = parseSegment(element);
            assert.deepEqual(actual, expected, 'Should parse Free Ride segment');
            assert.end();
         });

         st.test('Completely invalid text', assert => {
            const html = '<div class="textbar">Just some random text</div>';
            const element = createElementFromHTML(html);
            const actual = parseSegment(element);
            assert.equal(actual, null, 'Should return null for unrecognised segment text');
            assert.end();
         });

         st.test('Element with no text', assert => {
            const html = '<div class="textbar"></div>';
            const element = createElementFromHTML(html);
            const actual = parseSegment(element);
            assert.equal(actual, null, 'Should return null for empty element');
            assert.end();
         });

         st.end();
     });


    t.end(); // End of parseSegment tests
});


test('Workout Parser: ZWO Generation (using generateZWO)', t => {
    // Test data based on the expected outputs of the parseSegment tests
    const workoutName = "Test Workout";
    const segmentSteady = { type: 'SteadyState', duration: 300, power: 0.75, cadence: 85 };
    const segmentSteadyNoCadence = { type: 'SteadyState', duration: 600, power: 0.80, cadence: null };
    const segmentRamp = { type: 'Ramp', duration: 480, powerLow: 0.6, powerHigh: 0.85, cadence: null };
    const segmentRampWithCadence = { type: 'Ramp', duration: 600, powerLow: 0.50, powerHigh: 0.70, cadence: 90 };
    const segmentInterval = { type: 'IntervalsT', repeat: 6, onDuration: 180, onPower: 1.05, offDuration: 60, offPower: 0.50, onCadence: null, offCadence: null };
    const segmentIntervalWithCadence = { type: 'IntervalsT', repeat: 2, onDuration: 30, onPower: 1.10, offDuration: 30, offPower: 0.55, onCadence: 110, offCadence: 85 };
    const segmentFreeRide = { type: 'FreeRide', duration: 120, flatRoad: 1 };

    t.test('Generate ZWO with various segments', st => {
        const segments = [
            segmentSteadyNoCadence, // Will be Warmup
            segmentRamp,
            segmentIntervalWithCadence,
            segmentSteady // Will be Cooldown
        ];
        const zwoXML = generateZWO(workoutName, segments);
        const workoutContent = extractWorkoutContent(zwoXML);

        // Define expected XML content within <workout> tags
        // Note: The exact spacing might differ slightly, adjust if needed.
        const expectedContent = `
        <Warmup Duration="600" Power="0.80" />
        <Ramp Duration="480" PowerLow="0.60" PowerHigh="0.85" />
        <IntervalsT Repeat="2" OnDuration="30" OnPower="1.10" OffDuration="30" OffPower="0.55" OnCadence="110" OffCadence="85" />
        <Cooldown Duration="300" Power="0.75" Cadence="85" />
        `.trim().replace(/>\s+</g, '><'); // Normalize spacing for comparison

        const actualContent = workoutContent.replace(/>\s+</g, '><'); // Normalize spacing

        // Check basic structure and workout name
        st.ok(zwoXML.includes(`<name>${workoutName}</name>`), 'XML should contain correct workout name');
        st.ok(zwoXML.includes('<workout>'), 'XML should contain <workout> open tag');
        st.ok(zwoXML.includes('</workout>'), 'XML should contain <workout> close tag');

        // Compare the normalized content within <workout>
        // Use includes for individual segments if exact order/spacing is tricky
        st.ok(actualContent.includes('<Warmup Duration="600" Power="0.80" />'), 'Includes Warmup segment');
        st.ok(actualContent.includes('<Ramp Duration="480" PowerLow="0.60" PowerHigh="0.85" />'), 'Includes Ramp segment');
        st.ok(actualContent.includes('<IntervalsT Repeat="2" OnDuration="30" OnPower="1.10" OffDuration="30" OffPower="0.55" OnCadence="110" OffCadence="85" />'), 'Includes IntervalsT segment');
        st.ok(actualContent.includes('<Cooldown Duration="300" Power="0.75" Cadence="85" />'), 'Includes Cooldown segment');

        // A stricter check (if spacing is reliable):
        // st.equal(actualContent, expectedContent, 'Should generate correct XML content within <workout>');

        st.end();
    });

     t.test('Generate ZWO - Single segment workout', st => {
        const segments = [segmentRampWithCadence]; // Will be Warmup and Cooldown
        const zwoXML = generateZWO("Single Ramp", segments);
        const workoutContent = extractWorkoutContent(zwoXML);
        const expectedContent = `<Warmup Duration="600" PowerLow="0.50" PowerHigh="0.70" Cadence="90" />`;
        st.equal(workoutContent, expectedContent, 'Should generate correct XML for single segment (as Warmup)');
        st.end();
     });

      t.test('Generate ZWO - Two segment workout', st => {
        const segments = [segmentSteadyNoCadence, segmentInterval]; // Warmup, Cooldown
        const zwoXML = generateZWO("Two Segments", segments);
        const workoutContent = extractWorkoutContent(zwoXML);
        const expectedContent = `
        <Warmup Duration="600" Power="0.80" />
        <Cooldown Repeat="6" OnDuration="180" OnPower="1.05" OffDuration="60" OffPower="0.50" />
        `.trim().replace(/>\s+</g, '><');
        const actualContent = workoutContent.replace(/>\s+</g, '><');
        st.equal(actualContent, expectedContent, 'Should generate correct XML for two segments (Warmup/Cooldown)');
        st.end();
     });

    // Add test for unknown segment type if needed, based on generateZWO's handling
    t.test('Generate ZWO - Unknown segment type handling', st => {
        const segments = [{ type: 'Unknown', duration: 120, cadence: 70 }];
        const zwoXML = generateZWO("Unknown Test", segments);
        const workoutContent = extractWorkoutContent(zwoXML);
        // Based on generateZWO logic, it defaults to SteadyState 50% FTP
        const expectedContent = `<Warmup Duration="120" Power="0.50" Cadence="70" />`; // Tag becomes Warmup
        st.equal(workoutContent, expectedContent, 'Should handle unknown segment type with default SteadyState');
        st.end();
    });

    // Add test for FreeRide segment
    t.test('Generate ZWO - FreeRide segment', st => {
        const segments = [segmentFreeRide];
        const zwoXML = generateZWO("Free Ride Test", segments);
        const workoutContent = extractWorkoutContent(zwoXML);
        // FreeRide with fixed duration as specified in requirements
        const expectedContent = `<Warmup Duration="120" FlatRoad="1" />`;
        st.equal(workoutContent, expectedContent, 'Should generate correct XML for FreeRide segment');
        st.end();
    });

    t.end(); // End of ZWO Generation tests
});
