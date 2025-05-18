const { ipcRenderer } = require('electron');
const { dialog } = require('electron');

const logWindow = document.getElementById('logWindow');

function logMessageToWindow(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    logWindow.appendChild(logEntry);
    logWindow.scrollTop = logWindow.scrollHeight;
}

// Listen for log messages from the main window
ipcRenderer.on('log-message-to-window', (event, { message, type }) => {
    logMessageToWindow(message, type);
});

// Clear logs button handler
document.getElementById('clearLogsButton').addEventListener('click', () => {
    logWindow.innerHTML = '';
}); 