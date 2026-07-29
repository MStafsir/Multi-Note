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
| Database | SQLite via Prisma ORM |
| Auth | NextAuth.js v4 |
| State | Zustand + TanStack Query |
| Real-time | Socket.IO |
| Editor | Tiptap |

## Prerequisites

- **Bun** (recommended) or Node.js 18+
- **Git**

Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

## Quick Start

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

```env
DATABASE_URL=file:./db/custom.db
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
├── mini-services/              # Socket.IO microservices
│   ├── collab-service/         # Real-time collaboration (port 3003)
│   └── comment-sync-service/   # Comment sync (port 3004)
├── prisma/
│   └── schema.prisma           # Database schema
├── public/                     # Static assets
├── setup.sh                    # First-time setup script
├── start.sh                    # Start all services
└── stop.sh                     # Stop all services
```

## Mini-Services (Real-time Features)

The app uses two Socket.IO microservices for real-time features:

| Service | Port | Purpose |
|---------|------|---------|
| collab-service | 3003 | Real-time note collaboration |
| comment-sync-service | 3004 | Real-time comment synchronization |

**Note:** The app works without these services, but real-time collaboration and comment sync features will be disabled.

## Deployment

### Production Build
```bash
bun run build
```

### Switching to PostgreSQL
The project uses SQLite by default. For production, switch to PostgreSQL:

1. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Update `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/multinote
```

3. Run migrations:
```bash
bun run db:push
```

## License

MIT
