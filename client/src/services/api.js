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
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;