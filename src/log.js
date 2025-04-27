

const { BrowserWindow } = require('electron');

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
          contextIsolation: false
      },
      modal: false,
      parent: null,
      show: true
  });

  logWindow.loadFile('public/log.html');

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

module.exports = { logToWindow, createLogWindow };