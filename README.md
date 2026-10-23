# Territory Rush — Online Pixel Arena

A complete first version of a 2-player online territory-capture browser game.

## Features
- Online 1v1 rooms with a 4-character code
- Smooth movement using WASD or arrow keys
- A 40 × 24 arena, 2 × 2 player footprint, and path-based tile claiming
- Enemy tiles are converted when crossed
- 120-second server-timed match and live territory percentages
- Pixel-art / retro arcade visual style
- Rematch button after the match

## Requirements
- Node.js 18 or newer
- Internet connection for installing packages (Google Fonts are optional; the game still works without them)

## Run locally
1. Extract the ZIP.
2. Open a terminal inside the `territory-rush` folder.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```
5. Open http://localhost:3000 in your browser.
6. Player 1 clicks **Create Room** and shares the 4-character code.
7. Player 2 opens the same site, enters the code, and clicks **Join**.

To test two players on one computer, open the site in two different browser windows (or one regular window and one private window).

## Put it online for friends
Deploy this Node.js app to a host that supports persistent WebSocket connections (for example, Render or Railway):
- Build/install command: `npm install`
- Start command: `npm start`
- Runtime: Node.js
- No database or environment variables are required for this prototype.
- Use the public HTTPS URL on both devices. WebSocket support must be enabled.

A single server instance is used: room state is held in memory, so restarting/redeploying the server ends active matches. This prototype is intended for casual matches, not ranked or cheat-proof competitive play.

## Rules
- The first player is blue; the second is orange.
- The 2 × 2 footprint claims cells as it passes over them.
- Territory is converted instantly, including enemy territory.
- Winner is whoever owns the greater percentage when 120 seconds end.

## Project structure
```
territory-rush/
  package.json
  server.js
  public/
    index.html
    style.css
    game.js
```

## Troubleshooting
- **Room not found:** create the room first; use the current four-character code.
- **Cannot connect from another network:** deploy to a public Node host. `localhost` is only accessible on your own computer.
- **Port in use:** set `PORT=3001` before starting, then visit `http://localhost:3001`.
