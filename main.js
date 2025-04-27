require('source-map-support').install();
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const Protocol = require('./protocol');
const { createLogWindow, logToWindow } = require('./log');

// maximum X and Y coordinates
const BITMAP_WIDTH = 1600;
const BITMAP_HEIGHT = 1520;

// Command constants
const COMMANDS = {
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

            // send command and wait for ack
            const ack = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.CONNECT), TIMEOUTS.CONNECT);
            if (!ack) {
                logToWindow('error', 'Failed to send connect command');
                event.reply('connect-response', { 
                    status: 'error',
                    message: 'Failed to send connect command',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // Send fan off and wait for ack
            const fanAck = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.FAN_OFF), TIMEOUTS.FAN);
            if (!fanAck) {
                logToWindow('error', 'Failed to send fan off command');
                event.reply('connect-response', {
                    status: 'error',
                    message: 'Failed to send fan off command',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // Send home command and wait for ack
            const homeAck = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.HOME), TIMEOUTS.HOME);
            if (!homeAck) {
                logToWindow('error', 'Failed to send home command');
                event.reply('connect-response', {
                    status: 'error',
                    message: 'Failed to send home command',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // send reply to renderer with all responses
            event.reply('connect-response', {
                status: 'connected',
                timestamp: new Date().toISOString()
            });
            
        });
    } 
    catch (err) {
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

      // Notify renderer that the port is disconnected
      event.reply('serial-port-status', { connected: false });
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

    // send fan on/off command and wait for ack
    const fanAck = await protocol.sendMessageAndWaitForAck(Buffer.from(data.state ? COMMANDS.FAN_ON : COMMANDS.FAN_OFF), TIMEOUTS.FAN);
    if (!fanAck) {
        logToWindow('error', 'Failed to send fan command');
        event.reply('fan-response', {
            status: 'error',
            message: 'Failed to send fan command',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // send reply to renderer with all responses
    event.reply('fan-response', {
        status: 'success',
        timestamp: new Date().toISOString()
    });
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

    // send center command and wait for ack
    const centerAck = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.CENTER), TIMEOUTS.CENTER);
    if (!centerAck) {
        logToWindow('error', 'Failed to send center command');
        event.reply('center-response', {
            status: 'error',
            message: 'Failed to send center command',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // send reply to renderer with all responses
    event.reply('center-response', {
        status: 'success',
        timestamp: new Date().toISOString()
    });
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

    // send home command and wait for ack
    const homeAck = await protocol.sendMessageAndWaitForAck(Buffer.from(COMMANDS.HOME), TIMEOUTS.HOME);
    if (!homeAck) {
        logToWindow('error', 'Failed to send home command');
        event.reply('home-response', {
            status: 'error',
            message: 'Failed to send home command',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // send reply to renderer with all responses
    event.reply('home-response', {
        status: 'success',
        timestamp: new Date().toISOString()
    });
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

    // send move command and wait for ack
    const moveAck = await protocol.sendMessageAndWaitForAck(Buffer.from(command), TIMEOUTS.MOVE);
    if (!moveAck) {
        logToWindow('error', 'Failed to send move command');
        event.reply('move-response', {
            status: 'error',
            message: 'Failed to send move command',
            timestamp: new Date().toISOString()
        });
        return;
    }

    // send reply to renderer with all responses
    event.reply('move-response', {
        status: 'success',
        timestamp: new Date().toISOString()
    });
}

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

    // send move command and wait for ack
    const moveAck = await protocol.sendMessageAndWaitForAck(Buffer.from(command), TIMEOUTS.MOVE);
    if (!moveAck) {
        logToWindow('error', 'Failed to send move command');
        event.reply('move-response', {
            status: 'error',  
            message: 'Failed to send move command',
            timestamp: new Date().toISOString()
        });
        return;
    }
    
    // send reply to renderer with all responses
    event.reply('move-response', {
        status: 'success',
        timestamp: new Date().toISOString()
    });
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
    mainWindow = new BrowserWindow({
        width: 900,
        height: 632,
        minWidth: 900,
        minHeight: 632,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Send internal dimensions when window is ready
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('set-internal-dimensions', {
            width: BITMAP_WIDTH,
            height: BITMAP_HEIGHT
        });
    });

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
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
                    createLogWindow();
                }
            }
        ]
    }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu); 

