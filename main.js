require('source-map-support').install();
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const Protocol = require('./protocol');


// maximum X and Y coordinates
const MAX_X = 1600;
const MAX_Y = 1520;

// Command constants
const COMMANDS = {
    ACK: 9,
    CONNECT: [10, 0, 4, 0],
    HOME:    [23, 0, 4, 0],
    CENTER:  [26, 0, 4, 0],
    FAN_ON:  [ 4, 0, 4, 0],
    FAN_OFF: [ 5, 0, 4, 0],
    LEFT:    [ 1, 0, 7, 0xff, -100,     0,    0],
    RIGHT:   [ 1, 0, 7,    0,  100,     0,    0],
    UP:      [ 1, 0, 7,    0,    0,  0xff, -100],
    DOWN:    [ 1, 0, 7,    0,    0,     0,  100]
};

// Timeout constants (in milliseconds)
const TIMEOUTS = {
    CONNECT: 100,
    FAN: 100,
    HOME: 6000,
    CENTER: 6000,
    MOVE: 500
};

// Enable debugging logs
const debug = process.argv.includes('--debug') || process.argv.includes('--inspect');
if (debug) {
  console.log('Debug mode enabled');
  console.log('To debug the renderer process, open Chrome DevTools at chrome://inspect');
}

let currentPort = null;
let protocol = null;
let logWindow = null;


// Handle serial port list request
ipcMain.on('request-serial-ports', async (event) => {
    try {
        const ports = await SerialPort.list();
        // Filter out wlan-debug and Bluetooth ports
        const filteredPorts = ports.filter(port => 
            !port.path.includes('cu.wlan-debug') && 
            !port.path.includes('tty.wlan-debug') &&
            !port.path.includes('tty.Bluetooth-Incoming-Port')
        );
        event.reply('serial-ports-list', filteredPorts);
    } catch (err) {
        console.error('Error listing serial ports:', err);
        event.reply('serial-ports-list', []);
    }
});

// Handle connect button click from renderer
ipcMain.on('connect-button-clicked', async (event, data) => {
    console.log('Connect button clicked:', data);
    
    if (currentPort) {
        currentPort.close();
        currentPort = null;
        protocol = null;
    }

    try {
        currentPort = new SerialPort({
            path: data.port,
            baudRate: 115200,
            autoOpen: false
        });

        currentPort.open(async (err) => {
            if (err) {
                console.error('Error opening port:', err);
                event.reply('connect-response', {
                    status: 'error',
                    message: err.message,
                    timestamp: new Date().toISOString()
                });
                return;
            }

            console.log('Port opened successfully');
            
            // Initialize protocol handler
            protocol = new Protocol(currentPort);
            protocol.init();

            // Send initial message using values from renderer
            const message = Buffer.from(COMMANDS.CONNECT);
            logToWindow('info', 'Sending connect command:', Array.from(message));
            
            // Set up timeout for connection response
            const connectTimeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Connection timeout - no response received within 100ms')), TIMEOUTS.CONNECT);
            });

            try {
                // Race between the response and timeout
                const result = await Promise.race([
                    protocol.sendMessageAndWaitForReply(message, TIMEOUTS.CONNECT),
                    connectTimeoutPromise
                ]);
                
                if (result.error) {
                    throw new Error(result.error);
                }

                // Check if response contains value 9 as first and only character
                if (!result.data || result.data.length !== 1 || result.data[0] !== COMMANDS.ACK) {
                    throw new Error('Invalid connection response - expected single byte with value 9');
                }

                console.log('Initial message sent successfully, received response:', result.data);
                
                // Send home command after successful connection
                const homeMessage = Buffer.from(COMMANDS.HOME);
                logToWindow('info', 'Sending home command:', Array.from(homeMessage));
                
                // Set up timeout for home command response
                const homeTimeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Home command timeout - no response received within 6000ms')), TIMEOUTS.HOME);
                });

                const homeResult = await Promise.race([
                    protocol.sendMessageAndWaitForReply(homeMessage, TIMEOUTS.HOME),
                    homeTimeoutPromise
                ]);
                
                if (homeResult.error) {
                    throw new Error(`Home command failed: ${homeResult.error}`);
                }

                // Send fan off command after successful connection
                const fanOffMessage = Buffer.from(COMMANDS.FAN_OFF);
                logToWindow('info', 'Sending fan off command:', Array.from(fanOffMessage));
                const fanResult = await protocol.sendMessageAndWaitForReply(fanOffMessage, TIMEOUTS.FAN);
                
                if (fanResult.error) {
                    throw new Error(`Fan off command failed: ${fanResult.error}`);
                }

                // Log the full response for debugging
                logToWindow('info', 'Home command response:', Array.from(homeResult.data));
                logToWindow('info', 'Fan off command response:', Array.from(fanResult.data));

                event.reply('connect-response', {
                    status: 'connected',
                    timestamp: new Date().toISOString(),
                    response: Array.from(result.data),
                    homeResponse: Array.from(homeResult.data),
                    fanResponse: Array.from(fanResult.data)
                });
            } catch (err) {
                console.error('Error during connection:', err);
                // Close the port since connection failed
                if (currentPort) {
                    currentPort.close();
                    currentPort = null;
                    protocol = null;
                }
                event.reply('connect-response', {
                    status: 'error',
                    message: err.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        currentPort.on('error', (err) => {
            console.error('Port error:', err);
            event.reply('connect-response', {
                status: 'error',
                message: err.message,
                timestamp: new Date().toISOString()
            });
        });

    } catch (err) {
        console.error('Error creating port:', err);
        event.reply('connect-response', {
            status: 'error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Handle fan button click from renderer
ipcMain.on('fan-button-clicked', async (event, data) => {
    console.log('Fan button clicked:', data);
    
    if (!currentPort || !protocol) {
        event.reply('fan-response', {
            status: 'error',
            message: 'Not connected to serial port',
            timestamp: new Date().toISOString()
        });
        return;
    }

    try {
        // Send fan command to serial port based on state
        const fanMessage = Buffer.from(data.state ? COMMANDS.FAN_ON : COMMANDS.FAN_OFF);
        logToWindow('info', 'Sending fan command:', Array.from(fanMessage));
        const result = await protocol.sendMessageAndWaitForReply(fanMessage, TIMEOUTS.FAN);
        
        if (result.error) {
            console.error('Error sending fan command:', result.error);
            event.reply('fan-response', {
                status: 'error',
                message: result.error,
                timestamp: new Date().toISOString()
            });
            return;
        }

        logToWindow('info', 'Fan command sent successfully, received response:', result.data);
        event.reply('fan-response', {
            status: 'success',
            timestamp: new Date().toISOString(),
            response: result.data
        });
    } catch (err) {
        console.error('Error handling fan command:', err);
        event.reply('fan-response', {
            status: 'error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Handle center button click from renderer
ipcMain.on('center-button-clicked', async (event, data) => {
    console.log('Center button clicked:', data);
    
    if (!currentPort || !protocol) {
        event.reply('center-response', {
            status: 'error',
            message: 'Not connected to serial port',
            timestamp: new Date().toISOString()
        });
        return;
    }

    try {
        // Send center command to serial port
        const message = Buffer.from(COMMANDS.CENTER);
        logToWindow('info', 'Sending center command:', Array.from(message));
        const result = await protocol.sendMessageAndWaitForReply(message, TIMEOUTS.CENTER);
        
        if (result.error) {
            console.error('Error sending center command:', result.error);
            event.reply('center-response', {
                status: 'error',
                message: result.error,
                timestamp: new Date().toISOString()
            });
            return;
        }

        logToWindow('info', 'Center command sent successfully, received response:', result.data);
        event.reply('center-response', {
            status: 'success',
            timestamp: new Date().toISOString(),
            response: result.data
        });
    } catch (err) {
        console.error('Error handling center command:', err);
        event.reply('center-response', {
            status: 'error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Handle home button click from renderer
ipcMain.on('home-button-clicked', async (event, data) => {
    console.log('Home button clicked:', data);
    
    if (!currentPort || !protocol) {
        event.reply('home-response', {
            status: 'error',
            message: 'Not connected to serial port',
            timestamp: new Date().toISOString()
        });
        return;
    }

    try {
        // Send home command to serial port
        const message = Buffer.from(COMMANDS.HOME);
        logToWindow('info', 'Sending home command:', Array.from(message));
        const result = await protocol.sendMessageAndWaitForReply(message);
        
        if (result.error) {
            console.error('Error sending home command:', result.error);
            event.reply('home-response', {
                status: 'error',
                message: result.error,
                timestamp: new Date().toISOString()
            });
            return;
        }

        console.log('Home command sent successfully, received response:', result.data);
        event.reply('home-response', {
            status: 'success',
            timestamp: new Date().toISOString(),
            response: result.data
        });
    } catch (err) {
        console.error('Error handling home command:', err);
        event.reply('home-response', {
            status: 'error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Function to handle direction messages
async function handleDirectionMessage(event, directionData, command) {
    console.log('Direction button clicked:', directionData);
    
    if (!currentPort || !protocol) {
        event.reply('move-response', {
            status: 'error',
            message: 'Not connected to serial port',
            timestamp: new Date().toISOString()
        });
        return;
    }

    try {
        const message = Buffer.from(command);
        logToWindow('info', 'Sending command:', Array.from(message));
        const result = await protocol.sendMessageAndWaitForReply(message, TIMEOUTS.MOVE);
        
        if (result.error) {
            console.error('Error sending direction command:', result.error);
            event.reply('move-response', {
                status: 'error',
                message: result.error,
                timestamp: new Date().toISOString()
            });
            return;
        }

        // Check for ACK response (value 9)
        if (!result.data || result.data.length !== 1 || result.data[0] !== COMMANDS.ACK) {
            throw new Error('Invalid response - expected ACK (9)');
        }

        logToWindow('info', 'Direction command sent successfully, received ACK');
        event.reply('move-response', {
            status: 'success',
            xOffset: directionData.xOffset,
            yOffset: directionData.yOffset,
            timestamp: new Date().toISOString(),
            response: result.data
        });
    } catch (err) {
        console.error('Error handling direction command:', err);
        event.reply('move-response', {
            status: 'error',
            message: err.message,
            timestamp: new Date().toISOString()
        });
    }
}

// Handle left button click from renderer
ipcMain.on('left-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data, COMMANDS.LEFT);
});

// Handle right button click from renderer
ipcMain.on('right-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data, COMMANDS.RIGHT);
});

// Handle up button click from renderer
ipcMain.on('up-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data, COMMANDS.UP);
});

// Handle down button click from renderer
ipcMain.on('down-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data, COMMANDS.DOWN);
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,  // Increased from 800 to 900
    height: 632, // 512 (bitmap) + 40 (padding) + 80 (additional vertical spacing)
    resizable: true,
    minWidth: 900,
    minHeight: 632,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools: true // Always enable DevTools
    }
  });

  mainWindow.loadFile('index.html');
  
  // Open DevTools by default in debug mode
  if (debug) {
    mainWindow.webContents.openDevTools();
  }

  // Add error handling
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  mainWindow.on('unresponsive', () => {
    console.error('Window became unresponsive');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (currentPort) {
        currentPort.close();
        currentPort = null;
        protocol = null;
    }
    app.quit();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

app.on('window-all-closed', function () {
  if (currentPort) {
    currentPort.close();
  }
  if (process.platform !== 'darwin') app.quit();
});

function createLogWindow() {
    logWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Log Window',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        modal: false,
        parent: null,
        show: true
    });

    logWindow.loadFile('log.html');

    logWindow.on('closed', () => {
        logWindow = null;
    });
}

// Function to send messages to log window
function logToWindow(type, ...items) {
    if (logWindow) {
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
        logWindow.webContents.send('log-message', { message: formattedMessage, type });
    }
}

// Add menu item to open log window
const template = [
    {
        label: 'File',
        submenu: [
            {
                label: 'Open...',
                accelerator: 'CmdOrCtrl+O',
                click: () => {
                    // TODO: Implement file open functionality
                }
            },
            { type: 'separator' },
            {
                label: 'Exit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                    app.quit();
                }
            }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'delete' },
            { type: 'separator' },
            { role: 'selectAll' }
        ]
    },
    {
        label: 'View',
        submenu: [
            {
                label: 'Show Logs',
                click: () => {
                    if (!logWindow) {
                        createLogWindow();
                    } else {
                        logWindow.focus();
                    }
                }
            }
        ]
    }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu); 