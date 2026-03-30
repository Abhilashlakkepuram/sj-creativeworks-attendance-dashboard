import axios from "axios";

const getBaseURL = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;
    }
    // Default to the live Render backend for production robustness
    return "https://sj-creativeworksdashboard.onrender.com/api";
};

const api = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
    timeout: 45000, // Increased to 45s to handle Render cold starts + email delays
});

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        const fullURL = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
        console.log(`🚀 Request: ${config.method?.toUpperCase()} ${fullURL}`);
        const token = localStorage.getItem("token");
        if (token && token !== "null" && token !== "undefined") {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        console.error("❌ Request Error:", error);
        return Promise.reject(error);
    }
);

// Add a response interceptor
api.interceptors.response.use(
    (response) => {
        console.log(`✅ Response: ${response.status} from ${response.config.url}`);
        return response;
    },
    (error) => {
        const status = error.response?.status || 'Network Error';
        const url = error.config?.url || 'unknown URL';
        const message = error.message || 'No additional error info';
        console.error(`❌ Response Error: ${status} (${message}) from ${url}`);

        if (!error.response) {
            console.warn("⚠️ This might be a CORS error, a timeout, or the server might be waking up from sleep.");
        }

        return Promise.reject(error);
    }
);

export default api;