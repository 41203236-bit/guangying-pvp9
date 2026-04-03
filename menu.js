import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getDatabase, ref, get, set, update, onValue, remove } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const STORAGE = {
  playerName: 'gy_player_name',
  playerId: 'gy_player_id',
  faction: 'gy_menu_faction',
  role: 'gy_menu_role',
  roomCode: 'gy_room_code',
  slot: 'gy_room_slot',
  bgm: 'gy_bgm_volume',
  sfx: 'gy_sfx_volume',
  audioUnlocked: 'gy_audio_unlocked'
};

const ROLE_DATA = {
  mage: {
    label: '法師 · Mage',
    short: '控場 / 封鎖 / 節奏限制',
    passiveName: '殘影禁制',
    passiveDesc: '當法師落下第 4 顆棋並移除最舊棋時，該位置留下 1 回合殘影格。對手若落在該格，下回合主動技能消耗 +1 SP。冷卻 2 回合。',
    activeName: '封格',
    activeDesc: '指定 1 個空格，對手下回合不能落子在該格。法師靠限制選擇來逼迫對手失誤。',
    image: 'mage.png'
  },
  knight: {
    label: '騎士 · Knight',
    short: '穩定推進 / 保持盤面壓力',
    passiveName: '堅守陣線',
    passiveDesc: '當騎士落下第 4 顆棋時，自動保留最舊棋一次，不立即移除。冷卻 2 回合。',
    activeName: '推進',
    activeDesc: '將自己場上一顆棋移動到相鄰空格，只能上下左右 1 格，目標格必須為空。',
    image: 'knight.png'
  },
  assassin: {
    label: '刺客 · Assassin',
    short: '擾亂節奏 / 打斷布局',
    passiveName: '弱點標記',
    passiveDesc: '當刺客落下第 4 顆棋時，自動使對手最舊棋進入脆弱 1 回合。脆弱棋不能參與連線判定。冷卻 3 回合。',
    activeName: '突襲換位',
    activeDesc: '將自己一顆棋與相鄰敵棋交換位置，用來拆線、插入關鍵位置、打亂對方節奏。',
    image: 'assassin.png'
  }
};

const FACTION_TEXT = { light: '光 / O', dark: '暗 / X' };

const $ = (id) => document.getElementById(id);
const els = {
  bgmVolume: $('bgmVolume'), sfxVolume: $('sfxVolume'), bgmOut: $('bgmOut'), sfxOut: $('sfxOut'),
  playerNameText: $('playerNameText'), factionLight: $('factionLight'), factionDark: $('factionDark'),
  createBtn: $('createBtn'), copyBtn: $('copyBtn'), roomInput: $('roomInput'), joinBtn: $('joinBtn'),
  readyBtn: $('readyBtn'), leaveBtn: $('leaveBtn'), startBtn: $('startBtn'), statusBar: $('statusBar'),
  roomCodeText: $('roomCodeText'), roomRoleText: $('roomRoleText'),
  mySlotChip: $('mySlotChip'), myRoleName: $('myRoleName'), myRoleSub: $('myRoleSub'), myRoleImage: $('myRoleImage'), myRolePlaceholder: $('myRolePlaceholder'), myPassiveName: $('myPassiveName'), myPassiveDesc: $('myPassiveDesc'), myActiveName: $('myActiveName'), myActiveDesc: $('myActiveDesc'),
  enemySlotChip: $('enemySlotChip'), enemyRoleName: $('enemyRoleName'), enemyRoleSub: $('enemyRoleSub'), enemyRoleImage: $('enemyRoleImage'), enemyRolePlaceholder: $('enemyRolePlaceholder'), enemyPassiveName: $('enemyPassiveName'), enemyPassiveDesc: $('enemyPassiveDesc'), enemyActiveName: $('enemyActiveName'), enemyActiveDesc: $('enemyActiveDesc'),
  playerOneName: $('playerOneName'), playerOneMeta: $('playerOneMeta'), playerOneState: $('playerOneState'), playerTwoName: $('playerTwoName'), playerTwoMeta: $('playerTwoMeta'), playerTwoState: $('playerTwoState'),
  toast: $('toast')
};
const roleCards = [...document.querySelectorAll('.role-card')];
const menuBgm = new Audio('./bgm/menu.mp3');
menuBgm.loop = true;
menuBgm.preload = 'auto';

let playerName = localStorage.getItem(STORAGE.playerName) || '';
let playerId = localStorage.getItem(STORAGE.playerId) || '';
let selectedFaction = localStorage.getItem(STORAGE.faction) || '';
let selectedRole = localStorage.getItem(STORAGE.role) || '';
let currentRoomCode = localStorage.getItem(STORAGE.roomCode) || '';
let currentSlot = localStorage.getItem(STORAGE.slot) || '';
let roomUnsub = null;
let roomData = null;

if (!playerName) {
  location.href = 'entry_page_v4_centered_layout.html';
}
if (!playerId) {
  playerId = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  localStorage.setItem(STORAGE.playerId, playerId);
}

function clamp(v){ return Math.max(0, Math.min(1, v)); }
function storedVolume(key, fallback){ const raw = localStorage.getItem(key); const n = raw===null ? fallback : Number(raw); return Number.isFinite(n) ? clamp(n) : fallback; }
function applyAudio(){
  const bgm = storedVolume(STORAGE.bgm, 0.65);
  const sfx = storedVolume(STORAGE.sfx, 0.85);
  els.bgmVolume.value = Math.round(bgm * 100); els.sfxVolume.value = Math.round(sfx * 100);
  els.bgmOut.textContent = `${Math.round(bgm * 100)}%`; els.sfxOut.textContent = `${Math.round(sfx * 100)}%`;
  menuBgm.volume = bgm;
}
function tryPlayMenu(){
  if (localStorage.getItem(STORAGE.audioUnlocked) === '1') {
    menuBgm.play().catch(()=>{});
  }
}
els.bgmVolume.addEventListener('input', ()=>{ const v=Number(els.bgmVolume.value)/100; localStorage.setItem(STORAGE.bgm, String(v)); els.bgmOut.textContent=`${els.bgmVolume.value}%`; menuBgm.volume=v; });
els.sfxVolume.addEventListener('input', ()=>{ const v=Number(els.sfxVolume.value)/100; localStorage.setItem(STORAGE.sfx, String(v)); els.sfxOut.textContent=`${els.sfxVolume.value}%`; });
applyAudio(); tryPlayMenu();
window.addEventListener('beforeunload', ()=> menuBgm.pause());

function showToast(message){
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(()=> els.toast.classList.remove('show'), 2200);
}
function setStatus(message){ els.statusBar.textContent = message; }
function roomRef(code){ return ref(db, `rooms/${code}`); }
function codeGen(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function playerPath(slot, key=''){ return `players/${slot}${key ? '/' + key : ''}`; }
function formatState(joined, ready){ if(!joined) return ['未加入', 'bad']; if(ready) return ['已準備', 'ok']; return ['未準備', 'warn']; }
function otherSlot(slot){ return slot === 'O' ? 'X' : 'O'; }

function updateRolePanel(prefix, role, faction){
  const chip = prefix === 'my' ? els.mySlotChip : els.enemySlotChip;
  const roleName = prefix === 'my' ? els.myRoleName : els.enemyRoleName;
  const roleSub = prefix === 'my' ? els.myRoleSub : els.enemyRoleSub;
  const roleImage = prefix === 'my' ? els.myRoleImage : els.enemyRoleImage;
  const placeholder = prefix === 'my' ? els.myRolePlaceholder : els.enemyRolePlaceholder;
  const passiveName = prefix === 'my' ? els.myPassiveName : els.enemyPassiveName;
  const passiveDesc = prefix === 'my' ? els.myPassiveDesc : els.enemyPassiveDesc;
  const activeName = prefix === 'my' ? els.myActiveName : els.enemyActiveName;
  const activeDesc = prefix === 'my' ? els.myActiveDesc : els.enemyActiveDesc;

  if (!role || !ROLE_DATA[role]) {
    chip.textContent = prefix === 'my' ? `我的陣營：${faction ? FACTION_TEXT[faction] : '未選'}` : `對手陣營：${faction ? FACTION_TEXT[faction] : '未選'}`;
    roleName.textContent = prefix === 'my' ? '尚未選擇角色' : '尚未同步角色';
    roleSub.textContent = prefix === 'my' ? '請先選擇光 / 暗，再選擇法師、騎士或刺客。' : '對手尚未加入或尚未完成選角。';
    roleImage.classList.add('hidden');
    roleImage.removeAttribute('src');
    placeholder.classList.remove('hidden');
    passiveName.textContent = ''; passiveDesc.textContent = prefix === 'my' ? '待你選角後顯示。' : '等待對手選角後顯示。';
    activeName.textContent = ''; activeDesc.textContent = prefix === 'my' ? '待你選角後顯示。' : '等待對手選角後顯示。';
    return;
  }
  const data = ROLE_DATA[role];
  chip.textContent = prefix === 'my' ? `我的陣營：${FACTION_TEXT[faction] || '未選'}` : `對手陣營：${FACTION_TEXT[faction] || '未選'}`;
  roleName.textContent = data.label;
  roleSub.textContent = data.short;
  roleImage.src = data.image;
  roleImage.classList.remove('hidden');
  placeholder.classList.add('hidden');
  passiveName.textContent = data.passiveName;
  passiveDesc.textContent = data.passiveDesc;
  activeName.textContent = data.activeName;
  activeDesc.textContent = data.activeDesc;
}

function updateFactionUi(){
  els.factionLight.classList.toggle('active', selectedFaction === 'light');
  els.factionDark.classList.toggle('active', selectedFaction === 'dark');
}
function updateRoleUi(){
  roleCards.forEach(card => card.classList.toggle('active', card.dataset.role === selectedRole));
}
function persistSelection(){
  if (selectedFaction) localStorage.setItem(STORAGE.faction, selectedFaction);
  if (selectedRole) localStorage.setItem(STORAGE.role, selectedRole);
}

async function syncMySelection(){
  if (!currentRoomCode || !currentSlot || !roomData) return;
  const me = roomData.players?.[currentSlot];
  if (!me || me.ready) return;
  await update(roomRef(currentRoomCode), {
    [playerPath(currentSlot, 'name')]: playerName,
    [playerPath(currentSlot, 'faction')]: selectedFaction || '',
    [playerPath(currentSlot, 'role')]: selectedRole || '',
    [playerPath(currentSlot, 'clientId')]: playerId
  });
}

function renderPlayerBox(slot, nameEl, metaEl, stateEl){
  const p = roomData?.players?.[slot];
  if (!p?.joined) {
    nameEl.textContent = '等待中';
    metaEl.textContent = '尚未加入';
    stateEl.textContent = '未加入'; stateEl.className = 'state bad';
    return;
  }
  nameEl.textContent = p.name || '未命名';
  metaEl.textContent = `${FACTION_TEXT[p.faction] || '未選陣營'} ｜ ${ROLE_DATA[p.role]?.label || '未選角色'}`;
  const [text, cls] = formatState(p.joined, p.ready);
  stateEl.textContent = text; stateEl.className = `state ${cls}`;
}

function render(){
  els.playerNameText.textContent = playerName;
  updateFactionUi(); updateRoleUi();
  updateRolePanel('my', selectedRole, selectedFaction);

  if (!roomData || !currentRoomCode) {
    els.roomCodeText.textContent = '未建立';
    els.roomRoleText.textContent = '尚未加入房間';
    els.copyBtn.disabled = true; els.readyBtn.disabled = true; els.leaveBtn.disabled = true; els.startBtn.disabled = true;
    renderPlayerBox('O', els.playerOneName, els.playerOneMeta, els.playerOneState);
    renderPlayerBox('X', els.playerTwoName, els.playerTwoMeta, els.playerTwoState);
    updateRolePanel('enemy', '', '');
    return;
  }

  const me = roomData.players?.[currentSlot] || {};
  const foe = roomData.players?.[otherSlot(currentSlot)] || {};
  els.roomCodeText.textContent = currentRoomCode;
  els.roomRoleText.textContent = `${currentSlot === 'O' ? '玩家一' : '玩家二'} ｜ ${me.joined ? '已加入' : '未加入'}`;
  els.copyBtn.disabled = false; els.leaveBtn.disabled = false;
  const canReady = !!(me.joined && selectedFaction && selectedRole);
  els.readyBtn.disabled = !canReady;
  els.readyBtn.textContent = me.ready ? '取消準備' : '準備就緒';
  const canStart = roomData.hostSlot === currentSlot && roomData.phase === 'lobby' && roomData.players?.O?.joined && roomData.players?.X?.joined && roomData.players?.O?.ready && roomData.players?.X?.ready;
  els.startBtn.disabled = !canStart;

  renderPlayerBox('O', els.playerOneName, els.playerOneMeta, els.playerOneState);
  renderPlayerBox('X', els.playerTwoName, els.playerTwoMeta, els.playerTwoState);
  updateRolePanel('enemy', foe.role, foe.faction);

  if (!roomData.players?.O?.joined || !roomData.players?.X?.joined) setStatus('等待另一位玩家加入房間。');
  else if (!(roomData.players?.O?.ready && roomData.players?.X?.ready)) setStatus('雙方都要準備就緒，房主才能開始。');
  else setStatus('雙方已準備完成，房主可以按下開始。');
}

function cleanupSubscription(){
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
}

function subscribeRoom(code){
  cleanupSubscription();
  roomUnsub = onValue(roomRef(code), async (snap)=>{
    const data = snap.val();
    if (!data) {
      roomData = null; currentRoomCode = ''; currentSlot = '';
      localStorage.removeItem(STORAGE.roomCode); localStorage.removeItem(STORAGE.slot);
      render(); setStatus('房間不存在或已被刪除。');
      return;
    }
    roomData = data;
    const me = data.players?.[currentSlot];
    if (me?.clientId === playerId && (!me.name || me.faction !== selectedFaction || me.role !== selectedRole) && !me.ready) {
      await syncMySelection();
      return;
    }
    render();
  });
}

async function createRoom(){
  if (!selectedFaction || !selectedRole) { setStatus('先選擇光 / 暗與角色，再建立房間。'); return; }
  cleanupSubscription();
  currentRoomCode = codeGen();
  currentSlot = 'O';
  localStorage.setItem(STORAGE.roomCode, currentRoomCode);
  localStorage.setItem(STORAGE.slot, currentSlot);
  roomData = {
    phase: 'lobby',
    hostSlot: 'O',
    createdAt: Date.now(),
    players: {
      O: { joined:true, name:playerName, faction:selectedFaction, role:selectedRole, ready:false, clientId:playerId },
      X: { joined:false, name:'', faction:'', role:'', ready:false, clientId:'' }
    }
  };
  await set(roomRef(currentRoomCode), roomData);
  subscribeRoom(currentRoomCode);
  render();
  showToast('新房間已建立');
}

async function joinRoom(){
  const code = els.roomInput.value.trim().toUpperCase();
  if (!selectedFaction || !selectedRole) { setStatus('先選擇光 / 暗與角色，再加入房間。'); return; }
  if (!code) { setStatus('請先輸入房號。'); return; }
  const snap = await get(roomRef(code));
  if (!snap.exists()) { setStatus('找不到這個房間。'); return; }
  const data = snap.val();
  if (data.phase !== 'lobby') { setStatus('這個房間已不在大廳階段。'); return; }
  const targetSlot = !data.players?.O?.joined ? 'O' : (!data.players?.X?.joined ? 'X' : '');
  if (!targetSlot) { setStatus('房間已滿。'); return; }
  currentRoomCode = code; currentSlot = targetSlot;
  localStorage.setItem(STORAGE.roomCode, currentRoomCode); localStorage.setItem(STORAGE.slot, currentSlot);
  await update(roomRef(currentRoomCode), {
    [playerPath(currentSlot)]: { joined:true, name:playerName, faction:selectedFaction, role:selectedRole, ready:false, clientId:playerId }
  });
  subscribeRoom(currentRoomCode);
  showToast('加入房間成功');
}

async function toggleReady(){
  if (!currentRoomCode || !currentSlot || !roomData) return;
  const me = roomData.players?.[currentSlot];
  if (!me?.joined) return;
  if (!selectedFaction || !selectedRole) { setStatus('準備前必須先選好陣營與角色。'); return; }
  await update(roomRef(currentRoomCode), {
    [playerPath(currentSlot, 'faction')]: selectedFaction,
    [playerPath(currentSlot, 'role')]: selectedRole,
    [playerPath(currentSlot, 'name')]: playerName,
    [playerPath(currentSlot, 'ready')]: !me.ready,
    [playerPath(currentSlot, 'clientId')]: playerId
  });
}

async function leaveRoom(){
  if (!currentRoomCode || !currentSlot) return;
  const code = currentRoomCode;
  const slot = currentSlot;
  const isHost = roomData?.hostSlot === slot;
  cleanupSubscription();
  if (isHost) {
    await remove(roomRef(code));
  } else {
    await update(roomRef(code), { [playerPath(slot)]: { joined:false, name:'', faction:'', role:'', ready:false, clientId:'' } });
  }
  currentRoomCode = ''; currentSlot = ''; roomData = null;
  localStorage.removeItem(STORAGE.roomCode); localStorage.removeItem(STORAGE.slot);
  render(); setStatus('已離開房間。');
}

async function startBattle(){
  if (els.startBtn.disabled || !currentRoomCode) return;
  await update(roomRef(currentRoomCode), { phase: 'starting', startedAt: Date.now() });
  showToast('已標記開始，下一步接戰鬥頁。');
  setStatus('已進入開始狀態，後續會接戰鬥頁。');
}

els.factionLight.addEventListener('click', async ()=>{
  if (roomData?.players?.[currentSlot]?.ready) return showToast('取消準備後才能更換陣營');
  selectedFaction = 'light'; persistSelection(); updateRolePanel('my', selectedRole, selectedFaction); updateFactionUi();
  await syncMySelection(); render();
});
els.factionDark.addEventListener('click', async ()=>{
  if (roomData?.players?.[currentSlot]?.ready) return showToast('取消準備後才能更換陣營');
  selectedFaction = 'dark'; persistSelection(); updateRolePanel('my', selectedRole, selectedFaction); updateFactionUi();
  await syncMySelection(); render();
});
roleCards.forEach(card => card.addEventListener('click', async ()=>{
  if (roomData?.players?.[currentSlot]?.ready) return showToast('取消準備後才能更換角色');
  selectedRole = card.dataset.role; persistSelection(); updateRoleUi(); updateRolePanel('my', selectedRole, selectedFaction); await syncMySelection(); render();
}));

els.createBtn.addEventListener('click', createRoom);
els.joinBtn.addEventListener('click', joinRoom);
els.readyBtn.addEventListener('click', toggleReady);
els.leaveBtn.addEventListener('click', leaveRoom);
els.startBtn.addEventListener('click', startBattle);
els.copyBtn.addEventListener('click', async ()=>{
  if (!currentRoomCode) return;
  await navigator.clipboard.writeText(currentRoomCode); showToast('房號已複製');
});

function init(){
  els.playerNameText.textContent = playerName;
  updateFactionUi(); updateRoleUi(); updateRolePanel('my', selectedRole, selectedFaction); render();
  if (currentRoomCode && currentSlot) subscribeRoom(currentRoomCode);
}
init();
