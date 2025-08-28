/**
 * WhatsOnZwift Workout Exporter Content Script
 *
 * This script runs on whatsonzwift.com workout pages. It parses the workout
 * structure displayed on the page, generates a Zwift Workout (.zwo) file,
 * and adds a button to download this file.
 */

console.log("WhatsOnZwift Exporter: Content script injected.");

function parseDuration(durationStr) {
    if (!durationStr) return 0;
    let duration = 0;
    
    // Handle combined formats like "7min 30sec"
    if (durationStr.includes("min") && durationStr.includes("sec")) {
        const minMatch = durationStr.match(/([\d.]+)\s*min/i);
        const secMatch = durationStr.match(/([\d.]+)\s*sec/i);
        
        const minutes = minMatch && minMatch[1] ? parseFloat(minMatch[1]) : 0;
        const seconds = secMatch && secMatch[1] ? parseFloat(secMatch[1]) : 0;
        
        duration = (minutes * 60) + seconds;
    } else {
        // Handle simple formats like "7min" or "30sec"
        const minMatch = durationStr.match(/([\d.]+)\s*min/i);
        const secMatch = durationStr.match(/([\d.]+)\s*sec/i);

        if (minMatch && minMatch[1]) {
            duration = parseFloat(minMatch[1]) * 60;
        } else if (secMatch && secMatch[1]) {
            duration = parseFloat(secMatch[1]);
        }
    }

    if (isNaN(duration) || duration < 0) {
        console.warn("Could not parse duration:", durationStr);
        return 0; // Return 0 for invalid or unparsed durations
    }
    // ZWO format requires integer seconds for duration
    return Math.round(duration);
}

function parseSegment(element) {
    // Use innerText if available (browser), otherwise use textContent (tests)
    const text = (element.innerText || element.textContent || '').trim();
    const spans = element.querySelectorAll('span[data-value]');
    const style = element.getAttribute('style') || '';

    // Extract cadence if present
    const cadenceMatch = text.match(/(\d+)\s*rpm/i);
    const cadence = cadenceMatch ? parseInt(cadenceMatch[1], 10) : null;

    // Check for Free Ride: "Xmin free ride"
    const freeRideMatch = text.match(/^([\d.]+)\s*(min|sec)\s+free\s+ride/i);
    if (freeRideMatch) {
        const durationStr = `${freeRideMatch[1]}${freeRideMatch[2]}`;
        const duration = parseDuration(durationStr);
        if (duration > 0) {
            return { type: 'FreeRide', duration, flatRoad: 1 };
        }
    }

    // Check for Ramp: "Xmin from Y to Z % FTP"
    // Special pattern for combined format "7min 30sec from Y to Z"
    const rampCombinedMatch = text.match(/^(\d+)\s*min\s+(\d+)\s*sec\s+from\s+/i);
    if (rampCombinedMatch && spans.length === 2) {
        const minutes = parseInt(rampCombinedMatch[1], 10) || 0;
        const seconds = parseInt(rampCombinedMatch[2], 10) || 0;
        const duration = (minutes * 60) + seconds;
        
        const powerLow = parseFloat(spans[0].dataset.value) / 100;
        const powerHigh = parseFloat(spans[1].dataset.value) / 100;
        
        if (duration > 0 && !isNaN(powerLow) && !isNaN(powerHigh)) {
            return { type: 'Ramp', duration, powerLow, powerHigh, cadence };
        }
    }
    
    // Improved to handle combined minute/second formats like "7min 30sec from..."
    const rampMatch = text.match(/^([\d.]+(?:\s+\d+sec)?)\s*(min|sec)\s+from\s+/i);
    
    // Also check for ramp with cadence format: "Xmin @ Nrpm, from Y to Z % FTP"
    const rampWithCadenceMatch = text.match(/^([\d.]+(?:\s+\d+sec)?)\s*(min|sec)\s+@\s+\d+rpm,\s+from\s+/i);
    
    if ((rampMatch || rampWithCadenceMatch) && spans.length === 2) {
        // Extract duration from whichever match succeeded
        const durationMatch = rampWithCadenceMatch || rampMatch;
        let durationStr = `${durationMatch[1]}${durationMatch[2]}`;
        
        // Handle combined formats like "7min 30sec"
        if (durationMatch[1].includes("min") || durationMatch[1].includes("sec")) {
            durationStr = durationMatch[1];
        } else {
            durationStr = `${durationMatch[1]}${durationMatch[2]}`;
        }
        
        const duration = parseDuration(durationStr);
        const powerLow = parseFloat(spans[0].dataset.value) / 100;
        const powerHigh = parseFloat(spans[1].dataset.value) / 100;
        if (duration > 0 && !isNaN(powerLow) && !isNaN(powerHigh)) {
            return { type: 'Ramp', duration, powerLow, powerHigh, cadence };
        }
    }

    // Check for Steady State: "Xmin @ Y % FTP"
    const steadyMatch = text.match(/^([\d.]+(?:\s+\d+sec)?)\s*(min|sec)\s+@\s+/i);
    if (steadyMatch && spans.length === 1) {
        let durationStr = steadyMatch[1];
        if (!durationStr.includes("min") && !durationStr.includes("sec")) {
            durationStr = `${steadyMatch[1]}${steadyMatch[2]}`;
        }
        const duration = parseDuration(durationStr);
        const power = parseFloat(spans[0].dataset.value) / 100;
        if (duration > 0 && !isNaN(power)) {
            return { type: 'SteadyState', duration, power, cadence };
        }
    }

    // Special case for combined minute+second interval format:
    // "5x 2min 30sec @ 105rpm, 276W, 3min @ 85rpm, 132W"
    const intervalCombinedMatch = text.match(/^(\d+)x\s+(\d+)\s*min\s+(\d+)\s*sec\s+@\s+/i);
    if (intervalCombinedMatch && spans.length === 2) {
        try {
            const repeat = parseInt(intervalCombinedMatch[1], 10);
            const onMinutes = parseInt(intervalCombinedMatch[2], 10) || 0;
            const onSeconds = parseInt(intervalCombinedMatch[3], 10) || 0;
            const onDuration = (onMinutes * 60) + onSeconds;
            
            // Get power values from span attributes
            const onPower = parseFloat(spans[0].dataset.value) / 100;
            const offPower = parseFloat(spans[1].dataset.value) / 100;
            
            // Extract cadence values
            let onCadence = null, offCadence = null;
            
            // Look for on cadence
            const onCadenceMatch = text.match(/(\d+)x\s+\d+\s*min\s+\d+\s*sec\s+@\s+(\d+)\s*rpm/i);
            if (onCadenceMatch) {
                onCadence = parseInt(onCadenceMatch[2], 10);
            }
            
            // Look for off cadence
            const normalizedText = text.replace(/<br\s*\/?>|\n/gi, ',');
            const parts = normalizedText.split(/,\s*/);
            
            if (parts.length > 1) {
                // Look for cadence in the second part
                const offCadenceMatch = parts.slice(1).join(',').match(/(\d+)\s*rpm/i);
                if (offCadenceMatch) {
                    offCadence = parseInt(offCadenceMatch[1], 10);
                }
                
                // Extract off duration
                const offText = parts.slice(1).join(',');
                let offDuration = 0;
                
                // Look for durations in format "3min"
                const offDurationMatch = offText.match(/(\d+(?:\.\d+)?)\s*min(?:\s+(\d+)\s*sec)?/i);
                if (offDurationMatch) {
                    const minutes = parseFloat(offDurationMatch[1]) || 0;
                    const seconds = parseInt(offDurationMatch[2] || 0);
                    offDuration = (minutes * 60) + seconds;
                }
                
                if (offDuration > 0 && !isNaN(repeat) && onDuration > 0 && !isNaN(onPower) && !isNaN(offPower)) {
                    return { type: 'IntervalsT', repeat, onDuration, onPower, offDuration, offPower, onCadence, offCadence };
                }
            }
        } catch (error) {
            console.error("Error parsing interval with combined format:", error, text);
        }
    }

    // Check for Intervals, handle various formats:
    // "Nx Xmin @ Y% FTP,<br> Mmin @ Z% FTP"
    // "Nx Xmin @ 70rpm, 252W,<br> Mmin @ 90rpm, 211W"
    // "5x 1min @ 70rpm, 252W,<br> 3min @ 90rpm, 211W"
    // "5x 1min 30sec @ 100rpm, 252W,<br> 2min 30sec @ 85rpm, 211W"
    const intervalMatch = text.match(/^(\d+)x\s+([\d.]+(?:\s+\d+sec)?)\s*(min|sec)?\s+@\s+/i);
    if (intervalMatch && spans.length === 2) {
        try {
            const repeat = parseInt(intervalMatch[1], 10);
            // Handle compound durations like "1min 30sec"
            let onDurationStr = intervalMatch[2];
            if (intervalMatch[3] && !onDurationStr.includes("min") && !onDurationStr.includes("sec")) {
                onDurationStr += intervalMatch[3];
            }
            const onDuration = parseDuration(onDurationStr);
            
            // IMPORTANT: Get power values from span data-value attributes
            // These always contain the %FTP values even if the display shows Watts
            const onPower = parseFloat(spans[0].dataset.value) / 100;
            const offPower = parseFloat(spans[1].dataset.value) / 100;
            
            // Extract cadence values
            let onCadence = null, offCadence = null;
            
            // First, try to find the on cadence at the beginning of the interval
            // Example: "5x 1min @ 70rpm, 252W, 3min @ 90rpm, 211W"
            const onCadenceMatch = text.match(/(\d+)x\s+[\d.]+(?:\s+\d+sec)?\s*(?:min|sec)?\s+@\s+(\d+)\s*rpm/i);
            if (onCadenceMatch) {
                onCadence = parseInt(onCadenceMatch[2], 10);
            }
            
            // Initialize offDuration at the outer scope
            let offDuration = 0;
            
            // Try to find the off cadence in the second part (after the first comma or <br>)
            // Normalize newlines and commas to make parsing easier
            const normalizedText = text.replace(/<br\s*\/?>|\n/gi, ',');
            const parts = normalizedText.split(/,\s*/);
            
            if (parts.length > 1) {
                // Look for cadence in the second part
                const offCadenceMatch = parts.slice(1).join(',').match(/(\d+)\s*rpm/i);
                if (offCadenceMatch) {
                    offCadence = parseInt(offCadenceMatch[1], 10);
                }
                
                // Extract off duration - look for duration pattern in second part
                // This combines multiple approaches for robustness
                
                // First look for a duration pattern in the second part
                const offText = parts.slice(1).join(',');
                
                // Look for durations like "2min" or "1min 30sec" or "30sec"
                const minSecMatch = offText.match(/(\d+(?:\.\d+)?)\s*min(?:\s+(\d+)\s*sec)?/i);
                const secOnlyMatch = offText.match(/(\d+(?:\.\d+)?)\s*sec/i);
                
                if (minSecMatch) {
                    const minutes = parseFloat(minSecMatch[1]) || 0;
                    const seconds = parseInt(minSecMatch[2] || 0);
                    offDuration = (minutes * 60) + seconds;
                } else if (secOnlyMatch) {
                    offDuration = parseFloat(secOnlyMatch[1]);
                }
            }
            
            // Try a fallback approach if we couldn't get the off duration
            if (offDuration <= 0) {
                // Fallback to original regex approach
                const offDurationMatch = text.match(/(?:,|<br>|\\n).*?([\d.]+(?:\s+\d+sec)?)\s*(min|sec)/i);
                if (offDurationMatch) {
                    let offDurationStr = offDurationMatch[1];
                    if (!offDurationStr.includes("min") && !offDurationStr.includes("sec")) {
                        offDurationStr = `${offDurationMatch[1]}${offDurationMatch[2]}`;
                    }
                    offDuration = parseDuration(offDurationStr);
                }
                
                // Try an even more generic approach for "X% FTP"-formatted intervals
                if (offDuration <= 0 && text.includes("% FTP")) {
                    // For cases like: "3x 2min @ 95% FTP, 1min @ 80rpm, 50% FTP"
                    const ftpFormatMatch = text.match(/,\s*([\d.]+(?:\s+\d+sec)?)\s*(min|sec)\s+@/i);
                    if (ftpFormatMatch) {
                        let offDurationStr = ftpFormatMatch[1];
                        if (!offDurationStr.includes("min") && !offDurationStr.includes("sec")) {
                            offDurationStr = `${ftpFormatMatch[1]}${ftpFormatMatch[2]}`;
                        }
                        offDuration = parseDuration(offDurationStr);
                    }
                }
            }
            
            if (!isNaN(repeat) && onDuration > 0 && !isNaN(onPower) && offDuration > 0 && !isNaN(offPower)) {
                return { type: 'IntervalsT', repeat, onDuration, onPower, offDuration, offPower, onCadence, offCadence };
            } else {
                console.warn("Invalid interval values:", { repeat, onDuration, onPower, offDuration, offPower });
            }
        } catch (error) {
            console.error("Error parsing interval:", error, text);
        }
    }

    // Fallback or complex structure not directly parsed yet.
    console.warn("Could not parse segment:", text);
    // Could add more checks here, e.g., for FreeRide if text contains "Free Ride"
    // Or try parsing spans directly if text format is unexpected
    if (spans.length === 1) {
        // Maybe a simple steady state missed by regex?
        const durationMatch = text.match(/^([\d.]+(?:\s+\d+sec)?)\s*(min|sec)/i);
        if (durationMatch) {
            let durationStr = durationMatch[1];
            if (!durationStr.includes("min") && !durationStr.includes("sec")) {
                durationStr = `${durationMatch[1]}${durationMatch[2]}`;
            }
            const duration = parseDuration(durationStr);
            const power = parseFloat(spans[0].dataset.value) / 100;
            if (duration > 0 && !isNaN(power)) {
                return { type: 'SteadyState', duration, power, cadence };
            }
        }
    }

    return null; // Indicate failure to parse
}

function generateZWO(workoutName, segments) {
    let xml = `
    <workout_file>
        <author>WhatsOnZwift Exporter</author>
        <name>${workoutName}</name>
        <description>Workout exported from WhatsOnZwift: ${window.location.href}</description>
        <sportType>bike</sportType>
        <tags/>
        <workout>\n`;

    segments.forEach((segment, index) => {
        // ZWO requires Warmup and Cooldown tags for the first and last elements *within* <workout>
        const isFirst = index === 0;
        const isLast = index === segments.length - 1;
        
        // Clone the segment so we don't modify the original
        const segmentToProcess = { ...segment };
        
        // Override tag type for first/last segments if needed by ZWO structure
        if (isFirst) {
            segmentToProcess.originalType = segmentToProcess.type;
            segmentToProcess.type = 'Warmup';
        } else if (isLast && segments.length > 1) {
            segmentToProcess.originalType = segmentToProcess.type;
            segmentToProcess.type = 'Cooldown';
        }

        xml += `        <${segmentToProcess.type} `;

        // Use original type properties to determine what attributes to output
        const originalType = segmentToProcess.originalType || segmentToProcess.type;

        switch (originalType) {
            case 'Ramp':
                xml += `Duration="${segmentToProcess.duration}" PowerLow="${segmentToProcess.powerLow.toFixed(2)}" PowerHigh="${segmentToProcess.powerHigh.toFixed(2)}"`;
                if (segmentToProcess.cadence) {
                    xml += ` Cadence="${segmentToProcess.cadence}"`;
                }
                break;
            case 'SteadyState':
                xml += `Duration="${segmentToProcess.duration}" Power="${segmentToProcess.power.toFixed(2)}"`;
                if (segmentToProcess.cadence) {
                    xml += ` Cadence="${segmentToProcess.cadence}"`;
                }
                break;
            case 'IntervalsT':
                xml += `Repeat="${segmentToProcess.repeat}" OnDuration="${segmentToProcess.onDuration}" OnPower="${segmentToProcess.onPower.toFixed(2)}" OffDuration="${segmentToProcess.offDuration}" OffPower="${segmentToProcess.offPower.toFixed(2)}"`;
                if (segmentToProcess.onCadence) {
                    xml += ` OnCadence="${segmentToProcess.onCadence}"`;
                }
                if (segmentToProcess.offCadence) {
                    xml += ` OffCadence="${segmentToProcess.offCadence}"`;
                }
                break;
            case 'FreeRide':
                xml += `Duration="${segmentToProcess.duration}" FlatRoad="${segmentToProcess.flatRoad || 1}"`;
                if (segmentToProcess.cadence) {
                    xml += ` Cadence="${segmentToProcess.cadence}"`;
                }
                break;
            // Add cases for FreeRide etc. if implemented
            default:
                console.warn("Unhandled segment type for ZWO generation:", originalType);
                // Default to SteadyState with 0.5 power if type unknown but has duration?
                if (segmentToProcess.duration) {
                    xml += `Duration="${segmentToProcess.duration}" Power="0.50"`;
                    if (segmentToProcess.cadence) {
                        xml += ` Cadence="${segmentToProcess.cadence}"`;
                    }
                } else {
                    xml = xml.replace(`<${segmentToProcess.type} `, `<SteadyState `); // Fix opening tag
                    xml += `Duration="60" Power="0.50"`; // Use a safe default
                }
        }
        xml += ` />\n`;
    });

    xml += `    </workout>
</workout_file>`;

    return xml;
}

function downloadFile(filename, content, mimeType = 'application/xml') {
    try {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`WhatsOnZwift Exporter: Download triggered for ${filename}`);
    } catch (error) {
        console.error("WhatsOnZwift Exporter: Error triggering download:", error);
        alert("Error creating download link. See console for details.");
    }
}

function getWorkoutName() {
    return document.querySelector("h4.flaticon-bike")?.innerText?.trim() || "Zwift Workout";
}


function addDownloadButton() {
    const workoutListDiv = document.querySelector('article > section > div > div');
    const referenceButton = workoutListDiv?.querySelector('button[name="update-ftp"]');

    if (!workoutListDiv || !referenceButton) {
        console.warn("WhatsOnZwift Exporter: Workout list container or reference button not found. Button not added.");
        // setTimeout(addDownloadButton, 1000);
        return;
    }

    if (workoutListDiv.querySelector('.zwo-download-button')) {
        console.log("WhatsOnZwift Exporter: Download button already exists.");
        return;
    }

    const downloadButton = document.createElement('button');
    downloadButton.textContent = 'Download .zwo';
    downloadButton.type = 'button';

    Object.assign(downloadButton.style, {
        display: 'block', width: 'calc(100% - 4px)', marginTop: '5px', marginBottom: '5px', padding: '8px 16px',
        backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px',
        cursor: 'pointer', fontSize: '14px', textAlign: 'center', fontFamily: 'inherit'
    });
    downloadButton.onmouseover = () => { downloadButton.style.backgroundColor = '#45a049'; };
    downloadButton.onmouseout = () => { downloadButton.style.backgroundColor = '#4CAF50'; };

    downloadButton.addEventListener('click', () => {
        if (document.querySelector('button[name="update-ftp"]')?.innerText?.includes('ENTER FTP')) {
            return document.querySelector('button[name="update-ftp"]').click();
        }
        console.log("WhatsOnZwift Exporter: Download button clicked.");
        downloadButton.textContent = 'Processing...';
        downloadButton.disabled = true;

        const segmentElements = workoutListDiv.querySelectorAll('.textbar');
        if (!segmentElements?.length) {
            alert("Could not find any workout segments on the page.");
            downloadButton.textContent = 'Download .zwo';
            downloadButton.disabled = false;
            return;
        }

        const parsedSegments = [];
        let parseWarnings = 0;
        segmentElements.forEach((el, index) => {
            try {
                const segment = parseSegment(el);
                if (segment) {
                    parsedSegments.push(segment);
                } else {
                    parseWarnings++;
                    console.warn(`WhatsOnZwift Exporter: Skipping unparsable segment #${index + 1}:`, el.innerText);
                }
            } catch (parseError) {
                 parseWarnings++;
                 console.error(`WhatsOnZwift Exporter: Error parsing segment #${index + 1}:`, el.innerText, parseError);
            }
        });

        if (parsedSegments.length === 0) {
            alert("Failed to parse any workout segments. Cannot generate ZWO file.");
            downloadButton.textContent = 'Download .zwo';
            downloadButton.disabled = false;
            return;
        }

        if (parseWarnings > 0) {
            alert(`Warning: ${parseWarnings} segment(s) could not be fully parsed and were skipped. Check the console (F12) for details. The generated ZWO file might be incomplete.`);
        }

        const workoutName = getWorkoutName();

        try {
            const zwoContent = generateZWO(workoutName, parsedSegments);
            const formattedZwoContent = new XMLSerializer().serializeToString(new DOMParser().parseFromString(zwoContent, "application/xml"));
            const safeFilename = workoutName.replace(/[^a-z0-9_\-\s\.]/gi, '_').replace(/\s+/g, '_') + ".zwo";
            downloadFile(safeFilename, formattedZwoContent);
        } catch (error) {
            console.error("WhatsOnZwift Exporter: Error generating or downloading ZWO file:", error);
            alert("An error occurred while creating the ZWO file. Check the browser console (F12) for details.");
        } finally {
             setTimeout(() => {
                downloadButton.textContent = 'Download .zwo';
                downloadButton.disabled = false;
             }, 500);
        }
    });

    referenceButton.parentNode.insertBefore(downloadButton, referenceButton.nextSibling);
    console.log("WhatsOnZwift Exporter: Download button added successfully.");
}

// --- Initialization ---
// Only run in browser environment, not during tests
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addDownloadButton);
    } else {
        setTimeout(addDownloadButton, 500);
    }
}
