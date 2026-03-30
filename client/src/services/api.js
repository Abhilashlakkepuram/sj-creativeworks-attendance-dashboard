// import axios from "axios";

// const getBaseURL = () => {
//   const envUrl = import.meta.env.VITE_API_URL;
//   if (envUrl) {
//     return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;
//   }
//   return "http://localhost:5000/api";
//   // return "https://sjcreativeworksdashboard.onrender.com/api";
// };

// const api = axios.create({
//   baseURL: getBaseURL()
// });

// api.interceptors.request.use((config) => {

//   const token = localStorage.getItem("token");

//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }

//   return config;

// });

// export default api;


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
  timeout: 45000, // 45s to handle Render cold starts
});

api.interceptors.request.use((config) => {
  const fullURL = config.baseURL ? `${config.baseURL}${config.url}` : config.url;
  console.log(`🚀 Request: ${config.method?.toUpperCase()} ${fullURL}`);
  const token = localStorage.getItem("token");

  if (token && token !== "null" && token !== "undefined") {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

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