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

let g_currentDeviceClass = null;
let g_currentDevice = null;
let g_currentPort   = null;

////////////////////////////////////////////////////////////
//
//  device type handling
//

const deviceTypeFactory = [
  { name: K3Laser.getDeviceName(),    class: K3Laser },
  { name: GCodeLaser.getDeviceName(), class: GCodeLaser },
  { name: TestLaser.getDeviceName(),  class: TestLaser }
];

ipcMain.handle('set-device-type', async (event, data) => {

  // find the name in the factory array
  const deviceType = deviceTypeFactory.find(type => type.name === data.deviceType); 
  if (!deviceType) {
    console.error(`Unknown device type: ${data.deviceType}`);
    return { success: false, message: `Unknown device type: ${data.deviceType}` };
  }

  // create the device using the factory
  g_currentDeviceClass = deviceType.class;
  g_currentDevice      = new g_currentDeviceClass();
  g_needsSerialPort    = g_currentDeviceClass.needsSerialPort();

  return { success: true, needsSerialPort: g_needsSerialPort };
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

function closePort(event, response)
{
  if (g_currentPort) {
    g_currentPort.close();
    g_currentPort = null;
  }

  if (response) {
    event.reply('connect-response', response);
  }
}

// Handle connect button click from renderer
ipcMain.on('connect-button-clicked', async (event, data) => {

  console.log('Connect button clicked:', data);

  closePort();
    
  if (!g_needsSerialPort) {
    logToWindow('info', 'No serial port needed');
  }
  else {
    logToWindow('info', 'Opening port:', data.port);

    try {
      g_currentPort = new SerialPort({
        path: data.port,
        baudRate: 115200,
        autoOpen: false
      });

      g_currentPort.open(async (err) => {
        if (err) {
          logToWindow('error', 'Error opening port:', err);
          closePort(event, {
            status: 'error',
            message: err.message,
          });
          return;
        }

        logToWindow('info', 'Port opened successfully');

        // Initialize protocol handler
        logToWindow('info', 'Initializing device');
        response = await g_currentDevice.init(g_currentPort);
        logToWindow('info', 'device initialized');

        // send response to renderer
        event.reply('connect-response', response);
      });
    }

    catch (err) {
      logToWindow('error', 'exception during connection:', err);
      closePort(event, {
        status: 'error',
        message: err.message,
      });
    }
  }
});

function isConnected()
{    
  if (!g_currentPort || !g_currentDevice) {
    logToWindow('error', 'Not connected to serial port');
    return { status: 'error', message: 'Not connected to serial port' };
  }
  return { status: 'success' };
}

// Handle fan button click from renderer
ipcMain.on('fan-button-clicked', async (event, data) => {

  console.log('Fan button clicked:', data);

  const connStatus = isConnected();
  if (connStatus.status === 'error') {
    event.reply('fan-response', connStatus);
    return;
  }

  response = await g_currentDevice.sendFanOn();

  // send reply to renderer with all responses
  event.reply('fan-response', response); 
});

// Handle center button click from renderer
ipcMain.on('center-button-clicked', async (event, data) => {

    console.log('Center button clicked:', data);

    const connStatus = isConnected();
    if (connStatus.status === 'error') {
        event.reply('center-response', connStatus);
        return;
    }

    response = await g_currentDevice.sendCenter();

    // send reply to renderer with all responses
    event.reply('center-response', response); 
});

// Handle home button click from renderer
ipcMain.on('home-button-clicked', async (event, data) => {
  console.log('Home button clicked:', data);
    
    const connStatus = isConnected();
    if (connStatus.status === 'error') {
        event.reply('home-response', connStatus);
        return;
    }
    
    response = await g_currentDevice.sendHome();

    // send reply to renderer with all responses
    event.reply('home-response', response); 
});

// nudge button click from renderer
ipcMain.on('relative-move-command', async (event, directionData) => {
    console.log('Nudge button clicked:', directionData);    
    
    const connStatus = isConnected();
    if (connStatus.status === 'error') {
        event.reply('relative-move-response', connStatus);
        return;
    }

    response = await g_currentDevice.sendRelativeMove(
        { dx: directionData.dx * g_currentDeviceClass.getNudgeSize(), 
          dy: directionData.dy * g_currentDeviceClass.getNudgeSize()}
    );  

    // send reply to renderer with all responses
    event.reply('relative-move-response', response); 
});

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 632,
        minWidth: 900,
        minHeight: 632,
        resizable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
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
        if (g_currentPort) {
            g_currentPort.close();
            g_currentPort = null;
            g_currentDevice = null;
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
    if (g_currentPort) {
        g_currentPort.close();
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
ipcMain.handle('open-file-dialog', async () => {
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
  logToWindow('debug', 'Delaying for', delay, 'ms for line', lineNumber);
  
  // Wait for the delay
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Send the line data and wait for ack
  //const engraverAck = await protocol.sendMessageAndWaitForAck("line", Buffer.from(lineData), TIMEOUTS.ENGRAVER);
  //if (!engraverAck) {
  //  logToWindow('error', 'Failed to send engraver command');
  //  return { success: false, message: 'Failed to send engraver command' };
  //}
  
  return { success: true };
});

