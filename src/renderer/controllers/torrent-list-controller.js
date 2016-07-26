const fs = require('fs')
const path = require('path')
const electron = require('electron')

const {dispatch} = require('../lib/dispatcher')
const State = require('../lib/state')
const sound = require('../lib/sound')
const TorrentSummary = require('../lib/torrent-summary')

const ipcRenderer = electron.ipcRenderer

const instantIoRegex = /^(https:\/\/)?instant\.io\/#/

// Controls the torrent list: creating, adding, deleting, & manipulating torrents
module.exports = class TorrentListController {
  constructor (state) {
    this.state = state
  }

  // Adds a torrent to the list, starts downloading/seeding. TorrentID can be a
  // magnet URI, infohash, or torrent file: https://github.com/feross/webtorrent#clientaddtorrentid-opts-function-ontorrent-torrent-
  addTorrent (torrentId) {
    if (torrentId.path) {
      // Use path string instead of W3C File object
      torrentId = torrentId.path
    }
    // Allow a instant.io link to be pasted
    // TODO: remove this once support is added to webtorrent core
    if (typeof torrentId === 'string' && instantIoRegex.test(torrentId)) {
      torrentId = torrentId.slice(torrentId.indexOf('#') + 1)
    }

    var torrentKey = this.state.nextTorrentKey++
    var path = this.state.saved.prefs.downloadPath

    ipcRenderer.send('wt-start-torrenting', torrentKey, torrentId, path)

    dispatch('backToList')
  }

  // Shows the Create Torrent page with options to seed a given file or folder
  showCreateTorrent (files) {
    // Files will either be an array of file objects, which we can send directly
    // to the create-torrent screen
    if (files.length === 0 || typeof files[0] !== 'string') {
      this.state.location.go({
        url: 'create-torrent',
        files: files
      })
      return
    }

    // ... or it will be an array of mixed file and folder paths. We have to walk
    // through all the folders and find the files
    findFilesRecursive(files, (allFiles) => this.showCreateTorrent(allFiles))
  }

  // creates a whole bunch of torrents 
  showCreateLibrary (files) {
    findDirectoriesRecursive(files, function(dirPaths) {
      dirPaths.forEach(function (dirPath) {
        filesInDir(dirPath, function(files) {
          // TODO: For some reason, if we only pass one file, webtorrent gets messed up and doesn't seed properly
          // Should probably fix that, but for now... it's fine if only folders with multiple files are tracked, for testing purposes
          if (1 < files.length) {
            var torrent = {
              name: path.basename(dirPath),
              path: path.dirname(dirPath),
              files: files,
              announce: [ 
                "udp://exodus.desync.com:6969",
                "udp://tracker.coppersurfer.tk:6969",
                "udp://tracker.internetwarriors.net:1337",
                "udp://tracker.leechers-paradise.org:6969",
                "udp://tracker.openbittorrent.com:80",
                "wss://tracker.btorrent.xyz",
                "wss://tracker.fastcast.nz",
                "wss://tracker.webtorrent.io",
                "wss://tracker.openwebtorrent.com"
              ],
              private: false,
              comment: ''
            }
            dispatch('createTorrent', torrent)
          }
        })
      })
    })
// var options = {
//         // We can't let the user choose their own name if we want WebTorrent
//         // to use the files in place rather than creating a new folder.
//         // If we ever want to add support for that:
//         // name: document.querySelector('.torrent-name').value
//         name: defaultName,
//         path: basePath,
//         files: files,
//         announce: announceList,
//         private: isPrivate,
//         comment: comment
//       }
//       dispatch('createTorrent', options)
  }

  // Switches between the advanced and simple Create Torrent UI
  toggleCreateTorrentAdvanced () {
    var info = this.state.location.current()
    if (info.url !== 'create-torrent') return
    info.showAdvanced = !info.showAdvanced
  }

  // Creates a new torrent and start seeeding
  createTorrent (options) {
    var state = this.state
    var torrentKey = state.nextTorrentKey++
    ipcRenderer.send('wt-create-torrent', torrentKey, options)
    state.location.backToFirst(function () {
      state.location.clearForward('create-torrent')
    })
  }

  // Starts downloading and/or seeding a given torrentSummary.
  startTorrentingSummary (torrentSummary) {
    var s = torrentSummary

    // Backward compatibility for config files save before we had torrentKey
    if (!s.torrentKey) s.torrentKey = this.state.nextTorrentKey++

    // Use Downloads folder by default
    if (!s.path) s.path = this.state.saved.prefs.downloadPath

    ipcRenderer.send('wt-start-torrenting',
                      s.torrentKey,
                      TorrentSummary.getTorrentID(s),
                      s.path,
                      s.fileModtimes,
                      s.selections)
  }

  // TODO: use torrentKey, not infoHash
  toggleTorrent (infoHash) {
    var torrentSummary = TorrentSummary.getByKey(this.state, infoHash)
    if (torrentSummary.status === 'paused') {
      torrentSummary.status = 'new'
      this.startTorrentingSummary(torrentSummary)
      sound.play('ENABLE')
    } else {
      torrentSummary.status = 'paused'
      ipcRenderer.send('wt-stop-torrenting', torrentSummary.infoHash)
      sound.play('DISABLE')
    }
  }

  toggleTorrentFile (infoHash, index) {
    var torrentSummary = TorrentSummary.getByKey(this.state, infoHash)
    torrentSummary.selections[index] = !torrentSummary.selections[index]

    // Let the WebTorrent process know to start or stop fetching that file
    ipcRenderer.send('wt-select-files', infoHash, torrentSummary.selections)
  }

  confirmDeleteTorrent (infoHash, deleteData) {
    this.state.modal = {
      id: 'remove-torrent-modal',
      infoHash,
      deleteData
    }
  }

  // TODO: use torrentKey, not infoHash
  deleteTorrent (infoHash, deleteData) {
    ipcRenderer.send('wt-stop-torrenting', infoHash)

    var index = this.state.saved.torrents.findIndex((x) => x.infoHash === infoHash)

    if (index > -1) {
      var summary = this.state.saved.torrents[index]

      // remove torrent and poster file
      deleteFile(TorrentSummary.getTorrentPath(summary))
      deleteFile(TorrentSummary.getPosterPath(summary)) // TODO: will the css path hack affect windows?

      // optionally delete the torrent data
      if (deleteData) moveItemToTrash(summary)

      // remove torrent from saved list
      this.state.saved.torrents.splice(index, 1)
      State.saveThrottled(this.state)
    }

    this.state.location.clearForward('player') // prevent user from going forward to a deleted torrent
    sound.play('DELETE')
  }

  toggleSelectTorrent (infoHash) {
    if (this.state.selectedInfoHash === infoHash) {
      this.state.selectedInfoHash = null
    } else {
      this.state.selectedInfoHash = infoHash
    }
  }

  openTorrentContextMenu (infoHash) {
    var torrentSummary = TorrentSummary.getByKey(this.state, infoHash)
    var menu = new electron.remote.Menu()

    menu.append(new electron.remote.MenuItem({
      label: 'Remove From List',
      click: () => dispatch('confirmDeleteTorrent', torrentSummary.infoHash, false)
    }))

    menu.append(new electron.remote.MenuItem({
      label: 'Remove Data File',
      click: () => dispatch('confirmDeleteTorrent', torrentSummary.infoHash, true)
    }))

    menu.append(new electron.remote.MenuItem({
      type: 'separator'
    }))

    if (torrentSummary.files) {
      menu.append(new electron.remote.MenuItem({
        label: process.platform === 'darwin' ? 'Show in Finder' : 'Show in Folder',
        click: () => showItemInFolder(torrentSummary)
      }))
      menu.append(new electron.remote.MenuItem({
        type: 'separator'
      }))
    }

    menu.append(new electron.remote.MenuItem({
      label: 'Copy Magnet Link to Clipboard',
      click: () => electron.clipboard.writeText(torrentSummary.magnetURI)
    }))

    menu.append(new electron.remote.MenuItem({
      label: 'Copy Instant.io Link to Clipboard',
      click: () => electron.clipboard.writeText(`https://instant.io/#${torrentSummary.infoHash}`)
    }))

    menu.append(new electron.remote.MenuItem({
      label: 'Save Torrent File As...',
      click: () => saveTorrentFileAs(torrentSummary)
    }))

    menu.popup(electron.remote.getCurrentWindow())
  }
}

// Returns the files from a dir. does not go recursively
function filesInDir (dirPath, cb) {
  fs.stat(dirPath, function (err, stat) {
    if (err) return dispatch('error', err)
    if (!stat.isDirectory()) return dispatch('error', new Error('Invalid directory passed to filesInDir: ' + dirPath))

    fs.readdir(dirPath, function(err, fileNames) {
      if (err) return dispatch('error', err)

      var numComplete = 0
      var ret = []
      fileNames.forEach(function (fileName) {
        var filePath = path.join(dirPath, fileName)
        fs.stat(filePath, function(err, stat) {
          if (err) return dispatch('error', err)

          if (!stat.isDirectory() && 0 < fileName.length && fileName.substr(0, 1) !== '.') {
            ret.push({
              name: path.basename(filePath),
              path: filePath,
              size: stat.size
            })
          }

          if (++numComplete === fileNames.length) {
            ret.sort((a, b) => a.path < b.path ? -1 : a.path > b.path)
            cb(ret)
          }
        })
      })
    })
  })
}

// Recursively finds {name, path, size} for all files in a folder
// Calls `cb` on success, calls `onError` on failure
function findFilesRecursive (paths, cb) {
  if (paths.length > 1) {
    var numComplete = 0
    var ret = []
    paths.forEach(function (path) {
      findFilesRecursive([path], function (fileObjs) {
        ret = ret.concat(fileObjs)
        if (++numComplete === paths.length) {
          ret.sort((a, b) => a.path < b.path ? -1 : a.path > b.path)
          cb(ret)
        }
      })
    })
    return
  }

  var fileOrFolder = paths[0]
  fs.stat(fileOrFolder, function (err, stat) {
    if (err) return dispatch('error', err)

    // Files: return name, path, and size
    if (!stat.isDirectory()) {
      var filePath = fileOrFolder
      return cb([{
        name: path.basename(filePath),
        path: filePath,
        size: stat.size
      }])
    }

    // Folders: recurse, make a list of all the files
    var folderPath = fileOrFolder
    fs.readdir(folderPath, function (err, fileNames) {
      if (err) return dispatch('error', err)
      var paths = fileNames.map((fileName) => path.join(folderPath, fileName))
      findFilesRecursive(paths, cb)
    })
  })
}

// returns all the paths of all the directories with more than 0 files (not subdirectories) in them
// recurses through all subdirectories, each subdirectory counts as another directory
// @return directory paths of all non-empty directories, including sub-directories
function findDirectoriesRecursive (dirPaths, cb) {
  if (dirPaths.length > 1) {
    var numComplete = 0
    var ret = []

    dirPaths.forEach(function (dirPath) {
      findDirectoriesRecursive([dirPath], function(dirs) {
        ret = ret.concat(dirs)
        if (++numComplete === dirPaths.length) {
          cb(ret)
        }
      })
    })
    return
  }

  var dirPath = dirPaths[0]
  fs.stat(dirPath, function(err, stat) {
    if (err) return dispatch('error', err)

    if (!stat.isDirectory()) {
      return cb([]);
    } else {
      fs.readdir(dirPath, function (err, fileNames) {
        if (err) return dispatch('error', err)

        if (0 === fileNames.length) {
          return cb([])
        } else {
          // TODO: Something is messed up here....
          // /Users/bender/Music/iTunes/iTunes Media/Music/Users/bender/Music/iTunes/iTunes Media/Music/Users/bender/Music/iTunes/iTunes Media/Music/Radiohead/OK Computer"
          var subPaths = fileNames.map((fileName) => path.join(dirPath, fileName))
          findDirectoriesRecursive(subPaths, function(dirs) {
            var ret = [dirPath]
            ret = ret.concat(dirs)
            return cb(ret)
          })
        }
      })
    }
  })
}

function makeTorrentObjsRecursive(paths, cb) {
  paths = paths.slice();

  if (1 < paths.length) {
    var numComplete = 0
    var ret = []
    paths.forEach(function (path) {
      makeTorrentObjsRecursive([path], function(torrentObjs) {
        ret = ret.concat(torrentObjs);
        if (++numComplete === paths.length) {
          ret.sort((a,b) => a.name < b.name ? -1 : a.name > b.name)
          cb(ret)
        }
      })
    })
    return
  }

  var dir = paths[0];
  fs.stat(dir, function(err, stat) {
    if (err) return dispatch('error', err)
    if (!stat.isDirectory())  return cb(null)

    fs.readdir(dir, function (err, fileNames) {
      if (err) return dispatch('error', err)

      var numComplete = 0
      var ret = []
      var files = []

      fileNames.forEach(function (fileName) {
        var filePath = path.join(dir, fileName)
        makeTorrentObjsRecursive([filePath], function(torrentObjs) {
          if (null != torrentObjs) {
            ret = ret.concat(torrentObjs)
          } else {
            files.push({
              name: fileName,
              path: filePath
            })
          }

          if (++numComplete === fileNames.length) {
            ret.push({
              name: dir,
              path: dir,
              files: files,
              announce: [ 
                "udp://exodus.desync.com:6969",
                "udp://tracker.coppersurfer.tk:6969",
                "udp://tracker.internetwarriors.net:1337",
                "udp://tracker.leechers-paradise.org:6969",
                "udp://tracker.openbittorrent.com:80",
                "wss://tracker.btorrent.xyz",
                "wss://tracker.fastcast.nz",
                "wss://tracker.webtorrent.io",
                "wss://tracker.openwebtorrent.com"
              ]
            })
            ret.sort((a,b) => a.name < b.name ? -1 : a.name > b.name)
            cb(ret)
          }
        })
      })
    })
  })
}

function deleteFile (path) {
  if (!path) return
  fs.unlink(path, function (err) {
    if (err) dispatch('error', err)
  })
}

// Delete all files in a torrent
function moveItemToTrash (torrentSummary) {
  var filePath = TorrentSummary.getFileOrFolder(torrentSummary)
  ipcRenderer.send('moveItemToTrash', filePath)
}

function showItemInFolder (torrentSummary) {
  ipcRenderer.send('showItemInFolder', TorrentSummary.getFileOrFolder(torrentSummary))
}

function saveTorrentFileAs (torrentSummary) {
  var downloadPath = this.state.saved.prefs.downloadPath
  var newFileName = path.parse(torrentSummary.name).name + '.torrent'
  var opts = {
    title: 'Save Torrent File',
    defaultPath: path.join(downloadPath, newFileName),
    filters: [
      { name: 'Torrent Files', extensions: ['torrent'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }
  electron.remote.dialog.showSaveDialog(electron.remote.getCurrentWindow(), opts, function (savePath) {
    var torrentPath = TorrentSummary.getTorrentPath(torrentSummary)
    fs.readFile(torrentPath, function (err, torrentFile) {
      if (err) return dispatch('error', err)
      fs.writeFile(savePath, torrentFile, function (err) {
        if (err) return dispatch('error', err)
      })
    })
  })
}
