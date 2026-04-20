const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { createServer } = require('http');
const next = require('next');
const { parse } = require('url');
const path = require('path');

const dev = !app.isPackaged;
const port = 0; // Dynamic port to avoid conflicts

// Initialize Next.js app programmatically
const nextApp = next({ dev, dir: app.getAppPath() });
const handle = nextApp.getRequestHandler();

let mainWindow;

app.whenReady().then(() => {
  nextApp.prepare().then(() => {
    // Start the local web server Next.js needs to run
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request', err);
        res.statusCode = 500;
        res.end('internal server error');
      }
    });

    server.once('error', (err) => {
      console.error(err);
      process.exit(1);
    });

    server.listen(port, () => {
      const actualPort = server.address().port;
      console.log(`> Ready on http://localhost:${actualPort}`);

      // Create the Electron window
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets/gemma.ico'),
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          preload: path.join(__dirname, 'preload.js')
        },
      });

      // Setup IPC for LLM testing
      ipcMain.handle("test_local_llm", async (_, { url, model }) => {
        try {
          const res = await fetch(`${url}/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: "Hello" }],
            }),
          });

          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      });

      ipcMain.handle("test_cloud_llm", async (_, { provider, apiKey, model }) => {
        // Placeholder for cloud testing
        return { success: true };
      });

      mainWindow.loadURL(`http://localhost:${actualPort}`);

      // Setup Native Menubar
      const { Menu } = require('electron');
      const isMac = process.platform === 'darwin';
      const template = [
        ...(isMac ? [{
          label: app.name,
          submenu: [
            { role: 'about' },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { role: 'quit' }
          ]
        }] : []),
        {
          label: 'File',
          submenu: [
            isMac ? { role: 'close' } : { role: 'quit' }
          ]
        },
        {
          label: 'Edit',
          submenu: [
            { role: 'undo' },
            { role: 'redo' },
            { type: 'separator' },
            { role: 'cut' },
            { role: 'copy' },
            { role: 'paste' }
          ]
        },
        {
          label: 'View',
          submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' }
          ]
        },
        {
          label: 'Window',
          submenu: [
            { role: 'minimize' },
            { role: 'zoom' },
            ...(isMac ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ] : [
              { role: 'close' }
            ])
          ]
        },
        {
          label: 'Settings',
          submenu: [
            {
              label: 'Open Settings',
              click: () => {
                if (mainWindow) {
                  mainWindow.webContents.executeJavaScript('window.location.href = "/settings";');
                }
              }
            }
          ]
        }
      ];
      const menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(menu);

      // Open DevTools for debugging
      // mainWindow.webContents.openDevTools();

      mainWindow.webContents.on('console-message', (event, level, message) => {
        console.log(`[Browser Console] ${message}`);
      });

      mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('[Browser Load Failed]', errorCode, errorDescription);
      });

      mainWindow.on('closed', () => {
        mainWindow = null;
      });
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
