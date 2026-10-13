const roleHome = (role) => (role === "admin" ? "/admin/dashboard" : "/employee/dashboard");

const fallbackLink = (type, role) => {
  if (type === "chat") return role === "admin" ? "/admin/chat" : "/employee/chat";
  if (type === "attendance") return role === "admin" ? "/admin/attendance" : "/employee/attendance";
  if (type === "leave") return role === "admin" ? "/admin/leaves" : "/employee/leaves";
  if (type === "registration") return role === "admin" ? "/admin/employees" : roleHome(role);
  if (type === "announcement") return roleHome(role);
  return roleHome(role);
};

export const getNotificationTarget = (notification, role) => {
  const fallback = fallbackLink(notification?.type, role);
  const link = typeof notification?.link === "string" ? notification.link : "";

  if (!link.startsWith("/")) return fallback;
  if (role === "admin" && link.startsWith("/employee/")) return fallback;
  if (role !== "admin" && link.startsWith("/admin/")) return fallback;
  return link;
};
