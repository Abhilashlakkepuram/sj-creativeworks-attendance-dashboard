const LOCAL_API_URL = "http://localhost:5000/api";

// This Render URL already existed in the client configuration comments. It is
// retained only as the production fallback when no deployment variable exists.
const EXISTING_RENDER_API_URL = "https://sjcreativeworksdashboard.onrender.com/api";

const stripTrailingSlashes = (value) => value.replace(/\/+$/, "");

const stripApiSuffix = (value) => stripTrailingSlashes(value).replace(/\/api$/i, "");

const isLocalHost = () => {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
};

const defaultApiUrl = isLocalHost() ? LOCAL_API_URL : EXISTING_RENDER_API_URL;
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();

export const API_URL = stripTrailingSlashes(configuredApiUrl || defaultApiUrl);
export const API_ORIGIN = stripApiSuffix(API_URL);
export const SOCKET_URL = stripTrailingSlashes(
  stripApiSuffix(configuredSocketUrl || stripApiSuffix(configuredApiUrl || defaultApiUrl))
);

export const resolveAssetUrl = (assetPath) => {
  if (!assetPath) return "";
  if (/^https?:\/\//i.test(assetPath)) return assetPath;
  return `${API_ORIGIN}${assetPath.startsWith("/") ? assetPath : `/${assetPath}`}`;
};
