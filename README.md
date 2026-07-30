# Multi-Note

A comprehensive, feature-rich note-taking application built with Next.js 16, TypeScript, Tailwind CSS, and Prisma.

## Features

- 📝 **Rich Text Editor** — Tiptap-based editor with collaborative editing
- 📁 **File Management** — Upload, organize, and preview files (PDF, DOCX, XLSX, images)
- 🗂️ **Workspace System** — Multi-tenant workspaces with role-based access
- 🔗 **Bi-directional Links** — Note linking with backlink graph
- 💬 **Threaded Comments** — In-note commenting with real-time sync
- 📊 **Database Blocks** — Notion-like database tables with filters and views
- 🧮 **Calculator Widget** — Built-in scientific calculator
- 🏷️ **Tags & Favorites** — Organize and quickly access notes
- 🔔 **Notifications** — Real-time notification system
- 📤 **File Sharing** — Share notes and files with permissions
- 📱 **PWA Support** — Install as a Progressive Web App
- 🌙 **Dark Mode** — Full theme support with next-themes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | SQLite (local) / PostgreSQL (production) via Prisma ORM |
| Auth | NextAuth.js v4 |
| State | Zustand + TanStack Query |
| Real-time | Socket.IO (local) / disabled on Vercel |
| Editor | Tiptap |

## Upload Limits

| Setting | Value |
|---------|-------|
| Max file size | **500 MB** |
| Storage quota | **5 TB** (effectively unlimited) |
| Supported formats | All file types (PDF, DOCX, XLSX, images, audio, video, etc.) |

> **Note:** On Vercel free tier, serverless functions have a 4.5MB body limit. For large uploads on Vercel, use Vercel Blob.

## Prerequisites

- **Bun** (recommended) or Node.js 18+
- **Git**

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Quick Start (Local Development)

### 1. Clone the repository
```bash
git clone https://github.com/MStafsir/Multi-Note.git
cd Multi-Note
```

### 2. Run the setup script
```bash
chmod +x setup.sh
./setup.sh
```

This will automatically:
- ✅ Check prerequisites
- ✅ Create required directories (`upload/`, `db/`)
- ✅ Create `.env` file with defaults
- ✅ Install all dependencies
- ✅ Set up the database (Prisma generate + push)
- ✅ Install mini-service dependencies

### 3. Start the application

**Option A: Start everything at once**
```bash
chmod +x start.sh
./start.sh
```

**Option B: Start services manually (3 terminals)**
```bash
# Terminal 1: Collab service
cd mini-services/collab-service && bun run dev

# Terminal 2: Comment sync service
cd mini-services/comment-sync-service && bun run dev

# Terminal 3: Main app
bun run dev
```

The app will be available at **http://localhost:3000**

### 4. Stop the application
```bash
chmod +x stop.sh
./stop.sh
```

## Environment Variables

Create a `.env` file in the project root (auto-created by `setup.sh`):

**For local development (SQLite):**
```env
DATABASE_URL=file:./db/custom.db
NEXTAUTH_SECRET=your-secret-key-here
```

**For Vercel/Supabase (PostgreSQL):**
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
NEXTAUTH_SECRET=your-secret-key-here
```

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Prisma database connection string | `file:./db/custom.db` |
| `NEXTAUTH_SECRET` | Secret key for NextAuth.js sessions | Change in production! |

## Project Structure

```
Multi-Note/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── api/                # Backend API routes
│   │   └── page.tsx            # Main application page
│   ├── components/             # React components
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utility functions & configurations
├── mini-services/              # Socket.IO microservices (local only)
│   ├── collab-service/         # Real-time collaboration (port 3003)
│   └── comment-sync-service/   # Comment sync (port 3004)
├── prisma/
│   ├── schema.prisma           # Active database schema (SQLite by default)
│   └── schema.postgresql.prisma # PostgreSQL schema for Vercel/Supabase
├── public/                     # Static assets
├── setup.sh                    # First-time setup script
├── start.sh                    # Start all services
├── stop.sh                     # Stop all services
└── switch-db.sh                # Switch between SQLite ↔ PostgreSQL
```

## Mini-Services (Real-time Features)

The app uses two Socket.IO microservices for real-time features:

| Service | Port | Purpose |
|---------|------|---------|
| collab-service | 3003 | Real-time note collaboration |
| comment-sync-service | 3004 | Real-time comment synchronization |

**Note:** The app works without these services, but real-time collaboration and comment sync features will be disabled. On Vercel, these services are not available.

---

## 🚀 Deploy to Vercel (with Supabase)

### Step 1: Create Supabase Project (Free)

1. Go to [https://supabase.com](https://supabase.com) and sign up
2. Click **"New Project"**
3. Fill in project name and database password
4. Select the closest region
5. Click **"Create new project"**
6. Wait for the project to be ready (~2 minutes)

### Step 2: Get Supabase Connection String

1. Go to **Supabase Dashboard → Settings → Database**
2. Scroll down to **"Connection string"**
3. Copy the **URI** format connection string
4. Replace `[YOUR-PASSWORD]` with your database password

Example:
```
postgresql://postgres.xxxxx:YOUR-PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
```

### Step 3: Switch to PostgreSQL Schema

```bash
chmod +x switch-db.sh
./switch-db.sh postgresql
```

### Step 4: Update .env for PostgreSQL

Edit `.env`:
```env
DATABASE_URL=postgresql://postgres.xxxxx:YOUR-PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
NEXTAUTH_SECRET=generate-a-random-secret-here
```

Generate a random secret:
```bash
openssl rand -base64 32
```

### Step 5: Push Schema to Supabase

```bash
bun run db:push
bun run db:generate
```

### Step 6: Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign up
2. Click **"Add New → Project"**
3. Import your GitHub repo: `MStafsir/Multi-Note`
4. In **Environment Variables**, add:
   - `DATABASE_URL` = your Supabase connection string
   - `NEXTAUTH_SECRET` = your generated secret
5. Click **"Deploy"**

### Step 7: Update Vercel Build Settings

In Vercel project settings → General:
- **Framework Preset**: Next.js
- **Build Command**: `npx prisma generate && next build`
- **Output Directory**: Leave default

### Important Vercel Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| File upload | ⚠️ Limited | 4.5MB max on free tier; use Vercel Blob for larger files |
| Real-time collab | ❌ Disabled | Socket.IO not supported on serverless |
| Comment sync | ❌ Disabled | Same as above |
| SQLite database | ❌ Not supported | Must use PostgreSQL (Supabase) |
| All other features | ✅ Works | Notes, editor, files, auth, etc. |

---

## 🆓 Free Hosting Alternatives (with SQLite support)

If you want to keep SQLite and real-time features, use these instead of Vercel:

| Platform | Free Tier | SQLite | WebSocket | Notes |
|----------|-----------|--------|-----------|-------|
| **[Render](https://render.com)** | ✅ Free | ✅ Yes | ✅ Yes | Best for SQLite apps |
| **[Railway](https://railway.app)** | ✅ $5 credit/mo | ✅ Yes | ✅ Yes | Easy deploy |
| **[Fly.io](https://fly.io)** | ✅ Free tier | ✅ Yes | ✅ Yes | Needs Dockerfile |
| **[VPS (DigitalOcean)](https://digitalocean.com)** | $4/mo | ✅ Yes | ✅ Yes | Full control |

### Deploy to Render (Recommended for SQLite)

1. Go to [https://render.com](https://render.com) and sign up
2. Click **"New → Web Service"**
3. Connect your GitHub repo: `MStafsir/Multi-Note`
4. Set:
   - **Build Command**: `bun install && bun run db:generate && bun run db:push && bun run build`
   - **Start Command**: `bun run start`
5. Add environment variables:
   - `DATABASE_URL` = `file:./db/custom.db`
   - `NEXTAUTH_SECRET` = generate a random secret
6. Click **"Create Web Service"**

---

## Switching Database Provider

```bash
# Switch to PostgreSQL (for Vercel/Supabase)
./switch-db.sh postgresql

# Switch back to SQLite (for local dev)
./switch-db.sh sqlite

# After switching, always run:
bun run db:push
bun run db:generate
```

## License

MIT
