# REWIND — Music Player

A working music player built with plain HTML, CSS, and JavaScript. No frameworks, no build step.

## Project structure

```
rewind-music-player/
├── index.html          # markup
├── style.css            # all styling
├── script.js            # playback, queue, search, likes, history logic
├── package.json         # optional npm script to run a local server
└── .vscode/
    ├── extensions.json   # recommends the Live Server extension
    └── settings.json     # Live Server config
```

## Running it

You have three easy options:

**1. Just open it**
Double-click `index.html`. It works directly in the browser — no server needed.

**2. VS Code Live Server (recommended for development)**
- Install the "Live Server" extension (VS Code will prompt you, since it's in `.vscode/extensions.json`)
- Right-click `index.html` → **Open with Live Server**
- Runs at `http://127.0.0.1:5500`

**3. npm**
```bash
npm start
```
Runs a local static server at `http://localhost:5500` (uses `serve` via `npx`, no install needed).

## Customizing

**Swap in your own tracks:** open `script.js` and edit the `tracks` array near the top. Each entry needs:
```js
{ id: 17, title: "Your Song", artist: "Your Artist", album: "Your Album", genre: "Indie", src: "path/or/url/to/audio.mp3" }
```
`src` can point to a local file (put it in an `assets/` folder and reference it as `assets/song.mp3`) or a hosted URL.

The current tracks use freely-licensed instrumental demo audio as placeholders, since real commercial music can't be redistributed — swap in audio you have the rights to use.

**Cover art:** covers are generated gradients using each track's `colors` pair and initials — no image files required. Add real artwork by replacing the `.cover` div logic in `script.js` with an `<img>` tag if you'd like.

**Colors/fonts:** all design tokens are CSS custom properties at the top of `style.css` (`:root { ... }`) — change `--amber`, `--bg`, etc. to reskin the whole app.

## Features

- Real audio playback with play/pause, next/prev, seek, volume
- Shuffle and repeat (off / all / one)
- Live search across title, artist, and album
- Genre filter pills
- Liked Songs (persisted with `localStorage`)
- Listening History
- Slide-out queue panel
- Keyboard shortcuts: `Space` play/pause, `←/→` prev/next
- Fully responsive layout
