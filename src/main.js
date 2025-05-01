require('source-map-support').install();
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');

const K3Laser     = require('./k3_laser');
const GCodeLaser  = require('./gcode_laser');
const TestLaser   = require('./test_laser');

const BITMAP_WINDOW_WIDTH  = 512;
const BITMAP_WINDOW_HEIGHT = 512;

const { createLogWindow, logToWindow } = require('./log');

// Enable debugging logs
//const debug = process.argv.includes('--debug') || process.argv.includes('--inspect');
//if (debug) 
{
  console.log('Debug mode enabled');
  console.log('To debug the renderer process, open Chrome DevTools at chrome://inspect');
}

let currentDevice = null;
let currentPort   = null;

////////////////////////////////////////////////////////////
//
//  device type handling
//

const deviceTypeFactory = [
  { name: K3Laser.getDeviceName(),    factory: () => { return K3Laser; } },
  { name: GCodeLaser.getDeviceName(), factory: () => { return GCodeLaser; } },
  { name: TestLaser.getDeviceName(),  factory: () => { return TestLaser; } }
];

ipcMain.handle('set-device-type', async (event, data) => {

  // find the name in the factory array
  const deviceType = deviceTypeFactory.find(type => type.name === data.deviceType); 
  if (!deviceType) {
    console.error(`Unknown device type: ${data.deviceType}`);
    return { success: false, message: `Unknown device type: ${data.deviceType}` };
  }

  // create the device using the factory
  currentDevice = deviceType.factory();
  needSerialPort = currentDevice.needsSerialPort();

  return { success: true, needsSerialPort: needSerialPort };
});

////////////////////////////////////////////////////////////
//
//  serial port handling
//

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
                });
                return;
            }

            console.log('Port opened successfully');
            
            // Initialize protocol handler
            response = await currentDevice.init(currentPort);

            // send reply to renderer with all responses
            event.reply('connect-response', response );
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
      });

      // Notify renderer that the port is disconnected
      event.reply('serial-port-status', { connected: false });
    }
});

function isConnected()
{    
  if (!currentPort || !protocol) {
    console.log('Not connected to serial port');
    return { status: 'error', message: 'Not connected to serial port' };
  }
  return { status: 'success' };
}


// Handle fan button click from renderer
ipcMain.on('fan-button-clicked', async (event, data) => {

  console.log('Fan button clicked:', data);

  const response = isConnected();
  if (response.status === 'error') {
    event.reply('fan-response', response);
    return;
  }

  response = await protocol.sendFanOn();

  // send reply to renderer with all responses
  event.reply('fan-response', response); 
});

// Handle center button click from renderer
ipcMain.on('center-button-clicked', async (event, data) => {

    console.log('Center button clicked:', data);

    const response = isConnected();
    if (response.status === 'error') {
        event.reply('center-response', response);
        return;
    }

    response = await protocol.sendCenter();

    // send reply to renderer with all responses
    event.reply('center-response', response); 
});

// Handle home button click from renderer
ipcMain.on('home-button-clicked', async (event, data) => {
    console.log('Home button clicked:', data);
    
    const response = isConnected();
    if (response.status === 'error') {
        event.reply('home-response', response);
        return;
    }
    
    response = await protocol.sendHome();

    // send reply to renderer with all responses
    event.reply('home-response', response); 
});

// Function to handle direction messages
async function handleDirectionMessage(event, directionData) {

    console.log('Direction button clicked:', directionData);    
    
    const response = isConnected();
    if (response.status === 'error') {
        event.reply('move-response', response);
        return;
    }

    response = await protocol.sendMove(directionData);  

    // send reply to renderer with all responses
    event.reply('move-response', response); 
}

// Handle left button click from renderer
ipcMain.on('left-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data);
});

// Handle right button click from renderer
ipcMain.on('right-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data);
});

// Handle up button click from renderer
ipcMain.on('up-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data);
});

// Handle down button click from renderer
ipcMain.on('down-button-clicked', async (event, data) => {
    handleDirectionMessage(event, data);
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

    mainWindow.webContents.openDevTools()

    mainWindow.loadFile('public/index.html');

    // Send internal dimensions when window is ready
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.send('set-internal-dimensions', {
            width: BITMAP_WINDOW_WIDTH,
            height: BITMAP_WINDOW_HEIGHT
        });
        deviceNames = deviceTypeFactory.map(type => type.name );
        mainWindow.webContents.send('set-device-types', { deviceNames: deviceNames });
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
        if (BrowserWindow.getAllWindows().length === 0) 
          createWindow();
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

// Add new IPC handlers for the image buffer functionality
ipcMain.on('open-file-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif'] }
    ]
  });
  
  if (canceled || filePaths.length === 0) {
    return null;
  }
  
  return filePaths[0];
});

ipcMain.handle('send-line-to-engraver', async (event, { lineData, lineNumber }) => {
  //console.log('Sending line to engraver:', lineData, lineNumber);

  // insert delay here
  const delay = 1000;
  console.log('Delaying for', delay, 'ms for line', lineNumber);
  
  // Wait for the delay
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Send the line data and wait for ack
  //const engraverAck = await protocol.sendMessageAndWaitForAck(Buffer.from(lineData), TIMEOUTS.ENGRAVER);
  //if (!engraverAck) {
  //  logToWindow('error', 'Failed to send engraver command');
  //  return { success: false, message: 'Failed to send engraver command' };
  //}
  
  return { success: true };
});

