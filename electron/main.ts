import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import {
  ChaoxingConfig,
  exportLogs,
  fetchCourseList,
  runDiagnostics,
  setLogSink,
  setProgressSink,
  startChaoxing,
  stopChaoxing
} from './pythonRunner'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    title: 'bk学习捅',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setTitle('bk学习捅')

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'))
  }
}

app.whenReady().then(() => {
  setLogSink((log) => {
    mainWindow?.webContents.send('chaoxing:log', log)
  })
  setProgressSink((progress) => {
    mainWindow?.webContents.send('chaoxing:progress', progress)
  })

  ipcMain.handle('chaoxing:start', (_event, config: ChaoxingConfig) => startChaoxing(config))
  ipcMain.handle('chaoxing:stop', () => stopChaoxing())
  ipcMain.handle('chaoxing:courses', (_event, config: ChaoxingConfig) => fetchCourseList(config))
  ipcMain.handle('chaoxing:diagnostics', () => runDiagnostics())
  ipcMain.handle('chaoxing:export-logs', () => exportLogs())
  ipcMain.handle('chaoxing:clear-log', () => {
    mainWindow?.webContents.send('chaoxing:clear-log')
    return { ok: true, message: '日志已清空。' }
  })

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
