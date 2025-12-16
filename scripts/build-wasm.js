const fs = require('fs');
const path = require('path');
const wabt = require('wabt');

async function buildWasm() {
    const sourceDir = path.join(__dirname, '..', 'src', 'wasm');
    const targetDir = path.join(__dirname, '..', 'dist', 'wasm');

    // Create dist directory if it doesn't exist
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }

    // Source and target files
    const watSource = path.join(sourceDir, 'vector_simd.wat');
    const wasmTarget = path.join(targetDir, 'vector_simd.wasm');

    console.log('Building WebAssembly with SIMD support...\n');
    console.log(`Source: ${watSource}`);
    console.log(`Target: ${wasmTarget}\n`);

    try {
        // Read WAT source
        const watContent = fs.readFileSync(watSource, 'utf-8');

        // Initialize wabt
        const wabtModule = await wabt();

        // Parse WAT to binary
        const wasmModule = wabtModule.parseWat('vector_simd.wat', watContent, {
            simd: true,           // Enable SIMD support
            bulk_memory: true,    // Enable bulk memory operations
            mutable_globals: true // Enable mutable globals
        });

        // Validate the module
        wasmModule.validate();

        // Generate binary
        const { buffer } = wasmModule.toBinary({
            log: false,
            write_debug_names: false
        });

        // Write WASM file
        fs.writeFileSync(wasmTarget, Buffer.from(buffer));

        // Get file size
        const stats = fs.statSync(wasmTarget);
        const fileSizeKB = (stats.size / 1024).toFixed(2);

        console.log('WebAssembly compilation successful!');
        console.log(`Output file: ${wasmTarget}`);
        console.log(`File size: ${fileSizeKB} KB\n`);

        // Cleanup
        wasmModule.destroy();

        return wasmTarget;
    } catch (error) {
        console.error('\nError details:', error.message);
        if (error.message.includes('syntax error') || error.message.includes('unexpected token')) {
            console.error('\nWAT syntax error. Please check the source file.');
        }
        throw new Error('Failed to compile WebAssembly');
    }
}

// Main build process
buildWasm()
    .then((output) => {
        console.log('Build completed successfully.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\nBuild failed:', error.message);
        process.exit(1);
    });
