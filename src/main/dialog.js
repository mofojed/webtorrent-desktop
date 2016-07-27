module.exports = {
  createTorrentLibrary,
  openSeedFile,
  openSeedDirectory,
  openTorrentFile,
  openTorrentAddress,
  openLibraryDirectory,
  openFiles
}

var electron = require('electron')

var config = require('../config')
var log = require('./log')
var windows = require('./windows')

/**
 * Show open dialog to create a single-file torrent.
 */
function openSeedFile () {
  if (!windows.main.win) return
  log('openSeedFile')
  var opts = {
    title: 'Select a file for the torrent.',
    properties: [ 'openFile' ]
  }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    windows.main.dispatch('showCreateTorrent', selectedPaths)
  })
}

/*
 * Show open dialog to create a single-file or single-directory torrent. On
 * Windows and Linux, open dialogs are for files *or* directories only, not both,
 * so this function shows a directory dialog on those platforms.
 */
function openSeedDirectory () {
  if (!windows.main.win) return
  log('openSeedDirectory')
  var opts = process.platform === 'darwin'
    ? {
      title: 'Select a file or folder for the torrent.',
      properties: [ 'openFile', 'openDirectory' ]
    }
    : {
      title: 'Select a folder for the torrent.',
      properties: [ 'openDirectory' ]
    }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    windows.main.dispatch('showCreateTorrent', selectedPaths)
  })
}

/*
 * Show flexible open dialog that supports selecting .torrent files to add, or
 * a file or folder to create a single-file or single-directory torrent.
 */
function openFiles () {
  if (!windows.main.win) return
  log('openFiles')
  var opts = process.platform === 'darwin'
    ? {
      title: 'Select a file or folder to add.',
      properties: [ 'openFile', 'openDirectory' ]
    }
    : {
      title: 'Select a file to add.',
      properties: [ 'openFile' ]
    }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    windows.main.dispatch('onOpen', selectedPaths)
  })
}

/*
 * Show open dialog to open a .torrent file.
 */
function openTorrentFile () {
  if (!windows.main.win) return
  log('openTorrentFile')
  var opts = {
    title: 'Select a .torrent file.',
    filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
    properties: [ 'openFile', 'multiSelections' ]
  }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    selectedPaths.forEach(function (selectedPath) {
      windows.main.dispatch('addTorrent', selectedPath)
    })
  })
}

/*
 * Show modal dialog to open a torrent URL (magnet uri, http torrent link, etc.)
 */
function openTorrentAddress () {
  log('openTorrentAddress')
  windows.main.dispatch('openTorrentAddress')
}

function openLibraryDirectory () {
  if (!windows.main.win) return
  log('openLibraryDirectory')
  var opts = process.platform === 'darwin'
    ? {
      title: 'Select the folder for your media library.',
      properties: [ 'openDirectory' ]
    }
    : {
      title: 'Select the folder for your media library.',
      properties: [ 'openDirectory' ]
    }
  setTitle(opts.title)
  electron.dialog.showOpenDialog(windows.main.win, opts, function (selectedPaths) {
    resetTitle()
    if (!Array.isArray(selectedPaths)) return
    windows.main.dispatch('createTorrentsFromDirectories', selectedPaths)
  })
}

function createTorrentLibrary () {
  if (!windows.main.win) return
  log('createTorrentLibrary')

  windows.main.dispatch('createTorrentLibrary')
}

/**
 * Dialogs on do not show a title on Mac, so the window title is used instead.
 */
function setTitle (title) {
  if (process.platform === 'darwin') {
    windows.main.dispatch('setTitle', title)
  }
}

function resetTitle () {
  setTitle(config.APP_WINDOW_TITLE)
}
