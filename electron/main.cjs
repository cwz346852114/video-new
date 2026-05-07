const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const path = require('node:path')

const isDev = process.argv.includes('--dev')

function createWindow() {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 680,
    title: 'Uni Video',
    autoHideMenuBar: true,
    backgroundColor: '#10131a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(process.env.UNI_DESKTOP_DEV_URL || 'http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
    return
  }

  win.loadFile(path.join(__dirname, '../dist/build/h5/index.html'))
}

ipcMain.handle('media:open-files', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '选择音视频文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '音视频文件', extensions: ['mp4', 'mp3', 'avi', 'm3u8', 'mov', 'mkv', 'webm', 'wav', 'ogg', 'flac', 'aac', 'm4a'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  })

  if (canceled || filePaths.length === 0) {
    return []
  }

  return filePaths
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

