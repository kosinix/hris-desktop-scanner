const { contextBridge, ipcRenderer } = require('electron')

// This goes to window.electronAPI in renderer.js
contextBridge.exposeInMainWorld('electronAPI', {
    onDataFromMain: (callback) => ipcRenderer.on('mis:onDataFromMain', callback),
    sendToMain: (action, params) => ipcRenderer.invoke('mis:onDataFromRenderer', action, params),
})