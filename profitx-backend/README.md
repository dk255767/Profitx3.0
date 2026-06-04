# ProfitX Backend

Express + TypeScript backend for the ProfitX mobile app.

## Features

- Supabase Postgres persistence
- Auth endpoint for app login
- Shop settings endpoint
- Finance vendors and payment tracking endpoints
- Saving cards and deposit tracking endpoints

## 1) Install

```bash
cd profitx-backend
npm install
```

## 2) Supabase Postgres setup

Create a Supabase project and add these tables:

- `users` (`id` text primary key, `email` text unique, `password` text, `role` text)
- `settings` (`id` int primary key, `shop_name` text, `owner_name` text)
- `finance_vendors` (`id` text primary key, `name` text, `loan_date` text, `loan_amount` numeric)
- `finance_payments` (`id` bigint generated identity primary key, `vendor_id` text, `amount` numeric, `month` text, `year` text, `paid_on` text, `timestamp` bigint)
- `saving_cards` (`id` text primary key, `name` text, `started_on` text, `initial_amount` numeric)
- `saving_deposits` (`id` bigint generated identity primary key, `card_id` text, `amount` numeric, `month` text, `year` text, `paid_on` text, `timestamp` bigint)

The backend seeds default settings and admin user automatically when the tables are empty.

## 3) Run in dev mode

```bash
npm run dev
```

Server starts at `http://localhost:4000` by default.

## 4) Build + run

```bash
npm run build
npm start
```

## 5) Reset database (optional)

If you want a fresh database, truncate all Supabase tables and restart the backend.

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

- `PORT`: API port (default `4000`)
- `CORS_ORIGIN`: Allowed origin for browser clients (default `*`)
- `APP_SECRET`: Secret used for login token generation
- `DATABASE_URL`: Supabase Postgres connection string (pooler), for example:
	`postgresql://postgres.zzbmdlxkbbyhzisbtrxo:[YOUR-PASSWORD]@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`

## Default Login

- Email: `admin@profitx.local`
- Password: `admin123`

## API Endpoints

Base URL: `http://localhost:4000/api`

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /settings/shop`
- `PUT /settings/shop`
- `GET /finance/vendors`
- `GET /finance/summary`
- `POST /finance/vendors`
- `PATCH /finance/vendors/:id`
- `POST /finance/vendors/:id/payments`
- `GET /saving/cards`
- `GET /saving/summary`
- `POST /saving/cards`
- `PATCH /saving/cards/:id`
- `POST /saving/cards/:id/deposits`

## Expo App Connection Notes

For a physical device, set your API base URL to your computer LAN IP (not `localhost`):

- Example: `http://192.168.1.50:4000/api`

For Android emulator, use:

- `http://10.0.2.2:4000/api`

For iOS simulator, `localhost` works:

- `http://localhost:4000/api`
