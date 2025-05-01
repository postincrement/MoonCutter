const { ipcRenderer } = require('electron');

const g_deviceTypeSelect    = document.getElementById('deviceTypeSelect');
const g_serialPortSelect    = document.getElementById('serialPortSelect');
const g_refreshButton       = document.getElementById('refreshButton');
const g_connectButton       = document.getElementById('connectButton');
const g_connectionIndicator = document.getElementById('connectionIndicator');
const g_currentXDisplay     = document.getElementById('currentX');
const g_currentYDisplay     = document.getElementById('currentY');

const g_fileInput           = document.getElementById('fileInput');
const g_loadButton          = document.getElementById('loadButton');
const g_fanButton           = document.getElementById('fanButton');
const g_homeButton          = document.getElementById('homeButton');
const g_centerButton        = document.getElementById('centerButton');
const g_upButton            = document.getElementById('upButton');
const g_downButton          = document.getElementById('downButton');
const g_leftButton          = document.getElementById('leftButton');
const g_rightButton         = document.getElementById('rightButton');

const g_startButton         = document.getElementById('startButton');
const g_stopButton          = document.getElementById('stopButton');

let g_fanState = false;         // false = off, true = on
let g_isConnected = false;      // Track connection state
let g_needsSerialPort = false;  // Track if serial port is needed
let g_isRunning = false;        // Track running state
let g_currentX = 0;             // Current X coordinate
let g_currentY = 0;             // Current Y coordinate

// Internal bitmap dimensions
let g_internalWidth = 1600;  // Default values
let g_internalHeight = 1520;

// Create internal image buffer (1600x1520)
const g_imageBuffer = {
  width: g_internalWidth,
  height: g_internalHeight,
  data: new Uint8ClampedArray(g_internalWidth * g_internalHeight * 4), // RGBA data
  clear() {
    this.data.fill(0); // Fill with transparent black
  }
};

// Clear buffer on startup
g_imageBuffer.clear();

// Handle internal dimensions message from main process
ipcRenderer.on('set-internal-dimensions', (event, dimensions) => {
    g_internalWidth   = dimensions.width;
    g_internalHeight  = dimensions.height;
    console.log(`Internal dimensions set to ${g_internalWidth}x${g_internalHeight}`);
    createBitmap();  // Recreate bitmap with new dimensions
});

////////////////////////////////////////////////////////////
//
//  device type handling
//

ipcRenderer.on('set-device-types', (event, data) => {
  const deviceNames = data.deviceNames;
  g_deviceTypeSelect.innerHTML = '';

  deviceNames.forEach(name => {
    // add new option
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    g_deviceTypeSelect.appendChild(option);
  });

  setDeviceType(deviceNames[0]);
});

g_deviceTypeSelect.addEventListener('change', async (event) => {
  setDeviceType(event.target.value);
});

async function setDeviceType(deviceType) {
  const result = await ipcRenderer.invoke('set-device-type', {
    deviceType: deviceType
  });
  if (result.success) {
    g_needsSerialPort = result.needsSerialPort;
    g_serialPortSelect.disabled = !g_needsSerialPort;
  }
  setConnectedState(false);
};

////////////////////////////////////////////////////////////
//
//  serial port handling
//

// Request available serial ports when the page loads
ipcRenderer.send('request-serial-ports');

// Handle refresh button click
g_refreshButton.addEventListener('click', () => {
  ipcRenderer.send('request-serial-ports');
});

// Handle serial port list update
ipcRenderer.on('serial-ports-list', (event, ports) => {
  updateSerialPortList(ports);
});

// Handle serial port list update
ipcRenderer.on('serial-ports-state', (event, enabled) => {
  g_serialPortSelect.disabled = !enabled;
  if (!enabled) {
    setConnectedState(false);
  }
});

// Handle serial port selection change
g_serialPortSelect.addEventListener('change', () => {
  setConnectedState(false);
});

// Function to update serial port list
function updateSerialPortList(ports) {
    // Store current selection
    const currentSelection = g_serialPortSelect.value;
    
    // Clear existing options except the first one
    while (g_serialPortSelect.options.length > 1) {
        g_serialPortSelect.remove(1);
    }
    
    // Add new port options
    ports.forEach(port => {
        const option = document.createElement('option');
        option.value = port.path;
        option.textContent = `${port.path} - ${port.manufacturer || 'Unknown'}`;
        g_serialPortSelect.appendChild(option);
    });

    // Restore previous selection if it still exists
    if (currentSelection && Array.from(g_serialPortSelect.options).some(opt => opt.value === currentSelection)) {
        g_serialPortSelect.value = currentSelection;
    } else {
        // Reset connection state if selected port is no longer available
        setConnectedState(false);
    }
}

////////////////////////////////////////////////////////////
//
//  connect button handling
//

// Handle connect button click
g_connectButton.addEventListener('click', () => {
  const selectedPort = g_serialPortSelect.value;
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
      setConnectedState(true);
      
      // Log successful connection
      sendLogMessage('Successfully connected to serial port');
      sendLogMessage('Home response:', data.homeResponse);
      sendLogMessage('Fan response:', data.fanResponse);
  } else if (data.status === 'error') {
      setConnectedState(false);
      
      // Log connection error
      console.error('Connection error:', data.message);
      alert(`Connection error: ${data.message}`);
  }
});

////////////////////////////////////////////////////////////
//
//  bitmap handling
//

// Create a grayscale bitmap
function createBitmap() {
    // Clear the buffer
    g_imageBuffer.clear();
    
    // Create a grayscale gradient pattern directly in the buffer
    for (let y = 0; y < g_internalHeight; y++) {
        for (let x = 0; x < g_internalWidth; x++) {
            const i = (y * g_internalWidth + x) * 4;
            const grayValue = Math.floor((x + y) / 4) % 256; // Creates a grayscale value between 0-255
            
            // Set RGBA values (all channels same for grayscale)
            g_imageBuffer.data[i] = grayValue;     // Red
            g_imageBuffer.data[i + 1] = grayValue; // Green
            g_imageBuffer.data[i + 2] = grayValue; // Blue
            g_imageBuffer.data[i + 3] = 255;       // Alpha (fully opaque)
        }
    }
    
    // Render the buffer to the canvas
    renderBufferToCanvas();
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

// Function to update a single pixel
function updatePixel(x, y, grayValue, a = 255) {
  const canvas = document.getElementById('bitmapCanvas');
  
  // Create a temporary canvas for the internal bitmap
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = g_internalWidth;
  tempCanvas.height = g_internalHeight;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Get the current image data
  const imageData = tempCtx.getImageData(0, 0, g_internalWidth, g_internalHeight);
  const data = imageData.data;
  const i = (y * g_internalWidth + x) * 4;
  
  // Set all color channels to the same value for grayscale
  data[i] = grayValue;     // Red
  data[i + 1] = grayValue; // Green
  data[i + 2] = grayValue; // Blue
  data[i + 3] = a;         // Alpha
  
  // Put the image data back on the temporary canvas
  tempCtx.putImageData(imageData, 0, 0);
  
  // Scale and draw to the display canvas
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
}

// Function to get pixel value
function getPixel(x, y) {
  const canvas = document.getElementById('bitmapCanvas');
  
  // Create a temporary canvas for the internal bitmap
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = g_internalWidth;
  tempCanvas.height = g_internalHeight;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Get the current image data
  const imageData = tempCtx.getImageData(0, 0, g_internalWidth, g_internalHeight);
  const data = imageData.data;
  const i = (y * g_internalWidth + x) * 4;
  
  // Since it's grayscale, we can return any of the RGB channels
  return {
      gray: data[i],
      a: data[i + 3]
  };
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
    const canvas = document.getElementById('bitmapCanvas');
    
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            // Create a temporary canvas for the internal bitmap
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = g_internalWidth;
            tempCanvas.height = g_internalHeight;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Calculate dimensions to maintain aspect ratio
            const dimensions = calculateAspectRatioFit(
                img.width,
                img.height,
                g_internalWidth,
                g_internalHeight
            );
            
            // Calculate position to center the image
            const x = (g_internalWidth - dimensions.width) / 2;
            const y = (g_internalHeight - dimensions.height) / 2;
            
            // Draw image to temporary canvas with maintained aspect ratio
            tempCtx.drawImage(img, x, y, dimensions.width, dimensions.height);
            
            // Get image data
            const imageData = tempCtx.getImageData(0, 0, g_internalWidth, g_internalHeight);
            
            // Convert to grayscale
            const grayscaleData = convertToGrayscale(imageData);
            
            // Put the grayscale image back on the temporary canvas
            tempCtx.putImageData(grayscaleData, 0, 0);
            
            // Scale and draw to the display canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
        };
        img.src = e.target.result;
    };
    
    reader.readAsDataURL(file);
}

// Handle file input change
g_fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'image/png') {
        loadImage(file);
    }
});

// Handle load button click
g_loadButton.addEventListener('click', () => {
    g_fileInput.click();
});


// Function to check connection and show alert if not connected
function checkConnection() {
  if (!isConnected) {
      alert('Please connect to a serial port first');
      return false;
  }
  return true;
}


// Add event listener for grid test pattern button
document.getElementById('gridTestButton').addEventListener('click', () => {
  // Clear the buffer
  g_imageBuffer.clear();
  
  // Fill buffer with white
  for (let i = 0; i < g_imageBuffer.data.length; i += 4) {
      g_imageBuffer.data[i] = 255;     // Red
      g_imageBuffer.data[i + 1] = 255; // Green
      g_imageBuffer.data[i + 2] = 255; // Blue
      g_imageBuffer.data[i + 3] = 255; // Alpha
  }
  
  const gridSize = 32; // 16x16 grid
  
  // Draw grid lines in the buffer
  for (let y = 0; y < g_internalHeight; y++) {
      for (let x = 0; x < g_internalWidth; x++) {
          // Check if we're on a grid line
          if (x % gridSize === 0 || y % gridSize === 0) {
              const i = (y * g_internalWidth + x) * 4;
              g_imageBuffer.data[i] = 0;     // Red
              g_imageBuffer.data[i + 1] = 0; // Green
              g_imageBuffer.data[i + 2] = 0; // Blue
              g_imageBuffer.data[i + 3] = 255; // Alpha
          }
      }
  }
  
  // Render the buffer to the canvas
  renderBufferToCanvas();
});

// Function to render the buffer to the canvas with scaling
function renderBufferToCanvas() {
  const canvas = document.getElementById('bitmapCanvas');
  const ctx = canvas.getContext('2d');

  // Create ImageData from our buffer
  const imageData = new ImageData(g_imageBuffer.data, g_imageBuffer.width, g_imageBuffer.height);

  // Create a temporary canvas to hold the full-size image
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = g_imageBuffer.width;
  tempCanvas.height = g_imageBuffer.height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.putImageData(imageData, 0, 0);

  // Clear main canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calculate scaling factor to fit in canvas
  const scaleX = canvas.width / g_imageBuffer.width;
  const scaleY = canvas.height / g_imageBuffer.height;
  const scale = Math.min(scaleX, scaleY);

  // Draw scaled image centered in canvas
  const scaledWidth = g_imageBuffer.width * scale;
  const scaledHeight = g_imageBuffer.height * scale;
  const offsetX = (canvas.width - scaledWidth) / 2;
  const offsetY = (canvas.height - scaledHeight) / 2;

  ctx.drawImage(tempCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
}

// Load image button handler
document.getElementById('loadButton').addEventListener('click', async () => {
try {
  const filePath = await window.api.openFileDialog();
  if (!filePath) return;
  
  // Load image into a temp img element
  const img = new Image();
  img.onload = () => {
    // Clear the buffer
    g_imageBuffer.clear();
    
    // Create a temporary canvas to process the image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = g_imageBuffer.width;
    tempCanvas.height = g_imageBuffer.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Calculate scaling to fit image into buffer while maintaining aspect ratio
    const scale = Math.min(
      g_imageBuffer.width / img.width,
      g_imageBuffer.height / img.height
    );
    
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const offsetX = (g_imageBuffer.width - scaledWidth) / 2;
    const offsetY = (g_imageBuffer.height - scaledHeight) / 2;
    
    // Draw image centered in buffer
    tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight);
    
    // Get image data and copy to our buffer
    const imageData = tempCtx.getImageData(0, 0, g_imageBuffer.width, g_imageBuffer.height);
    g_imageBuffer.data.set(imageData.data);
    
    // Render to visible canvas
    renderBufferToCanvas();
    
    //document.getElementById('statusBar').textContent = `Image loaded: ${filePath}`;
  };
  
  img.onerror = () => {
    //document.getElementById('statusBar').textContent = 'Failed to load image';
  };
  
  img.src = filePath;
} catch (err) {
  //document.getElementById('statusBar').textContent = `Error: ${err.message}`;
}
});


////////////////////////////////////////////////////////////
//
//  device button handling
//

// set enable status of all buttons
function setConnectedState(connected) {

  if (!g_needsSerialPort) {
    connected = true;
  }
  else if (!g_serialPortSelect.value) {
    connected = false;
  }

  g_connectButton.disabled = !g_needsSerialPort;

  if (connected) {
    g_connectButton.textContent   = 'Connected';
    g_connectionIndicator.classList.add('connected');
  }
  else {
    g_connectButton.textContent = 'Connect';
    g_connectionIndicator.classList.remove('connected');
  }

  g_isConnected = connected;

  g_fanButton.disabled      = !connected;
  g_homeButton.disabled     = !connected;
  g_centerButton.disabled   = !connected;
  g_upButton.disabled       = !connected;
  g_downButton.disabled     = !connected;
  g_leftButton.disabled     = !connected;
  g_rightButton.disabled    = !connected;
  g_startButton.disabled    = !connected;
  g_stopButton.disabled     = true;
}

// Handle fan button click
g_fanButton.addEventListener('click', () => {
    if (!checkConnection()) 
      return;

    // Toggle fan state
    fanState = !fanState;
    
    // Update button text
    g_fanButton.textContent = g_fanState ? 'Fan On' : 'Fan Off';
    
    // Send a message to the main process for the fan command
    ipcRenderer.send('fan-button-clicked', {
        state: g_fanState,
        timestamp: new Date().toISOString()
    });
});

// Handle home button click
g_homeButton.addEventListener('click', () => {
    if (!checkConnection()) 
      return;

    // Reset coordinates when home is called
    resetCoordinates();

    // Send a message to the main process for the home command
    ipcRenderer.send('home-button-clicked', {
        timestamp: new Date().toISOString()
    });
});

// Handle center button click
g_centerButton.addEventListener('click', () => {
    if (!checkConnection()) 
      return;

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

// Handle up button click
g_upButton.addEventListener('click', () => {
    handleDirectionButton('up-button-clicked', 0, -100);
});

// Handle down button click
g_downButton.addEventListener('click', () => {
    handleDirectionButton('down-button-clicked', 0, 100);
});

// Handle left button click
g_leftButton.addEventListener('click', () => {
    handleDirectionButton('left-button-clicked', -100, 0);
});

// Handle right button click
g_rightButton.addEventListener('click', () => {
    handleDirectionButton('right-button-clicked', 100, 0);
});


// Function to update coordinates
function updateCoordinates(x, y) {
    g_currentX = x;
    g_currentY = y;
    g_currentXDisplay.textContent = g_currentX;
    g_currentYDisplay.textContent = g_currentY;
    console.log(`Coordinates updated: X=${g_currentX}, Y=${g_currentY}`);
}

// Function to reset coordinates to zero
function resetCoordinates() {
    updateCoordinates(0, 0);
}

// Initialize coordinates to zero
resetCoordinates();


////////////////////////////////////////////////////////////
//
//  tab switching handling
//

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


////////////////////////////////////////////////////////////
//
//  log handling
//

// Function to send log messages to the log window
function sendLogMessage(message, type = 'info') {
    ipcRenderer.send('log-message', { message, type });
}

////////////////////////////////////////////////////////////
//
//  status bar handling
//

// Function to update the status bar
function updateStatusBar(message, showProgress = false, progress = 0) {
    const statusText = document.querySelector('.status-text');
    const statusProgress = document.querySelector('.status-progress');
    const progressFill = statusProgress.querySelector('.progress-fill');
    const progressText = statusProgress.querySelector('.progress-text');
    
    // Update text
    statusText.textContent = message;
    
    // Update progress
    if (showProgress) {
        statusProgress.style.display = 'flex';
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
    } else {
        statusProgress.style.display = 'none';
    }
}

// Export the function for use in other parts of the code
window.updateStatusBar = updateStatusBar;

// Initialize status bar
updateStatusBar('Ready'); 


////////////////////////////////////////////////////////////
//
//  engrave button handling
//

// Handle start button click
g_startButton.addEventListener('click', async () => {
  g_isRunning = true;
  g_startButton.disabled = true;
  g_stopButton.disabled = false;

  // start engraving
  console.log('Starting engraving...'); 
  ipcRenderer.send('start-engraving', {
    timestamp: new Date().toISOString()
  });

  updateProgressBar(0);

  try {
    // Process each line of the image buffer and send to serial port
    for (let y = 0; y < g_imageBuffer.height; y++) {
      if (!g_isRunning) {
        break;
      }
      updateProgressBar((y / g_imageBuffer.height) * 100);
      console.log('Processing line', y);
      
      // Create line data (just looking at red channel for simplicity)
      const lineData = new Uint8Array(g_imageBuffer.width);
      
      for (let x = 0; x < g_imageBuffer.width; x++) {
        const index = (y * g_imageBuffer.width + x) * 4;
        // data is already grayscale - return any color channel (in this case red)
        lineData[x] = g_imageBuffer.data[index]; 
      }
      
      // Send line to the serial port and wait for response
      const result = await ipcRenderer.invoke('send-line-to-engraver', {
        lineData: lineData,
        lineNumber: y
      });
      
      if (!result.success) {
        throw new Error(`Failed to process line ${y}: ${result.message}`);
      }
      
      console.log('Line sent:', result);
    }

    stopEngraving();
  } catch (err) {
    console.error('Error during engraving:', err);
    stopEngraving();
  }
});

function updateProgressBar(percent) {
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.querySelector('.progress-text');
  
  if (progressFill && progressText) {
      progressFill.style.width = `${percent}%`;
      progressText.textContent = `${Math.round(percent)}%`;
  }
} 

function stopEngraving() {
  updateProgressBar(100);
  console.log('Stopping engraving...');
  ipcRenderer.send('stop-engraving', {});
  g_isRunning = false;
  g_startButton.disabled = false;
  g_stopButton.disabled = true;
}

// Handle stop button click
g_stopButton.addEventListener('click', () => {
  g_isRunning = false;
  g_startButton.disabled = false;
  g_stopButton.disabled = true;
});

