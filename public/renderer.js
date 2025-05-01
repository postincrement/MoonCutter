const g_deviceTypeSelect    = document.getElementById('deviceTypeSelect');
const g_serialPortSelect    = document.getElementById('serialPortSelect');
const g_refreshButton       = document.getElementById('refreshButton');
const g_connectButton       = document.getElementById('connectButton');
const g_connectionIndicator = document.getElementById('connectionIndicator');
const g_currentXDisplay     = document.getElementById('currentX');
const g_currentYDisplay     = document.getElementById('currentY');

const g_loadImageButton     = document.getElementById('loadImageButton');
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

function logToWindow(type, ...items) {
  const formattedMessage = items.map(item => {
    if (typeof item === 'object') {
      try {
        return JSON.stringify(item, null, 2); 
      } catch (e) {
        return String(item);
      }
    }
    return String(item);
  }).join(' ');
  console.log(formattedMessage);
  window.api.logMessage(formattedMessage, type);
}

////////////////////////////////////////////////////////////
//
//  device type handling
//

window.api.onSetDeviceTypes((event, data) => {
  const deviceNames = data.deviceNames;
  g_deviceTypeSelect.innerHTML = '';

  deviceNames.forEach(name => {
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
  const result = await window.api.setDeviceType({ deviceType });
  if (result.success) {
    g_needsSerialPort = result.needsSerialPort;
    g_serialPortSelect.disabled = !g_needsSerialPort;
  }
  setConnectedState(false);
}

////////////////////////////////////////////////////////////
//
//  serial port handling
//

// Request available serial ports when the page loads
window.api.requestSerialPorts();

// Handle refresh button click
g_refreshButton.addEventListener('click', () => {
  window.api.requestSerialPorts();
});

// Handle serial port list update
window.api.onSerialPortsList((event, ports) => {
  updateSerialPortList(ports);
});

// Handle serial port list update
window.api.onSerialPortsState((event, enabled) => {
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

  window.api.connectPort({
    port: selectedPort,
    timestamp: new Date().toISOString()
  });
});

// Handle connection response
window.api.onConnectResponse((event, data) => {
  if (data.status === 'connected') {
    setConnectedState(true);
    logToWindow('info', 'Successfully connected to serial port');
    logToWindow('info', 'Home response:', data.homeResponse);
    logToWindow('info', 'Fan response:', data.fanResponse);
  } else if (data.status === 'error') {
    setConnectedState(false);
    console.error('Connection error:', data.message);
    alert(`Connection error: ${data.message}`);
  }
});

////////////////////////////////////////////////////////////
//
//  bitmap handling
//

// Declare internal image buffer 
const g_imageBuffer = {
  width:  1024,
  height: 1024,
  data: new Uint8ClampedArray(1024 * 1024 * 4), // RGBA data
  clear() {
    this.data.fill(0); // Fill with transparent black
  }
};

// Clear buffer on startup
g_imageBuffer.clear();

// Handle internal dimensions message from main process
window.api.onSetInternalDimensions((event, dimensions) => {
  createImageBuffer(dimensions.width, dimensions.height);
  logToWindow('info', `Internal dimensions set to ${g_imageBuffer.width}x${g_imageBuffer.height}`);

  // Create a grayscale gradient pattern directly in the buffer
  for (let y = 0; y < g_imageBuffer.height; y++) {
      for (let x = 0; x < g_imageBuffer.width; x++) {
          const i = (y * g_imageBuffer.width + x) * 4;
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
});


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
  tempCanvas.width = g_imageBuffer.width;
  tempCanvas.height = g_imageBuffer.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Get the current image data
  const imageData = tempCtx.getImageData(0, 0, g_imageBuffer.width, g_imageBuffer.height);
  const data = imageData.data;
  const i = (y * g_imageBuffer.width + x) * 4;
  
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
  tempCanvas.width = g_imageBuffer.width;
  tempCanvas.height = g_imageBuffer.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Get the current image data
  const imageData = tempCtx.getImageData(0, 0, g_imageBuffer.width, g_imageBuffer.height);
  const data = imageData.data;
  const i = (y * g_imageBuffer.width + x) * 4;
  
  // Since it's grayscale, we can return any of the RGB channels
  return {
      gray: data[i],
      a: data[i + 3]
  };
}

// Function to check connection and show alert if not connected
function checkConnection() {
  if (!g_isConnected) {
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
  for (let y = 0; y < g_imageBuffer.height; y++) {
      for (let x = 0; x < g_imageBuffer.width; x++) {
          // Check if we're on a grid line
          if (x % gridSize === 0 || y % gridSize === 0) {
              const i = (y * g_imageBuffer.width + x) * 4;
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

// Keep only this event listener for the load image button
g_loadImageButton.addEventListener('click', async () => {
  try {
    const filePath = await window.api.openFileDialog();
    if (!filePath) 
      return;
    
    // Load image into a temp img element
    const img = new Image();
    img.onload = () => {
      loadImage(img);
    }
    img.onerror = () => {
      logToWindow('error', `Failed to load image ${filePath}`);
    };    
    img.src = filePath;
  } catch (err) {
    logToWindow('error', `Failed to load image: ${err.message}`);
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
    g_fanState = !g_fanState;
    
    // Update button text
    g_fanButton.textContent = g_fanState ? 'Fan On' : 'Fan Off';
    
    // Send a message to the main process for the fan command
    window.api.sendFanCommand({
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
    window.api.sendHomeCommand({
        timestamp: new Date().toISOString()
    });
});

// Handle center button click
g_centerButton.addEventListener('click', () => {
    if (!checkConnection()) 
      return;

    // Send a message to the main process for the center command
    window.api.sendCenterCommand({
        timestamp: new Date().toISOString()
    });
});

// Function to handle direction button clicks
function handleDirectionButton(xOffset, yOffset) {
    if (!checkConnection()) return;

    // Send a message to the main process for the direction command
    window.api.sendRelativeMove({
        dx: xOffset,
        dy: yOffset
    });
}

// Handle move response
window.api.onRelativeMoveResponse((event, data) => {
  if (data.status === 'success') {
      // Update coordinates after successful ACK using offsets from the message
      updateCoordinates(g_currentX + data.xOffset, g_currentY + data.yOffset);
  } else if (data.status === 'error') {
      console.error('Move command error:', data.message);
      alert(`Move failed: ${data.message}`);
  }
});

// Handle up button click
g_upButton.addEventListener('click', () => {
    handleDirectionButton(0, -1);
});

// Handle down button click
g_downButton.addEventListener('click', () => {
    handleDirectionButton(0, 1);
});

// Handle left button click
g_leftButton.addEventListener('click', () => {
    handleDirectionButton(-1, 0);
});

// Handle right button click
g_rightButton.addEventListener('click', () => {
    handleDirectionButton(1, 0);
});


// Function to update coordinates
function updateCoordinates(x, y) {
    g_currentX = x;
    g_currentY = y;
    g_currentXDisplay.textContent = g_currentX;
    g_currentYDisplay.textContent = g_currentY;
    logToWindow('debug', `Coordinates updated: X=${g_currentX}, Y=${g_currentY}`);
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
    logToWindow(type, message);
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
  logToWindow('info', 'Starting engraving...'); 
  window.api.startEngraving({
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
      sendLogMessage('Processing line ' + y);
      
      // Create line data (just looking at red channel for simplicity)
      const lineData = new Uint8Array(g_imageBuffer.width);
      
      for (let x = 0; x < g_imageBuffer.width; x++) {
        const index = (y * g_imageBuffer.width + x) * 4;
        // data is already grayscale - return any color channel (in this case red)
        lineData[x] = g_imageBuffer.data[index]; 
      }
      
      // Send line to the serial port and wait for response
      const result = await window.api.sendLineToEngraver({
        lineData: lineData,
        lineNumber: y
      });
      
      if (!result.success) {
        throw new Error(`Failed to process line ${y}: ${result.message}`);
      }
      
      logToWindow('info', 'Line sent:', result);
    }

    stopEngraving();
  } catch (err) {
    logToWindow('error', 'engraving error:', err);
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
  logToWindow('info', 'Stopping engraving...');
  window.api.stopEngraving({});
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

