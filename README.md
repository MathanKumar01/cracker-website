# Kathiravan Crackers — Ordering Website & Management System

Online Diwali crackers ordering storefront and administrative dashboard built for **Kathiravan Crackers, Sivakasi**.


---

## 🌟 Key Features

- **Storefront (Next.js 15 App Router)**:
  - Real-time Diwali catalogue with category filters and instant live search.
  - Cart drawer with quantity controls and automatic total calculation.
  - Direct checkout collecting customer name, phone, delivery address, and notes.
  - Supports both **guest checkout** and **registered customer accounts** (`/account`).
- **Backend API (Django 5.1 & Django REST Framework)**:
  - Strict server-side catalogue price recalculation (tamper-proof orders).
  - Dual Admin Authentication: Sign in using your **Admin API Key** or **Django Staff account**.
  - Order status workflow: `New` → `Confirmed` → `Packed` → `Completed` → `Cancelled`.
  - Excel-compatible UTF-8 BOM **CSV Export** for warehouse dispatch.
  - Auto-loading environment configuration via `python-dotenv`.
- **Security Hardening**:
  - Secure `.env` handling for API keys and secrets with `.gitignore` protection.
  - Configurable CORS origins, allowed host verification, and security headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `XSS Protection`).
  - Production HTTPS reverse-proxy compatibility (`SECURE_PROXY_SSL_HEADER`).
- **Database Architecture**:
  - **Local Development**: Stored in SQLite at [`backend/db.sqlite3`](file:///c:/Users/MathanVini/Downloads/sakthidevi_diwali_website/backend/db.sqlite3).
  - **Production Deployment**: Connects automatically to persistent managed PostgreSQL (e.g. Neon, Supabase, Render, Railway) via `DATABASE_URL`.

---

## 🔐 Environment Files Setup

### 1. Backend Environment ([`backend/.env`](file:///c:/Users/MathanVini/Downloads/sakthidevi_diwali_website/backend/.env))
```ini
DJANGO_SECRET_KEY=lbByuIWNxu7qmGPtb--oNRidw0rmTBBt1OBcJ61Yw6dAT5jVYZ1mrmhafr-7unuNn8M
DJANGO_DEBUG=true
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,.onrender.com,.railway.app,.vercel.app
ADMIN_API_KEY=sakthi-admin-change-this-12345
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://*.vercel.app
# DATABASE_URL=postgresql://user:password@hostname:5432/sakthidevi_db
```

### 2. Frontend Environment ([`frontend/.env.local`](file:///c:/Users/MathanVini/Downloads/sakthidevi_diwali_website/frontend/.env.local))
```ini
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api
```

---

## 🚀 Running Locally on Windows

Open two terminals:

### Terminal 1 — Django Backend
```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```
*Backend runs on `http://127.0.0.1:8000`.*

### Terminal 2 — Next.js Frontend
```powershell
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

### Admin Dashboard Access
1. Open `http://localhost:3000/admin`.
2. Enter your Admin API Key: `sakthi-admin-change-this-12345`.
3. View orders, change order statuses, and download orders as Excel CSV.

---

## ☁️ Deployment Guide

### A. Deploy Backend (e.g. Render / Railway / Fly.io)
1. Push repository to GitHub.
2. In Render / Railway, create a new **Web Service** pointing to the `backend` directory.
3. Build command: `pip install -r requirements.txt && python manage.py migrate`
4. Start command: `gunicorn store.wsgi:application`
5. Configure Environment Variables in your hosting dashboard:
   - `DJANGO_SECRET_KEY`: `<your-random-production-secret>`
   - `DJANGO_DEBUG`: `false`
   - `DJANGO_ALLOWED_HOSTS`: `your-backend.onrender.com`
   - `ADMIN_API_KEY`: `sakthi-admin-change-this-12345` (or your private key)
   - `CORS_ALLOWED_ORIGINS`: `https://your-frontend.vercel.app`
   - `DATABASE_URL`: Your PostgreSQL connection string.

### B. Deploy Frontend (Vercel)
1. In Vercel, import the project and set Root Directory to `frontend`.
2. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://your-backend.onrender.com/api`
3. Click **Deploy**.

---

## 📦 Where is Data Stored?
- **Orders & Users**: Stored in the Django database.
  - In development, this is stored locally in [`backend/db.sqlite3`](file:///c:/Users/MathanVini/Downloads/sakthidevi_diwali_website/backend/db.sqlite3).
  - In production, set `DATABASE_URL` in [`backend/.env`](file:///c:/Users/MathanVini/Downloads/sakthidevi_diwali_website/backend/.env) to connect directly to PostgreSQL.
- **Product Catalogue**: Loaded from [`frontend/lib/products.json`](file:///c:/Users/MathanVini/Downloads/sakthidevi_diwali_website/frontend/lib/products.json) and validated server-side against [`backend/orders/serializers.py`](file:///c:/Users/MathanVini/Downloads/sakthidevi_diwali_website/backend/orders/serializers.py).
