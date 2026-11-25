const { app, BrowserWindow, Menu, protocol, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DIST = path.join(__dirname, '..', 'dist');

// file:// 下 ES module 脚本会被 CORS 拦截；自定义标准协议提供稳定 origin 与模块加载
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 360,
    minHeight: 640,
    backgroundColor: '#f4efe4',
    title: 'EnArrower · 箭头解谜',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadURL('app://local/index.html');
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const filePath = path.normalize(path.join(DIST, decodeURIComponent(pathname)));
    if (!filePath.startsWith(DIST + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
  createWindow();
});

app.on('window-all-closed', () => app.quit());