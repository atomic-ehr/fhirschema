#!/bin/bash

# Script to copy golden test files from Clojure implementation

CLOJURE_TEST_DIR="./fhir-schema-clj/test/golden"
TS_TEST_DIR="./test/golden"

# Create directories
mkdir -p "$TS_TEST_DIR/inputs"
mkdir -p "$TS_TEST_DIR/expected"

# Copy StructureDefinition inputs (*.sd.json) to inputs/
echo "Copying StructureDefinition inputs..."
find "$CLOJURE_TEST_DIR" -name "*.sd.json" -type f | while read -r file; do
    cp "$file" "$TS_TEST_DIR/inputs/"
    echo "  Copied: $(basename "$file")"
done

# Copy FHIRSchema outputs (*.fs.json) to expected/
echo "Copying FHIRSchema expected outputs..."
find "$CLOJURE_TEST_DIR" -name "*.fs.json" -type f | while read -r file; do
    # Preserve directory structure for complex/primitive subdirectories
    rel_path="${file#$CLOJURE_TEST_DIR/}"
    dir_path=$(dirname "$rel_path")
    
    if [ "$dir_path" != "." ]; then
        mkdir -p "$TS_TEST_DIR/expected/$dir_path"
    fi
    
    cp "$file" "$TS_TEST_DIR/expected/$rel_path"
    echo "  Copied: $rel_path"
done

echo "Golden test files copied successfully!"
echo ""
echo "Test structure created:"
tree "$TS_TEST_DIR" -I "node_modules"