'use strict';

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

const ICONS = {
  gem: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9Z"/><path d="m12 21 4-12-4-6-4 6 4 12Z"/><path d="M2 9h20"/></svg>',
  sparkles: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8L4 11l6.1 2.2L12 19l1.9-5.8L20 11l-6.1-2.2Z"/><path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/></svg>',
  bot: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  'mouse-pointer-click': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m9 9 5 12 1.8-5.2L21 14Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/></svg>',
  zap: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.8-1.6l9.7-10.8a.5.5 0 0 1 .9.4L12 9h8a1 1 0 0 1 .8 1.6l-9.7 10.8a.5.5 0 0 1-.9-.4l1.8-7Z"/></svg>',
  star: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9Z"/></svg>',
  flame: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c0-2 1-3.5 2.5-5 .9 1 1.5 2.2 1.5 3.5a3 3 0 1 1-6 0Z"/><path d="M12 2C9 5 7 7.5 7 11a5 5 0 0 0 10 0c0-3-2-5-5-9Z"/></svg>',
  'battery-charging': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M15 7h1a2 2 0 0 1 2 2v1h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2h-2"/><path d="M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3"/><path d="m11 7-3 5h4l-3 5"/></svg>',
  'calendar-days': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/></svg>',
  gift: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8A2.5 2.5 0 0 1 12 5.5 2.5 2.5 0 0 1 16.5 8"/></svg>',
  rocket: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1 1-1.5 2.5-1.5 4.5 2 0 3.5-.5 4.5-1.5"/><path d="M9 15 4 10l2-4 5 5"/><path d="M14 10 19 5l-4-2-5 5"/><path d="M14.5 4.5c2.8-.7 4.9-.3 6 .8.6 1.1 1.5 4-1.2 8.1-2.1 3.1-5.3 5.4-8.8 6.1L4.5 13.5c.7-3.5 3-6.7 6.1-8.8 1.4-.9 2.7-1.6 3.9-2.2Z"/><circle cx="15" cy="9" r="1"/></svg>',
  'users-round': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.4-2-6.3-5-7.6"/><path d="M17 3.3a5 5 0 0 1 0 9.4"/></svg>',
  copy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  'copy-check': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m12 15 2 2 4-4"/><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  trophy: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14.7V17c0 .6-.4 1-1 1H7v3h10v-3h-2c-.6 0-1-.4-1-1v-2.3"/><path d="M18 5h3v3a5 5 0 0 1-5 5"/><path d="M6 5H3v3a5 5 0 0 0 5 5"/><path d="M18 2H6v7a6 6 0 0 0 12 0Z"/></svg>',
  'refresh-cw': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  pickaxe: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5 19 9"/><path d="M3 21 14 10"/><path d="M13 5c3-2 6-2 8 0-3 1-5 3-6 6l-5-5c1-.3 2-.7 3-1Z"/></svg>',
  coins: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="8" cy="5" rx="6" ry="3"/><path d="M2 5v4c0 1.7 2.7 3 6 3s6-1.3 6-3V5"/><path d="M2 9v4c0 1.7 2.7 3 6 3 1.1 0 2.2-.2 3-.5"/><path d="M2 13v4c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4"/><ellipse cx="17" cy="14" rx="5" ry="2.5"/><path d="M12 14v4c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4"/></svg>',
  'chevron-right': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
  'badge-check': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3.9 8.4a2 2 0 0 1 1-3.4h1.2a2 2 0 0 0 1.7-1l.6-1a2 2 0 0 1 3.4 0l.6 1a2 2 0 0 0 1.7 1h1.2a2 2 0 0 1 1 3.4l-1 .7a2 2 0 0 0-.7 2.1l.4 1.2a2 2 0 0 1-2.7 2.5l-1.1-.5a2 2 0 0 0-1.8 0l-1.1.5a2 2 0 0 1-2.7-2.5l.4-1.2a2 2 0 0 0-.7-2.1Z"/><path d="m9 12 2 2 4-4"/></svg>',
  medal: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7.2 2h9.6L14 8h-4Z"/><circle cx="12" cy="15" r="6"/><path d="m12 12 1 2h2l-1.7 1.2.7 2-2-1.3-2 1.3.7-2L9 14h2Z"/></svg>',
  award: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/></svg>',
  shield: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.6a1.3 1.3 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1Z"/></svg>',
  'zap-off': '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m13 3-2 6h8l-3 4"/><path d="M11 17 9 21l1.1-7H4l3-5"/><path d="m2 2 20 20"/></svg>'
};

const upgrades = [
  { id: 'tap', icon: 'pickaxe', title: 'Tap Power', description: '+3 coin per tap', baseCost: 900, className: 'grad-tap' },
  { id: 'energy', icon: 'zap', title: 'Energy Tank', description: '+250 max energy', baseCost: 1250, className: 'grad-energy' },
  { id: 'miner', icon: 'bot', title: 'Auto Miner', description: '+1 coin/sec passive', baseCost: 1800, className: 'grad-miner' },
  { id: 'multi', icon: 'flame', title: 'Multiplier', description: '+0.15x tap bonus', baseCost: 2500, className: 'grad-multi' }
];

const tasks = [
  { id: 'join_channel', icon: 'badge-check', title: 'Join Telegram Channel', reward: 500 },
  { id: 'invite_friend', icon: 'users-round', title: 'Invite 1 friend', reward: 1200 },
  { id: 'three_day', icon: 'calendar-days', title: 'Open app 3 days streak', reward: 900 },
  { id: 'silver', icon: 'trophy', title: 'Reach Silver League', reward: 3000 }
];

const ranks = [
  { name: 'Diamond', need: 250000, icon: 'gem', className: 'diamond' },
  { name: 'Gold', need: 80000, icon: 'medal', className: 'gold' },
  { name: 'Silver', need: 20000, icon: 'award', className: 'silver' },
  { name: 'Bronze', need: 0, icon: 'shield', className: 'bronze' }
];

let user = null;
let state = null;
let upgradeLevels = null;
let leaderboard = [];
let passiveTimer = null;
let syncTimer = null;

const $ = (id) => document.getElementById(id);

function icon(name) {
  return ICONS[name] || ICONS.sparkles;
}

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    el.innerHTML = icon(name);
  });
}

function setupTelegram() {
  try {
    tg?.ready?.();
    tg?.expand?.();
    tg?.setHeaderColor?.('#070711');
    tg?.setBackgroundColor?.('#070711');
    tg?.disableVerticalSwipes?.();
  } catch (_) {}
}

function initData() {
  return tg?.initData || '';
}

function startParam() {
  return tg?.initDataUnsafe?.start_param || '';
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': initData(),
      'X-Telegram-Start-Param': startParam(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({ ok: false, error: 'Invalid server response' }));
  if (!response.ok && !data.error) data.error = 'Server error';
  return data;
}

async function boot() {
  setupTelegram();
  hydrateIcons();
  bindEvents();

  try {
    const data = await api('/api/me');
    if (!data.ok) throw new Error(data.error || 'Could not load profile');
    setUser(data.user);
    await loadLeaderboard();
    renderAll();
    startPassiveTicker();
  } catch (error) {
    toast(error.message || 'Server bilan ulanishda xatolik', 'zap-off');
  } finally {
    setTimeout(() => $('loadingScreen')?.classList.add('hide'), 350);
  }
}

function setUser(nextUser) {
  user = nextUser;
  state = nextUser.state;
  upgradeLevels = nextUser.upgrades;
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number >= 1000000000) return (number / 1000000000).toFixed(2) + 'B';
  if (number >= 1000000) return (number / 1000000).toFixed(2) + 'M';
  if (number >= 1000) return (number / 1000).toFixed(1) + 'K';
  return Math.floor(number).toLocaleString('en-US');
}

function rawNumber(value) {
  return Math.floor(Number(value || 0)).toLocaleString('en-US');
}

function tapReward() {
  return Math.max(1, Math.round(Number(state.tapPower || 1) * Number(state.multiplier || 1)));
}

function upgradeCost(item) {
  return Math.round(item.baseCost * Math.pow(1.55, Number(upgradeLevels[item.id] || 0)));
}

function haptic(type = 'light') {
  try { tg?.HapticFeedback?.impactOccurred?.(type); } catch (_) {}
}

function notify(type = 'success') {
  try { tg?.HapticFeedback?.notificationOccurred?.(type); } catch (_) {}
}

function toast(message, toastIcon = 'sparkles') {
  const el = $('toast');
  el.innerHTML = `${icon(toastIcon)}<span>${message}</span>`;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 1800);
}

function renderAll() {
  if (!state || !upgradeLevels) return;
  renderHeader();
  renderProgress();
  renderStats();
  renderUpgrades();
  renderTasks();
  renderRanks();
  renderDaily();
  renderLeaderboard();
}

function renderHeader() {
  $('balanceText').textContent = formatNumber(state.balance);
  $('leagueText').textContent = state.league;
  $('tapRewardText').textContent = '+' + tapReward();
  $('passiveText').textContent = '+' + formatNumber(state.miners);
  $('rankHeroLeague').textContent = state.league;
  $('totalMinedText').textContent = rawNumber(state.totalEarned);

  const tgUser = tg?.initDataUnsafe?.user;
  const firstName = user?.firstName || tgUser?.first_name || 'Miner';
  $('helloText').textContent = 'Hi, ' + firstName;

  const botUsername = tg?.initDataUnsafe?.receiver?.username || 'your_bot';
  const ref = state.referralCode || '000001';
  $('inviteInput').value = `https://t.me/${botUsername}?startapp=ref_${ref}`;
}

function renderProgress() {
  const energyPercent = Math.min(100, Math.max(0, (state.energy / state.maxEnergy) * 100));
  const xpPercent = Math.min(100, Math.max(0, (state.xp / state.xpToNext) * 100));

  $('energyText').textContent = `${Math.floor(state.energy)} / ${Math.floor(state.maxEnergy)}`;
  $('energyBar').style.width = energyPercent + '%';
  $('levelText').innerHTML = `${icon('star')} Level ${state.level} XP`;
  $('xpText').textContent = `${Math.floor(state.xp)} / ${Math.floor(state.xpToNext)}`;
  $('xpBar').style.width = xpPercent + '%';
  $('coinButton').classList.toggle('disabled', state.energy <= 0);
}

function renderStats() {
  $('multiStat').textContent = Number(state.multiplier).toFixed(2) + 'x';
  $('maxEnergyStat').textContent = formatNumber(state.maxEnergy);
  $('streakStat').textContent = state.streak + 'd';
}

function renderDaily() {
  const today = new Date().toISOString().slice(0, 10);
  const claimed = state.claimedDailyDate === today;
  const btn = $('dailyButton');
  btn.disabled = claimed;
  btn.innerHTML = claimed ? `${icon('badge-check')} Already Claimed Today` : `${icon('gift')} Claim Daily Reward`;
}

function renderUpgrades() {
  const list = $('upgradeList');
  list.innerHTML = '';

  upgrades.forEach((item) => {
    const cost = upgradeCost(item);
    const canBuy = state.balance >= cost;
    const button = document.createElement('button');
    button.className = 'upgrade-card' + (canBuy ? '' : ' locked');
    button.innerHTML = `
      <div class="up-icon ${item.className}">${icon(item.icon)}</div>
      <div class="item-body">
        <div class="item-top">
          <h3 class="item-title">${item.title}</h3>
          <span class="level-badge">Lv ${upgradeLevels[item.id] || 0}</span>
        </div>
        <p class="item-desc">${item.description}</p>
        <div class="item-bottom">
          <span class="price">${icon('coins')} ${formatNumber(cost)}</span>
          <span class="action-word">Upgrade ${icon('chevron-right')}</span>
        </div>
      </div>`;
    button.addEventListener('click', () => buyUpgrade(item));
    list.appendChild(button);
  });
}

function renderTasks() {
  const list = $('taskList');
  list.innerHTML = '';

  tasks.forEach((task) => {
    const done = state.completedTasks.includes(task.id);
    const card = document.createElement('button');
    card.className = 'task-card';
    card.innerHTML = `
      <div class="task-icon grad-task">${icon(task.icon)}</div>
      <div class="item-body">
        <div class="item-top">
          <h3 class="item-title">${task.title}</h3>
          <span class="status-badge ${done ? 'done' : ''}">${done ? 'Done' : 'Go'}</span>
        </div>
        <p class="item-desc">Reward: +${formatNumber(task.reward)} coins</p>
      </div>`;
    card.addEventListener('click', () => claimTask(task));
    list.appendChild(card);
  });
}

function renderRanks() {
  const list = $('rankList');
  list.innerHTML = '';

  ranks.forEach((rank) => {
    const active = state.league === rank.name;
    const card = document.createElement('div');
    card.className = 'rank-card';
    card.innerHTML = `
      <div class="rank-icon ${rank.className}">${icon(rank.icon)}</div>
      <div class="item-body">
        <div class="item-top">
          <h3 class="item-title">${rank.name}</h3>
          ${active ? '<span class="status-badge done">Active</span>' : ''}
        </div>
        <p class="item-desc">Requirement: ${formatNumber(rank.need)} total mined coins</p>
      </div>`;
    list.appendChild(card);
  });
}

function renderLeaderboard() {
  const list = $('leaderboardList');
  list.innerHTML = '';
  if (!leaderboard.length) {
    list.innerHTML = '<div class="leaderboard-row"><div class="leaderboard-rank">1</div><div class="leaderboard-name"><b>You</b><span>Start mining to appear here</span></div><div class="leaderboard-score">0</div></div>';
    return;
  }

  leaderboard.slice(0, 7).forEach((row, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-row';
    item.innerHTML = `
      <div class="leaderboard-rank">${index + 1}</div>
      <div class="leaderboard-name"><b>${escapeHTML(row.firstName || 'Miner')}</b><span>${escapeHTML(row.league)} · Lv ${Number(row.level || 1)}</span></div>
      <div class="leaderboard-score">${formatNumber(row.totalEarned)}</div>`;
    list.appendChild(item);
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

async function mine(event) {
  if (!state || state.energy <= 0) {
    notify('error');
    toast('Energy tugadi. Biroz kuting', 'zap-off');
    return;
  }

  haptic('light');
  spawnFloatingPlus(event, tapReward());
  spawnRipple(event);

  const data = await api('/api/tap', { method: 'POST', body: '{}' });
  if (!data.ok) {
    notify('error');
    toast(data.error || 'Tap error', 'zap-off');
    if (data.user) setUser(data.user);
    renderAll();
    return;
  }

  setUser(data.user);
  if (data.leveledUp) {
    notify('success');
    confetti(20);
    openLevelModal();
  }
  renderAll();
}

function relativeTapPosition(event) {
  const zone = $('mineZone');
  const rect = zone.getBoundingClientRect();
  return { zone, x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function spawnFloatingPlus(event, reward) {
  const { zone, x, y } = relativeTapPosition(event);
  const plus = document.createElement('div');
  plus.className = 'floating-plus';
  plus.textContent = '+' + reward;
  plus.style.left = x + 'px';
  plus.style.top = y + 'px';
  zone.appendChild(plus);
  setTimeout(() => plus.remove(), 900);
}

function spawnRipple(event) {
  const { zone, x, y } = relativeTapPosition(event);
  const ripple = document.createElement('div');
  ripple.className = 'tap-ripple';
  ripple.style.left = x + 'px';
  ripple.style.top = y + 'px';
  zone.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
}

async function buyUpgrade(item) {
  if (!state) return;
  const cost = upgradeCost(item);
  if (state.balance < cost) {
    notify('error');
    toast('Coin yetarli emas', 'coins');
    return;
  }

  const data = await api('/api/upgrade', { method: 'POST', body: JSON.stringify({ id: item.id }) });
  if (!data.ok) {
    notify('error');
    toast(data.error || 'Upgrade error', item.icon);
    if (data.user) setUser(data.user);
    renderAll();
    return;
  }

  setUser(data.user);
  notify('success');
  toast(`${item.title} upgrade qilindi`, item.icon);
  confetti(8);
  renderAll();
}

async function claimDaily() {
  const data = await api('/api/daily', { method: 'POST', body: '{}' });
  if (!data.ok) {
    notify('error');
    toast(data.error || 'Daily reward error', 'gift');
    if (data.user) setUser(data.user);
    renderAll();
    return;
  }
  setUser(data.user);
  notify('success');
  confetti(24);
  toast('Daily reward olindi: +2,500', 'gift');
  renderAll();
}

async function claimTask(task) {
  const data = await api('/api/task', { method: 'POST', body: JSON.stringify({ id: task.id }) });
  if (!data.ok) {
    toast(data.error || 'Task hali tayyor emas', task.icon);
    if (data.user) setUser(data.user);
    renderAll();
    return;
  }
  setUser(data.user);
  notify('success');
  confetti(16);
  toast(`Task reward: +${formatNumber(task.reward)} coins`, task.icon);
  renderAll();
  loadLeaderboard();
}

async function copyInvite() {
  const input = $('inviteInput');
  try {
    await navigator.clipboard.writeText(input.value);
    notify('success');
    toast('Invite link copied', 'copy-check');
  } catch (error) {
    input.select();
    document.execCommand('copy');
    toast('Invite link copied', 'copy-check');
  }
}

async function loadLeaderboard() {
  const data = await api('/api/leaderboard');
  if (data.ok && Array.isArray(data.leaderboard)) leaderboard = data.leaderboard;
  renderLeaderboard();
}

function switchPage(page) {
  document.querySelectorAll('.page').forEach((el) => el.classList.remove('active'));
  $('page-' + page).classList.add('active');

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  if (page === 'rank') loadLeaderboard();
  haptic('light');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openLevelModal() {
  $('levelModal').classList.add('show');
}

function closeLevelModal() {
  $('levelModal').classList.remove('show');
}

function confetti(count = 16) {
  const colors = ['#67e8f9', '#facc15', '#f472b6', '#86efac', '#c084fc', '#fb923c'];
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = Math.random() * 0.3 + 's';
    piece.style.transform = `rotate(${Math.random() * 180}deg)`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 1800);
  }
}

function startPassiveTicker() {
  clearInterval(passiveTimer);
  passiveTimer = setInterval(() => {
    if (!state) return;
    state.balance += Number(state.miners || 0);
    state.totalEarned += Number(state.miners || 0);
    state.energy = Math.min(state.maxEnergy, state.energy + 4);
    renderHeader();
    renderProgress();
  }, 1000);

  clearInterval(syncTimer);
  syncTimer = setInterval(async () => {
    const data = await api('/api/me');
    if (data.ok) {
      setUser(data.user);
      renderAll();
    }
  }, 15000);
}

function bindEvents() {
  $('coinButton').addEventListener('click', mine);
  $('dailyButton').addEventListener('click', claimDaily);
  $('copyInviteBtn').addEventListener('click', copyInvite);
  $('refreshLeaderboardBtn').addEventListener('click', loadLeaderboard);
  $('closeModalBtn').addEventListener('click', closeLevelModal);
  $('levelModal').addEventListener('click', (event) => {
    if (event.target.id === 'levelModal') closeLevelModal();
  });
  $('modalBoostBtn').addEventListener('click', () => {
    closeLevelModal();
    switchPage('boost');
  });

  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });
  document.querySelectorAll('[data-page-jump]').forEach((btn) => {
    btn.addEventListener('click', () => switchPage(btn.dataset.pageJump));
  });
}

document.addEventListener('DOMContentLoaded', boot);
