/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // System fonts
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  
  // Log messages
  logMessage: (message, type) => ipcRenderer.send('log-message', { message, type }),
  
  // Device and port management
  requestSerialPorts: () => ipcRenderer.send('request-serial-ports'),
  setDeviceType: (data) => ipcRenderer.invoke('set-device-type', data),
  connectPort: (data) => ipcRenderer.send('connect-button-clicked', data),
  
  // Device controls
  sendFanCommand: (data) => ipcRenderer.send('fan-button-clicked', data),
  sendHomeCommand: (data) => ipcRenderer.send('home-button-clicked', data),
  sendCentreCommand: (data) => ipcRenderer.send('centre-button-clicked', data),
  sendRelativeMove: (data) => ipcRenderer.send('relative-move-command', data),
  engraveArea: (boundingBox) => ipcRenderer.send('engrave-area-clicked', boundingBox),
  
  // Image handling
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),

  // Engraving
  startEngraving: (data) => ipcRenderer.invoke('start-engraving', data),
  sendLineToEngraver: (lineData, lineNumber) => ipcRenderer.invoke('send-line-to-engraver', { lineData, lineNumber }),
  stopEngraving: () => ipcRenderer.invoke('stop-engraving'),
  
  // Listen for events
  onSerialPortsList: (callback) => ipcRenderer.on('serial-ports-list', callback),
  onSerialPortsState: (callback) => ipcRenderer.on('serial-ports-state', callback),
  onConnectResponse: (callback) => ipcRenderer.on('connect-response', callback),
  onFanResponse: (callback) => ipcRenderer.on('fan-response', callback),
  onHomeResponse: (callback) => ipcRenderer.on('home-response', callback),
  onCentreResponse: (callback) => ipcRenderer.on('centre-response', callback),
  onSetDeviceTypes: (callback) => ipcRenderer.on('set-device-types', callback),
  onEngraveAreaResponse: (callback) => ipcRenderer.on('engrave-area-response', callback),

  // Preferences API
  loadPreferences: () => ipcRenderer.invoke('load-preferences'),
  savePreferences: (preferences) => ipcRenderer.invoke('save-preferences', preferences),
  preferencesChanged: (preferences) => ipcRenderer.send('preferences-changed', preferences),
  onPreferencesChanged: (callback) => ipcRenderer.on('preferences-changed', callback),

  // Version API
  onSetAppVersion: (callback) => ipcRenderer.on('set-app-version', (event, version) => callback(version))
}); 