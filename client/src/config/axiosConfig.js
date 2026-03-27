import axios from "axios";

const getBaseURL = () => {
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;
    }
    return "http://localhost:5000/api";
};

const api = axios.create({
    baseURL: getBaseURL(),
    withCredentials: true,
    timeout: 30000, // Increased to 30s to handle potential email service delays
});

// Add a request interceptor
api.interceptors.request.use(
    (config) => {
        console.log(`🚀 Request: ${config.method?.toUpperCase()} ${config.url}`);
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
        console.error(`❌ Response Error: ${error.response?.status || 'Network Error'} from ${error.config?.url}`);
        return Promise.reject(error);
    }
);

export default api;