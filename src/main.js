require('source-map-support').install();
const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const fs = require('fs');

const K3Laser     = require('./k3_laser');
const GCodeLaser  = require('./gcode_laser');
const TestLaser   = require('./test_laser');

const { createLogWindow, logMessage } = require('./log');

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
let g_needsSerialPort = false;

////////////////////////////////////////////////////////////
//
//  device type handling
//

const deviceTypeFactory = [
  { name: K3Laser.getDeviceName(),    class: K3Laser },
  { name: GCodeLaser.getDeviceName(), class: GCodeLaser },
  { name: TestLaser.getDeviceName(),  class: TestLaser }
];

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

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 915,
        height: 632,
        minWidth: 900,
        minHeight: 632,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    //mainWindow.webContents.openDevTools()

    mainWindow.loadFile('public/index.html');

    // Send internal dimensions when window is ready
    mainWindow.webContents.on('did-finish-load', () => {
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

    // Device type handling
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

      // get the dimensions of the device
      const dimensions = g_currentDevice.getDimensions();

      logMessage('info', `setting device type to ${data.deviceType}, dimensions: ${dimensions.width}x${dimensions.height}`);

      return { success            : true, 
               needsSerialPort    : g_needsSerialPort,
               engraverDimensions : g_currentDevice.getDimensions() };
    });

    // Handle engrave area button click
    ipcMain.on('engrave-area-clicked', async (event, boundingBox) => {
      const connStatus = isConnected();
      if (connStatus.status === 'error') {
        event.reply('engrave-area-response', { status: 'error', message: connStatus.message });
        return;
      }

      logMessage('info', 'Engrave area command received');

      var errorString = '';
      try {
        var response = await g_currentDevice.sendAbsoluteMove({ x: boundingBox.left, y: boundingBox.top })
                       && await g_currentDevice.sendAbsoluteMove({ x: boundingBox.right, y: boundingBox.top })
                       && await g_currentDevice.sendAbsoluteMove({ x: boundingBox.right, y: boundingBox.bottom })
                       && await g_currentDevice.sendAbsoluteMove({ x: boundingBox.left, y: boundingBox.bottom })
                       && await g_currentDevice.sendAbsoluteMove({ x: boundingBox.left, y: boundingBox.top });
        if (response) {
          event.reply('engrave-area-response', { status: 'success', message: 'Engrave area command sent successfully' });
          return;
        }

        errorString = 'Failed to send engrave area command';
      } catch (err) {
        errorString = 'move command error: ' + err.message;
      }
      logMessage('error', 'move command error', errorString);
      event.reply('engrave-area-response', { status: 'error', message: errorString
      });
    });

    // Serial port handling
    ipcMain.on('request-serial-ports', async (event) => {
      try {
        const ports = await SerialPort.list();
        const filteredPorts = ports.filter(port => 
          !port.path.includes('cu.wlan-debug') && 
          !port.path.includes('tty.wlan-debug') &&
          !port.path.includes('tty.debug-console') &&
          !port.path.includes('tty.Bluetooth-Incoming-Port')
        );
        event.reply('serial-ports-list', filteredPorts);
      } catch (err) {
        console.error('Error listing serial ports:', err);
        event.reply('serial-ports-list', []);
      }
    });

    ipcMain.on('connect-button-clicked', async (event, data) => {
      console.log('Connect button clicked:', data);

      closePort();
        
      if (!g_needsSerialPort) {
        logMessage('info', 'No serial port needed');
      }
      else {
        logMessage('info', 'Opening port:', data.port);

        try {
          g_currentPort = new SerialPort({
            path: data.port,
            baudRate: 115200,
            autoOpen: false
          });

          g_currentPort.open(async (err) => {
            if (err) {
              logMessage('error', 'Error opening port:', err);
              closePort(event, {
                status: 'error',
                message: err.message,
              });
              return;
            }

            logMessage('info', 'Port opened successfully');

            // Initialize protocol handler
            logMessage('info', 'Initializing device');
            response = await g_currentDevice.init(g_currentPort);
            logMessage('info', 'device initialized');

            // send response to renderer
            event.reply('connect-response', response);
          });
        }

        catch (err) {
          logMessage('error', 'exception during connection:', err);
          closePort(event, {
            status: 'error',
            message: err.message,
          });
        }
      }
    });

    ipcMain.on('fan-button-clicked', async (event, data) => {
      console.log('Fan button clicked:', data);

      const connStatus = isConnected();
      if (connStatus.status === 'error') {
        event.reply('fan-response', connStatus);
        return;
      }

      g_currentDevice.setFan(!g_currentDevice.getFan());

      // send reply to renderer with all responses
      event.reply('fan-response', response); 
    });

    ipcMain.on('center-button-clicked', async (event, data) => {
      console.log('Center button clicked:', data);

      const connStatus = isConnected();
      if (connStatus.status === 'error') {
          event.reply('center-response', connStatus);
          return;
      }

      response = await g_currentDevice.sendCenter();

      // send reply to renderer with all responses
      event.reply('center-response', { status: 'success', message: "center command sent successfully" }); 
    });

    ipcMain.on('home-button-clicked', async (event, data) => {
      console.log('Home button clicked:', data);
        
      const connStatus = isConnected();
      if (connStatus.status === 'error') {
          event.reply('home-response', connStatus);
          return;
      }
      
      response = await g_currentDevice.sendHome();

      // send reply to renderer with all responses
      event.reply('home-response', { status: 'success', message: "home command sent successfully" }); 
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
});

app.on('window-all-closed', () => {
  if (g_currentPort) {
    g_currentPort.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle any uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// Preferences handling
const userDataPath = app.getPath('userData');
const preferencesPath = path.join(userDataPath, 'preferences.json');

function loadPreferences() {
    try {
        if (fs.existsSync(preferencesPath)) {
            const data = fs.readFileSync(preferencesPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Error loading preferences:', err);
    }
    // Default preferences
    return {
        units: 'mm',
        scaleMode: 'corner'
    };
}

function savePreferences(preferences) {
    try {
        fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2));
    } catch (err) {
        console.error('Error saving preferences:', err);
    }
}

// Add preferences IPC handlers
ipcMain.handle('load-preferences', () => {
    return loadPreferences();
});

ipcMain.handle('save-preferences', (event, preferences) => {
    savePreferences(preferences);
    return { success: true };
});

// Update menu template
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
    },
    {
        label: 'Settings',
        submenu: [
            {
                label: 'Preferences',
                click: () => {
                    const prefsWindow = new BrowserWindow({
                        width: 400,
                        height: 300,
                        resizable: false,
                        minimizable: false,
                        maximizable: false,
                        webPreferences: {
                            nodeIntegration: false,
                            contextIsolation: true,
                            preload: path.join(__dirname, 'preload.js')
                        }
                    });

                    prefsWindow.loadFile('public/preferences.html');
                    prefsWindow.setMenu(null);
                }
            }
        ]
    },
    {
        label: 'Help',
        submenu: [
            {
                label: 'About MoonCutter',
                click: () => {
                    const aboutWindow = new BrowserWindow({
                        width: 400,
                        height: 300,
                        resizable: false,
                        minimizable: false,
                        maximizable: false,
                        webPreferences: {
                            nodeIntegration: false,
                            contextIsolation: true
                        }
                    });

                    aboutWindow.loadFile('public/about.html');
                    aboutWindow.setMenu(null);
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

function isConnected()
{    
  if (g_needsSerialPort && (!g_currentPort || !g_currentDevice)) {
    logMessage('error', 'Not connected to serial port');
    return { status: 'error', message: 'Not connected to serial port' };
  }
  return { status: 'success' };
}


ipcMain.handle('start-engraving', async (event, data) => {
  logMessage('info', 'Start engraving command received:', data);
  const connStatus = isConnected();
  if (connStatus.status === 'error') {
    return connStatus;
  }

  await g_currentDevice.startEngraving(data);
  return { status: 'success', message: "start engraving command sent successfully" };
});

ipcMain.handle('stop-engraving', async (event) => {
  logMessage('info', 'Stop engraving command received:');
  await g_currentDevice.stopEngraving();
  return { status: 'success', message: "stop engraving command sent successfully" };
});

ipcMain.handle('send-line-to-engraver', async (event, { lineData, lineNumber }) => {

  logMessage('info', 'Sending line to engraver:', lineNumber);
  const connStatus = isConnected();
  if (connStatus.status === 'error') {
    return connStatus;
  }

  await g_currentDevice.engraveLine(lineData, lineNumber)

  return { status: 'success', message: "line sent successfully" };
});


