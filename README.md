# Crypto Clicker Pro — Telegram Mini App

Compact premium tap-to-earn Telegram Mini App with Node.js backend, Telegram bot, admin panel, EN/RU UI, referral system, tasks, leaderboard, shop, exchange requests, transfers and global stats.

## Requirements

- Node.js 18+
- Telegram bot token from BotFather
- HTTPS URL for Telegram Mini App: ngrok, cloudflared, Render, VPS + SSL, etc.

## Quick start

```bash
cp .env.example .env
# edit .env: BOT_TOKEN, WEBAPP_URL, ADMIN_PASSWORD
node server.js
```

Open:

- Mini App: `https://your-domain.com/`
- Admin panel: `https://your-domain.com/admin.html`
- Health check: `/health`

## Local Telegram test

Telegram Mini Apps require HTTPS. For local server:

```bash
node server.js
ngrok http 3000
```

Put the ngrok HTTPS URL into `.env` as `WEBAPP_URL`, then restart `node server.js`.

## Subscribe task verification

For automatic channel/group subscription verification:

1. Add your bot to the channel/group. For channels, make the bot an admin.
2. In admin panel create a task with `type = subscribe`.
3. Set `link` to the channel/group link.
4. Set `chatId` to `@channelusername` or numeric `-100...` chat id.
5. Click **Test chat** in admin panel.
6. Users press **Open**, subscribe, return and press **Check**. The backend calls Telegram `getChatMember` and confirms automatically.

If `chatId` is empty, the app falls back to a timed demo check after opening the task link.

## Admin panel

Default panel path: `/admin.html`.

Use `ADMIN_PASSWORD` from `.env`.

Admin can manage:

- EN/RU task titles and descriptions
- advertiser subscribe tasks
- shop items
- game coin exchange items
- user balance adjustments
- withdraw/exchange/sell request statuses
- global statistics

## Notes

- The game uses a local JSON database: `data/users.json`.
- For production, back up `data/users.json` regularly or migrate to PostgreSQL.
- Do not expose `.env` publicly.
