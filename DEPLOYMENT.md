# ZP Sampark - Deployment Guide

This guide details how to deploy the ZP Sampark monorepo. It contains two main components:
1. **Frontend**: Vite + React SPA (located in `artifacts/zp-sampark`)
2. **Backend**: Express.js API Server (located in `artifacts/api-server`)

---

## 1. Prerequisites (Database Setup)
The backend uses **Drizzle ORM** with **PostgreSQL**.
1. Create a PostgreSQL database instance on a cloud provider like **Supabase**, **Neon**, or **Aiven**.
2. Note your Connection String (e.g., `postgresql://postgres:...@...`).

---

## 2. Deploying the Backend API Server

You can host the Express backend on services like **Render**, **Railway**, **Fly.io**, or **Vercel Serverless Functions**.

### Option A: Railway (Recommended for monorepos)
1. Link your GitHub repository to Railway.
2. Add a new service from your repository.
3. In **Settings**, change the **Root Directory** to `artifacts/api-server`.
4. Set the **Build Command** to:
   ```bash
   pnpm install && pnpm run build
   ```
5. Set the **Start Command** to:
   ```bash
   node dist/index.mjs
   ```
6. Configure the following **Environment Variables**:
   * `DATABASE_URL`: `your_postgresql_connection_string`
   * `JWT_SECRET`: `your_secure_random_string`
   * `PORT`: `5000` (or leave blank; Railway binds this automatically)

---

## 3. Deploying the Frontend to Vercel

The frontend is a static React application built with Vite, which can be hosted directly on Vercel.

1. Go to your **Vercel Dashboard** and click **Add New Project**.
2. Select your `queuemanage` repository.
3. In **Project Settings**:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `artifacts/zp-sampark` (Vercel will look inside this subdirectory to build)
4. In **Build and Development Settings**:
   * **Build Command**: `vite build --config vite.config.ts` (or default `npm run build`)
   * **Output Directory**: `dist/public` (Vite compiles files into this folder)
5. In **Environment Variables**, add:
   * `VITE_API_URL`: Set this to your deployed Backend URL (e.g., `https://zp-sampark-api.up.railway.app`). Ensure it does **not** end with a trailing slash.
   * `PORT`: `3000`
   * `BASE_PATH`: `/`
6. Click **Deploy**.

---

## 4. Database Initialization (Run Migrations)
Once your backend server has your database credentials, initialize the tables and seed default slots/accounts:
1. Run the Drizzle push command locally pointing to your production database, OR configure your build step on Railway to run it:
   ```bash
   # Locally in your terminal (with DATABASE_URL set to your cloud DB):
   pnpm --filter @workspace/db run push
   ```
2. When the backend server starts, it will automatically check if the tables are empty and seed default admin/staff accounts:
   * **Admin**: `admin` / `admin123`
   * **CEO**: `ceo` / `ceo123`
   * **Reception / PA**: `reception` / `reception123`
   * **Officer**: `officer` / `officer123`

---

## 5. Exposing the QR Code Link
Once Vercel gives you your frontend URL (e.g. `https://zp-sampark.vercel.app`):
- Citizens scanning the QR code at the desk will automatically open the URL.
- To update the QR code displayed inside the receptionist desk or printed sheets, navigate to the `/qr` page on your deployed site. It dynamically generates the QR image using the current host address.
