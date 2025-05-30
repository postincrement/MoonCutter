const g_deviceTypeSelect    = document.getElementById('deviceTypeSelect');
const g_serialPortSelect    = document.getElementById('serialPortSelect');
const g_refreshButton       = document.getElementById('refreshButton');
const g_connectButton       = document.getElementById('connectButton');
const g_connectionIndicator = document.getElementById('connectionIndicator');
const g_loadImageButton     = document.getElementById('loadImageButton');

const g_startButton         = document.getElementById('startButton');
const g_stopButton          = document.getElementById('stopButton');
const g_homeButton          = document.getElementById('homeButton');
const g_engraveAreaButton   = document.getElementById('engraveAreaButton');

let g_fanState = false;         // false = off, true = on
let g_isConnected = false;      // Track connection state
let g_needsSerialPort = false;  // Track if serial port is needed
let g_isRunning = false;        // Track running state

let g_bitmapWidth = 0;
let g_bitmapHeight = 0;

// Add scale slider handler
const scaleSlider = document.getElementById('scaleSlider');
const scaleValue = document.getElementById('scaleValue');

scaleSlider.addEventListener('input', () => {
    const scale = scaleSlider.value / 100;
    g_imageScale = g_maxImageScale * scale;
    scaleValue.textContent = `${scaleSlider.value}%`;
    adjustOffsetAfterRotation();
    renderImageToCanvas();
});

// Add threshold slider handler
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');

thresholdSlider.addEventListener('input', () => {
    g_threshold = parseInt(thresholdSlider.value);
    thresholdValue.textContent = thresholdSlider.value;
    renderImageToCanvas();
});

// Update scale slider when new image is loaded
function updateScaleSlider() {
    scaleSlider.value = 100;
    scaleValue.textContent = '100%';
    g_imageScale = g_maxImageScale;
    updateOffsetDisplay();
}

// Add speed and power slider handlers
const speedSlider = document.getElementById('speedSlider');
const speedValue = document.getElementById('speedValue');
const powerSlider = document.getElementById('powerSlider');
const powerValue = document.getElementById('powerValue');

speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value;
});

powerSlider.addEventListener('input', () => {
    powerValue.textContent = powerSlider.value;
});

function logMessage(type, ...items) {
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

window.api.onSetDeviceTypes(async (event, data) => {
  const deviceNames = data.deviceNames;
  g_deviceTypeSelect.innerHTML = '';

  deviceNames.forEach(name => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    g_deviceTypeSelect.appendChild(option);
  });

  await setDeviceType(deviceNames[0])
  .then(() => {
    setDefaultImage();
    renderImageToCanvas();
  });
});

g_deviceTypeSelect.addEventListener('change', async (event) => {
  await setDeviceType(event.target.value)
  .then(() => {
    if (g_loadedImageBuffer.m_default) {
      setDefaultImage();
    }
    else {
      loadImage(g_loadedImageBuffer.m_image);
    }
    renderImageToCanvas();
  });
});

async function setDeviceType(deviceType) {
  const result = await window.api.setDeviceType({ deviceType });
  if (result.success) {

    logMessage('info', `device type requested ${deviceType}`);

    g_needsSerialPort           = result.needsSerialPort;
    g_serialPortSelect.disabled = !g_needsSerialPort;

    g_engraverDimensions        = result.engraverDimensions;

    g_engraveBuffer             = new ImageBuffer(g_engraverDimensions.width, g_engraverDimensions.height);

    logMessage('info', `engraver dimensions: ${g_engraveBuffer.m_width}x${g_engraveBuffer.m_height}`);
    
    resizeBitmapCanvas();

    drawScaleIndicators(g_engraverDimensions.widthMm + ' mm', g_engraverDimensions.heightMm + ' mm');
  }
  setConnectedState(false);
  logMessage('info', `setDeviceType end`);
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
        // Remove /dev/ prefix on macOS
        const displayPath = port.path.replace('/dev/', '');
        option.textContent = displayPath;
        if (port.manufacturer) {
          option.textContent += ` - ${port.manufacturer}`;
        }
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
    logMessage('info', 'Connected');
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

// Function to check connection and show alert if not connected
function checkConnection() {
  if (!g_isConnected) {
      alert('Please connect to a serial port first');
      return false;
  }
  return true;
}

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
      logMessage('error', `Failed to load image ${filePath}`);
    };    
    img.src = filePath;
  } catch (err) {
    logMessage('error', `Failed to load image: ${err.message}`);
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

  g_startButton.disabled     = !connected;
  g_stopButton.disabled      = true;
  g_homeButton.disabled      = !connected;
  g_engraveAreaButton.disabled = !connected;
}

////////////////////////////////////////////////////////////
//
//  tab switching handling
//

// Tab switching functionality
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // If engraving is running and trying to switch away from engrave tab, prevent it
        if (g_isRunning && button.dataset.tab !== 'engrave') {
            logMessage('info', 'Cannot switch tabs while engraving is in progress');
            return;
        }

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
    logMessage(type, message);
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
//  engrave area button handling
//

document.getElementById('engraveAreaButton').addEventListener('click', () => {
  if (!checkConnection()) {
    return;
  }
  
  logMessage('info', 'Engrave Area button clicked');
  window.api.engraveArea(g_boundingBox);
});

// Add handler for engrave area response
window.api.onEngraveAreaResponse((event, data) => {
  if (data.status === 'error') {
    logMessage('error', 'Engrave area error:', data.message);
    alert('Engrave area error: ' + data.message);
  } else {
    logMessage('info', 'Engrave area command sent successfully');
  }
});

// Add home button click handler
document.getElementById('homeButton').addEventListener('click', () => {
  if (!checkConnection()) {
    return;
  }
  
  logMessage('info', 'Home button clicked');
  window.api.sendHomeCommand({
    timestamp: new Date().toISOString()
  });
});

// Add handler for home response
window.api.onHomeResponse((event, data) => {
  if (data.status === 'error') {
    logMessage('error', 'Home command error:', data.message);
    alert('Home command error: ' + data.message);
  } else {
    logMessage('info', 'Home command sent successfully');
  }
});

// Handle start button click
g_startButton.addEventListener('click', async () => {
  g_isRunning            = true;
  g_startButton.disabled = true;
  g_stopButton.disabled  = false;

  // Get current speed and power values
  const speed = parseInt(speedSlider.value);
  const power = parseInt(powerSlider.value);

  // start engraving
  logMessage('info', `Starting engraving with speed: ${speed}%, power: ${power}%`); 
  try {
    await window.api.startEngraving({
      boundingBox: g_boundingBox,
      speed: speed,
      power: power
    }).then((response) => {
      logMessage('info', `startEngraving response: ${response}`);
      if (response.status === 'error') {
        throw new Error(response.message);
      }
    });

    const engraveStartY = g_boundingBox.top;
    const engraveEndY   = g_boundingBox.bottom;
    const engraveStartX = g_boundingBox.left;
    const engraveEndX   = g_boundingBox.right;
    const engraveWidth  = engraveEndX - engraveStartX;
    const engraveHeight = engraveEndY - engraveStartY;

    logMessage('info', `Engraving started for ${engraveWidth}x${engraveHeight} at ${engraveStartX},${engraveStartY}`);

    updateProgressBar(0);

    // Process each line of the image buffer and send to serial port
    //var lineData = new Uint8ClampedArray(g_engraveBuffer.m_width);
    for (y = 0; y < engraveHeight; y++) {

      logMessage('debug', 'Processing line ', y);

      if (!g_isRunning) {
        break;
      }

      updateProgressBar((y / engraveHeight) * 100);

      var lineData = new Uint8ClampedArray(engraveWidth);

      for (let x = 0; x < engraveWidth; x++) {
        const index = (((y + engraveStartY) * g_engraveBuffer.m_width) + (engraveStartX + x)) * 4;
        // data is already grayscale - return any color channel (in this case red)
        lineData[x] = g_engraveBuffer.m_data[index]; 
      }
      
      // Send line to the serial port and wait for response
      await window.api.sendLineToEngraver(lineData, y).then((result) => {
        if (result.status === 'error') {
          throw new Error(`Failed to process line ${y}: ${result.message}`);
        }
      });
    }

  } catch (err) {
    logMessage('error', 'Engraving error:', err);
    alert('Engraving error: ' + err.message);
  }

  stopEngraving();
});

function updateProgressBar(percent) {
  const progressFill = document.querySelector('.progress-fill');
  const progressText = document.querySelector('.progress-text');
  
  if (progressFill && progressText) {
      progressFill.style.width = `${percent}%`;
      progressText.textContent = `${Math.round(percent)}%`;
  }
} 

async function stopEngraving() {
  updateProgressBar(100);
  logMessage('info', 'Stopping engraving...');
  try {
    const response = await window.api.stopEngraving();
    if (response.status === 'error') {
      throw new Error(response.message);
    }
  } catch (err) {
    logMessage('error', 'Error stopping engraving:', err);
    alert('Error stopping engraving: ' + err.message);
  } finally {
    g_isRunning = false;
    g_startButton.disabled = false;
    g_stopButton.disabled = true;
  }
}

// Handle stop button click
g_stopButton.addEventListener('click', () => {
  g_isRunning = false;
});

function getMediaSettings() {
  const width = parseFloat(document.getElementById('media-width').value);
  const widthUnit = document.getElementById('media-width-unit').value;
  const height = parseFloat(document.getElementById('media-height').value);
  const heightUnit = document.getElementById('media-height-unit').value;
  const material = document.getElementById('media-material').value;

  return {
    width,
    widthUnit,
    height,
    heightUnit,
    material
  };
}

// calculate the scale between the bitmap window and the engraver dimensions
function resizeBitmapCanvas() 
{
  scale = 1;
  yOffset = 0;
  xOffset = 0;

  // work out if the width or height is the limiting factor
  if (g_engraveBuffer.m_width < g_engraveBuffer.m_height) {
      g_bitmapHeight = BITMAP_SIZE;
      g_bitmapWidth = g_engraveBuffer.m_width / g_engraveBuffer.m_height * BITMAP_SIZE;
      xOffset = (BITMAP_SIZE - g_bitmapWidth) / 2;
  } else {
    g_bitmapWidth = BITMAP_SIZE;
    g_bitmapHeight = Math.floor(g_engraveBuffer.m_height / g_engraveBuffer.m_width * BITMAP_SIZE);
    yOffset = (BITMAP_SIZE - g_bitmapHeight) / 2;
  }

  canvas = document.getElementById('bitmapCanvas');
  canvas.height = BORDER + g_bitmapHeight;
  canvas.width  = BORDER + g_bitmapWidth;
  logMessage('info', `bitmap size: ${g_bitmapWidth}x${g_bitmapHeight}`);
  logMessage('info', `bitmap canvas size: ${canvas.width}x${canvas.height}`);
}

function drawScaleIndicators(horizontalValue, verticalValue) 
{
  logMessage('info', `drawScaleIndicators: ${horizontalValue}x${verticalValue}`);
    
  canvas = document.getElementById('bitmapCanvas');
  ctx = canvas.getContext('2d');

  // Set text properties
  ctx.font = '12px monospace';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
    
  // Draw horizontal scale
  ctx.save();
  {
    ctx.translate(BORDER, 0);

    // Left arrow
    ctx.moveTo(0, BORDER/2);
    ctx.lineTo(5, BORDER/2 - 5);
    ctx.lineTo(5, BORDER/2 + 5);
    ctx.fill();

    // Right arrow
    ctx.moveTo(g_bitmapWidth,     BORDER/2);
    ctx.lineTo(g_bitmapWidth - 5, BORDER/2 - 5);
    ctx.lineTo(g_bitmapWidth - 5, BORDER/2 + 5);
    ctx.fill();

    // get the width of the text
    const textWidth = ctx.measureText(horizontalValue).width;
    const textLeftX = g_bitmapWidth/2 - textWidth/2;

    // draw line from left arrow to just before the text
    ctx.moveTo(0, BORDER/2);
    ctx.lineTo(textLeftX - 5, BORDER/2);
    ctx.stroke();

    // draw line from right arrow to just after the text
    ctx.moveTo(g_bitmapWidth, BORDER/2);
    ctx.lineTo(textLeftX + textWidth + 5, BORDER/2);
    ctx.stroke();

    // Draw text
    ctx.fillText(horizontalValue, g_bitmapWidth/2, BORDER/2);
  }
  ctx.restore();

  // Draw vertical scale
  ctx.save();
  {
    ctx.translate(0, BORDER+g_bitmapHeight);
    ctx.rotate(-Math.PI/2);
    //ctx.translate(-BORDER, 0);
    
    // Top arrow
    ctx.moveTo(g_bitmapHeight, BORDER/2);
    ctx.lineTo(g_bitmapHeight - 5, BORDER/2 - 5);
    ctx.lineTo(g_bitmapHeight - 5, BORDER/2 + 5);

    // Bottom arrow
    ctx.moveTo(0, BORDER/2);
    ctx.lineTo(5, BORDER/2+5);
    ctx.lineTo(5, BORDER/2-5);
    ctx.fill();

    // get the width of the text
    const textWidth = ctx.measureText(verticalValue).width;
    const textLeftX = g_bitmapHeight/2 - textWidth/2;

    // draw line from left arrow to just before the text
    ctx.moveTo(0, BORDER/2);
    ctx.lineTo(textLeftX - 5, BORDER/2);
    ctx.stroke();

    // draw line from right arrow to just after the text
    ctx.moveTo(g_bitmapHeight, BORDER/2);
    ctx.lineTo(textLeftX + textWidth + 5, BORDER/2);
    ctx.stroke();

    // Draw text
    ctx.fillText(verticalValue, g_bitmapHeight/2, BORDER/2);
  }
  ctx.restore();

  logMessage('info', `drawScaleIndicators end:`);
}

// Add rotate button handlers
document.getElementById('rotateLeftButton').addEventListener('click', () => {
  g_rotateAngle -= 90;
  if (g_rotateAngle < 0) {
    g_rotateAngle += 360;
  }
  adjustOffsetAfterRotation();
  renderImageToCanvas();
});

document.getElementById('rotateRightButton').addEventListener('click', () => {
  g_rotateAngle += 90;
  if (g_rotateAngle >= 360) {
    g_rotateAngle -= 360;
  }
  adjustOffsetAfterRotation();
  renderImageToCanvas();
});

// Add click handler for bitmap canvas
const bitmapCanvas = document.getElementById('bitmapCanvas');
let isDragging = false;
let lastX = 0;
let lastY = 0;

bitmapCanvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    const rect = bitmapCanvas.getBoundingClientRect();
    lastX = event.clientX - rect.left - BORDER;
    lastY = event.clientY - rect.top - BORDER;
});

bitmapCanvas.addEventListener('mousemove', (event) => {
    if (!isDragging) return;
    
    const rect = bitmapCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left - BORDER;
    const currentY = event.clientY - rect.top - BORDER;
    
    // Calculate the change in position
    const deltaX = currentX - lastX;
    const deltaY = currentY - lastY;
    
    // Convert canvas coordinates to engrave buffer coordinates
    const canvasScale = g_bitmapWidth / g_engraveBuffer.m_width;
    g_imageOffsetX += deltaX / canvasScale;
    g_imageOffsetY += deltaY / canvasScale;
    
    // Update last position
    lastX = currentX;
    lastY = currentY;
    
    // Update offset display
    updateOffsetDisplay();
    
    // Re-render the canvas
    renderImageToCanvas();
});

// Add mouseup and mouseleave handlers to stop dragging
bitmapCanvas.addEventListener('mouseup', () => {
    isDragging = false;
});

bitmapCanvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

// Update cursor style when hovering over the canvas
bitmapCanvas.addEventListener('mouseenter', () => {
    bitmapCanvas.style.cursor = 'move';
});

bitmapCanvas.addEventListener('mouseleave', () => {
    bitmapCanvas.style.cursor = 'default';
});

// Add offset display elements
const offsetXDisplay = document.getElementById('offsetX');
const offsetYDisplay = document.getElementById('offsetY');

function updateOffsetDisplay() {
    // Convert pixels to millimeters (1mm = 10 pixels)
    const mmPerPixel = 0.1;
    const xMm = (g_imageOffsetX * mmPerPixel).toFixed(1);
    const yMm = (g_imageOffsetY * mmPerPixel).toFixed(1);
    
    // Update input fields
    const offsetXInput = document.getElementById('offsetXInput');
    const offsetYInput = document.getElementById('offsetYInput');
    
    if (offsetXInput) offsetXInput.value = xMm;
    if (offsetYInput) offsetYInput.value = yMm;
}

// Add event listeners for speed and power controls
document.addEventListener('DOMContentLoaded', () => {
    const speedSlider = document.getElementById('speedSlider');
    const speedInput = document.getElementById('speedInput');
    const speedValue = document.getElementById('speedValue');

    const powerSlider = document.getElementById('powerSlider');
    const powerInput = document.getElementById('powerInput');
    const powerValue = document.getElementById('powerValue');

    // Speed control handlers
    speedSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        speedInput.value = value;
        speedValue.textContent = value;
    });

    speedInput.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        // Clamp value between min and max
        value = Math.max(1, Math.min(10, value));
        speedSlider.value = value;
        speedValue.textContent = value;
    });

    speedInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });

    // Power control handlers
    powerSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        powerInput.value = value;
        powerValue.textContent = value;
    });

    powerInput.addEventListener('input', (e) => {
        let value = parseInt(e.target.value);
        // Clamp value between min and max
        value = Math.max(1, Math.min(100, value));
        powerSlider.value = value;
        powerValue.textContent = value;
    });

    powerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });
});

// Add offset input handlers
document.addEventListener('DOMContentLoaded', () => {
    const offsetXInput = document.getElementById('offsetXInput');
    const offsetYInput = document.getElementById('offsetYInput');

    // Convert mm to pixels (1mm = 10 pixels)
    const mmToPixels = (mm) => mm * 10;
    const pixelsToMm = (pixels) => pixels / 10;

    // X offset handlers
    offsetXInput.addEventListener('input', (e) => {
        const mmValue = parseFloat(e.target.value);
        g_imageOffsetX = mmToPixels(mmValue);
        updateOffsetDisplay();
        renderImageToCanvas();
    });

    offsetXInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });

    // Y offset handlers
    offsetYInput.addEventListener('input', (e) => {
        const mmValue = parseFloat(e.target.value);
        g_imageOffsetY = mmToPixels(mmValue);
        updateOffsetDisplay();
        renderImageToCanvas();
    });

    offsetYInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        }
    });
});
