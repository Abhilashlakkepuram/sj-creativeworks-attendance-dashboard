import { createContext, useContext, useState } from "react";

const AuthContext = createContext();

function decodeToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split("")
        .map(function (c) {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Token decoding error:", e);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem("token");
    if (stored && !decodeToken(stored)) {
      localStorage.removeItem("token");
      return null;
    }
    return stored;
  });

  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("token");
    return decodeToken(stored);
  });

  const login = (payload) => {
    // payload can be { token, role, name } or just token string
    const tokenValue = typeof payload === "string" ? payload : payload.token;
    const decoded = decodeToken(tokenValue);

    if (tokenValue && decoded) {
      localStorage.setItem("token", tokenValue);
      setToken(tokenValue);
      // Merge decoded with any explicit payload data if needed, but decoded is primary
      setUser({ ...decoded, ...payload });
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  // Derived role for convenience
  const role = user?.role || null;

  return (
    <AuthContext.Provider value={{ token, user, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);