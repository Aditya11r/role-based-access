const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { readDb, updateDb } = require("./db");
const {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  createSession,
  verifySession,
  parseCookies,
  sessionCookie,
  clearSessionCookie
} = require("./auth");
const {
  cleanString,
  requireString,
  validateEmail,
  isValidDate,
  normalizeIdArray
} = require("./validation");

const PORT = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "..", "public");
const taskStatuses = ["todo", "in-progress", "blocked", "done"];

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function sendError(res, status, message, details) {
  sendJson(res, status, { error: message, details });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

function authenticate(req) {
  const cookies = parseCookies(req.headers.cookie);
  const session = verifySession(cookies[SESSION_COOKIE]);
  if (!session) return null;
  const db = readDb();
  const user = db.users.find((item) => item.id === session.sub);
  return user ? { user, db } : null;
}

function requireAuth(req, res) {
  const auth = authenticate(req);
  if (!auth) {
    sendError(res, 401, "Please log in to continue.");
    return null;
  }
  return auth;
}

function requireAdmin(req, res) {
  const auth = requireAuth(req, res);
  if (!auth) return null;
  if (auth.user.role !== "admin") {
    sendError(res, 403, "Only admins can perform this action.");
    return null;
  }
  return auth;
}

function canAccessProject(user, project) {
  return user.role === "admin" || project.memberIds.includes(user.id);
}

function canAccessTask(user, task, project) {
  return user.role === "admin" || task.assigneeId === user.id || project.memberIds.includes(user.id);
}

function enrichProject(project, db) {
  return {
    ...project,
    members: project.memberIds
      .map((id) => db.users.find((user) => user.id === id))
      .filter(Boolean)
      .map(publicUser),
    taskCount: db.tasks.filter((task) => task.projectId === project.id).length
  };
}

function enrichTask(task, db) {
  const project = db.projects.find((item) => item.id === task.projectId);
  const assignee = db.users.find((item) => item.id === task.assigneeId);
  return {
    ...task,
    project: project ? { id: project.id, name: project.name } : null,
    assignee: assignee ? publicUser(assignee) : null
  };
}

function visibleProjects(user, db) {
  return db.projects.filter((project) => canAccessProject(user, project));
}

function visibleTasks(user, db) {
  return db.tasks.filter((task) => {
    const project = db.projects.find((item) => item.id === task.projectId);
    return project && canAccessTask(user, task, project);
  });
}

function dashboardFor(user, db) {
  const tasks = visibleTasks(user, db);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = Object.fromEntries(taskStatuses.map((status) => [status, 0]));

  for (const task of tasks) {
    counts[task.status] += 1;
  }

  const overdue = tasks.filter((task) => {
    if (!task.dueDate || task.status === "done") return false;
    return new Date(`${task.dueDate}T00:00:00`) < today;
  });

  return {
    projects: visibleProjects(user, db).length,
    tasks: tasks.length,
    assignedToMe: db.tasks.filter((task) => task.assigneeId === user.id && task.status !== "done").length,
    overdue: overdue.length,
    status: counts,
    recentTasks: tasks
      .slice()
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 6)
      .map((task) => enrichTask(task, db))
  };
}

function parseRoute(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return {
    method: req.method,
    pathname: url.pathname,
    searchParams: url.searchParams,
    parts: url.pathname.split("/").filter(Boolean)
  };
}

async function handleApi(req, res) {
  const route = parseRoute(req);
  const { method, pathname, parts, searchParams } = route;

  if (method === "POST" && pathname === "/api/auth/signup") {
    const body = await readBody(req);
    const errors = [
      requireString(body, "name", 2, 80),
      requireString(body, "email", 5, 120),
      requireString(body, "password", 8, 120)
    ].filter(Boolean);
    const email = cleanString(body.email).toLowerCase();
    if (email && !validateEmail(email)) errors.push("email must be a valid email address.");
    if (errors.length) return sendError(res, 400, "Validation failed.", errors);

    const result = updateDb((db) => {
      if (db.users.some((user) => user.email === email)) {
        return { error: "An account with this email already exists." };
      }
      const now = new Date().toISOString();
      const user = {
        id: crypto.randomUUID(),
        name: cleanString(body.name),
        email,
        passwordHash: hashPassword(body.password),
        role: db.users.length === 0 ? "admin" : "member",
        createdAt: now,
        updatedAt: now
      };
      db.users.push(user);
      return { user };
    });

    if (result.error) return sendError(res, 409, result.error);
    return sendJson(res, 201, { user: publicUser(result.user) });
  }

  if (method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "team-task-manager",
      time: new Date().toISOString()
    });
  }

  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = cleanString(body.email).toLowerCase();
    const db = readDb();
    const user = db.users.find((item) => item.email === email);
    if (!user || !verifyPassword(body.password || "", user.passwordHash)) {
      return sendError(res, 401, "Invalid email or password.");
    }
    return sendJson(res, 200, { user: publicUser(user) }, { "Set-Cookie": sessionCookie(createSession(user)) });
  }

  if (method === "POST" && pathname === "/api/auth/logout") {
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  }

  if (method === "GET" && pathname === "/api/auth/me") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    return sendJson(res, 200, { user: publicUser(auth.user) });
  }

  if (method === "GET" && pathname === "/api/dashboard") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    return sendJson(res, 200, { dashboard: dashboardFor(auth.user, auth.db) });
  }

  if (method === "GET" && pathname === "/api/users") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const users = auth.user.role === "admin"
      ? auth.db.users
      : auth.db.users.filter((user) => user.id === auth.user.id);
    return sendJson(res, 200, { users: users.map(publicUser) });
  }

  if (method === "PATCH" && parts[0] === "api" && parts[1] === "users" && parts[3] === "role") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    const nextRole = cleanString(body.role);
    if (!["admin", "member"].includes(nextRole)) return sendError(res, 400, "role must be admin or member.");

    const result = updateDb((db) => {
      const target = db.users.find((user) => user.id === parts[2]);
      if (!target) return { error: "User not found.", status: 404 };
      const adminCount = db.users.filter((user) => user.role === "admin").length;
      if (target.id === auth.user.id && nextRole === "member" && adminCount === 1) {
        return { error: "At least one admin is required.", status: 400 };
      }
      target.role = nextRole;
      target.updatedAt = new Date().toISOString();
      return { user: target };
    });

    if (result.error) return sendError(res, result.status, result.error);
    return sendJson(res, 200, { user: publicUser(result.user) });
  }

  if (method === "GET" && pathname === "/api/projects") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const projects = visibleProjects(auth.user, auth.db).map((project) => enrichProject(project, auth.db));
    return sendJson(res, 200, { projects });
  }

  if (method === "POST" && pathname === "/api/projects") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    const errors = [
      requireString(body, "name", 2, 100)
    ].filter(Boolean);
    if (errors.length) return sendError(res, 400, "Validation failed.", errors);

    const result = updateDb((db) => {
      const memberIds = normalizeIdArray(body.memberIds);
      const knownMemberIds = memberIds.filter((id) => db.users.some((user) => user.id === id));
      if (!knownMemberIds.includes(auth.user.id)) knownMemberIds.unshift(auth.user.id);
      const now = new Date().toISOString();
      const project = {
        id: crypto.randomUUID(),
        name: cleanString(body.name),
        description: cleanString(body.description).slice(0, 500),
        ownerId: auth.user.id,
        memberIds: knownMemberIds,
        createdAt: now,
        updatedAt: now
      };
      db.projects.push(project);
      return { project };
    });

    return sendJson(res, 201, { project: enrichProject(result.project, readDb()) });
  }

  if (parts[0] === "api" && parts[1] === "projects" && parts[2]) {
    const auth = method === "GET" ? requireAuth(req, res) : requireAdmin(req, res);
    if (!auth) return;
    const project = auth.db.projects.find((item) => item.id === parts[2]);
    if (!project) return sendError(res, 404, "Project not found.");
    if (method === "GET") {
      if (!canAccessProject(auth.user, project)) return sendError(res, 403, "You do not have access to this project.");
      return sendJson(res, 200, { project: enrichProject(project, auth.db) });
    }

    if (method === "PATCH") {
      const body = await readBody(req);
      const result = updateDb((db) => {
        const target = db.projects.find((item) => item.id === parts[2]);
        if (Object.hasOwn(body, "name")) {
          const error = requireString(body, "name", 2, 100);
          if (error) return { error, status: 400 };
          target.name = cleanString(body.name);
        }
        if (Object.hasOwn(body, "description")) target.description = cleanString(body.description).slice(0, 500);
        if (Object.hasOwn(body, "memberIds")) {
          const memberIds = normalizeIdArray(body.memberIds).filter((id) => db.users.some((user) => user.id === id));
          if (!memberIds.includes(target.ownerId)) memberIds.unshift(target.ownerId);
          target.memberIds = memberIds;
          db.tasks.forEach((task) => {
            if (task.projectId === target.id && !target.memberIds.includes(task.assigneeId)) {
              task.assigneeId = target.ownerId;
              task.updatedAt = new Date().toISOString();
            }
          });
        }
        target.updatedAt = new Date().toISOString();
        return { project: target };
      });
      if (result.error) return sendError(res, result.status, result.error);
      return sendJson(res, 200, { project: enrichProject(result.project, readDb()) });
    }

    if (method === "DELETE") {
      updateDb((db) => {
        db.projects = db.projects.filter((item) => item.id !== parts[2]);
        db.tasks = db.tasks.filter((task) => task.projectId !== parts[2]);
      });
      return sendJson(res, 200, { ok: true });
    }
  }

  if (method === "GET" && pathname === "/api/tasks") {
    const auth = requireAuth(req, res);
    if (!auth) return;
    let tasks = visibleTasks(auth.user, auth.db);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const mine = searchParams.get("mine");
    if (projectId) tasks = tasks.filter((task) => task.projectId === projectId);
    if (status) tasks = tasks.filter((task) => task.status === status);
    if (mine === "true") tasks = tasks.filter((task) => task.assigneeId === auth.user.id);
    tasks = tasks.slice().sort((a, b) => {
      const aDue = a.dueDate || "9999-99-99";
      const bDue = b.dueDate || "9999-99-99";
      return aDue.localeCompare(bDue) || new Date(b.updatedAt) - new Date(a.updatedAt);
    });
    return sendJson(res, 200, { tasks: tasks.map((task) => enrichTask(task, auth.db)) });
  }

  if (method === "POST" && pathname === "/api/tasks") {
    const auth = requireAdmin(req, res);
    if (!auth) return;
    const body = await readBody(req);
    const errors = [
      requireString(body, "title", 2, 120),
      requireString(body, "projectId", 1, 120),
      requireString(body, "assigneeId", 1, 120)
    ].filter(Boolean);
    if (!isValidDate(body.dueDate)) errors.push("dueDate must use YYYY-MM-DD format.");
    if (errors.length) return sendError(res, 400, "Validation failed.", errors);

    const result = updateDb((db) => {
      const project = db.projects.find((item) => item.id === body.projectId);
      if (!project) return { error: "Project not found.", status: 404 };
      if (!project.memberIds.includes(body.assigneeId)) return { error: "Assignee must be a member of the project.", status: 400 };
      const now = new Date().toISOString();
      const task = {
        id: crypto.randomUUID(),
        projectId: body.projectId,
        assigneeId: body.assigneeId,
        title: cleanString(body.title),
        description: cleanString(body.description).slice(0, 800),
        status: taskStatuses.includes(body.status) ? body.status : "todo",
        dueDate: cleanString(body.dueDate),
        createdAt: now,
        updatedAt: now
      };
      db.tasks.push(task);
      return { task };
    });

    if (result.error) return sendError(res, result.status, result.error);
    return sendJson(res, 201, { task: enrichTask(result.task, readDb()) });
  }

  if (parts[0] === "api" && parts[1] === "tasks" && parts[2]) {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const task = auth.db.tasks.find((item) => item.id === parts[2]);
    if (!task) return sendError(res, 404, "Task not found.");
    const project = auth.db.projects.find((item) => item.id === task.projectId);
    if (!project || !canAccessTask(auth.user, task, project)) return sendError(res, 403, "You do not have access to this task.");

    if (method === "PATCH") {
      const body = await readBody(req);
      const result = updateDb((db) => {
        const target = db.tasks.find((item) => item.id === parts[2]);
        const targetProject = db.projects.find((item) => item.id === target.projectId);
        const admin = auth.user.role === "admin";

        if (Object.hasOwn(body, "status")) {
          if (!taskStatuses.includes(body.status)) return { error: "Invalid task status.", status: 400 };
          target.status = body.status;
        }

        if (!admin) {
          const allowedKeys = ["status"];
          const blocked = Object.keys(body).filter((key) => !allowedKeys.includes(key));
          if (blocked.length) return { error: "Members can only update task status.", status: 403 };
          if (target.assigneeId !== auth.user.id) return { error: "Only the assignee can update this task.", status: 403 };
        } else {
          if (Object.hasOwn(body, "title")) {
            const error = requireString(body, "title", 2, 120);
            if (error) return { error, status: 400 };
            target.title = cleanString(body.title);
          }
          if (Object.hasOwn(body, "description")) target.description = cleanString(body.description).slice(0, 800);
          if (Object.hasOwn(body, "dueDate")) {
            if (!isValidDate(body.dueDate)) return { error: "dueDate must use YYYY-MM-DD format.", status: 400 };
            target.dueDate = cleanString(body.dueDate);
          }
          if (Object.hasOwn(body, "assigneeId")) {
            if (!targetProject.memberIds.includes(body.assigneeId)) {
              return { error: "Assignee must be a member of the project.", status: 400 };
            }
            target.assigneeId = body.assigneeId;
          }
        }

        target.updatedAt = new Date().toISOString();
        return { task: target };
      });

      if (result.error) return sendError(res, result.status, result.error);
      return sendJson(res, 200, { task: enrichTask(result.task, readDb()) });
    }

    if (method === "DELETE") {
      if (auth.user.role !== "admin") return sendError(res, 403, "Only admins can delete tasks.");
      updateDb((db) => {
        db.tasks = db.tasks.filter((item) => item.id !== parts[2]);
      });
      return sendJson(res, 200, { ok: true });
    }
  }

  sendError(res, 404, "API route not found.");
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let filePath = path.join(publicDir, url.pathname === "/" ? "index.html" : url.pathname);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, "index.html");
  }

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  };
  res.writeHead(200, {
    "Content-Type": types[ext] || "application/octet-stream"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    serveStatic(req, res);
  } catch (error) {
    sendError(res, 500, error.message || "Something went wrong.");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Team Task Manager running on http://localhost:${PORT}`);
});
