# Crypto Clicker Telegram Mini App

Premium **Tap-to-Earn / Crypto Clicker** Telegram Mini App. Loyiha bitta Node.js server ichida ishlaydi:

- Telegram bot polling
- Mini App web server
- Game API
- User progress storage
- Anti-spam tap limit
- Referral bonus
- Daily reward
- Upgrade system
- Leaderboard
- Responsive premium mobile UI

> Hech qanday `npm install` shart emas. Loyiha faqat Node.js 18+ bilan ishlaydi.

---

## 1. Talablar

- Node.js 18 yoki 20+
- Telegram bot token — @BotFather orqali olinadi
- HTTPS domen yoki ngrok/cloudflared URL

Telegram Mini App production’da **HTTPS URL** orqali ochilishi kerak.

---

## 2. Tez ishga tushirish

```bash
cp .env.example .env
```

`.env` ichida quyidagilarni to‘ldiring:

```env
BOT_TOKEN=BOTFATHER_TOKENINGIZ
WEBAPP_URL=https://your-domain.com
PORT=3000
NODE_ENV=production
SET_MENU_BUTTON=true
BOT_TITLE=Crypto Clicker
```

Keyin:

```bash
npm start
```

Local test:

```bash
npm run dev
```

Brauzerda:

```txt
http://localhost:3000
```

---

## 3. Telegram botga ulash

1. @BotFather → `/newbot` orqali bot yarating.
2. Tokenni `.env` ichidagi `BOT_TOKEN` ga yozing.
3. Serveringizni HTTPS domen bilan ishga tushiring.
4. `.env` ichidagi `WEBAPP_URL` ni domeningizga almashtiring.
5. Serverni ishga tushiring:

```bash
npm start
```

Botga `/start` yuboring. Bot **Open Crypto Clicker** tugmasini chiqaradi.

---

## 4. Deploy variantlari

### Render

Repository’ni GitHub’ga yuklang. Render’da **New Web Service** yarating.

Build command bo‘sh qolishi mumkin.

Start command:

```bash
node server.js
```

Environment variables:

```env
BOT_TOKEN=...
WEBAPP_URL=https://your-render-domain.onrender.com
NODE_ENV=production
SET_MENU_BUTTON=true
BOT_TITLE=Crypto Clicker
```

### VPS

```bash
git clone your-repo
cd crypto-clicker-miniapp
cp .env.example .env
nano .env
npm start
```

Nginx reverse proxy bilan domenni HTTPS qiling.

---

## 5. Fayl strukturasi

```txt
crypto-clicker-miniapp/
├── server.js                 # Node.js bot + API + static server
├── package.json
├── .env.example
├── Procfile
├── render.yaml
├── public/
│   ├── index.html            # Mini App sahifasi
│   ├── manifest.json
│   └── assets/
│       ├── app.css           # Premium UI styles
│       └── app.js            # Mini App frontend logic
└── data/
    └── users.json            # Local JSON database
```

---

## 6. API endpointlar

- `GET /api/me` — foydalanuvchi state
- `POST /api/tap` — tap mining
- `POST /api/upgrade` — upgrade sotib olish
- `POST /api/daily` — daily reward
- `POST /api/task` — task reward
- `GET /api/leaderboard` — leaderboard
- `GET /health` — server health check

Frontend har requestda `X-Telegram-Init-Data` yuboradi. Production’da server Telegram `initData` hash’ini tekshiradi.

---

## 7. Muhim eslatmalar

- Hozirgi saqlash tizimi `data/users.json`. Katta production uchun PostgreSQL tavsiya qilinadi.
- Real airdrop/token va moliyaviy va’dalar berishdan oldin huquqiy/compliance tomonni tekshiring.
- Bot polling ishlatilgan. Katta production uchun webhook’ga o‘tkazish mumkin.

---

## 8. Customization

Asosiy o‘zgartirish joylari:

- UI: `public/assets/app.css`
- Frontend logic: `public/assets/app.js`
- Game economics: `server.js` ichidagi `DEFAULT_GAME_STATE`, `upgrades`, `tasks`
- Bot matnlari: `server.js` ichidagi `/start` javobi

---

## 9. Tekshirish

Syntax check:

```bash
npm run check
```

Health check:

```bash
curl http://localhost:3000/health
```

## Fix: `Conflict: can't use getUpdates method while webhook is active`

This project runs the bot in polling mode. If your bot had a webhook configured before, Telegram blocks `getUpdates` until the webhook is deleted.

The project now fixes this automatically on startup with:

```env
AUTO_DELETE_WEBHOOK=true
DROP_PENDING_UPDATES=true
```

If you still see the conflict, stop all other running copies of this bot and run:

```bash
node server.js
```

Only one process can poll the same bot token at a time.
