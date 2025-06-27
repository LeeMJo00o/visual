// Electron 主进程示例
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  mainWindow.loadFile('index.html')
}

function createFloatingWindow() {
  const floatingWindow = new BrowserWindow({
    width: 400,
    height: 300,
    x: 1400, // 可以设置到主窗口外
    y: 100,
    frame: false, // 无边框
    alwaysOnTop: true, // 置顶
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  floatingWindow.loadFile('floating-dialog.html')
  return floatingWindow
}

app.whenReady().then(() => {
  createMainWindow()

  // 监听来自渲染进程的创建浮动窗口请求
  ipcMain.on('create-floating-window', () => {
    createFloatingWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
