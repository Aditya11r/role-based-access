# Team Task Manager

A full-stack team task manager for the assignment brief. Users can sign up, log in, create projects, manage project members, assign tasks, update statuses, and view progress dashboards with role-based access control.

## Features

- Authentication with secure password hashing and signed HTTP-only session cookies
- First registered user becomes `admin`; later users become `member`
- Admins can create projects, manage project teams, assign tasks, delete tasks, and change user roles
- Members can view assigned/team work and update only their own task status
- Dashboard with project count, task count, assigned work, overdue tasks, and status totals
- REST API with validations and project/task/user relationships
- File-backed NoSQL-style document database at `data/db.json`
- Zero runtime dependencies for fast Railway deployment

## Tech Stack

- Node.js HTTP server
- Vanilla HTML, CSS, and JavaScript frontend
- JSON document database persisted on disk
- Railway deployment config included

## Local Setup

```bash
cd role-based-access
copy .env.example .env
node server/index.js
```

Open `http://localhost:3000`.

The first signup is automatically created as an Admin. Use a different browser, private window, or logout/signup flow to create Member accounts.

## Railway Deployment

1. Push this folder to GitHub.
2. Create a new Railway project from the GitHub repo.
3. In the Railway service, add a volume mounted at `/data`.
4. Add these environment variables:

```bash
SESSION_SECRET=your-long-random-production-secret
NODE_ENV=production
DATA_FILE=/data/db.json
```

Railway will use `node server/index.js` from `railway.json` / `Procfile`.

The `/api/health` endpoint can be used as a quick production check after deployment.

## REST API

| Method | Endpoint | Role | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | Public | Create account |
| POST | `/api/auth/login` | Public | Login |
| POST | `/api/auth/logout` | User | Logout |
| GET | `/api/auth/me` | User | Current user |
| GET | `/api/dashboard` | User | Dashboard metrics |
| GET | `/api/users` | User/Admin | Current user or all users |
| PATCH | `/api/users/:id/role` | Admin | Change role |
| GET | `/api/projects` | User | Visible projects |
| POST | `/api/projects` | Admin | Create project |
| PATCH | `/api/projects/:id` | Admin | Update project/team |
| DELETE | `/api/projects/:id` | Admin | Delete project and tasks |
| GET | `/api/tasks` | User | Visible tasks |
| POST | `/api/tasks` | Admin | Create task |
| PATCH | `/api/tasks/:id` | User/Admin | Update status or admin fields |
| DELETE | `/api/tasks/:id` | Admin | Delete task |

## Demo Video Checklist

- Signup first user as Admin
- Create one or two Member accounts
- Create a project and add members
- Assign tasks with due dates
- Login as Member and update task status
- Show dashboard counts, overdue/status sections, and Admin-only controls
- Open the deployed Railway URL
