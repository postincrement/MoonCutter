const { BrowserWindow } = require('electron');
const { ipcMain } = require('electron');
const { dialog } = require('electron');

let logWindow = null;

function createLogWindow() {
  if (logWindow) {
    logWindow.focus();
    return;
  }

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

  //logWindow.webContents.openDevTools()

  logWindow.loadFile('public/log.html');

  logWindow.on('closed', () => {
      logWindow = null;
  });
}

// listen to log messages from the main window
ipcMain.on('log-message', (event, { message, type }) => {
  logMessage(type, message);
});

// Function to send messages to log window
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
  })

  if (type === 'error') {
    console.error(formattedMessage);
    dialog.showErrorBox('Error', formattedMessage);
  }
  else {
    console.log(items);
  }
  if (logWindow) {
    logWindow.webContents.send('log-message-to-window', { message: formattedMessage, type });
  }
}

module.exports = { logMessage, createLogWindow };