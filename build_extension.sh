#!/bin/bash

# Create a clean extension.zip file for distribution
echo "Building extension.zip..."

# Remove old zip if it exists
if [ -f extension.zip ]; then
    rm extension.zip
fi

# Create a new zip with only the necessary files
zip -r extension.zip \
    icons/ \
    content.js \
    manifest.json \
    LICENSE \
    -x "*.git*" "*node_modules*" "tests/*" "README.md" "build_extension.sh"

echo "Extension built successfully!"
echo "Files included in the zip:"
unzip -l extension.zip

# Make the script executable with: chmod +x build_extension.sh 