const socket = io();
const $ = id => document.getElementById(id);
const lobby = $("lobby"), game = $("game"), canvas = $("board"), ctx = canvas.getContext("2d");
const CELL = 20, COLS = 40, ROWS = 24;
let myId = null, roomCode = null, currentState = null, input = {up:false,down:false,left:false,right:false};
let matchStarted = false, opponentGone = false, lastStateTime = 0;

function setMessage(text, error=false) { const el=$("lobbyMessage"); el.textContent=text; el.style.color=error?"#ff8e9c":"#a5ff8f"; }
function nameValue() { return $("playerName").value.trim().slice(0,16) || "PIXEL PILOT"; }
function enterGame(result) {
  myId = result.playerId; roomCode = result.code;
  lobby.classList.add("hidden"); game.classList.remove("hidden");
  $("roomLabel").textContent = roomCode; $("copyCode").textContent = roomCode;
  $("controlText").textContent = myId === 1 ? "WASD / ARROW KEYS" : "ARROW KEYS / WASD";
  showOverlay("WAITING FOR RIVAL", "Share this room code with one friend. The match starts when they join.", false);
}
$("createBtn").addEventListener("click", () => {
  $("createBtn").disabled = true; setMessage("Creating your arena...");
  socket.emit("createRoom", {name:nameValue()}, result => {
    $("createBtn").disabled = false;
    if (!result || !result.ok) return setMessage(result?.error || "Could not create room.", true);
    enterGame(result); setMessage("Room created.");
  });
});
$("joinBtn").addEventListener("click", () => {
  const code=$("roomCode").value.trim().toUpperCase();
  if(code.length!==4) return setMessage("Enter the 4-character room code.", true);
  $("joinBtn").disabled=true; setMessage("Joining arena...");
  socket.emit("joinRoom",{code,name:nameValue()},result=>{
    $("joinBtn").disabled=false;
    if(!result || !result.ok) return setMessage(result?.error || "Could not join room.",true);
    enterGame(result);
  });
});
$("roomCode").addEventListener("input", e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,4));
$("copyBtn").addEventListener("click", async ()=>{
  try { await navigator.clipboard.writeText(roomCode); $("copyBtn").firstChild.textContent="COPIED! "; }
  catch { window.prompt("Copy this room code:",roomCode); }
});
$("overlayBtn").addEventListener("click",()=>socket.emit("rematch"));

function showOverlay(title,text,button) {
  $("overlayTitle").textContent=title; $("overlayText").textContent=text;
  $("overlayBtn").classList.toggle("hidden",!button); $("overlay").classList.remove("hidden");
}
function hideOverlay(){ $("overlay").classList.add("hidden"); }
socket.on("joined",()=>{});
socket.on("state", state=>{
  currentState=state; lastStateTime=performance.now();
  if(state.started){ matchStarted=true; hideOverlay(); }
  if(state.ended){
    const a=state.scores.p1Pct,b=state.scores.p2Pct;
    const won=(myId===1&&a>b)||(myId===2&&b>a), draw=a===b;
    showOverlay(draw?"IT'S A DRAW":won?"VICTORY!":"DEFEAT",`FINAL SCORE — BLUE ${a.toFixed(1)}% / ORANGE ${b.toFixed(1)}%. ${draw?"Dead even!":won?"You own the arena.":"Your rival owns the arena."}`,true);
  }
  if(state.players.length===2 && state.started) {
    $("name1").textContent=(state.players.find(p=>p.id===1)?.name||"BLUE").toUpperCase();
    $("name2").textContent=(state.players.find(p=>p.id===2)?.name||"ORANGE").toUpperCase();
  }
  $("score1").textContent=state.scores.p1Pct.toFixed(1)+"%";
  $("score2").textContent=state.scores.p2Pct.toFixed(1)+"%";
  $("statusPill").textContent=state.ended?"FINISHED":state.started?"IN PROGRESS":"WAITING";
  draw(state);
});
socket.on("opponentLeft", info=>{
  opponentGone=true; showOverlay("RIVAL DISCONNECTED",info.message,false);
});
socket.on("connect",()=>{});
socket.on("disconnect",()=>{ if(roomCode) showOverlay("CONNECTION LOST","Refresh the page and create or join a room again.",false); });

function draw(state){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // Pixel-art night arena with subtle grid and tile ownership.
  ctx.fillStyle="#111525";ctx.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    const owner=state.grid[y*COLS+x], px=x*CELL,py=y*CELL;
    if(owner===1){ctx.fillStyle="#1d526b";ctx.fillRect(px,py,CELL,CELL);ctx.fillStyle="#2e8ba7";ctx.fillRect(px+2,py+2,CELL-4,3);}
    else if(owner===2){ctx.fillStyle="#663c32";ctx.fillRect(px,py,CELL,CELL);ctx.fillStyle="#a65c3e";ctx.fillRect(px+2,py+2,CELL-4,3);}
    else {ctx.fillStyle=((x+y)%2===0)?"#171c2e":"#151a2a";ctx.fillRect(px,py,CELL,CELL);}
    ctx.strokeStyle="#252b40";ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,CELL,CELL);
  }
  // Spawn beacon corners.
  ctx.fillStyle="#54d6ff";ctx.fillRect(2*CELL,10*CELL,2,4*CELL);ctx.fillRect(2*CELL,10*CELL,4*CELL,2);
  ctx.fillStyle="#ff9f5a";ctx.fillRect((COLS-4)*CELL,10*CELL,2,4*CELL);ctx.fillRect((COLS-6)*CELL,10*CELL,4*CELL,2);
  for(const p of state.players){
    const color=p.id===1?"#54d6ff":"#ff9f5a", dark=p.id===1?"#1b7898":"#9c4e2f";
    // Character body has a crisp pixel outline and a 2x2-sized footprint.
    ctx.fillStyle="#0a0d18";ctx.fillRect(p.x-3,p.y-3,CELL*2+6,CELL*2+6);
    ctx.fillStyle=dark;ctx.fillRect(p.x,p.y,CELL*2,CELL*2);
    ctx.fillStyle=color;ctx.fillRect(p.x+3,p.y+3,CELL*2-6,CELL*2-6);
    ctx.fillStyle="#101525";ctx.fillRect(p.x+6,p.y+7,4,4);ctx.fillRect(p.x+CELL+7,p.y+7,4,4);
    ctx.fillStyle="#fff2d6";ctx.fillRect(p.x+7,p.y+8,2,2);ctx.fillRect(p.x+CELL+8,p.y+8,2,2);
    ctx.fillStyle="#101525";ctx.fillRect(p.x+9,p.y+CELL+7,22,3);
    ctx.fillStyle="#fff";ctx.font="10px monospace";ctx.textAlign="center";ctx.fillText(p.id===myId?"YOU":p.name.toUpperCase(),p.x+CELL,p.y-7);
  }
  const now=Date.now(), remaining=state.ended?0:Math.max(0,state.endsAt?state.endsAt-now:120000);
  $("timer").textContent=String(Math.floor(remaining/60000)).padStart(2,"0")+":"+String(Math.floor((remaining%60000)/1000)).padStart(2,"0");
}
function updateInput(){
  if(!roomCode || !matchStarted || (currentState&&currentState.ended))return;
  socket.emit("input",input);
}
const keyMap={w:"up",ArrowUp:"up",s:"down",ArrowDown:"down",a:"left",ArrowLeft:"left",d:"right",ArrowRight:"right"};
window.addEventListener("keydown",e=>{
  const key=keyMap[e.key]||keyMap[e.key.toLowerCase()];
  if(key){e.preventDefault();input[key]=true;updateInput();}
});
window.addEventListener("keyup",e=>{
  const key=keyMap[e.key]||keyMap[e.key.toLowerCase()];
  if(key){input[key]=false;updateInput();}
});
window.addEventListener("blur",()=>{input={up:false,down:false,left:false,right:false};updateInput();});
// Send held keys at a steady rate; server remains authoritative for movement and ownership.
setInterval(updateInput,50);
