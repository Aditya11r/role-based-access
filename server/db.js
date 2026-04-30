const fs = require("fs");
const path = require("path");

const defaultData = {
  users: [],
  projects: [],
  tasks: []
};

const dataFile = path.resolve(process.env.DATA_FILE || path.join(__dirname, "..", "data", "db.json"));

function ensureDatabase() {
  const dir = path.dirname(dataFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2));
  }
}

function readDb() {
  ensureDatabase();
  const raw = fs.readFileSync(dataFile, "utf8");
  const parsed = raw.trim() ? JSON.parse(raw) : {};
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : []
  };
}

function writeDb(data) {
  ensureDatabase();
  const next = {
    users: data.users || [],
    projects: data.projects || [],
    tasks: data.tasks || []
  };
  const tempFile = `${dataFile}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(next, null, 2));
  fs.renameSync(tempFile, dataFile);
}

function updateDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

module.exports = {
  readDb,
  updateDb,
  dataFile
};
