import axios from "axios";
import { API_URL } from "./urls";

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
    timeout: 30000,
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
