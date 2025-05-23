document.addEventListener('DOMContentLoaded', () => {
    const bitmapContainer = document.querySelector('.bitmap-container');
    const dropZone = document.getElementById('dropZone');
    const canvas = document.getElementById('bitmapCanvas');

    // Show drop zone by default
    dropZone.style.display = 'flex';

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        bitmapContainer.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Add paste event listener
    document.addEventListener('paste', handlePaste);

    // Add copy and cut event listeners
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        bitmapContainer.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        bitmapContainer.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    bitmapContainer.addEventListener('drop', handleDrop, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.style.display = 'flex';
    }

    function unhighlight(e) {
        // Only hide if we're not dragging over the container
        if (!e.currentTarget.contains(e.relatedTarget)) {
            dropZone.style.display = 'flex';
        }
    }

    async function handleCopy(e) {
        if (!g_loadedImageBuffer) {
            return; // Don't copy if no image is loaded
        }

        e.preventDefault();
        
        // Create a temporary canvas to get the image data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = g_loadedImageBuffer.m_width;
        tempCanvas.height = g_loadedImageBuffer.m_height;
        const ctx = tempCanvas.getContext('2d');
        
        // Create ImageData from the buffer
        const imageData = new ImageData(
            new Uint8ClampedArray(g_loadedImageBuffer.m_data),
            g_loadedImageBuffer.m_width,
            g_loadedImageBuffer.m_height
        );
        
        // Put the image data on the canvas
        ctx.putImageData(imageData, 0, 0);
        
        try {
            // Convert canvas to blob
            const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
            if (blob) {
                // Use the modern Clipboard API
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]);
                logMessage('info', 'Image copied to clipboard');
            }
        } catch (err) {
            logMessage('error', `Failed to copy image: ${err.message}`);
        }
    }

    async function handleCut(e) {
        await handleCopy(e);
        if (!g_loadedImageBuffer) {
            return;
        }
        
        // Clear the current image and show the drop zone
        g_loadedImageBuffer = null;
        setDefaultImage();
        dropZone.style.display = 'flex';
    }

    function handlePaste(e) {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = () => {
                        loadImage(img);
                        dropZone.style.display = 'none';  // Hide drop zone after image is loaded
                    };
                    img.onerror = () => {
                        logMessage('error', 'Failed to load pasted image');
                    };
                    img.src = event.target.result;
                };
                
                reader.readAsDataURL(blob);
                break;
            }
        }
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                try {
                    // Load image into a temp img element
                    const img = new Image();
                    img.onload = () => {
                        loadImage(img);
                        dropZone.style.display = 'none';  // Hide drop zone after image is loaded
                    }
                    img.onerror = () => {
                        logMessage('error', `Failed to load image ${filePath}`);
                    };    
                    img.src = file.path;
                } catch (err) {
                    logMessage('error', `Failed to load image: ${err.message}`);
                }
            }
        }
    }
}); 