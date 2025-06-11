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

function updateProgress(progress) 
{
  const value = Math.max(0, Math.min(100, progress)).toFixed(0);
  if (g_progressFill && g_progressText) {
      g_progressFill.style.width = `${value}%`;
      g_progressText.textContent = `${value}%`;
  }
}

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

    updateProgress(0);

    // Process each line of the image buffer and send to serial port
    //var lineData = new Uint8ClampedArray(g_engraveBuffer.m_width);
    for (y = 0; y < engraveHeight; y++) {

      logMessage('debug', 'Processing line ', y);

      if (!g_isRunning) {
        break;
      }

      updateProgress((y / engraveHeight) * 100);

      var lineData = new Uint8ClampedArray(engraveWidth);

      for (let x = 0; x < engraveWidth; x++) {
        const index = (((y + engraveStartY) * g_engraveBuffer.m_width) + (engraveStartX + x)) * 4;
        // ignore transparent pixels
        if (g_engraveBuffer.m_data[index+3] < 255) {
          lineData[x] = 255;
        }
        else {
          lineData[x] = g_engraveBuffer.m_data[index]; 
        }
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

async function stopEngraving() {
  updateProgress(100);
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
