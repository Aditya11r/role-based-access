const state = {
  user: null,
  users: [],
  projects: [],
  tasks: [],
  dashboard: null
};

const statuses = {
  "todo": "To do",
  "in-progress": "In progress",
  "blocked": "Blocked",
  "done": "Done"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "same-origin",
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload.details) ? ` ${payload.details.join(" ")}` : "";
    throw new Error(`${payload.error || "Request failed."}${details}`);
  }
  return payload;
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function setAuthMode(mode) {
  const login = mode === "login";
  $("#loginPanel").hidden = !login;
  $("#signupPanel").hidden = login;
}

function updateShell() {
  const authed = Boolean(state.user);
  $("#authView").hidden = authed;
  $("#appView").hidden = !authed;

  if (!authed) return;
  $("#currentUserName").textContent = state.user.name;
  $("#currentUserRole").textContent = state.user.role;
  $$(".admin-only").forEach((item) => {
    item.hidden = state.user.role !== "admin";
  });
}

function switchView(id) {
  $$(".view").forEach((view) => view.classList.toggle("is-visible", view.id === id));
  $$(".nav-link").forEach((button) => button.classList.toggle("is-active", button.dataset.view === id));
}

function formatDate(date) {
  if (!date) return "No due date";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDashboard() {
  const dashboard = state.dashboard;
  if (!dashboard) return;
  const metrics = [
    ["Projects", dashboard.projects],
    ["Tasks", dashboard.tasks],
    ["Assigned to me", dashboard.assignedToMe],
    ["Overdue", dashboard.overdue]
  ];
  $("#metricGrid").innerHTML = metrics.map(([label, value]) => `
    <article class="metric">
      <strong>${value}</strong>
      <span>${label}</span>
    </article>
  `).join("");

  const max = Math.max(...Object.values(dashboard.status), 1);
  $("#statusBars").innerHTML = Object.entries(statuses).map(([key, label]) => {
    const value = dashboard.status[key] || 0;
    return `
      <div class="bar-row">
        <span>${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(value / max) * 100}%"></div></div>
        <strong>${value}</strong>
      </div>
    `;
  }).join("");

  $("#recentTasks").innerHTML = dashboard.recentTasks.length
    ? dashboard.recentTasks.map(taskMarkup).join("")
    : `<div class="empty">No tasks yet.</div>`;
}

function renderProjects() {
  $("#projectsList").innerHTML = state.projects.length
    ? state.projects.map((project) => `
      <article class="project-card">
        <header>
          <div>
            <h3>${escapeHtml(project.name)}</h3>
            <p class="subtle">${escapeHtml(project.description || "No description")}</p>
          </div>
          <span class="pill">${project.taskCount} tasks</span>
        </header>
        <p class="subtle">${project.members.map((member) => escapeHtml(member.name)).join(", ") || "No members"}</p>
      </article>
    `).join("")
    : `<div class="empty">No projects yet.</div>`;
}

function taskMarkup(task) {
  const canChange = state.user.role === "admin" || task.assigneeId === state.user.id;
  return `
    <article class="list-item">
      <header>
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p class="subtle">${escapeHtml(task.project?.name || "Unknown project")} - ${escapeHtml(task.assignee?.name || "Unassigned")}</p>
        </div>
        <span class="pill ${task.status}">${statuses[task.status]}</span>
      </header>
      ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
      <div class="row-actions">
        <span class="pill">${formatDate(task.dueDate)}</span>
        ${canChange ? `
          <select data-task-status="${task.id}" aria-label="Update task status">
            ${Object.entries(statuses).map(([value, label]) => `
              <option value="${value}" ${task.status === value ? "selected" : ""}>${label}</option>
            `).join("")}
          </select>
        ` : ""}
        ${state.user.role === "admin" ? `<button class="ghost" data-delete-task="${task.id}" type="button">Delete</button>` : ""}
      </div>
    </article>
  `;
}

function renderTasks() {
  $("#tasksList").innerHTML = state.tasks.length
    ? state.tasks.map(taskMarkup).join("")
    : `<div class="empty">No tasks match this view.</div>`;
}

function renderUsers() {
  $("#usersList").innerHTML = state.users.map((user) => `
    <article class="list-item">
      <header>
        <div>
          <h3>${escapeHtml(user.name)}</h3>
          <p class="subtle">${escapeHtml(user.email)}</p>
        </div>
        <span class="pill">${user.role}</span>
      </header>
      ${state.user.role === "admin" ? `
        <select data-role-user="${user.id}" aria-label="Change role">
          <option value="member" ${user.role === "member" ? "selected" : ""}>Member</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      ` : ""}
    </article>
  `).join("");
}

function renderTeamEditor() {
  $("#teamEditor").innerHTML = state.projects.length
    ? state.projects.map((project) => `
      <article class="list-item">
        <header>
          <h3>${escapeHtml(project.name)}</h3>
          <span class="pill">${project.members.length} members</span>
        </header>
        <div class="member-grid" data-project-members="${project.id}">
          ${state.users.map((user) => `
            <label>
              <input type="checkbox" value="${user.id}" ${project.memberIds.includes(user.id) ? "checked" : ""}>
              ${escapeHtml(user.name)}
            </label>
          `).join("")}
        </div>
      </article>
    `).join("")
    : `<div class="empty">Create a project to manage its team.</div>`;
}

function populateTaskForm() {
  const projectSelect = $("#taskForm select[name='projectId']");
  const assigneeSelect = $("#taskForm select[name='assigneeId']");
  const submitButton = $("#taskForm button[type='submit']");
  const hint = $("#taskFormHint");
  if (!projectSelect || !assigneeSelect) return;

  if (!state.projects.length) {
    projectSelect.innerHTML = `<option value="">Create a project first</option>`;
    assigneeSelect.innerHTML = `<option value="">No assignees yet</option>`;
    projectSelect.disabled = true;
    assigneeSelect.disabled = true;
    submitButton.disabled = true;
    hint.textContent = "Create a project in the Projects tab before assigning tasks.";
    return;
  }

  projectSelect.disabled = false;
  assigneeSelect.disabled = false;
  submitButton.disabled = false;
  hint.textContent = "";

  projectSelect.innerHTML = `<option value="">Project</option>${state.projects.map((project) => `
    <option value="${project.id}">${escapeHtml(project.name)}</option>
  `).join("")}`;

  const selectedProject = state.projects[0];
  if (selectedProject) projectSelect.value = selectedProject.id;
  populateAssignees();
}

function populateAssignees() {
  const projectId = $("#taskForm select[name='projectId']").value;
  const project = state.projects.find((item) => item.id === projectId);
  const assigneeSelect = $("#taskForm select[name='assigneeId']");
  const submitButton = $("#taskForm button[type='submit']");
  const hint = $("#taskFormHint");
  const members = project?.members || [];

  if (!project) {
    assigneeSelect.innerHTML = `<option value="">Select project first</option>`;
    submitButton.disabled = true;
    hint.textContent = "Select a project before assigning a task.";
    return;
  }

  if (!members.length) {
    assigneeSelect.innerHTML = `<option value="">No project members</option>`;
    submitButton.disabled = true;
    hint.textContent = "Add at least one member to this project before assigning tasks.";
    return;
  }

  submitButton.disabled = false;
  hint.textContent = "";
  assigneeSelect.innerHTML = `<option value="">Assignee</option>${members.map((member) => `
    <option value="${member.id}">${escapeHtml(member.name)}</option>
  `).join("")}`;
  if (members[0]) assigneeSelect.value = members[0].id;
}

function renderAll() {
  updateShell();
  if (!state.user) return;
  renderDashboard();
  renderProjects();
  renderTasks();
  renderUsers();
  renderTeamEditor();
  populateTaskForm();
}

async function loadData() {
  if (!state.user) return;
  const [dashboard, users, projects, tasks] = await Promise.all([
    api("/api/dashboard"),
    api("/api/users"),
    api("/api/projects"),
    api(`/api/tasks?status=${encodeURIComponent($("#statusFilter").value)}&mine=${$("#mineFilter").checked}`)
  ]);
  state.dashboard = dashboard.dashboard;
  state.users = users.users;
  state.projects = projects.projects;
  state.tasks = tasks.tasks;
  renderAll();
}

async function boot() {
  try {
    const payload = await api("/api/auth/me");
    state.user = payload.user;
    await loadData();
  } catch {
    state.user = null;
    setAuthMode("signup");
    updateShell();
  }
}

$("#goLogin").addEventListener("click", () => setAuthMode("login"));
$("#goSignup").addEventListener("click", () => setAuthMode("signup"));

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const payload = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(formData(form))
    });
    state.user = payload.user;
    form.reset();
    await loadData();
  } catch (error) {
    showToast(error.message);
  }
});

$("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const body = formData(form);
    await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(body)
    });
    form.reset();
    $("#loginForm input[name='email']").value = body.email;
    setAuthMode("login");
    showToast("Account created. Login to continue.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#logoutButton").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  state.user = null;
  updateShell();
});

$("#refreshButton").addEventListener("click", () => loadData().catch((error) => showToast(error.message)));

$$(".nav-link").forEach((button) => {
  button.addEventListener("click", () => switchView(button.dataset.view));
});

$("#projectForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  try {
    const body = formData(form);
    body.memberIds = state.users.map((user) => user.id);
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify(body)
    });
    form.reset();
    await loadData();
    showToast("Project created.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#taskForm select[name='projectId']").addEventListener("change", populateAssignees);

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const body = formData(form);
  if (!body.projectId) {
    showToast("Create and select a project before assigning a task.");
    switchView("projectsView");
    return;
  }
  if (!body.assigneeId) {
    showToast("Select an assignee before assigning a task.");
    return;
  }
  try {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify(body)
    });
    form.reset();
    await loadData();
    showToast("Task assigned.");
  } catch (error) {
    showToast(error.message);
  }
});

$("#statusFilter").addEventListener("change", () => loadData().catch((error) => showToast(error.message)));
$("#mineFilter").addEventListener("change", () => loadData().catch((error) => showToast(error.message)));

document.addEventListener("change", async (event) => {
  const statusTaskId = event.target.dataset.taskStatus;
  const roleUserId = event.target.dataset.roleUser;
  const membersProjectId = event.target.closest("[data-project-members]")?.dataset.projectMembers;

  try {
    if (statusTaskId) {
      await api(`/api/tasks/${statusTaskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: event.target.value })
      });
      await loadData();
      showToast("Task updated.");
    }

    if (roleUserId) {
      await api(`/api/users/${roleUserId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: event.target.value })
      });
      await loadData();
      showToast("Role updated.");
    }

    if (membersProjectId) {
      const box = event.target.closest("[data-project-members]");
      const memberIds = [...box.querySelectorAll("input:checked")].map((input) => input.value);
      const project = state.projects.find((item) => item.id === membersProjectId);
      await api(`/api/projects/${membersProjectId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: project.name,
          description: project.description,
          memberIds
        })
      });
      await loadData();
      showToast("Team updated.");
    }
  } catch (error) {
    showToast(error.message);
    await loadData();
  }
});

document.addEventListener("click", async (event) => {
  const taskId = event.target.dataset.deleteTask;
  if (!taskId) return;
  try {
    await api(`/api/tasks/${taskId}`, { method: "DELETE" });
    await loadData();
    showToast("Task deleted.");
  } catch (error) {
    showToast(error.message);
  }
});

boot();
