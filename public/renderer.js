

// global state
let g_fanState = false;         // false = off, true = on
let g_isConnected = false;      // Track connection state
let g_needsSerialPort = false;  // Track if serial port is needed
let g_isRunning = false;        // Track running state

let g_bitmapWidth = 0;
let g_bitmapHeight = 0;

// image buffer loaded from a file 
let g_imageBuffer = null;

// text image buffer created from text
let g_textImageBuffer = null;

// image at engraver resolution to be engraved
let g_engraveBuffer = null;

// bounding box of the image to be engraved
let g_boundingBox  = null;

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
    renderImageToScreen();
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
    renderImageToScreen();
  });
});

async function setDeviceType(deviceType) {
  const result = await window.api.setDeviceType({ deviceType });
  if (result.success) {

    logMessage('info', `device type requested ${deviceType}`);

    g_needsSerialPort           = result.needsSerialPort;
    g_serialPortSelect.disabled = !g_needsSerialPort;

    g_engraverDimensions        = result.engraverDimensions;

    g_engraveBuffer             = new ImageBuffer(g_engraverDimensions.width, g_engraverDimensions.height, false, false);

    logMessage('info', `engraver dimensions: ${g_engraveBuffer.m_width}x${g_engraveBuffer.m_height}`);
    
    resizeBitmapCanvas();

    drawScaleIndicators();
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

// Function to send log messages to the log window
function sendLogMessage(message, type = 'info') {
    logMessage(type, message);
}

// Add window resize handler with debounce
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        resizeBitmapCanvas();
        drawScaleIndicators();
    }, 100);
});

// Add preference change handler
window.preferencesManager.onPreferenceChange((key, value) => {
    if (key === 'units' && g_engraverDimensions) {
        drawScaleIndicators();
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

  if (canvas.height < canvas.width) {
    canvas.height += BORDER/2;
  }
  else {
    canvas.width += BORDER/2;
  }

  logMessage('info', `bitmap size: ${g_bitmapWidth}x${g_bitmapHeight}`);
  logMessage('info', `bitmap canvas size: ${canvas.width}x${canvas.height}`);

  // Force a re-render
  renderImageToScreen();
}

// Initial resize
document.addEventListener('DOMContentLoaded', () => {
    resizeBitmapCanvas();
});

function drawScaleIndicators() 
{
  if (!g_engraverDimensions) {
    return;
  }

  const units = window.preferencesManager.getPreference('units');

  const bbWidth = g_boundingBox.right - g_boundingBox.left;
  const bbHeight = g_boundingBox.bottom - g_boundingBox.top;

  // Convert values to current units if needed
  var engraverWidthMm = g_engraverDimensions.widthMm; 
  var engraverHeightMm = g_engraverDimensions.heightMm ;
  var boundingBoxWidthMm = bbWidth * g_engraverDimensions.widthMm / g_engraveBuffer.m_width;
  var boundingBoxHeightMm = bbHeight * g_engraverDimensions.heightMm / g_engraveBuffer.m_height;
  
  if (units === 'in') {
    // Convert mm to inches (divide by 25.4)
    engraverWidth     = (engraverWidthMm / 25.4).toFixed(2) + '"';
    engraverHeight    = (engraverHeightMm / 25.4).toFixed(2) + '"';
    boundingBoxWidth  = (boundingBoxWidthMm / 25.4).toFixed(2) + '"';
    boundingBoxHeight = (boundingBoxHeightMm / 25.4).toFixed(2) + '"';
  }
  else {
    engraverWidth     = (engraverWidthMm * 1.0).toFixed(2) + ' mm';
    engraverHeight    = (engraverHeightMm * 1.0).toFixed(2) + ' mm';
    boundingBoxWidth  = (boundingBoxWidthMm * 1.0).toFixed(2) + ' mm';
    boundingBoxHeight = (boundingBoxHeightMm * 1.0).toFixed(2) + ' mm';
  }

  const canvas = document.getElementById('bitmapCanvas');
  const ctx = canvas.getContext('2d');

  // clear indicator regions
  ctx.save();

  // Set text properties
  ctx.font = '12px monospace';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const bbXScale = g_bitmapWidth / g_engraveBuffer.m_width;
  const bbYScale = g_bitmapHeight / g_engraveBuffer.m_height;

  drawHorizontalScale(ctx, 0, 0, g_bitmapWidth,  engraverWidth);
  drawVerticalScale  (ctx, 0, 0, g_bitmapHeight, engraverHeight);

  if (bbWidth != 0 && bbHeight != 0) {
    drawHorizontalScale(ctx, g_boundingBox.left * bbXScale, BORDER/2, bbWidth * bbXScale,  boundingBoxWidth);

    const bbYOffset = g_bitmapHeight - (g_boundingBox.bottom * bbYScale);
    drawVerticalScale  (ctx, bbYOffset,  BORDER/2, bbHeight * bbYScale, boundingBoxHeight);
  }

  ctx.restore();
}

function drawHorizontalScale(ctx, xoffset, yoffset, length, value) 
{
  // Draw horizontal scale
  ctx.save();
  ctx.translate(BORDER, yoffset);

  drawScale(ctx, xoffset, length, value);
}

function drawVerticalScale(ctx, xoffset, yoffset, length, value) 
{
  // Draw vertical scale
  ctx.save();

  ctx.translate(0, BORDER+g_bitmapHeight);
  ctx.rotate(-Math.PI/2);
  ctx.translate(0, yoffset);

  drawScale(ctx, xoffset, length, value);
}


function drawScale(ctx, xoffset, length, value) 
{
  const height = BORDER/2;
    
  // clear the rectangle from the left arrow to the right arrow
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, g_bitmapWidth, height);

  // Left arrow
  ctx.beginPath();
  ctx.fillStyle = 'black';
  ctx.moveTo(xoffset + 0, height/2);
  ctx.lineTo(xoffset + 5, height/2 - 5);
  ctx.lineTo(xoffset + 5, height/2 + 5);
  ctx.closePath();
  ctx.fill();

  // Right arrow
  ctx.beginPath();
  ctx.moveTo(xoffset + length,     height/2);
  ctx.lineTo(xoffset + length - 5, height/2 - 5);
  ctx.lineTo(xoffset + length - 5, height/2 + 5);
  ctx.closePath();
  ctx.fill();

  // get the width of the text
  const textWidth = ctx.measureText(value).width;
  const textLeftX = xoffset + length/2 - textWidth/2;

  ctx.save();
  ctx.fillStyle = 'white';
  ctx.fillRect(textLeftX, 0, textWidth, height);
  ctx.restore();

  // draw line from left arrow to just before the text
  ctx.beginPath();
  ctx.moveTo(xoffset, height/2);
  ctx.lineTo(textLeftX - 5, height/2);
  ctx.closePath();
  ctx.stroke();

  // draw line from right arrow to just after the text
  ctx.beginPath();
  ctx.moveTo(xoffset + length, height/2);
  ctx.lineTo(textLeftX + textWidth + 5, height/2);
  ctx.closePath();
  ctx.stroke();

  // Draw text
  ctx.fillText(value, xoffset + length/2, height/2);
  
  ctx.restore();
}

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
        g_imageSettings.m_imageOffsetX += deltaX / canvasScale;
        g_imageSettings.m_imageOffsetY += deltaY / canvasScale;
    } else if (activeTab === 'text' && g_textImageBuffer) {
        // Move the text
        g_textSettings.m_imageOffsetX += deltaX / canvasScale;
        g_textSettings.m_imageOffsetY += deltaY / canvasScale;
    }
    
    // Update last position
    lastX = currentX;
    lastY = currentY;
    
    // Re-render the canvas
    renderImageToScreen();
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



