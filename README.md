# Crypto Clicker Pro — Telegram Mini App

To‘liq Node.js Telegram Mini App o‘yini: clicker, referral, task/ads, leaderboard, shop, exchange requests, wallet, admin panel va public stats.

## Funksiyalar

- Telegram bot `/start` va `Open App` tugmasi
- Telegram `initData` validation
- Tap-to-earn game, energy, XP, level, qiyinlashuvchi energy cost
- Upgrade: Tap Power, Energy Tank, Auto Miner, Multiplier, Recharge, Critical Tap
- Referral bonuslar: join bonus + active referral bonus
- Earn tasks: kanal/guruh obuna tasklari, referral, streak, league, tap target
- Advertiser task qo‘shish: admin panel orqali link/chatId/reward kiritiladi
- Shop: boosterlar, miner, skin, multiplier
- Exchange: PUBG UC, Free Fire Diamond, Roblox Robux requestlari — status `tez orada`
- Wallet: coin yuborish, withdraw request — status `tez orada`, P2P sell offer — status `tez orada`
- Top reyting va foydalanuvchining o‘z o‘rni
- Global statistika: start bosishlar, users, jami click, barcha balans, mined, task claims va boshqalar
- Admin panel: `/admin.html`
- Dependency yo‘q: Node.js 18+ yetadi

## Ishga tushirish

```bash
cd crypto-clicker-miniapp
cp .env.example .env
```

`.env` ni to‘ldiring:

```env
BOT_TOKEN=BotFather_token
WEBAPP_URL=https://your-ngrok-or-domain-url
PORT=3000
NODE_ENV=production
SET_MENU_BUTTON=true
ADMIN_PASSWORD=strong-password
AUTO_DELETE_WEBHOOK=true
DROP_PENDING_UPDATES=true
```

Start:

```bash
npm start
# yoki
node server.js
```

Tekshirish:

```bash
npm run check
```

## Telegram Mini App local test

Telegram `localhost` URL’ni ocholmaydi. HTTPS tunnel kerak:

```bash
ngrok http 3000
```

Chiqqan `https://....ngrok-free.app` URL’ni `.env` dagi `WEBAPP_URL` ga qo‘ying va serverni qayta ishga tushiring.

## Admin panel

Brauzerda oching:

```text
http://localhost:3000/admin.html
```

Password: `.env` dagi `ADMIN_PASSWORD`.

Admin panelda quyidagilar bor:

- umumiy stats
- referral/daily/transfer sozlamalari
- task qo‘shish/tahrirlash/o‘chirish
- shop item qo‘shish/tahrirlash/o‘chirish
- exchange item qo‘shish/tahrirlash/o‘chirish
- user balansini adjust qilish
- withdraw/exchange/sell request statusini update qilish

## Kanal/guruh obuna tasklarini real tekshirish

Task qo‘shishda `chatId` kiritsangiz server Telegram `getChatMember` orqali obunani tekshiradi.

Shartlar:

1. Bot o‘sha kanal/guruhga qo‘shilgan bo‘lishi kerak.
2. Kanal/guruhda bot admin bo‘lsa yaxshiroq.
3. `chatId` misollar:
   - public kanal: `@channelusername`
   - private kanal/guruh: `-1001234567890`

Agar `chatId` bo‘sh bo‘lsa, task demo/ad mode’da ishlaydi: user `Open` bosadi, 8 soniyadan keyin `Claim` qila oladi.

## Muhim

Withdraw, game coin exchange va sell bo‘limlari hozir real pul/to‘lov bermaydi. Ular request sifatida admin panelga yoziladi va foydalanuvchiga `tez orada` statusini ko‘rsatadi.
