const { contextBridge, ipcRenderer } = require('electron')
const { pathToFileURL } = require('node:url')
const path = require('node:path')

function toMediaFile(filePath) {
  return {
    id: `${filePath}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    path: filePath,
    url: pathToFileURL(filePath).toString(),
    name: path.basename(filePath),
    ext: path.extname(filePath).slice(1).toLowerCase(),
  }
}

contextBridge.exposeInMainWorld('electronMedia', {
  openFiles: async () => {
    const filePaths = await ipcRenderer.invoke('media:open-files')
    return filePaths.map(toMediaFile)
  },
  openFile: async () => {
    const filePaths = await ipcRenderer.invoke('media:open-files')
    return filePaths[0] ? toMediaFile(filePaths[0]) : null
  },
  toMediaFiles: filePaths => filePaths.map(toMediaFile),
})
