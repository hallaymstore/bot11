'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

loadEnvFile(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = String(process.env.BOT_TOKEN || '').trim();
const WEBAPP_URL = String(process.env.WEBAPP_URL || '').trim().replace(/\/$/, '');
const NODE_ENV = String(process.env.NODE_ENV || 'development');
const SET_MENU_BUTTON = String(process.env.SET_MENU_BUTTON || 'false').toLowerCase() === 'true';
const AUTO_DELETE_WEBHOOK = String(process.env.AUTO_DELETE_WEBHOOK || 'true').toLowerCase() !== 'false';
const DROP_PENDING_UPDATES = String(process.env.DROP_PENDING_UPDATES || 'true').toLowerCase() !== 'false';
const BOT_TITLE = String(process.env.BOT_TITLE || 'Crypto Clicker');
const IS_PROD = NODE_ENV === 'production';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const DEFAULT_GAME_STATE = Object.freeze({
  balance: 1250,
  totalEarned: 1250,
  energy: 730,
  maxEnergy: 1000,
  tapPower: 7,
  level: 3,
  xp: 42,
  xpToNext: 100,
  streak: 4,
  league: 'Bronze',
  miners: 1,
  multiplier: 1,
  claimedDailyDate: '',
  lastSeenDate: '',
  referralCode: '',
  referredBy: '',
  completedTasks: ['join_channel']
});

const DEFAULT_UPGRADES = Object.freeze({ tap: 2, energy: 1, miner: 1, multi: 0 });
const TAPS_WINDOW_MS = 1000;
const MAX_TAPS_PER_WINDOW = 22;
const tapWindows = new Map();
let botOffset = 0;
let botPollingActive = false;

ensureDataFiles();
const store = readUsersStore();

const upgrades = {
  tap: { id: 'tap', title: 'Tap Power', baseCost: 900 },
  energy: { id: 'energy', title: 'Energy Tank', baseCost: 1250 },
  miner: { id: 'miner', title: 'Auto Miner', baseCost: 1800 },
  multi: { id: 'multi', title: 'Multiplier', baseCost: 2500 }
};

const tasks = {
  join_channel: { id: 'join_channel', reward: 500 },
  invite_friend: { id: 'invite_friend', reward: 1200 },
  three_day: { id: 'three_day', reward: 900 },
  silver: { id: 'silver', reward: 3000 }
};

const server = http.createServer(async (req, res) => {
  try {
    setCommonHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') return sendNoContent(res);
    if (url.pathname === '/health') return sendJSON(res, 200, { ok: true, service: BOT_TITLE, time: new Date().toISOString() });
    if (url.pathname === '/api/status') return sendJSON(res, 200, publicStatus());

    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, res, url);
    }

    return serveStatic(req, res, url);
  } catch (error) {
    console.error('[server:error]', error);
    return sendJSON(res, 500, { ok: false, error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 ${BOT_TITLE} server running on http://localhost:${PORT}`);
  console.log(`🌐 Mini App URL: ${WEBAPP_URL || '(set WEBAPP_URL in .env)'}`);

  if (!BOT_TOKEN || BOT_TOKEN.includes('EXAMPLE')) {
    console.warn('⚠️  BOT_TOKEN is not configured. Web server will run, Telegram bot polling is disabled.');
    return;
  }

  if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://')) {
    console.warn('⚠️  WEBAPP_URL must be HTTPS for Telegram Mini Apps in production.');
  }

  startBot().catch((error) => console.error('[bot:start:error]', error));
});

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown() {
  console.log('\nSaving game data...');
  writeUsersStore();
  process.exit(0);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({ users: {} }, null, 2));
}

function readUsersStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!parsed.users || typeof parsed.users !== 'object') return { users: {} };
    return parsed;
  } catch (error) {
    console.warn('Could not read data/users.json. Creating a new store.');
    return { users: {} };
  }
}

function writeUsersStore() {
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}

let saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(writeUsersStore, 150);
}

function setCommonHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendNoContent(res) {
  res.statusCode = 204;
  return res.end();
}

function sendJSON(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify(payload));
}

function sendText(res, status, text) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.end(text);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  const user = getUserFromRequest(req, url);
  if (!user.ok) return sendJSON(res, 401, { ok: false, error: user.error });

  if (req.method === 'GET' && url.pathname === '/api/me') {
    const profile = ensureUser(user.telegramUser, user.ref);
    applyPassiveIncome(profile);
    return sendJSON(res, 200, { ok: true, user: publicUser(profile), status: publicStatus() });
  }

  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    return sendJSON(res, 200, { ok: true, leaderboard: getLeaderboard() });
  }

  if (req.method !== 'POST') {
    return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const body = await parseBody(req);
  const profile = ensureUser(user.telegramUser, user.ref);
  applyPassiveIncome(profile);

  if (url.pathname === '/api/tap') {
    return sendJSON(res, 200, tap(profile));
  }

  if (url.pathname === '/api/upgrade') {
    return sendJSON(res, 200, buyUpgrade(profile, String(body.id || '')));
  }

  if (url.pathname === '/api/daily') {
    return sendJSON(res, 200, claimDaily(profile));
  }

  if (url.pathname === '/api/task') {
    return sendJSON(res, 200, claimTask(profile, String(body.id || '')));
  }

  return sendJSON(res, 404, { ok: false, error: 'API route not found' });
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const normalized = path.normalize(pathname).replace(/^([.][.][\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      return streamFile(res, fallback, req.method);
    }
    return streamFile(res, filePath, req.method);
  });
}

function streamFile(res, filePath, method) {
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  if (ext === '.html') res.setHeader('Cache-Control', 'no-store');
  else res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  if (method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function getUserFromRequest(req, url) {
  const initData = String(req.headers['x-telegram-init-data'] || '');
  const startParam = String(req.headers['x-telegram-start-param'] || url.searchParams.get('tgWebAppStartParam') || '');
  const ref = startParam.startsWith('ref_') ? startParam.slice(4) : '';

  if (BOT_TOKEN && !BOT_TOKEN.includes('EXAMPLE') && initData) {
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    if (!verified.ok) return { ok: false, error: verified.error };
    return { ok: true, telegramUser: verified.user, ref };
  }

  if (!IS_PROD) {
    return {
      ok: true,
      telegramUser: {
        id: 'dev-user',
        first_name: 'Developer',
        last_name: '',
        username: 'dev',
        language_code: 'uz'
      },
      ref
    };
  }

  return { ok: false, error: 'Telegram initData is required' };
}

function verifyTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, error: 'Missing hash' };

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const a = Buffer.from(calculatedHash, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, error: 'Invalid Telegram initData hash' };

    const authDate = Number(params.get('auth_date') || 0);
    if (authDate && Date.now() / 1000 - authDate > 86400 * 7) return { ok: false, error: 'Telegram initData expired' };

    const rawUser = params.get('user');
    if (!rawUser) return { ok: false, error: 'Missing Telegram user' };
    return { ok: true, user: JSON.parse(rawUser) };
  } catch (error) {
    return { ok: false, error: 'Could not verify Telegram initData' };
  }
}

function ensureUser(telegramUser, ref = '') {
  const id = String(telegramUser.id);
  if (!store.users[id]) {
    store.users[id] = {
      telegramId: id,
      firstName: telegramUser.first_name || 'Miner',
      lastName: telegramUser.last_name || '',
      username: telegramUser.username || '',
      languageCode: telegramUser.language_code || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      state: { ...DEFAULT_GAME_STATE, referralCode: id.slice(-6).padStart(6, '0') },
      upgrades: { ...DEFAULT_UPGRADES },
      meta: { lastPassiveAt: Date.now(), referrals: [] }
    };

    if (ref && ref !== store.users[id].state.referralCode) {
      const inviter = findUserByReferralCode(ref);
      if (inviter && inviter.telegramId !== id) {
        store.users[id].state.referredBy = ref;
        inviter.meta.referrals = Array.isArray(inviter.meta.referrals) ? inviter.meta.referrals : [];
        inviter.meta.referrals.push(id);
        inviter.state.balance += 10000;
        inviter.state.totalEarned += 10000;
        updateLeague(inviter.state);
      }
    }

    scheduleSave();
  } else {
    const profile = store.users[id];
    profile.firstName = telegramUser.first_name || profile.firstName || 'Miner';
    profile.lastName = telegramUser.last_name || profile.lastName || '';
    profile.username = telegramUser.username || profile.username || '';
    profile.languageCode = telegramUser.language_code || profile.languageCode || '';
    profile.updatedAt = new Date().toISOString();
    profile.state = { ...DEFAULT_GAME_STATE, ...profile.state };
    profile.upgrades = { ...DEFAULT_UPGRADES, ...profile.upgrades };
    profile.meta = { lastPassiveAt: Date.now(), referrals: [], ...profile.meta };
  }

  return store.users[id];
}

function findUserByReferralCode(code) {
  return Object.values(store.users).find((user) => user.state && user.state.referralCode === code);
}

function publicUser(profile) {
  updateLeague(profile.state);
  return {
    telegramId: profile.telegramId,
    firstName: profile.firstName,
    username: profile.username,
    state: profile.state,
    upgrades: profile.upgrades,
    referrals: Array.isArray(profile.meta.referrals) ? profile.meta.referrals.length : 0
  };
}

function publicStatus() {
  return {
    ok: true,
    botConfigured: Boolean(BOT_TOKEN && !BOT_TOKEN.includes('EXAMPLE')),
    webappConfigured: Boolean(WEBAPP_URL),
    webappUrl: WEBAPP_URL,
    environment: NODE_ENV
  };
}

function applyPassiveIncome(profile) {
  const now = Date.now();
  const last = Number(profile.meta.lastPassiveAt || now);
  const seconds = Math.min(3600, Math.max(0, Math.floor((now - last) / 1000)));
  if (seconds <= 0) return;

  const passive = Math.max(0, Number(profile.state.miners || 0) * seconds);
  const energy = Math.max(0, 4 * seconds);
  profile.state.balance += passive;
  profile.state.totalEarned += passive;
  profile.state.energy = Math.min(profile.state.maxEnergy, profile.state.energy + energy);
  profile.meta.lastPassiveAt = now;
  updateLeague(profile.state);
  scheduleSave();
}

function tap(profile) {
  const id = profile.telegramId;
  const now = Date.now();
  const windowState = tapWindows.get(id) || { start: now, count: 0 };
  if (now - windowState.start > TAPS_WINDOW_MS) {
    windowState.start = now;
    windowState.count = 0;
  }
  windowState.count += 1;
  tapWindows.set(id, windowState);

  if (windowState.count > MAX_TAPS_PER_WINDOW) {
    return { ok: false, error: 'Too many taps. Slow down.', user: publicUser(profile) };
  }

  if (profile.state.energy <= 0) {
    return { ok: false, error: 'Energy is empty', user: publicUser(profile) };
  }

  const reward = tapReward(profile.state);
  profile.state.balance += reward;
  profile.state.totalEarned += reward;
  profile.state.energy = Math.max(0, profile.state.energy - 1);
  profile.state.xp += 1;
  const leveledUp = checkLevelUp(profile.state);
  updateLeague(profile.state);
  profile.updatedAt = new Date().toISOString();
  scheduleSave();

  return { ok: true, reward, leveledUp, user: publicUser(profile) };
}

function tapReward(state) {
  return Math.max(1, Math.round(Number(state.tapPower || 1) * Number(state.multiplier || 1)));
}

function checkLevelUp(state) {
  let leveled = false;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext = Math.round(state.xpToNext * 1.16);
    state.maxEnergy += 80;
    state.energy = Math.min(state.maxEnergy, state.energy + 120);
    leveled = true;
  }
  return leveled;
}

function updateLeague(state) {
  if (state.totalEarned >= 250000) state.league = 'Diamond';
  else if (state.totalEarned >= 80000) state.league = 'Gold';
  else if (state.totalEarned >= 20000) state.league = 'Silver';
  else state.league = 'Bronze';
}

function buyUpgrade(profile, id) {
  const item = upgrades[id];
  if (!item) return { ok: false, error: 'Unknown upgrade', user: publicUser(profile) };

  const cost = upgradeCost(item, profile.upgrades[id] || 0);
  if (profile.state.balance < cost) return { ok: false, error: 'Not enough coins', user: publicUser(profile) };

  profile.state.balance -= cost;
  profile.upgrades[id] = (profile.upgrades[id] || 0) + 1;

  if (id === 'tap') profile.state.tapPower += 3;
  if (id === 'energy') {
    profile.state.maxEnergy += 250;
    profile.state.energy = Math.min(profile.state.maxEnergy, profile.state.energy + 250);
  }
  if (id === 'miner') profile.state.miners += 1;
  if (id === 'multi') profile.state.multiplier = Number((profile.state.multiplier + 0.15).toFixed(2));

  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, upgrade: id, cost, user: publicUser(profile) };
}

function upgradeCost(item, level) {
  return Math.round(item.baseCost * Math.pow(1.55, Number(level || 0)));
}

function claimDaily(profile) {
  const today = new Date().toISOString().slice(0, 10);
  if (profile.state.claimedDailyDate === today) return { ok: false, error: 'Already claimed today', user: publicUser(profile) };

  profile.state.balance += 2500;
  profile.state.totalEarned += 2500;
  profile.state.energy = Math.min(profile.state.maxEnergy, profile.state.energy + 180);
  profile.state.streak += 1;
  profile.state.claimedDailyDate = today;
  updateLeague(profile.state);
  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, reward: 2500, user: publicUser(profile) };
}

function claimTask(profile, id) {
  const task = tasks[id];
  if (!task) return { ok: false, error: 'Unknown task', user: publicUser(profile) };
  if (profile.state.completedTasks.includes(id)) return { ok: false, error: 'Task already completed', user: publicUser(profile) };
  if (id === 'three_day' && profile.state.streak < 3) return { ok: false, error: 'Need 3 day streak', user: publicUser(profile) };
  if (id === 'silver' && profile.state.totalEarned < 20000) return { ok: false, error: 'Need Silver league', user: publicUser(profile) };

  profile.state.completedTasks.push(id);
  profile.state.balance += task.reward;
  profile.state.totalEarned += task.reward;
  updateLeague(profile.state);
  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, reward: task.reward, user: publicUser(profile) };
}

function getLeaderboard() {
  return Object.values(store.users)
    .map((profile) => {
      updateLeague(profile.state);
      return {
        firstName: profile.firstName || 'Miner',
        username: profile.username || '',
        league: profile.state.league,
        totalEarned: Math.floor(profile.state.totalEarned || 0),
        level: Math.floor(profile.state.level || 1)
      };
    })
    .sort((a, b) => b.totalEarned - a.totalEarned)
    .slice(0, 25);
}

async function startBot() {
  if (botPollingActive) return;
  botPollingActive = true;

  const me = await telegramApi('getMe', {});
  if (!me.ok) throw new Error(me.description || 'Could not connect to Telegram Bot API');
  console.log(`🤖 Bot connected: @${me.result.username}`);

  if (AUTO_DELETE_WEBHOOK) {
    await resetWebhookForPolling();
  }

  if (SET_MENU_BUTTON && WEBAPP_URL && WEBAPP_URL.startsWith('https://')) {
    await telegramApi('setChatMenuButton', {
      menu_button: { type: 'web_app', text: '🚀 Open App', web_app: { url: WEBAPP_URL } }
    }).catch((error) => console.warn('[bot:menu]', error.message));
  } else if (SET_MENU_BUTTON && WEBAPP_URL && !WEBAPP_URL.startsWith('https://')) {
    console.warn('⚠️  Menu button was not set: WEBAPP_URL must start with https://');
  }

  pollBotLoop().catch((error) => console.error('[bot:poll:error]', error));
}

async function resetWebhookForPolling() {
  try {
    const info = await telegramApi('getWebhookInfo', {});
    const activeUrl = info?.result?.url || '';

    if (activeUrl) {
      console.log(`🧹 Active webhook found: ${activeUrl}`);
    }

    const deleted = await telegramApi('deleteWebhook', { drop_pending_updates: DROP_PENDING_UPDATES });
    if (!deleted.ok) {
      console.warn('[bot:deleteWebhook]', deleted.description || deleted);
      return;
    }

    if (activeUrl) {
      console.log(`✅ Webhook deleted. Polling mode is ready. drop_pending_updates=${DROP_PENDING_UPDATES}`);
    } else {
      console.log('✅ Webhook check OK. Polling mode is ready.');
    }
  } catch (error) {
    console.warn('[bot:deleteWebhook:catch]', error.message);
  }
}

async function pollBotLoop() {
  while (botPollingActive) {
    try {
      const response = await telegramApi('getUpdates', {
        offset: botOffset,
        timeout: 25,
        allowed_updates: ['message', 'callback_query']
      });

      if (!response.ok) {
        const description = response.description || '';
        console.warn('[bot:getUpdates]', description || response);

        if (/webhook/i.test(description) && AUTO_DELETE_WEBHOOK) {
          await resetWebhookForPolling();
        }

        await sleep(1500);
        continue;
      }

      for (const update of response.result || []) {
        botOffset = update.update_id + 1;
        await handleBotUpdate(update).catch((error) => console.error('[bot:update:error]', error));
      }
    } catch (error) {
      console.error('[bot:poll:catch]', error.message);
      await sleep(1800);
    }
  }
}

async function handleBotUpdate(update) {
  const message = update.message;
  if (!message) return;

  if (message.web_app_data) {
    return sendBotMessage(message.chat.id, '✅ Mini App maʼlumoti qabul qilindi. O‘yinni davom ettiring!', openAppKeyboard());
  }

  const text = String(message.text || '');
  if (text.startsWith('/start')) {
    const name = message.from?.first_name || 'Miner';
    const caption = [
      `Salom, ${name}! 💎`,
      '',
      `🚀 ${BOT_TITLE} — tap-to-earn Mini App.`,
      'Coin yig‘ing, upgrade qiling, daily reward oling va leaderboard’da ko‘tariling.',
      '',
      'Pastdagi tugma orqali o‘yinni oching.'
    ].join('\n');
    return sendBotMessage(message.chat.id, caption, openAppKeyboard());
  }

  if (text.startsWith('/help')) {
    return sendBotMessage(
      message.chat.id,
      'Buyruqlar:\n/start — Mini App ochish\n/help — yordam\n\nMini App faqat HTTPS domen orqali Telegram ichida ochiladi.',
      openAppKeyboard()
    );
  }

  return sendBotMessage(message.chat.id, 'O‘yinni ochish uchun pastdagi tugmani bosing 👇', openAppKeyboard());
}

function openAppKeyboard() {
  const url = WEBAPP_URL || 'http://localhost:3000';
  return {
    reply_markup: {
      inline_keyboard: [[{ text: '🚀 Open Crypto Clicker', web_app: { url } }]]
    }
  };
}

async function sendBotMessage(chatId, text, extra = {}) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra
  });
}

async function telegramApi(method, payload) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
