# Team Task Manager

Team Task Manager is a full-stack web application for managing team projects, assigning tasks, and tracking work progress with role-based access control.

## Live Demo

Live URL:

```text
https://web-production-4842.up.railway.app
```

Health check:

```text
https://web-production-4842.up.railway.app/api/health
```

## Features

- User signup and login
- First registered user becomes Admin
- Later registered users become Members
- Admin can create projects
- Admin can assign tasks to project members
- Admin can manage user roles
- Members can view assigned/team tasks
- Members can update their own task status
- Dashboard shows projects, tasks, assigned tasks, overdue tasks, and task status counts
- REST API backend
- Database storage using a JSON document database
- Railway deployment support

## User Roles

### Admin

Admin can:

- Create projects
- Assign tasks
- Add users to project teams
- Change user roles
- Delete tasks
- View dashboard and progress

### Member

Member can:

- Login
- View assigned/team tasks
- Update their own task status
- View dashboard

Member cannot create projects, assign tasks, delete tasks, or change roles.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js
- API: REST APIs
- Database: JSON file database
- Authentication: Signed HTTP-only session cookies
- Deployment: Railway with Docker

## Project Structure

```text
role-based-access/
  public/
    index.html        Frontend page structure
    styles.css        App styling
    app.js            Frontend logic and API calls
  server/
    index.js          Main backend server and API routes
    auth.js           Password hashing and session handling
    db.js             Database read/write helpers
    validation.js     Input validation helpers
  data/
    .gitkeep          Keeps data folder in Git
  Dockerfile          Docker deployment setup
  railway.json        Railway configuration
  Procfile            Railway start command fallback
  package.json        Project scripts and metadata
  README.md           Project documentation
```

## How The App Works

The user first signs up and then logs in.

The first account created becomes Admin. Admin creates projects and assigns tasks to members.

Members login and update the status of their assigned tasks.

The dashboard shows task progress, overdue work, and recently updated tasks.

Basic flow:

```text
Signup -> Login -> Create Project -> Assign Task -> Update Status -> Track Dashboard
```

## Demo Flow

Use this flow for a 2-5 minute demo video.

### 1. Signup as Admin

```text
Name: Aditya Admin
Email: admin@test.com
Password: Admin@123
```

The first signup becomes Admin.

### 2. Login as Admin

```text
Email: admin@test.com
Password: Admin@123
```

### 3. Create a Project

Go to Projects and create:

```text
Project name: Website Redesign
Description: Team project for improving the company website
```

### 4. Signup as Member

Logout and signup:

```text
Name: Rahul Member
Email: member@test.com
Password: Member@123
```

### 5. Login Again as Admin

```text
Email: admin@test.com
Password: Admin@123
```

### 6. Assign Tasks

Go to Tasks and create:

```text
Task title: Build login page
Project: Website Redesign
Assignee: Rahul Member
Due date: Tomorrow
Description: Create signup and login screens with validation
```

Create another task:

```text
Task title: Prepare dashboard
Project: Website Redesign
Assignee: Rahul Member
Due date: Yesterday
Description: Show task status, assigned tasks, and overdue count
```

The second task demonstrates overdue tracking.

### 7. Login as Member

```text
Email: member@test.com
Password: Member@123
```

Go to Tasks and update task status:

```text
Build login page -> In progress
Prepare dashboard -> Done
```

### 8. Show Dashboard

Show:

- Total projects
- Total tasks
- Assigned tasks
- Overdue tasks
- Task status counts
- Recently updated tasks

## Local Setup

Clone the repository and run:

```powershell
cd role-based-access
node server/index.js
```

Open:

```text
http://localhost:3000
```

## Reset Local Data

If you want a fresh start locally, delete:

```text
data/db.json
```

The app will create a new database automatically when it starts.

After reset, the next signup becomes Admin.

## Environment Variables

For production, use:

```text
SESSION_SECRET=your-long-random-secret
NODE_ENV=production
DATA_FILE=/data/db.json
```

## Railway Deployment

1. Push the project to GitHub.
2. Open Railway.
3. Create a new project.
4. Select Deploy from GitHub repo.
5. Choose this repository.
6. Add environment variables:

```text
SESSION_SECRET=your-long-random-secret
NODE_ENV=production
DATA_FILE=/data/db.json
```

7. Deploy the app.
8. Open the Railway domain.
9. Test:

```text
/api/health
```

Example:

```text
https://web-production-4842.up.railway.app/api/health
```

## API Endpoints

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Checks if app is running |
| POST | `/api/auth/signup` | Public | Creates a new user |
| POST | `/api/auth/login` | Public | Logs in user |
| POST | `/api/auth/logout` | User | Logs out user |
| GET | `/api/auth/me` | User | Gets current logged-in user |
| GET | `/api/dashboard` | User | Gets dashboard data |
| GET | `/api/users` | User/Admin | Gets users |
| PATCH | `/api/users/:id/role` | Admin | Changes user role |
| GET | `/api/projects` | User | Gets visible projects |
| POST | `/api/projects` | Admin | Creates a project |
| PATCH | `/api/projects/:id` | Admin | Updates project/team |
| DELETE | `/api/projects/:id` | Admin | Deletes project |
| GET | `/api/tasks` | User | Gets visible tasks |
| POST | `/api/tasks` | Admin | Creates task |
| PATCH | `/api/tasks/:id` | User/Admin | Updates task |
| DELETE | `/api/tasks/:id` | Admin | Deletes task |

## Assignment Coverage

This project covers:

- Authentication
- Signup/Login
- Role-based access control
- Admin and Member roles
- Project management
- Team management
- Task creation
- Task assignment
- Task status tracking
- Dashboard
- Overdue task tracking
- REST APIs
- Database relationships
- Railway deployment

## Short Explanation

This app lets an Admin create projects and assign tasks to team Members. Members can login and update their task status. The dashboard tracks total tasks, assigned tasks, overdue tasks, and progress by status. The backend provides REST APIs, validates data, checks user roles, and stores data in a database file.
