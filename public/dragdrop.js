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