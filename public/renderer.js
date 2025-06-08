const g_deviceTypeSelect    = document.getElementById('deviceTypeSelect');
const g_serialPortSelect    = document.getElementById('serialPortSelect');
const g_refreshButton       = document.getElementById('refreshButton');
const g_connectButton       = document.getElementById('connectButton');
const g_connectionIndicator = document.getElementById('connectionIndicator');
const g_loadImageButton     = document.getElementById('loadImageButton');
const g_clearImageButton    = document.getElementById('clearImageButton');

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

let DEFAULT_SPEED = 45;
let DEFAULT_POWER = 100;

// Add scale slider handler
const scaleSlider = document.getElementById('scaleSlider');
const scaleValue = document.getElementById('scaleValue');

scaleSlider.addEventListener('input', () => {
  if (g_imageBuffer) {
    g_imageBuffer.onScaleChange(scaleSlider.value);
    scaleValue.textContent = `${scaleSlider.value}%`;
    renderImageToCanvas();
  }
});

// Add threshold slider handler
const thresholdSlider = document.getElementById('thresholdSlider');
const thresholdValue = document.getElementById('thresholdValue');

thresholdSlider.addEventListener('input', () => {
  if (g_imageBuffer) {
    g_imageBuffer.m_threshold = parseInt(thresholdSlider.value);
    thresholdValue.textContent = thresholdSlider.value;
    renderImageToCanvas();
  }
});

// Update scale slider when new image is loaded
function updateScaleSlider() {
  if (g_imageBuffer) {
    scaleSlider.value = 100;
    scaleValue.textContent = '100%';
    g_imageBuffer.m_imageScale = g_imageBuffer.m_maxImageScale;
    updateOffsetDisplay();
  }
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
    if (g_imageBuffer.m_default) {
      setDefaultImage();
    }
    else {
      loadImage(g_imageBuffer.m_image);
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

function xPixelsToMm(pixels) {
  return g_engraverDimensions.widthMm * pixels / g_engraverDimensions.width;
}

function yPixelsToMm(pixels) {
  return g_engraverDimensions.heightMm * pixels / g_engraverDimensions.height;
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

// Add window resize handler with debounce
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeBitmapCanvas();
        if (g_engraverDimensions) {
            drawScaleIndicators(g_engraverDimensions.widthMm + ' mm', g_engraverDimensions.heightMm + ' mm');
        }
    }, 100);
});

// Add preference change handler
window.preferencesManager.onPreferenceChange((key, value) => {
    if (key === 'units' && g_engraverDimensions) {
        drawScaleIndicators(g_engraverDimensions.widthMm + ' mm', g_engraverDimensions.heightMm + ' mm');
    }
});

// calculate the scale between the bitmap window and the engraver dimensions
function resizeBitmapCanvas() 
{
    if (!g_engraveBuffer) {
        return;
    }

    const bitmapContainer = document.querySelector('.bitmap-container');
    const containerWidth = bitmapContainer.clientWidth;
    const containerHeight = bitmapContainer.clientHeight;

    logMessage('info', `container size: ${containerWidth}x${containerHeight}`);

    // Calculate scale to fit the container while maintaining aspect ratio
    const scaleX = (containerWidth - BORDER) / g_engraveBuffer.m_width;
    const scaleY = (containerHeight - BORDER) / g_engraveBuffer.m_height;
    const scale = Math.min(scaleX, scaleY);

    // Calculate new dimensions
    g_bitmapWidth = Math.floor(g_engraveBuffer.m_width * scale);
    g_bitmapHeight = Math.floor(g_engraveBuffer.m_height * scale);

    // Update canvas size
    const canvas = document.getElementById('bitmapCanvas');
    canvas.width = BORDER + g_bitmapWidth;
    canvas.height = BORDER + g_bitmapHeight;

    logMessage('info', `bitmap size: ${g_bitmapWidth}x${g_bitmapHeight}`);
    logMessage('info', `bitmap canvas size: ${canvas.width}x${canvas.height}`);

    // Force a re-render
    renderImageToCanvas();
}

// Initial resize
document.addEventListener('DOMContentLoaded', () => {
    resizeBitmapCanvas();
});

function drawScaleIndicators(horizontalValue, verticalValue) 
{
  const units = window.preferencesManager.getPreference('units');
  logMessage('info', `drawScaleIndicators: ${horizontalValue}x${verticalValue} units: ${units}`);
    
  canvas = document.getElementById('bitmapCanvas');
  ctx = canvas.getContext('2d');

  // Get current units from preferences
  
  // Convert values to current units if needed
  let horizontalDisplay = horizontalValue;
  let verticalDisplay = verticalValue;
  
  if (units === 'in') {
    // Convert mm to inches (divide by 25.4)
    const horizontalMm = parseFloat(horizontalValue);
    const verticalMm = parseFloat(verticalValue);
    horizontalDisplay = (horizontalMm / 25.4).toFixed(2) + ' in';
    verticalDisplay = (verticalMm / 25.4).toFixed(2) + ' in';
  }

  // Set text properties
  ctx.font = '12px monospace';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
    
  // Draw horizontal scale
  ctx.save();
  {
    ctx.translate(BORDER, 0);

    // clear the rectangle from the left arrow to the right arrow
    ctx.clearRect(0, BORDER/2 - 5, g_bitmapWidth, BORDER/2 + 5);

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
    const textWidth = ctx.measureText(horizontalDisplay).width;
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
    ctx.fillText(horizontalDisplay, g_bitmapWidth/2, BORDER/2);
  }
  ctx.restore();

  // Draw vertical scale
  ctx.save();
  {
    ctx.translate(0, BORDER+g_bitmapHeight);
    ctx.rotate(-Math.PI/2);

    // clear the rectangle from the top arrow to the bottom arrow
    ctx.clearRect(0, BORDER/2 - 5, g_bitmapHeight, BORDER/2 + 5);
    
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
    const textWidth = ctx.measureText(verticalDisplay).width;
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
    ctx.fillText(verticalDisplay, g_bitmapHeight/2, BORDER/2);
  }
  ctx.restore();

  logMessage('info', `drawScaleIndicators end:`);
}

// Add rotate button handlers
document.getElementById('rotateLeftButton').addEventListener('click', () => {
  if (g_imageBuffer) {
    g_imageBuffer.m_rotateAngle -= 90;
    if (g_imageBuffer.m_rotateAngle < 0) {
      g_imageBuffer.m_rotateAngle += 360;
    }
    g_imageBuffer.adjustOffsetAfterRotation(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
  renderImageToCanvas();
});

document.getElementById('rotateRightButton').addEventListener('click', () => {
  if (g_imageBuffer) {
    g_imageBuffer.m_rotateAngle += 90;
    if (g_imageBuffer.m_rotateAngle >= 360) {
      g_imageBuffer.m_rotateAngle -= 360;
    }
    g_imageBuffer.adjustOffsetAfterRotation(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
  }
  renderImageToCanvas();
});

// Add text rotation button handlers
document.getElementById('rotateTextLeftButton').addEventListener('click', () => {
    if (g_textImageBuffer) {
        g_textImageBuffer.m_rotateAngle -= 90;
        if (g_textImageBuffer.m_rotateAngle < 0) {
            g_textImageBuffer.m_rotateAngle += 360;
        }
        g_textImageBuffer.adjustOffsetAfterRotation(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
        renderImageToCanvas();
    }
});

document.getElementById('rotateTextRightButton').addEventListener('click', () => {
    if (g_textImageBuffer) {
        g_textImageBuffer.m_rotateAngle += 90;
        if (g_textImageBuffer.m_rotateAngle >= 360) {
            g_textImageBuffer.m_rotateAngle -= 360;
        }
        g_textImageBuffer.adjustOffsetAfterRotation(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
        renderImageToCanvas();
    }
});

// Add click handler for bitmap canvas
const bitmapCanvas = document.getElementById('bitmapCanvas');
let isDragging = false;
let lastX = 0;
let lastY = 0;

// Function to get the active tab
function getActiveTab() {
    const activeTabButton = document.querySelector('.tab-button.active');
    return activeTabButton ? activeTabButton.getAttribute('data-tab') : null;
}

bitmapCanvas.addEventListener('mousedown', (event) => {
    isDragging = true;
    const rect = bitmapCanvas.getBoundingClientRect();
    lastX = event.clientX - rect.left - BORDER;
    lastY = event.clientY - rect.top - BORDER;
});

bitmapCanvas.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    const activeTab = getActiveTab();
    const rect = bitmapCanvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left - BORDER;
    const currentY = event.clientY - rect.top - BORDER;
    
    // Calculate the change in position
    const deltaX = currentX - lastX;
    const deltaY = currentY - lastY;
    
    // Convert canvas coordinates to engrave buffer coordinates
    const canvasScale = g_bitmapWidth / g_engraveBuffer.m_width;
    
    if (activeTab === 'image' && g_imageBuffer) {
        // Move the image
        g_imageBuffer.m_imageOffsetX += deltaX / canvasScale;
        g_imageBuffer.m_imageOffsetY += deltaY / canvasScale;
    } else if (activeTab === 'text' && g_textImageBuffer) {
        // Move the text
        g_textImageBuffer.m_imageOffsetX += deltaX / canvasScale;
        g_textImageBuffer.m_imageOffsetY += deltaY / canvasScale;
    }
    
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
    const activeTab = getActiveTab();
    if ((activeTab === 'image' && g_imageBuffer) || (activeTab === 'text' && g_textImageBuffer)) {
        bitmapCanvas.style.cursor = 'move';
    } else {
        bitmapCanvas.style.cursor = 'default';
    }
});

bitmapCanvas.addEventListener('mouseleave', () => {
    bitmapCanvas.style.cursor = 'default';
});

// Add offset display elements
const offsetXDisplay = document.getElementById('offsetX');
const offsetYDisplay = document.getElementById('offsetY');

function updateOffsetDisplay() {
    const activeTab = getActiveTab();
    let xMm, yMm;

    if (activeTab === 'image' && g_imageBuffer) {
        xMm = xPixelsToMm(g_imageBuffer.m_imageOffsetX);
        yMm = yPixelsToMm(g_imageBuffer.m_imageOffsetY);
    } else if (activeTab === 'text' && g_textImageBuffer) {
        xMm = xPixelsToMm(g_textImageBuffer.m_imageOffsetX);
        yMm = yPixelsToMm(g_textImageBuffer.m_imageOffsetY);
    } else {
        xMm = 0;
        yMm = 0;
    }
    
    // Update input fields
    const offsetXInput = document.getElementById('offsetXInput');
    const offsetYInput = document.getElementById('offsetYInput');
    
    if (offsetXInput) offsetXInput.value = xMm;
    if (offsetYInput) offsetYInput.value = yMm;
}

// Add event listeners for speed and power controls
document.addEventListener('DOMContentLoaded', () => {
    // Initialize speed and power controls
    const speedSlider = document.getElementById('speedSlider');
    const speedInput = document.getElementById('speedInput');
    const speedValue = document.getElementById('speedValue');
    const powerSlider = document.getElementById('powerSlider');
    const powerInput = document.getElementById('powerInput');
    const powerValue = document.getElementById('powerValue');

    // Set initial values from defaults
    speedSlider.value = DEFAULT_SPEED;
    speedInput.value = DEFAULT_SPEED;
    speedValue.textContent = DEFAULT_SPEED;
    powerSlider.value = DEFAULT_POWER;
    powerInput.value = DEFAULT_POWER;
    powerValue.textContent = DEFAULT_POWER;

    // Speed slider event
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

// Add clear image button handler
g_clearImageButton.addEventListener('click', () => {
    // Clear the image buffer
    g_imageBuffer = null;
    
    // Create a new empty image buffer
    g_imageBuffer = new ImageBuffer(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
    g_imageBuffer.clear();
    g_imageBuffer.m_default = false;  // Ensure default flag is cleared
    
    // Set default scale for the empty image
    g_imageBuffer.setDefaultScale(g_engraveBuffer.m_width, g_engraveBuffer.m_height);
    
    // Update UI
    updateScaleSlider();
    updateOffsetDisplay();
    
    // Force a re-render
    renderImageToCanvas();
});

function updateProgress(progress) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('.progress-text');
    if (progressFill && progressText) {
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;
    }
}

