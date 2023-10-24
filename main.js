/**
 * Main.js
 */

//// Core modules
const fs = require('fs')
const path = require('path')

//// External modules
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron') // Modules to control application life and create native browser window

//// Modules


//// Set globals
const IS_MAC = process.platform === 'darwin'
const APP_DIR = path.resolve(__dirname).replace(/\\/g, '/'); // Turn back slash to slash for cross-platform compat
global.APP_DIR = APP_DIR
let rootBrowserWindow = null

global.TMP_DIR = path.join(APP_DIR, `tmp`)
if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true })
}

const createWindow = () => {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1024,
        height: 700,
        minWidth: 500,
        minHeight: 200,
        icon: `${__dirname}/images/icon.png`,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    })

    //////////////////
    const menu = Menu.buildFromTemplate([
        {
            label: '&File',
            submenu: [
                {
                    label: 'Toggle Full Screen',
                    click: async () => {
                        mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                IS_MAC ? { role: 'close' } : { role: 'quit' },
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'About',
                    click: async () => {
                        await shell.openExternal('https://mis.gsu.edu.ph')
                    }
                }
            ]
        }
    ])
    Menu.setApplicationMenu(menu)
    //////////////////////////////////////


    // and load the index.html of the app.
    mainWindow.loadFile('index.html')

    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    return mainWindow
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {

    ipcMain.handle('mis:onDataFromRenderer', async (_event, action, params) => {
        const logToRenderer = (logGroup = '') => {
            return (log, progressBits = []) => {
                // Log here
                console.log(log)
                // Log to renderer
                if (rootBrowserWindow) rootBrowserWindow.webContents.send('mis:onDataFromMain', {}, logGroup)
            }
        }
        try {
            if (action === 'promotional-list') {
                
            }
            return 'Ok'
        } catch (err) {
            return err
        }
    })

    rootBrowserWindow = createWindow()

    app.on('activate', () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (!IS_MAC) app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.