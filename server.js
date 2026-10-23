const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

const COLS = 40, ROWS = 24, CELL = 20, DURATION = 120000, TICK = 1000 / 30;
const rooms = new Map();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const makeRoomCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

function newRoom(code) {
  const room = {
    code, owner: null, players: {}, grid: Array(COLS * ROWS).fill(0),
    started: false, ended: false, startedAt: null, endsAt: null, interval: null
  };
  rooms.set(code, room);
  return room;
}
function claimFootprint(room, player) {
  const left = Math.floor((player.x - 1) / CELL);
  const top = Math.floor((player.y - 1) / CELL);
  const right = Math.floor((player.x + CELL * 2 - 1) / CELL);
  const bottom = Math.floor((player.y + CELL * 2 - 1) / CELL);
  // Claim every cell crossed by the 2x2 footprint, including territory under its path.
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) room.grid[y * COLS + x] = player.id;
  }
}
function score(room) {
  let a = 0, b = 0;
  for (const cell of room.grid) { if (cell === 1) a++; else if (cell === 2) b++; }
  const total = COLS * ROWS;
  return { p1: a, p2: b, p1Pct: +(a / total * 100).toFixed(1), p2Pct: +(b / total * 100).toFixed(1), total };
}
function publicState(room) {
  return {
    code: room.code, cols: COLS, rows: ROWS, cell: CELL,
    grid: room.grid, players: Object.values(room.players).map(p => ({ id:p.id, x:p.x, y:p.y, name:p.name, ready:p.ready })),
    started: room.started, ended: room.ended, startedAt: room.startedAt, endsAt: room.endsAt,
    scores: score(room)
  };
}
function emitState(room) { io.to(room.code).emit("state", publicState(room)); }
function begin(room) {
  if (room.started || Object.keys(room.players).length !== 2) return;
  room.started = true; room.startedAt = Date.now(); room.endsAt = room.startedAt + DURATION;
  room.players[1].x = 4 * CELL; room.players[1].y = 11 * CELL;
  room.players[2].x = (COLS - 6) * CELL; room.players[2].y = 11 * CELL;
  claimFootprint(room, room.players[1]); claimFootprint(room, room.players[2]);
  room.interval = setInterval(() => {
    if (room.ended) return;
    const now = Date.now();
    const dt = TICK / 1000;
    for (const p of Object.values(room.players)) {
      if (!p.input) continue;
      let dx = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
      let dy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);
      if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
      const oldX = p.x, oldY = p.y, speed = 170;
      p.x = clamp(p.x + dx * speed * dt, 0, COLS * CELL - CELL * 2);
      p.y = clamp(p.y + dy * speed * dt, 0, ROWS * CELL - CELL * 2);
      // Sample along the segment so fast movement cannot skip tiles.
      const distance = Math.hypot(p.x - oldX, p.y - oldY);
      const steps = Math.max(1, Math.ceil(distance / (CELL / 3)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        claimFootprint(room, { ...p, x: oldX + (p.x - oldX) * t, y: oldY + (p.y - oldY) * t });
      }
    }
    if (now >= room.endsAt) {
      room.ended = true;
      clearInterval(room.interval);
    }
    emitState(room);
  }, TICK);
}
function cleanRoom(room) {
  if (room.interval) clearInterval(room.interval);
  rooms.delete(room.code);
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name } = {}, callback) => {
    let code = makeRoomCode();
    while (rooms.has(code)) code = makeRoomCode();
    const room = newRoom(code);
    room.owner = socket.id;
    room.players[1] = { id:1, socketId:socket.id, name:String(name || "Player 1").slice(0,16), x:80, y:220, input:{}, ready:true };
    socket.join(code); socket.data.room = code; socket.data.playerId = 1;
    if (typeof callback === "function") callback({ ok:true, code, playerId:1 });
    emitState(room);
  });
  socket.on("joinRoom", ({ code, name } = {}, callback) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return typeof callback === "function" && callback({ ok:false, error:"Room not found. Check the code or create a new room." });
    if (room.started || Object.keys(room.players).length >= 2) return typeof callback === "function" && callback({ ok:false, error:"This room is already full or the match has started." });
    room.players[2] = { id:2, socketId:socket.id, name:String(name || "Player 2").slice(0,16), x:680, y:220, input:{}, ready:true };
    socket.join(code); socket.data.room = code; socket.data.playerId = 2;
    if (typeof callback === "function") callback({ ok:true, code, playerId:2 });
    io.to(code).emit("joined", { message:"Both players connected. Match starting!" });
    begin(room); emitState(room);
  });
  socket.on("input", input => {
    const room = rooms.get(socket.data.room), id = socket.data.playerId;
    if (!room || !room.started || room.ended || !room.players[id]) return;
    const safe = {};
    for (const key of ["up","down","left","right"]) safe[key] = !!(input && input[key]);
    room.players[id].input = safe;
  });
  socket.on("rematch", () => {
    const room = rooms.get(socket.data.room);
    if (!room || Object.keys(room.players).length !== 2) return;
    if (room.interval) clearInterval(room.interval);
    room.grid = Array(COLS * ROWS).fill(0); room.started = false; room.ended = false; room.startedAt = null; room.endsAt = null;
    for (const p of Object.values(room.players)) { p.input = {}; }
    begin(room); emitState(room);
  });
  socket.on("disconnect", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room) return;
    io.to(code).emit("opponentLeft", { message:"Your opponent disconnected. Create a new room to play again." });
    cleanRoom(room);
  });
});

server.listen(PORT, () => console.log(`Territory Rush running at http://localhost:${PORT}`));