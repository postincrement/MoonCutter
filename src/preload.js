const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Log messages
  logMessage: (message, type) => ipcRenderer.send('log-message', { message, type }),
  
  // Device and port management
  requestSerialPorts: () => ipcRenderer.send('request-serial-ports'),
  setDeviceType: (data) => ipcRenderer.invoke('set-device-type', data),
  connectPort: (data) => ipcRenderer.send('connect-button-clicked', data),
  
  // Device controls
  sendFanCommand: (data) => ipcRenderer.send('fan-button-clicked', data),
  sendHomeCommand: (data) => ipcRenderer.send('home-button-clicked', data),
  sendCenterCommand: (data) => ipcRenderer.send('center-button-clicked', data),
  sendRelativeMove: (data) => ipcRenderer.send('relative-move-command', data),
  
  // Image handling
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  sendLineToEngraver: (lineData, lineNumber) => 
    ipcRenderer.invoke('send-line-to-engraver', { lineData, lineNumber }),
  
  // Listen for events
  onSerialPortsList: (callback) => ipcRenderer.on('serial-ports-list', callback),
  onSerialPortsState: (callback) => ipcRenderer.on('serial-ports-state', callback),
  onConnectResponse: (callback) => ipcRenderer.on('connect-response', callback),
  onFanResponse: (callback) => ipcRenderer.on('fan-response', callback),
  onHomeResponse: (callback) => ipcRenderer.on('home-response', callback),
  onCenterResponse: (callback) => ipcRenderer.on('center-response', callback),
  onSetDeviceTypes: (callback) => ipcRenderer.on('set-device-types', callback)
}); 