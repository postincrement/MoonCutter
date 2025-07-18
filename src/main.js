/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

require('source-map-support').install();
const { app, BrowserWindow, ipcMain, Menu, dialog, systemPreferences } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const fs = require('fs');
const fontList = require('font-list');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { checkForUpdates } = require('./version-check');

const K3Laser     = require('./k3-laser');
const GCodeLaser  = require('./gcode-laser');
const TestLaser   = require('./test-laser');

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

async function closeDevice(event, response)
{
  try {
    if (g_currentDevice) {

      if (g_currentDevice.m_port && g_currentDevice.m_port.isOpen) {
        console.log('Closing port...');
        await new Promise((resolve, reject) => {
          g_currentDevice.m_port.close((err) => {
            if (err) {
              console.error('Error closing port:', err);
              reject(err);
            } else {
              console.log('Port closed successfully');
              resolve();
            }
            g_currentDevice.m_port = null;            
          });
        });
      } else {
        console.log('Port was already closed');
      }

      // First call cleanup on the device to remove event listeners
      await g_currentDevice.cleanup();
      
      // Clear the device reference
      g_currentDevice = null;
    }

    if (response) {
      event.reply('connect-response', response);
    }
  } catch (error) {
    console.error('Error in closeDevice:', error);
    if (response) {
      event.reply('connect-response', { ...response, error: error.message });
    }
  }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 915,
        height: 632,
        minWidth: 850,
        minHeight: 632,
        resizable: true,
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

    mainWindow.on('closed', async () => {
        try {
            // Clean up the current device before quitting
            if (g_currentDevice) {
                await closeDevice(null, null);
            }
        } catch (error) {
            console.error('Error during window close:', error);
        } finally {
            mainWindow = null;
            // Use process.exit(0) instead of app.quit() to ensure clean exit
            process.exit(0);
        }
    });
}

app.whenReady().then(async () => {
    createWindow();
    
    // Check for updates after a short delay to ensure the app is fully loaded
    setTimeout(async () => {
        const preferences = loadPreferences();
        if (preferences.checkUpdates !== false) {
            await checkForUpdates(false);
        }
    }, 5000);

    // System fonts handling
    ipcMain.handle('get-system-fonts', async () => {
        try {
            console.log('Getting system fonts...');
            const platform = os.platform();
            let fonts = [];

            if (platform === 'darwin') {
                // macOS - use system_profiler with larger buffer
                const { stdout } = await execPromise('system_profiler SPFontsDataType', {
                    maxBuffer: 10 * 1024 * 1024 // 10MB buffer
                });
                
                // Parse the output to extract font families
                const fontFamilies = new Set();
                const lines = stdout.split('\n');
                let currentFamily = '';
                
                for (const line of lines) {
                    if (line.includes('Family:')) {
                        currentFamily = line.split('Family:')[1].trim();
                        if (currentFamily && !currentFamily.includes('System Fonts') && !currentFamily.startsWith('.')) {
                            fontFamilies.add(currentFamily);
                        }
                    }
                }
                
                fonts = Array.from(fontFamilies).sort();
            } else if (platform === 'win32') {
                // Windows
                const { stdout } = await execPromise('powershell -command "[System.Reflection.Assembly]::LoadWithPartialName(\'System.Drawing\'); [System.Drawing.FontFamily]::Families | ForEach-Object { $_.Name }"');
                fonts = stdout.split('\n').filter(Boolean);
            } else {
                // Linux
                const { stdout } = await execPromise('fc-list : family');
                fonts = stdout.split('\n').map(line => line.trim()).filter(Boolean);
            }

            console.log('Found fonts:', fonts.length);
            return fonts;
        } catch (error) {
            console.error('Error getting system fonts:', error);
            return [];
        }
    });

    // Device type handling
    ipcMain.handle('set-device-type', async (event, data) => {
        try {
            // Close any existing device first
            if (g_currentDevice) {
                await closeDevice(event, null);
            }

            // find the name in the factory array
            const deviceType = deviceTypeFactory.find(type => type.name === data.deviceType); 
            if (!deviceType) {
                console.error(`Unknown device type: ${data.deviceType}`);
                return { success: false, message: `Unknown device type: ${data.deviceType}` };
            }

            // create the device using the factory
            g_currentDeviceClass = deviceType.class;
            g_needsSerialPort = g_currentDeviceClass.needsSerialPort();

            // instantiate the device and get the dimensions, even though we have the port yet
            const dev = new g_currentDeviceClass();
            const dimensions = dev.getDimensions();

            logMessage('info', `setting device type to ${data.deviceType}, dimensions: ${dimensions.width}x${dimensions.height}`);

            return { 
                success: true, 
                needsSerialPort: g_needsSerialPort,
                engraverDimensions: dimensions 
            };
        } catch (error) {
            console.error('Error in set-device-type:', error);
            return { success: false, message: error.message };
        }
    });

    // Handle engrave area button click
    ipcMain.on('engrave-area-clicked', async (event, boundingBox) => {
      try {
        const connStatus = isConnected();
        if (connStatus.status === 'error') {
          event.reply('engrave-area-response', { status: 'error', message: connStatus.message });
          return;
        }

        logMessage('info', 'Engrave area command received');

        var errorString = '';
        try {
          var response =    await g_currentDevice.sendAbsoluteMove({ x: boundingBox.left, y: boundingBox.top })
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

        event.reply('engrave-area-response', { status: 'error', message: errorString });
      } catch (error) {
        console.error('Error in engrave-area-clicked:', error);
        event.reply('engrave-area-response', { status: 'error', message: error.message });
      }
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

      if (g_currentDevice) {
        await closeDevice(event, null);
      }

      g_currentDevice = new g_currentDeviceClass();

      if (!g_needsSerialPort) {
        logMessage('info', 'No serial port needed');
      }
      else {
        logMessage('info', 'Opening port:', data.portName);

        var newPort = null;

        try {
          newPort = new SerialPort({
            path: data.portName,
            baudRate: 115200,
            autoOpen: false
          });

          newPort.open(async (err) => {
            if (err) {
              logMessage('error', 'Error opening port:', err);
              await newPort.close();
              newPort = null;
              event.reply('connect-response', {
                status: 'error',
                message: err.message,
              });
              return;
            }

            logMessage('info', 'Port opened successfully');

            // Initialize protocol handler
            logMessage('info', 'Initializing device');
            response = await g_currentDevice.init(newPort);
            logMessage('info', 'device initialized');

            // send response to renderer
            event.reply('connect-response', response);
          });
        }

        catch (err) {
          if (newPort) {
            await newPort.close();
            newPort = null;
          }
          logMessage('error', 'exception during connection:', err);
          event.reply('connect-response', {
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

    ipcMain.on('centre-button-clicked', async (event, data) => {
      console.log('Centre button clicked:', data);

      const connStatus = isConnected();
      if (connStatus.status === 'error') {
          event.reply('centre-response', connStatus);
          return;
      }

      // calculate the centre of the image bounding box
      const boundingBox = data.boundingBox;
      const centreX = (boundingBox.left + boundingBox.right) / 2;
      const centreY = (boundingBox.top + boundingBox.bottom) / 2;

      logMessage('info', `Centre of image: ${centreX}, ${centreY}`);

      try {
        var response =    await g_currentDevice.sendAbsoluteMove({ x: centreX, y: centreY });
        if (response) {
          event.reply('centre-response', { status: 'success', message: 'Centre command sent successfully' });
          return;
      }

        errorString = 'Failed to send centre command';
        event.reply('centre-response', { status: 'error', message: errorString });
      } catch (err) {
        errorString = 'move command error: ' + err.message;
        event.reply('centre-response', { status: 'error', message: errorString });
      }
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

app.on('window-all-closed', async () => {  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Preferences handling
const userDataPath = app.getPath('userData');
const preferencesPath = path.join(userDataPath, 'preferences.json');

function loadPreferences() {
  logMessage('info', 'Loading preferences from:', preferencesPath);
    try {
        if (fs.existsSync(preferencesPath)) {
            const data = fs.readFileSync(preferencesPath, 'utf8');
            const preferences = JSON.parse(data);
            logMessage('info', 'main Preferences loaded:', preferences);
            return preferences;
        }
    } catch (err) {
        console.error('Error loading preferences:', err);
    }
    // Default preferences
    return {
        units: 'mm'
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

// Handle preferences changed event
ipcMain.on('preferences-changed', (event, preferences) => {
    // Notify all windows about the preference change
    BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('preferences-changed', preferences);
    });
});

// Add this function to create the About window
function createAboutWindow() {
    const aboutWindow = new BrowserWindow({
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

    aboutWindow.loadFile('public/about.html');
    aboutWindow.setMenu(null);

    // Send the app version to the About window
    aboutWindow.webContents.on('did-finish-load', () => {
        aboutWindow.webContents.send('set-app-version', app.getVersion());
    });
}

// Update menu template
const template = [
    {
        label: 'MoonCutter',
        id: 'mooncutter-menu',
        submenu: [
            {
                label: 'About MoonCutter',
                click: () => {
                    createAboutWindow();
                }
            },
            {
                label: 'Check for Updates',
                click: async () => {
                    await checkForUpdates(true);
                }
            },
            { type: 'separator' },
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
            },
            {
                label: 'Show Logs',
                click: () => {
                    createLogWindow();
                }
            },
            { type: 'separator' },
            {
                label: 'Quit',
                accelerator: 'CmdOrCtrl+Q',
                click: () => {
                    app.quit();
                }
            }
        ]
    },
    {
        label: 'File',
        submenu: [
            {
                label: 'Open...',
                accelerator: 'CmdOrCtrl+O',
                click: () => {
                    // TODO: Implement file open functionality
                }
            }
        ]
    },
    {
        label: 'Edit',
        submenu: [
            //{ role: 'undo' },
            //{ role: 'redo' },
            //{ type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' },
            { role: 'delete' },
            //{ type: 'separator' },
            //{ role: 'selectAll' }
        ]
    }
];

// Create the menu
const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// Make the MoonCutter menu bold
const moonCutterMenu = menu.getMenuItemById('mooncutter-menu');
if (moonCutterMenu) {
    moonCutterMenu.label = 'MoonCutter';
    moonCutterMenu.font = { weight: 'bold' };
}

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
  if (g_needsSerialPort && (!g_currentDevice || !g_currentDevice.m_port)) {
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

// Add a handler for app quit
app.on('before-quit', async () => {
    try {
        if (g_currentDevice) {
            await closeDevice(null, null);
        }
    } catch (error) {
        console.error('Error during app quit:', error);
    }
});



