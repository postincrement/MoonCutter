const { ipcRenderer } = require('electron');
const canvas = document.getElementById('bitmapCanvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const loadButton = document.getElementById('loadButton');
const connectButton = document.getElementById('connectButton');
const serialPortSelect = document.getElementById('serialPortSelect');
const refreshButton = document.getElementById('refreshButton');
const fanButton = document.getElementById('fanButton');
const homeButton = document.getElementById('homeButton');
const centerButton = document.getElementById('centerButton');
const upButton = document.getElementById('upButton');
const downButton = document.getElementById('downButton');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const connectionIndicator = document.getElementById('connectionIndicator');
const currentXDisplay = document.getElementById('currentX');
const currentYDisplay = document.getElementById('currentY');

let fanState = false; // false = off, true = on
let isConnected = false; // Track connection state
let currentX = 0; // Current X coordinate
let currentY = 0; // Current Y coordinate


// Function to update serial port list
function updateSerialPortList(ports) {
    // Store current selection
    const currentSelection = serialPortSelect.value;
    
    // Clear existing options except the first one
    while (serialPortSelect.options.length > 1) {
        serialPortSelect.remove(1);
    }
    
    // Add new port options
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.manufacturer || 'Unknown'}`;
        serialPortSelect.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentSelection && Array.from(serialPortSelect.options).some(opt => opt.value === currentSelection)) {
        serialPortSelect.value = currentSelection;
    } else {
        // Reset connection state if selected port is no longer available
        isConnected = false;
        connectButton.textContent = 'Connect';
        connectButton.disabled = !serialPortSelect.value;
        fanButton.disabled = true;
        homeButton.disabled = true;
        centerButton.disabled = true;
        connectionIndicator.classList.remove('connected');
    }
}

// Request available serial ports when the page loads
ipcRenderer.send('request-serial-ports');

// Handle refresh button click
refreshButton.addEventListener('click', () => {
    ipcRenderer.send('request-serial-ports');
});

// Handle serial port list update
ipcRenderer.on('serial-ports-list', (event, ports) => {
    updateSerialPortList(ports);
});

// Handle serial port selection change
serialPortSelect.addEventListener('change', () => {
    connectButton.disabled = !serialPortSelect.value;
    isConnected = false;
    connectButton.textContent = 'Connect';
    fanButton.disabled = true;
    homeButton.disabled = true;
    centerButton.disabled = true;
    upButton.disabled = true;
    downButton.disabled = true;
    leftButton.disabled = true;
    rightButton.disabled = true;
    connectionIndicator.classList.remove('connected');
});

// Create a 512x512 grayscale bitmap
function createBitmap() {
    const imageData = ctx.createImageData(512, 512);
    const data = imageData.data;

    // Create a grayscale gradient pattern
    for (let y = 0; y < 512; y++) {
        for (let x = 0; x < 512; x++) {
            const i = (y * 512 + x) * 4;
            const grayValue = Math.floor((x + y) / 4) % 256; // Creates a grayscale value between 0-255
            
            // Set RGBA values (all channels same for grayscale)
            data[i] = grayValue;     // Red
            data[i + 1] = grayValue; // Green
            data[i + 2] = grayValue; // Blue
            data[i + 3] = 255;       // Alpha (fully opaque)
        }
    }

    // Put the image data onto the canvas
    ctx.putImageData(imageData, 0, 0);
}

// Convert image to grayscale
function convertToGrayscale(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // Calculate grayscale value using luminance formula
        const grayValue = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        
        // Set all channels to the grayscale value
        data[i] = grayValue;     // Red
        data[i + 1] = grayValue; // Green
        data[i + 2] = grayValue; // Blue
        // Alpha channel remains unchanged
    }
    return imageData;
}

// Calculate dimensions to maintain aspect ratio
function calculateAspectRatioFit(srcWidth, srcHeight, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / srcWidth, maxHeight / srcHeight);
    return {
        width: Math.round(srcWidth * ratio),
        height: Math.round(srcHeight * ratio)
    };
}

// Load and process image file
function loadImage(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Calculate dimensions to maintain aspect ratio
            const dimensions = calculateAspectRatioFit(
                img.width,
                img.height,
                canvas.width,
                canvas.height
            );
            
            // Calculate position to center the image
            const x = (canvas.width - dimensions.width) / 2;
            const y = (canvas.height - dimensions.height) / 2;
            
            // Draw image to canvas with maintained aspect ratio
            ctx.drawImage(img, x, y, dimensions.width, dimensions.height);
            
            // Get image data
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Convert to grayscale
            const grayscaleData = convertToGrayscale(imageData);
            
            // Put the grayscale image back on the canvas
            ctx.putImageData(grayscaleData, 0, 0);
        };
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

// Handle file input change
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'image/png') {
        loadImage(file);
    }
});

// Handle load button click
loadButton.addEventListener('click', () => {
    fileInput.click();
});

// Handle connect button click
connectButton.addEventListener('click', () => {
    const selectedPort = serialPortSelect.value;
    if (!selectedPort) {
        alert('Please select a serial port first');
        return;
    }

    // Send a message to the main process with the selected port and initial values
    ipcRenderer.send('connect-button-clicked', {
        port: selectedPort,
        timestamp: new Date().toISOString()
    });
});

// Handle connection response
ipcRenderer.on('connect-response', (event, data) => {
  sendLogMessage('Connection response:', data);
    if (data.status === 'connected') {
        isConnected = true;
        connectButton.textContent = 'Connected';
        connectButton.disabled = true;
        // Enable all control buttons
        fanButton.disabled = false;
        homeButton.disabled = false;
        centerButton.disabled = false;
        upButton.disabled = false;
        downButton.disabled = false;
        leftButton.disabled = false;
        rightButton.disabled = false;
        connectionIndicator.classList.add('connected');
        
        // Log successful connection
        sendLogMessage('Successfully connected to serial port');
        sendLogMessage('Home response:', data.homeResponse);
        sendLogMessage('Fan response:', data.fanResponse);
    } else if (data.status === 'error') {
        isConnected = false;
        connectButton.textContent = 'Connect';
        connectButton.disabled = false;
        // Disable all control buttons
        fanButton.disabled = true;
        homeButton.disabled = true;
        centerButton.disabled = true;
        upButton.disabled = true;
        downButton.disabled = true;
        leftButton.disabled = true;
        rightButton.disabled = true;
        connectionIndicator.classList.remove('connected');
        
        // Log connection error
        console.error('Connection error:', data.message);
        alert(`Connection error: ${data.message}`);
    }
});

// Function to check connection and show alert if not connected
function checkConnection() {
    if (!isConnected) {
        alert('Please connect to a serial port first');
        return false;
    }
    return true;
}

// Handle fan button click
fanButton.addEventListener('click', () => {
    if (!checkConnection()) return;

    // Toggle fan state
    fanState = !fanState;
    
    // Update button text
    fanButton.textContent = fanState ? 'Fan On' : 'Fan Off';
    
    // Send a message to the main process for the fan command
    ipcRenderer.send('fan-button-clicked', {
        state: fanState,
        timestamp: new Date().toISOString()
    });
});

// Handle home button click
homeButton.addEventListener('click', () => {
    if (!checkConnection()) return;

    // Reset coordinates when home is called
    resetCoordinates();

    // Send a message to the main process for the home command
    ipcRenderer.send('home-button-clicked', {
        timestamp: new Date().toISOString()
    });
});

// Handle center button click
centerButton.addEventListener('click', () => {
    if (!checkConnection()) return;

    // Send a message to the main process for the center command
    ipcRenderer.send('center-button-clicked', {
        timestamp: new Date().toISOString()
    });
});

// Function to handle direction button clicks
function handleDirectionButton(command, xOffset, yOffset) {
    if (!checkConnection()) return;

    // Send a message to the main process for the direction command
    ipcRenderer.send(command, {
        timestamp: new Date().toISOString(),
        xOffset: xOffset,
        yOffset: yOffset
    });
}

// Handle up button click
upButton.addEventListener('click', () => {
    handleDirectionButton('up-button-clicked', 0, -100);
});

// Handle down button click
downButton.addEventListener('click', () => {
    handleDirectionButton('down-button-clicked', 0, 100);
});

// Handle left button click
leftButton.addEventListener('click', () => {
    handleDirectionButton('left-button-clicked', -100, 0);
});

// Handle right button click
rightButton.addEventListener('click', () => {
    handleDirectionButton('right-button-clicked', 100, 0);
});

// Handle move response
ipcRenderer.on('move-response', (event, data) => {
    if (data.status === 'success') {
        // Update coordinates after successful ACK using offsets from the message
        updateCoordinates(currentX + data.xOffset, currentY + data.yOffset);
    } else if (data.status === 'error') {
        console.error('Move command error:', data.message);
        alert(`Move failed: ${data.message}`);
    }
});

// Initialize the bitmap
createBitmap();

// Disable buttons initially
connectButton.disabled = true;
fanButton.disabled = true;
homeButton.disabled = true;
centerButton.disabled = true;
upButton.disabled = true;
downButton.disabled = true;
leftButton.disabled = true;
rightButton.disabled = true;

// Function to update a single pixel
function updatePixel(x, y, grayValue, a = 255) {
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    const i = (y * 512 + x) * 4;
    
    // Set all color channels to the same value for grayscale
    data[i] = grayValue;     // Red
    data[i + 1] = grayValue; // Green
    data[i + 2] = grayValue; // Blue
    data[i + 3] = a;         // Alpha
    
    ctx.putImageData(imageData, 0, 0);
}

// Function to get pixel value
function getPixel(x, y) {
    const imageData = ctx.getImageData(0, 0, 512, 512);
    const data = imageData.data;
    const i = (y * 512 + x) * 4;
    
    // Since it's grayscale, we can return any of the RGB channels
    return {
        gray: data[i],
        a: data[i + 3]
    };
}

// Function to update coordinates
function updateCoordinates(x, y) {
    currentX = x;
    currentY = y;
    currentXDisplay.textContent = currentX;
    currentYDisplay.textContent = currentY;
    console.log(`Coordinates updated: X=${currentX}, Y=${currentY}`);
}

// Function to reset coordinates to zero
function resetCoordinates() {
    updateCoordinates(0, 0);
}

// Initialize coordinates to zero
resetCoordinates();

// Export functions for use in the main process
window.bitmapAPI = {
    updatePixel,
    getPixel,
    createBitmap
};

// Tab switching functionality
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons and panes
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
        
        // Add active class to clicked button and corresponding pane
        button.classList.add('active');
        document.getElementById(`${button.dataset.tab}-tab`).classList.add('active');
    });
});

// Function to send log messages to the log window
function sendLogMessage(message, type = 'info') {
    ipcRenderer.send('log-message', { message, type });
}

// Add event listener for grid test pattern button
document.getElementById('gridTestButton').addEventListener('click', () => {
    const canvas = document.getElementById('bitmapCanvas');
    const ctx = canvas.getContext('2d');
    const size = 512;
    const gridSize = 32; // 16x16 grid
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    
    // Draw grid
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    
    // Draw vertical lines
    for (let x = 0; x <= size; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
    }
    
    // Draw horizontal lines
    for (let y = 0; y <= size; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
    }
}); 