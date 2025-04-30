const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Existing APIs
  // ...
  
  // New APIs for image buffer functionality
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  sendLineToEngraver: (lineData, lineNumber) => 
    ipcRenderer.invoke('send-line-to-engraver', lineData, lineNumber)
}); 