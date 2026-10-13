const EMPLOYEE_ROLES = ["developer", "seo", "designer", "marketing"];
const ALL_ROLES = [...EMPLOYEE_ROLES, "admin"];

const PASSWORD_MESSAGE =
  "Password must be at least 8 characters (at most 72 bytes) and include a lowercase letter, an uppercase letter, a number, and a special character (!@#$%^&*)";

const isStrongPassword = (password) => (
  typeof password === "string" &&
  password.length >= 8 &&
  Buffer.byteLength(password, "utf8") <= 72 &&
  !/\s/.test(password) &&
  /[a-z]/.test(password) &&
  /[A-Z]/.test(password) &&
  /\d/.test(password) &&
  /[!@#$%^&*]/.test(password)
);

const isValidEmail = (email) => (
  typeof email === "string" &&
  email.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
);

const normalizeEmail = (email) => (
  typeof email === "string" ? email.trim().toLowerCase() : ""
);

module.exports = {
  EMPLOYEE_ROLES,
  ALL_ROLES,
  PASSWORD_MESSAGE,
  isStrongPassword,
  isValidEmail,
  normalizeEmail,
};
