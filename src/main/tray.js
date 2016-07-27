module.exports = {
  hasTray,
  init,
  onWindowBlur,
  onWindowFocus
}

var electron = require('electron')

var app = electron.app

var config = require('../config')
var windows = require('./windows')

var tray

function init () {
  if (process.platform === 'linux') {
    initLinux()
  }
  if (process.platform === 'win32') {
    initWin32()
  }
  // Mac apps generally do not have menu bar icons
}

/**
 * Returns true if there a tray icon is active.
 */
function hasTray () {
  return !!tray
}

function onWindowBlur () {
  if (!tray) return
  updateTrayMenu()
}

function onWindowFocus () {
  if (!tray) return
  updateTrayMenu()
}

function initLinux () {
  checkLinuxTraySupport(function (supportsTray) {
    if (supportsTray) createTray()
  })
}

function initWin32 () {
  createTray()
}

/**
 * Check for libappindicator1 support before creating tray icon
 */
function checkLinuxTraySupport (cb) {
  var cp = require('child_process')

  // Check that we're on Ubuntu (or another debian system) and that we have
  // libappindicator1. If WebTorrent was installed from the deb file, we should
  // always have it. If it was installed from the zip file, we might not.
  cp.exec('dpkg --get-selections libappindicator1', function (err, stdout) {
    if (err) return cb(false)
    // Unfortunately there's no cleaner way, as far as I can tell, to check
    // whether a debian package is installed:
    cb(stdout.endsWith('\tinstall\n'))
  })
}

function createTray () {
  tray = new electron.Tray(getIconPath())

  // On Windows, left click opens the app, right click opens the context menu.
  // On Linux, any click (left or right) opens the context menu.
  tray.on('click', () => windows.main.show())

  // Show the tray context menu, and keep the available commands up to date
  updateTrayMenu()
}

function updateTrayMenu () {
  var contextMenu = electron.Menu.buildFromTemplate(getMenuTemplate())
  tray.setContextMenu(contextMenu)
}

function getMenuTemplate () {
  return [
    getToggleItem(),
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]

  function getToggleItem () {
    if (windows.main.win.isVisible()) {
      return {
        label: 'Hide to tray',
        click: () => windows.main.hide()
      }
    } else {
      return {
        label: 'Show WebTorrent',
        click: () => windows.main.show()
      }
    }
  }
}

function getIconPath () {
  return process.platform === 'win32'
    ? config.APP_ICON + '.ico'
    : config.APP_ICON + '.png'
}
