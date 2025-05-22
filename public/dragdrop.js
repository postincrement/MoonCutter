document.addEventListener('DOMContentLoaded', () => {
    const bitmapContainer = document.querySelector('.bitmap-container');
    const dropZone = document.getElementById('dropZone');
    const canvas = document.getElementById('bitmapCanvas');

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
        dropZone.style.display = 'none';
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