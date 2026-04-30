function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requireString(body, field, min = 1, max = 120) {
  const value = cleanString(body[field]);
  if (value.length < min) return `${field} must be at least ${min} character${min === 1 ? "" : "s"}.`;
  if (value.length > max) return `${field} must be ${max} characters or fewer.`;
  return null;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime());
}

function normalizeIdArray(value) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === "string"))] : [];
}

module.exports = {
  cleanString,
  requireString,
  validateEmail,
  isValidDate,
  normalizeIdArray
};
