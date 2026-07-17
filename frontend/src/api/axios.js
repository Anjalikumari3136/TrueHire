import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token from localStorage or sessionStorage to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("truehire_token") || sessionStorage.getItem("truehire_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
