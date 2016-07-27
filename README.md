<h1 align="center">
  <br>
  <a href="https://webtorrent.io"><img src="https://webtorrent.io/img/WebTorrent.png" alt="WebTorrent" width="200"></a>
  <br>
  WebTorrent Desktop
  <br>
  <br>
</h1>

<h4 align="center">The streaming torrent client. For Mac, Windows, and Linux.</h4>

<p align="center">
  <a href="https://gitter.im/feross/webtorrent"><img src="https://img.shields.io/badge/gitter-join%20chat%20%E2%86%92-brightgreen.svg" alt="Gitter"></a>
  <a href="https://travis-ci.org/feross/webtorrent-desktop"><img src="https://img.shields.io/travis/feross/webtorrent-desktop/master.svg" alt="Travis"></a>
  <a href="https://github.com/feross/webtorrent-desktop/releases"><img src="https://img.shields.io/github/release/feross/webtorrent-desktop.svg" alt="Release"></a>
</p>

## Install

**WebTorrent Desktop** is still under very active development. You can download the latest version from the [releases](https://github.com/feross/webtorrent-desktop/releases) page.

## Screenshot

<p align="center">
  <img src="https://webtorrent.io/img/screenshot-main.png" width="612" height="749" alt="screenshot" align="center">
</p>

## How to Contribute

### Install dependencies

```
$ npm install
```

### Run app

```
$ npm start
```

### Package app

Builds app binaries for Mac, Linux, and Windows.

```
$ npm run package
```

To build for one platform:

```
$ npm run package -- [platform]
```

Where `[platform]` is `darwin`, `linux`, `win32`, or `all` (default).

The following optional arguments are available:

- `--sign` - Sign the application (Mac, Windows)
- `--package=[type]` - Package single output type.
   - `deb` - Debian package
   - `zip` - Linux zip file
   - `dmg` - Mac disk image
   - `exe` - Windows installer
   - `portable` - Windows portable app
   - `all` - All platforms (default)

Note: Even with the `--package` option, the auto-update files (.nupkg for Windows, *-darwin.zip for Mac) will always be produced.

#### Windows build notes

To package the Windows app from non-Windows platforms, [Wine](https://www.winehq.org/) needs
to be installed.

On Mac, first install [XQuartz](http://www.xquartz.org/), then run:

```
brew install wine
```

(Requires the [Homebrew](http://brew.sh/) package manager.)

### Privacy

WebTorrent Desktop collects some basic usage stats to help us make the app better. For example, we track how well the play button works. How often does it succeed? Time out? Show a missing codec error?

The app never sends personally identifying information, nor does it track which swarms you join.

### Code Style

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

## License

MIT. Copyright (c) [WebTorrent, LLC](https://webtorrent.io).
