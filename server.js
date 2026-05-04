'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_FILE = path.join(DATA_DIR, 'users.json');

loadEnvFile(path.join(ROOT, '.env'));

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = String(process.env.BOT_TOKEN || '').trim();
const WEBAPP_URL = String(process.env.WEBAPP_URL || '').trim().replace(/\/$/, '');
const NODE_ENV = String(process.env.NODE_ENV || 'development');
const SET_MENU_BUTTON = boolEnv('SET_MENU_BUTTON', false);
const AUTO_DELETE_WEBHOOK = boolEnv('AUTO_DELETE_WEBHOOK', true);
const DROP_PENDING_UPDATES = boolEnv('DROP_PENDING_UPDATES', true);
const BOT_TITLE = String(process.env.BOT_TITLE || 'Crypto Clicker Pro');
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'admin12345');
const ADMIN_IDS = String(process.env.ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
const DEV_MODE = boolEnv('DEV_MODE', NODE_ENV !== 'production');
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
  balance: 250,
  totalEarned: 250,
  totalSpent: 0,
  energy: 420,
  maxEnergy: 500,
  tapPower: 2,
  level: 1,
  xp: 0,
  xpToNext: 80,
  streak: 0,
  league: 'Bronze',
  miners: 0,
  multiplier: 1,
  recharge: 4,
  criticalChance: 0,
  claimedDailyDate: '',
  lastSeenDate: '',
  referralCode: '',
  referredBy: '',
  referralEarned: 0,
  completedTasks: [],
  visitedTasks: {},
  inventory: [],
  activeBoosts: {},
  stats: { taps: 0, tasks: 0, upgrades: 0, referrals: 0, transfersSent: 0, transfersReceived: 0 }
});

const DEFAULT_UPGRADES = Object.freeze({ tap: 0, energy: 0, miner: 0, multi: 0, recharge: 0, critical: 0 });
const TAPS_WINDOW_MS = 1000;
const MAX_TAPS_PER_WINDOW = 14;
const tapWindows = new Map();
let botOffset = 0;
let botPollingActive = false;
let botUsername = '';

ensureDataFiles();
const store = readStore();
normalizeStore(store);
writeStore();

const upgrades = {
  tap: { id: 'tap', title: 'Tap Power', baseCost: 900, growth: 1.72, description: '+2 coin per tap' },
  energy: { id: 'energy', title: 'Energy Tank', baseCost: 1400, growth: 1.68, description: '+180 max energy' },
  miner: { id: 'miner', title: 'Auto Miner', baseCost: 2600, growth: 1.82, description: '+1 coin/sec passive' },
  multi: { id: 'multi', title: 'Multiplier', baseCost: 4200, growth: 1.9, description: '+0.10x tap bonus' },
  recharge: { id: 'recharge', title: 'Fast Recharge', baseCost: 3200, growth: 1.75, description: '+1 energy/sec recovery' },
  critical: { id: 'critical', title: 'Critical Tap', baseCost: 5200, growth: 1.85, description: '+2% chance x3 tap' }
};

const server = http.createServer(async (req, res) => {
  try {
    setCommonHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') return sendNoContent(res);
    if (url.pathname === '/health') return sendJSON(res, 200, { ok: true, service: BOT_TITLE, time: new Date().toISOString() });
    if (url.pathname === '/api/status') return sendJSON(res, 200, publicStatus());
    if (url.pathname.startsWith('/api/admin/')) return handleAdminApi(req, res, url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);

    return serveStatic(req, res, url);
  } catch (error) {
    console.error('[server:error]', error);
    return sendJSON(res, 500, { ok: false, error: 'Internal server error' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 ${BOT_TITLE} server running on http://localhost:${PORT}`);
  console.log(`🌐 Mini App URL: ${WEBAPP_URL || '(set WEBAPP_URL in .env)'}`);
  console.log(`🛡️  Admin panel: http://localhost:${PORT}/admin.html`);

  if (!BOT_TOKEN || BOT_TOKEN.includes('EXAMPLE')) {
    console.warn('⚠️  BOT_TOKEN is not configured. Web server will run, Telegram bot polling is disabled.');
    return;
  }
  if (!WEBAPP_URL || !WEBAPP_URL.startsWith('https://')) {
    console.warn('⚠️  WEBAPP_URL must be HTTPS for Telegram Mini Apps in production. Use ngrok/cloudflared for local Telegram test.');
  }
  startBot().catch((error) => console.error('[bot:start:error]', error));
});

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

function gracefulShutdown() {
  console.log('\nSaving game data...');
  writeStore();
  process.exit(0);
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return String(raw).toLowerCase() !== 'false' && String(raw) !== '0';
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ users: {} }, null, 2));
}

function readStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return { users: {} };
    if (!parsed.users || typeof parsed.users !== 'object') parsed.users = {};
    return parsed;
  } catch (error) {
    console.warn('Could not read data/users.json. Creating a new store.');
    return { users: {} };
  }
}

function normalizeStore(target) {
  target.users = target.users && typeof target.users === 'object' ? target.users : {};
  target.stats = {
    totalStartPresses: 0,
    totalBotMessages: 0,
    totalClicks: 0,
    totalCoinsMined: 0,
    totalDailyClaims: 0,
    totalTaskClaims: 0,
    totalTransfers: 0,
    totalShopPurchases: 0,
    totalExchangeRequests: 0,
    totalWithdrawRequests: 0,
    totalSellOffers: 0,
    totalUsersCreated: 0,
    adminSaves: 0,
    ...(target.stats || {})
  };
  target.tasks = Array.isArray(target.tasks) && target.tasks.length ? target.tasks : defaultTasks();
  target.shopItems = Array.isArray(target.shopItems) && target.shopItems.length ? target.shopItems : defaultShopItems();
  target.exchangeItems = Array.isArray(target.exchangeItems) && target.exchangeItems.length ? target.exchangeItems : defaultExchangeItems();
  target.withdrawals = Array.isArray(target.withdrawals) ? target.withdrawals : [];
  target.transfers = Array.isArray(target.transfers) ? target.transfers : [];
  target.purchases = Array.isArray(target.purchases) ? target.purchases : [];
  target.exchangeRequests = Array.isArray(target.exchangeRequests) ? target.exchangeRequests : [];
  target.sellOffers = Array.isArray(target.sellOffers) ? target.sellOffers : [];
  target.settings = {
    referralJoinBonus: 5000,
    referralActiveBonus: 10000,
    referralActiveNeed: 1500,
    transferFeePercent: 5,
    dailyBaseReward: 350,
    dailyStreakBonus: 70,
    ...(target.settings || {})
  };
  for (const profile of Object.values(target.users)) normalizeProfile(profile);
}

function normalizeProfile(profile) {
  profile.telegramId = String(profile.telegramId || profile.id || '');
  profile.firstName = profile.firstName || 'Miner';
  profile.lastName = profile.lastName || '';
  profile.username = profile.username || '';
  profile.languageCode = profile.languageCode || '';
  profile.createdAt = profile.createdAt || new Date().toISOString();
  profile.updatedAt = profile.updatedAt || new Date().toISOString();
  profile.state = deepMerge(DEFAULT_GAME_STATE, profile.state || {});
  profile.upgrades = { ...DEFAULT_UPGRADES, ...(profile.upgrades || {}) };
  profile.meta = {
    lastPassiveAt: Date.now(),
    referrals: [],
    referralBonuses: {},
    startPresses: 0,
    ...(profile.meta || {})
  };
  if (!profile.state.referralCode) profile.state.referralCode = profile.telegramId.slice(-6).padStart(6, '0');
  if (!Array.isArray(profile.state.completedTasks)) profile.state.completedTasks = [];
  if (!Array.isArray(profile.state.inventory)) profile.state.inventory = [];
  if (!profile.state.visitedTasks || typeof profile.state.visitedTasks !== 'object') profile.state.visitedTasks = {};
  if (!profile.state.stats || typeof profile.state.stats !== 'object') profile.state.stats = { taps: 0, tasks: 0, upgrades: 0, referrals: 0, transfersSent: 0, transfersReceived: 0 };
}

function deepMerge(base, value) {
  const output = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, val] of Object.entries(value || {})) {
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) output[key] = deepMerge(base[key], val);
    else output[key] = val;
  }
  return output;
}

function defaultTasks() {
  return [
    { id: 'join_main_channel', title: 'Telegram kanalga obuna bo‘ling', description: 'Asosiy kanalga qo‘shiling va bonus oling.', reward: 600, type: 'subscribe', link: 'https://t.me/telegram', chatId: '', advertiser: 'Demo Advertiser', active: true, sort: 10 },
    { id: 'join_game_group', title: 'Gaming guruhga qo‘shiling', description: 'Guruhga qo‘shiling, claim bosing.', reward: 800, type: 'subscribe', link: 'https://t.me/telegram', chatId: '', advertiser: 'Demo Advertiser', active: true, sort: 20 },
    { id: 'invite_friend', title: '1 ta do‘st taklif qiling', description: 'Referral orqali kamida 1 do‘st kirsa claim qilinadi.', reward: 1200, type: 'referral', link: '', chatId: '', advertiser: 'System', active: true, sort: 30 },
    { id: 'three_day', title: '3 kunlik streak qiling', description: '3 kun daily reward olganingizdan keyin ochiladi.', reward: 900, type: 'streak', link: '', chatId: '', advertiser: 'System', active: true, sort: 40 },
    { id: 'silver', title: 'Silver League ga chiqing', description: '20K total earned yig‘ing.', reward: 3000, type: 'league', link: '', chatId: '', advertiser: 'System', active: true, sort: 50 },
    { id: 'tap_1000', title: '1000 marta click qiling', description: 'Jami 1000 tap qilganingizdan keyin reward.', reward: 2500, type: 'tap', target: 1000, link: '', chatId: '', advertiser: 'System', active: true, sort: 60 }
  ];
}

function defaultShopItems() {
  return [
    { id: 'energy_pack', title: 'Energy Pack', description: '+450 energy instant', cost: 700, type: 'energy', value: 450, active: true, icon: 'battery' },
    { id: 'miner_crate', title: 'Miner Crate', description: '+1 auto miner', cost: 4800, type: 'miner', value: 1, active: true, icon: 'bot' },
    { id: 'tap_booster', title: 'Tap Booster', description: '+3 tap power', cost: 3500, type: 'tap_power', value: 3, active: true, icon: 'pickaxe' },
    { id: 'multiplier_chip', title: 'Multiplier Chip', description: '+0.12x multiplier', cost: 6500, type: 'multiplier', value: 0.12, active: true, icon: 'flame' },
    { id: 'neon_skin', title: 'Neon Coin Skin', description: 'Cosmetic inventory item', cost: 2500, type: 'skin', value: 'neon_coin', active: true, icon: 'gem' }
  ];
}

function defaultExchangeItems() {
  return [
    { id: 'pubg_60_uc', game: 'PUBG Mobile', title: '60 UC', cost: 30000, status: 'soon', active: true, note: 'Tez orada avtomatik berish qo‘shiladi.' },
    { id: 'pubg_325_uc', game: 'PUBG Mobile', title: '325 UC', cost: 145000, status: 'soon', active: true, note: 'Tez orada.' },
    { id: 'ff_100_diamond', game: 'Free Fire', title: '100 Diamond', cost: 45000, status: 'soon', active: true, note: 'Tez orada.' },
    { id: 'ff_310_diamond', game: 'Free Fire', title: '310 Diamond', cost: 125000, status: 'soon', active: true, note: 'Tez orada.' },
    { id: 'roblox_80_robux', game: 'Roblox', title: '80 Robux', cost: 55000, status: 'soon', active: true, note: 'Tez orada.' }
  ];
}

function writeStore() {
  const tmp = STORE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

let saveTimeout = null;
function scheduleSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(writeStore, 150);
}

function setCommonHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}
function sendNoContent(res) { res.statusCode = 204; return res.end(); }
function sendJSON(res, status, payload) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); return res.end(JSON.stringify(payload)); }
function sendText(res, status, text) { res.statusCode = status; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); return res.end(text); }

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, url) {
  const auth = getUserFromRequest(req, url);
  if (!auth.ok) return sendJSON(res, 401, { ok: false, error: auth.error });

  const profile = ensureUser(auth.telegramUser, auth.ref);
  applyPassiveIncome(profile);
  checkReferralMilestones(profile);

  if (req.method === 'GET' && url.pathname === '/api/me') {
    return sendJSON(res, 200, publicPayload(profile));
  }
  if (req.method === 'GET' && url.pathname === '/api/leaderboard') {
    return sendJSON(res, 200, { ok: true, leaderboard: getLeaderboard(50), myRank: getMyRank(profile.telegramId) });
  }
  if (req.method === 'GET' && url.pathname === '/api/stats') {
    return sendJSON(res, 200, { ok: true, stats: publicStats() });
  }
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });

  const body = await parseBody(req);
  let result;
  if (url.pathname === '/api/tap') result = tap(profile);
  else if (url.pathname === '/api/upgrade') result = buyUpgrade(profile, String(body.id || ''));
  else if (url.pathname === '/api/daily') result = claimDaily(profile);
  else if (url.pathname === '/api/task/visit') result = visitTask(profile, String(body.id || ''));
  else if (url.pathname === '/api/task') result = await claimTask(profile, String(body.id || ''));
  else if (url.pathname === '/api/shop/buy') result = buyShopItem(profile, String(body.id || ''));
  else if (url.pathname === '/api/transfer') result = transferCoins(profile, body);
  else if (url.pathname === '/api/withdraw') result = createWithdrawRequest(profile, body);
  else if (url.pathname === '/api/exchange') result = createExchangeRequest(profile, body);
  else if (url.pathname === '/api/sell') result = createSellOffer(profile, body);
  else return sendJSON(res, 404, { ok: false, error: 'API route not found' });

  return sendJSON(res, result.ok ? 200 : 400, result);
}

function publicPayload(profile) {
  return {
    ok: true,
    user: publicUser(profile),
    stats: publicStats(),
    tasks: publicTasks(profile),
    shopItems: store.shopItems.filter(x => x.active !== false),
    exchangeItems: store.exchangeItems.filter(x => x.active !== false),
    leaderboard: getLeaderboard(20),
    myRank: getMyRank(profile.telegramId),
    status: publicStatus()
  };
}

function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const normalized = path.normalize(pathname).replace(/^([.][.][\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, 'Forbidden');
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return streamFile(res, path.join(PUBLIC_DIR, 'index.html'), req.method);
    return streamFile(res, filePath, req.method);
  });
}

function streamFile(res, filePath, method) {
  const ext = path.extname(filePath).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  if (ext === '.html') res.setHeader('Cache-Control', 'no-store');
  else res.setHeader('Cache-Control', 'public, max-age=3600');
  if (method === 'HEAD') return res.end();
  fs.createReadStream(filePath).pipe(res);
}

function getUserFromRequest(req, url) {
  const initData = String(req.headers['x-telegram-init-data'] || url.searchParams.get('tgWebAppData') || '');
  const startParam = String(req.headers['x-telegram-start-param'] || url.searchParams.get('tgWebAppStartParam') || '');
  const ref = startParam.startsWith('ref_') ? startParam.slice(4) : '';

  if (BOT_TOKEN && !BOT_TOKEN.includes('EXAMPLE') && initData) {
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    if (!verified.ok) return { ok: false, error: verified.error };
    return { ok: true, telegramUser: verified.user, ref };
  }

  if (DEV_MODE && !IS_PROD) {
    return { ok: true, telegramUser: { id: 'dev-user', first_name: 'Developer', last_name: '', username: 'dev', language_code: 'uz' }, ref };
  }
  return { ok: false, error: 'Telegram initData is required. Open the app from Telegram or set DEV_MODE=true with NODE_ENV=development.' };
}

function verifyTelegramInitData(initData, botToken) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { ok: false, error: 'Missing hash' };
    params.delete('hash');
    const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
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
  } catch {
    return { ok: false, error: 'Could not verify Telegram initData' };
  }
}

function ensureUser(telegramUser, ref = '') {
  const id = String(telegramUser.id);
  let created = false;
  if (!store.users[id]) {
    created = true;
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
      meta: { lastPassiveAt: Date.now(), referrals: [], referralBonuses: {}, startPresses: 0 }
    };
    store.stats.totalUsersCreated += 1;
  }
  const profile = store.users[id];
  normalizeProfile(profile);
  profile.firstName = telegramUser.first_name || profile.firstName || 'Miner';
  profile.lastName = telegramUser.last_name || profile.lastName || '';
  profile.username = telegramUser.username || profile.username || '';
  profile.languageCode = telegramUser.language_code || profile.languageCode || '';
  profile.updatedAt = new Date().toISOString();

  if (created && ref && ref !== profile.state.referralCode) {
    const inviter = findUserByReferralCode(ref);
    if (inviter && inviter.telegramId !== id) {
      profile.state.referredBy = ref;
      inviter.meta.referrals = Array.isArray(inviter.meta.referrals) ? inviter.meta.referrals : [];
      if (!inviter.meta.referrals.includes(id)) inviter.meta.referrals.push(id);
      const bonus = Number(store.settings.referralJoinBonus || 5000);
      inviter.state.balance += bonus;
      inviter.state.totalEarned += bonus;
      inviter.state.referralEarned += bonus;
      inviter.state.stats.referrals += 1;
      updateLeague(inviter.state);
    }
  }
  scheduleSave();
  return profile;
}

function findUserByReferralCode(code) {
  return Object.values(store.users).find(user => user.state && user.state.referralCode === code);
}

function findUserByCodeOrId(value) {
  const raw = String(value || '').trim().replace(/^ref_/, '');
  if (!raw) return null;
  if (store.users[raw]) return store.users[raw];
  return findUserByReferralCode(raw) || Object.values(store.users).find(user => user.username && user.username.toLowerCase() === raw.replace('@', '').toLowerCase());
}

function publicUser(profile) {
  updateLeague(profile.state);
  return {
    telegramId: profile.telegramId,
    firstName: profile.firstName,
    username: profile.username,
    createdAt: profile.createdAt,
    state: profile.state,
    upgrades: profile.upgrades,
    referrals: Array.isArray(profile.meta.referrals) ? profile.meta.referrals.length : 0,
    referralActive: activeReferralCount(profile),
    referralLinkCode: profile.state.referralCode
  };
}

function publicStatus() {
  return { ok: true, botConfigured: Boolean(BOT_TOKEN && !BOT_TOKEN.includes('EXAMPLE')), webappConfigured: Boolean(WEBAPP_URL), webappUrl: WEBAPP_URL, environment: NODE_ENV, botUsername };
}

function publicStats() {
  const users = Object.values(store.users);
  const totalBalance = users.reduce((sum, profile) => sum + Number(profile.state?.balance || 0), 0);
  const totalEarned = users.reduce((sum, profile) => sum + Number(profile.state?.totalEarned || 0), 0);
  const totalEnergy = users.reduce((sum, profile) => sum + Number(profile.state?.energy || 0), 0);
  const activeToday = users.filter(profile => profile.state?.lastSeenDate === todayKey()).length;
  return {
    ...store.stats,
    totalUsers: users.length,
    activeToday,
    totalBalance: Math.floor(totalBalance),
    totalEarned: Math.floor(totalEarned),
    totalEnergy: Math.floor(totalEnergy),
    taskCount: store.tasks.filter(x => x.active !== false).length,
    shopItemCount: store.shopItems.filter(x => x.active !== false).length,
    exchangeItemCount: store.exchangeItems.filter(x => x.active !== false).length,
    withdrawalsStored: store.withdrawals.length,
    exchangeRequestsStored: store.exchangeRequests.length,
    sellOffersStored: store.sellOffers.length,
    transferFeePercent: Number(store.settings.transferFeePercent || 5)
  };
}

function publicTasks(profile) {
  return store.tasks
    .filter(task => task.active !== false)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
    .map(task => ({
      ...task,
      completed: profile.state.completedTasks.includes(task.id),
      visitedAt: profile.state.visitedTasks[task.id] || 0,
      progress: taskProgress(profile, task)
    }));
}

function applyPassiveIncome(profile) {
  const now = Date.now();
  const last = Number(profile.meta.lastPassiveAt || now);
  const seconds = Math.min(10800, Math.max(0, Math.floor((now - last) / 1000)));
  if (seconds <= 0) return;
  const passive = Math.max(0, Number(profile.state.miners || 0) * seconds);
  const energy = Math.max(0, Number(profile.state.recharge || 4) * seconds);
  profile.state.balance += passive;
  profile.state.totalEarned += passive;
  profile.state.energy = Math.min(profile.state.maxEnergy, profile.state.energy + energy);
  profile.meta.lastPassiveAt = now;
  profile.state.lastSeenDate = todayKey();
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
  if (windowState.count > MAX_TAPS_PER_WINDOW) return { ...publicPayload(profile), ok: false, error: 'Juda tez tap qilinyapti. Sekinroq.' };

  const energyCost = tapEnergyCost(profile.state);
  if (profile.state.energy < energyCost) return { ...publicPayload(profile), ok: false, error: `Energy kam. Kerak: ${energyCost}` };

  let reward = tapReward(profile.state);
  const critical = Math.random() < Number(profile.state.criticalChance || 0);
  if (critical) reward *= 3;
  profile.state.balance += reward;
  profile.state.totalEarned += reward;
  profile.state.energy = Math.max(0, profile.state.energy - energyCost);
  profile.state.xp += 1;
  profile.state.stats.taps += 1;
  store.stats.totalClicks += 1;
  store.stats.totalCoinsMined += reward;
  const leveledUp = checkLevelUp(profile.state);
  updateLeague(profile.state);
  checkReferralMilestones(profile);
  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, reward, critical, energyCost, leveledUp, ...publicPayload(profile) };
}

function tapEnergyCost(state) { return Math.max(1, 1 + Math.floor(Number(state.level || 1) / 12)); }
function tapReward(state) {
  const levelBonus = 1 + Number(state.level || 1) * 0.012;
  return Math.max(1, Math.floor(Number(state.tapPower || 1) * Number(state.multiplier || 1) * levelBonus));
}
function checkLevelUp(state) {
  let leveled = false;
  while (state.xp >= state.xpToNext) {
    state.xp -= state.xpToNext;
    state.level += 1;
    state.xpToNext = Math.round(state.xpToNext * 1.22 + 18);
    state.maxEnergy += 45;
    state.energy = Math.min(state.maxEnergy, state.energy + 90);
    leveled = true;
  }
  return leveled;
}
function updateLeague(state) {
  const score = Number(state.totalEarned || 0);
  if (score >= 1000000) state.league = 'Mythic';
  else if (score >= 350000) state.league = 'Diamond';
  else if (score >= 120000) state.league = 'Gold';
  else if (score >= 30000) state.league = 'Silver';
  else state.league = 'Bronze';
}

function buyUpgrade(profile, id) {
  const item = upgrades[id];
  if (!item) return { ...publicPayload(profile), ok: false, error: 'Unknown upgrade' };
  const level = Number(profile.upgrades[id] || 0);
  const cost = upgradeCost(item, level);
  if (profile.state.balance < cost) return { ...publicPayload(profile), ok: false, error: 'Coin yetarli emas' };
  profile.state.balance -= cost;
  profile.state.totalSpent += cost;
  profile.upgrades[id] = level + 1;
  if (id === 'tap') profile.state.tapPower += 2;
  if (id === 'energy') { profile.state.maxEnergy += 180; profile.state.energy = Math.min(profile.state.maxEnergy, profile.state.energy + 180); }
  if (id === 'miner') profile.state.miners += 1;
  if (id === 'multi') profile.state.multiplier = Number((profile.state.multiplier + 0.10).toFixed(2));
  if (id === 'recharge') profile.state.recharge += 1;
  if (id === 'critical') profile.state.criticalChance = Number(Math.min(0.35, Number(profile.state.criticalChance || 0) + 0.02).toFixed(2));
  profile.state.stats.upgrades += 1;
  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, upgrade: id, cost, ...publicPayload(profile) };
}
function upgradeCost(item, level) { return Math.round(Number(item.baseCost) * Math.pow(Number(item.growth || 1.7), Number(level || 0))); }

function claimDaily(profile) {
  const today = todayKey();
  if (profile.state.claimedDailyDate === today) return { ...publicPayload(profile), ok: false, error: 'Bugun olingan' };
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (profile.state.claimedDailyDate === yesterday) profile.state.streak += 1;
  else profile.state.streak = 1;
  const reward = Number(store.settings.dailyBaseReward || 350) + Math.min(30, profile.state.streak) * Number(store.settings.dailyStreakBonus || 70);
  profile.state.balance += reward;
  profile.state.totalEarned += reward;
  profile.state.energy = Math.min(profile.state.maxEnergy, profile.state.energy + 120 + profile.state.streak * 10);
  profile.state.claimedDailyDate = today;
  profile.state.lastSeenDate = today;
  store.stats.totalDailyClaims += 1;
  updateLeague(profile.state);
  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, reward, ...publicPayload(profile) };
}

function visitTask(profile, id) {
  const task = store.tasks.find(x => x.id === id && x.active !== false);
  if (!task) return { ...publicPayload(profile), ok: false, error: 'Task topilmadi' };
  profile.state.visitedTasks[id] = Date.now();
  scheduleSave();
  return { ok: true, task, ...publicPayload(profile) };
}

async function claimTask(profile, id) {
  const task = store.tasks.find(x => x.id === id && x.active !== false);
  if (!task) return { ...publicPayload(profile), ok: false, error: 'Task topilmadi' };
  if (profile.state.completedTasks.includes(id)) return { ...publicPayload(profile), ok: false, error: 'Task bajarilgan' };

  const ready = await taskReady(profile, task);
  if (!ready.ok) return { ...publicPayload(profile), ok: false, error: ready.error };
  profile.state.completedTasks.push(id);
  profile.state.balance += Number(task.reward || 0);
  profile.state.totalEarned += Number(task.reward || 0);
  profile.state.stats.tasks += 1;
  store.stats.totalTaskClaims += 1;
  updateLeague(profile.state);
  checkReferralMilestones(profile);
  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, reward: Number(task.reward || 0), ...publicPayload(profile) };
}

async function taskReady(profile, task) {
  if (task.type === 'referral') {
    if ((profile.meta.referrals || []).length < 1) return { ok: false, error: 'Kamida 1 do‘st taklif qiling' };
    return { ok: true };
  }
  if (task.type === 'streak') {
    if (Number(profile.state.streak || 0) < 3) return { ok: false, error: '3 kunlik streak kerak' };
    return { ok: true };
  }
  if (task.type === 'league') {
    if (Number(profile.state.totalEarned || 0) < 30000) return { ok: false, error: 'Silver League uchun 30K earned kerak' };
    return { ok: true };
  }
  if (task.type === 'tap') {
    if (Number(profile.state.stats?.taps || 0) < Number(task.target || 1000)) return { ok: false, error: `${task.target || 1000} tap kerak` };
    return { ok: true };
  }
  if (task.type === 'subscribe') {
    if (task.chatId && BOT_TOKEN && !BOT_TOKEN.includes('EXAMPLE')) {
      const member = await telegramApi('getChatMember', { chat_id: task.chatId, user_id: profile.telegramId });
      if (!member.ok) return { ok: false, error: 'Obuna tekshirib bo‘lmadi. Botni kanal/guruhga admin qiling yoki chatId ni tekshiring.' };
      const status = member.result?.status;
      if (!['creator', 'administrator', 'member'].includes(status)) return { ok: false, error: 'Avval kanal/guruhga obuna bo‘ling' };
      return { ok: true };
    }
    const visitedAt = Number(profile.state.visitedTasks?.[task.id] || 0);
    if (!visitedAt) return { ok: false, error: 'Avval Open tugmasini bosing' };
    if (Date.now() - visitedAt < 8000) return { ok: false, error: '8 soniyadan keyin claim qiling' };
    return { ok: true };
  }
  return { ok: true };
}

function taskProgress(profile, task) {
  if (task.type === 'referral') return { current: (profile.meta.referrals || []).length, target: 1 };
  if (task.type === 'streak') return { current: Number(profile.state.streak || 0), target: 3 };
  if (task.type === 'league') return { current: Number(profile.state.totalEarned || 0), target: 30000 };
  if (task.type === 'tap') return { current: Number(profile.state.stats?.taps || 0), target: Number(task.target || 1000) };
  return null;
}

function buyShopItem(profile, id) {
  const item = store.shopItems.find(x => x.id === id && x.active !== false);
  if (!item) return { ...publicPayload(profile), ok: false, error: 'Shop item topilmadi' };
  const cost = Number(item.cost || 0);
  if (profile.state.balance < cost) return { ...publicPayload(profile), ok: false, error: 'Coin yetarli emas' };
  profile.state.balance -= cost;
  profile.state.totalSpent += cost;
  applyShopEffect(profile, item);
  const purchase = { id: uid('buy'), telegramId: profile.telegramId, itemId: item.id, title: item.title, cost, createdAt: new Date().toISOString() };
  store.purchases.unshift(purchase);
  store.stats.totalShopPurchases += 1;
  profile.updatedAt = new Date().toISOString();
  scheduleSave();
  return { ok: true, purchase, ...publicPayload(profile) };
}

function applyShopEffect(profile, item) {
  const value = Number(item.value || 0);
  if (item.type === 'energy') profile.state.energy = Math.min(profile.state.maxEnergy, profile.state.energy + value);
  else if (item.type === 'miner') profile.state.miners += value;
  else if (item.type === 'tap_power') profile.state.tapPower += value;
  else if (item.type === 'multiplier') profile.state.multiplier = Number((profile.state.multiplier + value).toFixed(2));
  else if (item.type === 'skin') profile.state.inventory.push(String(item.value || item.id));
  else if (item.type === 'coins') { profile.state.balance += value; profile.state.totalEarned += value; }
}

function transferCoins(profile, body) {
  const to = findUserByCodeOrId(body.to || body.toCode || body.recipient);
  const amount = Math.floor(Number(body.amount || 0));
  if (!to) return { ...publicPayload(profile), ok: false, error: 'Qabul qiluvchi topilmadi. Referral code yoki Telegram ID kiriting.' };
  if (to.telegramId === profile.telegramId) return { ...publicPayload(profile), ok: false, error: 'O‘zingizga yuborib bo‘lmaydi' };
  if (amount < 100) return { ...publicPayload(profile), ok: false, error: 'Minimum transfer: 100 coins' };
  const fee = Math.ceil(amount * Number(store.settings.transferFeePercent || 5) / 100);
  if (profile.state.balance < amount + fee) return { ...publicPayload(profile), ok: false, error: `Coin yetarli emas. Fee: ${fee}` };
  profile.state.balance -= amount + fee;
  profile.state.totalSpent += amount + fee;
  profile.state.stats.transfersSent += 1;
  to.state.balance += amount;
  to.state.totalEarned += amount;
  to.state.stats.transfersReceived += 1;
  const transfer = { id: uid('tr'), from: profile.telegramId, to: to.telegramId, amount, fee, createdAt: new Date().toISOString() };
  store.transfers.unshift(transfer);
  store.stats.totalTransfers += 1;
  updateLeague(to.state);
  scheduleSave();
  return { ok: true, transfer, ...publicPayload(profile) };
}

function createWithdrawRequest(profile, body) {
  const amount = Math.floor(Number(body.amount || 0));
  if (amount < 10000) return { ...publicPayload(profile), ok: false, error: 'Minimum withdraw request: 10,000 coins' };
  const request = { id: uid('wd'), telegramId: profile.telegramId, firstName: profile.firstName, amount, method: String(body.method || 'manual'), account: String(body.account || '').slice(0, 120), status: 'soon', note: 'Withdraw tez orada ishga tushadi. Coin yechilmadi.', createdAt: new Date().toISOString() };
  store.withdrawals.unshift(request);
  store.stats.totalWithdrawRequests += 1;
  scheduleSave();
  return { ok: true, request, message: 'Withdraw tez orada. So‘rov saqlandi, coin yechilmadi.', ...publicPayload(profile) };
}

function createExchangeRequest(profile, body) {
  const item = store.exchangeItems.find(x => x.id === String(body.id || '') && x.active !== false);
  if (!item) return { ...publicPayload(profile), ok: false, error: 'Exchange item topilmadi' };
  const request = { id: uid('ex'), telegramId: profile.telegramId, firstName: profile.firstName, itemId: item.id, game: item.game, title: item.title, cost: Number(item.cost || 0), playerId: String(body.playerId || '').slice(0, 80), status: item.status || 'soon', note: 'Almashtirish tez orada. Hozircha coin yechilmadi.', createdAt: new Date().toISOString() };
  store.exchangeRequests.unshift(request);
  store.stats.totalExchangeRequests += 1;
  scheduleSave();
  return { ok: true, request, message: `${item.game} ${item.title} exchange tez orada. So‘rov saqlandi.`, ...publicPayload(profile) };
}

function createSellOffer(profile, body) {
  const amount = Math.floor(Number(body.amount || 0));
  const price = String(body.price || '').slice(0, 80);
  if (amount < 10000) return { ...publicPayload(profile), ok: false, error: 'Minimum sell offer: 10,000 coins' };
  const offer = { id: uid('sell'), telegramId: profile.telegramId, firstName: profile.firstName, username: profile.username, amount, price, status: 'soon', note: 'P2P sotish bozori tez orada.', createdAt: new Date().toISOString() };
  store.sellOffers.unshift(offer);
  store.stats.totalSellOffers += 1;
  scheduleSave();
  return { ok: true, offer, message: 'Sotish funksiyasi tez orada. Offer saqlandi.', ...publicPayload(profile) };
}

function checkReferralMilestones(profile) {
  const ref = profile.state.referredBy;
  if (!ref || Number(profile.state.totalEarned || 0) < Number(store.settings.referralActiveNeed || 1500)) return;
  const inviter = findUserByReferralCode(ref);
  if (!inviter) return;
  inviter.meta.referralBonuses = inviter.meta.referralBonuses || {};
  if (inviter.meta.referralBonuses[profile.telegramId]?.active) return;
  const bonus = Number(store.settings.referralActiveBonus || 10000);
  inviter.state.balance += bonus;
  inviter.state.totalEarned += bonus;
  inviter.state.referralEarned += bonus;
  inviter.meta.referralBonuses[profile.telegramId] = { active: true, amount: bonus, createdAt: new Date().toISOString() };
  updateLeague(inviter.state);
  scheduleSave();
}
function activeReferralCount(profile) { return Object.values(profile.meta.referralBonuses || {}).filter(x => x.active).length; }

function getLeaderboard(limit = 25) {
  return Object.values(store.users)
    .map(profile => {
      updateLeague(profile.state);
      return { telegramId: profile.telegramId, firstName: profile.firstName || 'Miner', username: profile.username || '', league: profile.state.league, totalEarned: Math.floor(profile.state.totalEarned || 0), balance: Math.floor(profile.state.balance || 0), level: Math.floor(profile.state.level || 1), taps: Math.floor(profile.state.stats?.taps || 0) };
    })
    .sort((a, b) => b.totalEarned - a.totalEarned || b.level - a.level)
    .slice(0, limit);
}
function getMyRank(telegramId) {
  const ranked = Object.values(store.users).map(profile => ({ id: profile.telegramId, score: Number(profile.state?.totalEarned || 0), level: Number(profile.state?.level || 1) })).sort((a, b) => b.score - a.score || b.level - a.level);
  const index = ranked.findIndex(x => x.id === telegramId);
  return index === -1 ? null : { rank: index + 1, total: ranked.length, score: Math.floor(ranked[index].score) };
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function uid(prefix) { return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`; }

async function handleAdminApi(req, res, url) {
  if (!adminAuthorized(req)) return sendJSON(res, 401, { ok: false, error: 'Admin password invalid' });
  if (req.method === 'GET' && url.pathname === '/api/admin/overview') return sendJSON(res, 200, adminOverview());
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'Method not allowed' });
  const body = await parseBody(req);
  let result;
  if (url.pathname === '/api/admin/task/save') result = adminSaveTask(body);
  else if (url.pathname === '/api/admin/task/delete') result = adminDeleteById('tasks', body.id);
  else if (url.pathname === '/api/admin/shop/save') result = adminSaveShop(body);
  else if (url.pathname === '/api/admin/shop/delete') result = adminDeleteById('shopItems', body.id);
  else if (url.pathname === '/api/admin/exchange/save') result = adminSaveExchange(body);
  else if (url.pathname === '/api/admin/exchange/delete') result = adminDeleteById('exchangeItems', body.id);
  else if (url.pathname === '/api/admin/user/adjust') result = adminAdjustUser(body);
  else if (url.pathname === '/api/admin/request/update') result = adminUpdateRequest(body);
  else if (url.pathname === '/api/admin/settings/save') result = adminSaveSettings(body);
  else return sendJSON(res, 404, { ok: false, error: 'Admin route not found' });
  return sendJSON(res, result.ok ? 200 : 400, result);
}
function adminAuthorized(req) {
  const password = String(req.headers['x-admin-password'] || '');
  if (password && password === ADMIN_PASSWORD) return true;
  const initData = String(req.headers['x-telegram-init-data'] || '');
  if (ADMIN_IDS.length && BOT_TOKEN && initData) {
    const verified = verifyTelegramInitData(initData, BOT_TOKEN);
    if (verified.ok && ADMIN_IDS.includes(String(verified.user.id))) return true;
  }
  return false;
}
function adminOverview() {
  return { ok: true, stats: publicStats(), users: Object.values(store.users).map(publicAdminUser).sort((a,b)=>b.totalEarned-a.totalEarned).slice(0,200), tasks: store.tasks, shopItems: store.shopItems, exchangeItems: store.exchangeItems, withdrawals: store.withdrawals.slice(0,100), exchangeRequests: store.exchangeRequests.slice(0,100), sellOffers: store.sellOffers.slice(0,100), transfers: store.transfers.slice(0,100), purchases: store.purchases.slice(0,100), settings: store.settings };
}
function publicAdminUser(profile) { return { telegramId: profile.telegramId, firstName: profile.firstName, username: profile.username, balance: Math.floor(profile.state.balance||0), totalEarned: Math.floor(profile.state.totalEarned||0), level: profile.state.level, league: profile.state.league, referrals: (profile.meta.referrals||[]).length, taps: profile.state.stats?.taps||0, createdAt: profile.createdAt }; }
function adminSaveTask(body) {
  const id = sanitizeId(body.id || body.title || 'task');
  const item = { id, title: String(body.title || 'Task').slice(0,80), description: String(body.description || '').slice(0,180), reward: Math.max(0, Math.floor(Number(body.reward || 0))), type: String(body.type || 'subscribe'), link: String(body.link || '').slice(0,300), chatId: String(body.chatId || '').slice(0,80), advertiser: String(body.advertiser || 'Admin').slice(0,80), target: Math.floor(Number(body.target || 0)), active: body.active !== false && body.active !== 'false', sort: Math.floor(Number(body.sort || 100)) };
  upsertArray(store.tasks, item); store.stats.adminSaves += 1; scheduleSave(); return { ok: true, item, overview: adminOverview() };
}
function adminSaveShop(body) {
  const id = sanitizeId(body.id || body.title || 'shop');
  const item = { id, title: String(body.title || 'Shop item').slice(0,80), description: String(body.description || '').slice(0,180), cost: Math.max(0, Math.floor(Number(body.cost || 0))), type: String(body.type || 'energy'), value: isNaN(Number(body.value)) ? String(body.value || '') : Number(body.value), active: body.active !== false && body.active !== 'false', icon: String(body.icon || 'box').slice(0,40) };
  upsertArray(store.shopItems, item); store.stats.adminSaves += 1; scheduleSave(); return { ok: true, item, overview: adminOverview() };
}
function adminSaveExchange(body) {
  const id = sanitizeId(body.id || `${body.game || 'game'}_${body.title || 'coin'}`);
  const item = { id, game: String(body.game || 'Game').slice(0,80), title: String(body.title || 'Coins').slice(0,80), cost: Math.max(0, Math.floor(Number(body.cost || 0))), status: String(body.status || 'soon').slice(0,40), note: String(body.note || 'Tez orada').slice(0,180), active: body.active !== false && body.active !== 'false' };
  upsertArray(store.exchangeItems, item); store.stats.adminSaves += 1; scheduleSave(); return { ok: true, item, overview: adminOverview() };
}
function adminDeleteById(collection, id) {
  const arr = store[collection];
  const idx = Array.isArray(arr) ? arr.findIndex(x => x.id === id) : -1;
  if (idx === -1) return { ok: false, error: 'Item topilmadi' };
  arr.splice(idx, 1); store.stats.adminSaves += 1; scheduleSave(); return { ok: true, overview: adminOverview() };
}
function adminAdjustUser(body) {
  const profile = findUserByCodeOrId(body.user || body.telegramId);
  if (!profile) return { ok: false, error: 'User topilmadi' };
  const amount = Math.floor(Number(body.amount || 0));
  if (body.mode === 'set') profile.state.balance = Math.max(0, amount);
  else profile.state.balance = Math.max(0, Number(profile.state.balance || 0) + amount);
  profile.updatedAt = new Date().toISOString(); scheduleSave(); return { ok: true, user: publicAdminUser(profile), overview: adminOverview() };
}
function adminUpdateRequest(body) {
  const lists = [store.withdrawals, store.exchangeRequests, store.sellOffers];
  for (const list of lists) {
    const item = list.find(x => x.id === body.id);
    if (item) { item.status = String(body.status || item.status || 'pending'); item.adminNote = String(body.note || '').slice(0,200); item.updatedAt = new Date().toISOString(); scheduleSave(); return { ok: true, item, overview: adminOverview() }; }
  }
  return { ok: false, error: 'Request topilmadi' };
}
function adminSaveSettings(body) {
  for (const key of ['referralJoinBonus','referralActiveBonus','referralActiveNeed','transferFeePercent','dailyBaseReward','dailyStreakBonus']) {
    if (body[key] !== undefined) store.settings[key] = Number(body[key]);
  }
  store.stats.adminSaves += 1; scheduleSave(); return { ok: true, settings: store.settings, overview: adminOverview() };
}
function sanitizeId(value) { return String(value || 'item').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0,50) || uid('item'); }
function upsertArray(arr, item) { const idx = arr.findIndex(x => x.id === item.id); if (idx === -1) arr.push(item); else arr[idx] = { ...arr[idx], ...item }; }

async function startBot() {
  if (botPollingActive) return;
  botPollingActive = true;
  const me = await telegramApi('getMe', {});
  if (!me.ok) throw new Error(me.description || 'Could not connect to Telegram Bot API');
  botUsername = me.result.username || '';
  console.log(`🤖 Bot connected: @${botUsername}`);
  if (AUTO_DELETE_WEBHOOK) await resetWebhookForPolling();
  if (SET_MENU_BUTTON && WEBAPP_URL && WEBAPP_URL.startsWith('https://')) {
    await telegramApi('setChatMenuButton', { menu_button: { type: 'web_app', text: '🚀 Open App', web_app: { url: WEBAPP_URL } } }).catch(error => console.warn('[bot:menu]', error.message));
  } else if (SET_MENU_BUTTON && WEBAPP_URL && !WEBAPP_URL.startsWith('https://')) console.warn('⚠️  Menu button was not set: WEBAPP_URL must start with https://');
  pollBotLoop().catch(error => console.error('[bot:poll:error]', error));
}
async function resetWebhookForPolling() {
  try {
    const info = await telegramApi('getWebhookInfo', {});
    const activeUrl = info?.result?.url || '';
    if (activeUrl) console.log(`🧹 Active webhook found: ${activeUrl}`);
    const deleted = await telegramApi('deleteWebhook', { drop_pending_updates: DROP_PENDING_UPDATES });
    if (!deleted.ok) { console.warn('[bot:deleteWebhook]', deleted.description || deleted); return; }
    console.log(activeUrl ? `✅ Webhook deleted. Polling mode is ready. drop_pending_updates=${DROP_PENDING_UPDATES}` : '✅ Webhook check OK. Polling mode is ready.');
  } catch (error) { console.warn('[bot:deleteWebhook:catch]', error.message); }
}
async function pollBotLoop() {
  while (botPollingActive) {
    try {
      const response = await telegramApi('getUpdates', { offset: botOffset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
      if (!response.ok) {
        const description = response.description || '';
        console.warn('[bot:getUpdates]', description || response);
        if (/webhook/i.test(description) && AUTO_DELETE_WEBHOOK) await resetWebhookForPolling();
        await sleep(1500); continue;
      }
      for (const update of response.result || []) { botOffset = update.update_id + 1; await handleBotUpdate(update).catch(error => console.error('[bot:update:error]', error)); }
    } catch (error) { console.error('[bot:poll:catch]', error.message); await sleep(1800); }
  }
}
async function handleBotUpdate(update) {
  const message = update.message;
  if (!message) return;
  store.stats.totalBotMessages += 1;
  if (message.from) ensureUser({ id: message.from.id, first_name: message.from.first_name, last_name: message.from.last_name, username: message.from.username, language_code: message.from.language_code }, parseRefFromText(message.text));
  if (message.web_app_data) return sendBotMessage(message.chat.id, '✅ Mini App maʼlumoti qabul qilindi. O‘yinni davom ettiring!', openAppKeyboard(message.from));
  const text = String(message.text || '');
  if (text.startsWith('/start')) {
    store.stats.totalStartPresses += 1;
    if (message.from && store.users[String(message.from.id)]) store.users[String(message.from.id)].meta.startPresses += 1;
    scheduleSave();
    const name = message.from?.first_name || 'Miner';
    const caption = [`Salom, ${escapeText(name)}! 💎`, '', `🚀 <b>${escapeText(BOT_TITLE)}</b> — gamerlar uchun tap-to-earn Mini App.`, 'Coin yig‘ing, upgrade qiling, referral chaqiring, task bajaring va TOP reytingga chiqing.', '', 'Pastdagi tugma orqali o‘yinni oching.'].join('\n');
    return sendBotMessage(message.chat.id, caption, openAppKeyboard(message.from));
  }
  if (text.startsWith('/stats')) return sendBotMessage(message.chat.id, botStatsText(), openAppKeyboard(message.from));
  if (text.startsWith('/help')) return sendBotMessage(message.chat.id, 'Buyruqlar:\n/start — Mini App ochish\n/stats — umumiy statistika\n/help — yordam\n\nMini App uchun HTTPS URL kerak.', openAppKeyboard(message.from));
  return sendBotMessage(message.chat.id, 'O‘yinni ochish uchun pastdagi tugmani bosing 👇', openAppKeyboard(message.from));
}
function parseRefFromText(text='') { const parts = String(text).split(/\s+/); const param = parts[1] || ''; return param.startsWith('ref_') ? param.slice(4) : ''; }
function openAppKeyboard(from) {
  let url = WEBAPP_URL || 'http://localhost:3000';
  if (from && store.users[String(from.id)]) url += `?startapp=ref_${store.users[String(from.id)].state.referralCode}`;
  return { reply_markup: { inline_keyboard: [[{ text: '🚀 Open App', web_app: { url } }]] } };
}
function botStatsText() { const s = publicStats(); return [`📊 <b>Umumiy statistika</b>`, `Start bosishlar: ${s.totalStartPresses}`, `Users: ${s.totalUsers}`, `Jami click: ${s.totalClicks}`, `Jami balance: ${s.totalBalance}`, `Jami mined: ${s.totalEarned}`].join('\n'); }
async function sendBotMessage(chatId, text, extra = {}) { return telegramApi('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra }); }
async function telegramApi(method, payload) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return response.json();
}
function escapeText(value) { return String(value).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
