import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const TOKEN_KEY = "intratest_access_token";

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common["Authorization"];
  }
};

export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// Initialise from storage so refresh keeps user logged in.
const _existing = getAuthToken();
if (_existing) {
  api.defaults.headers.common["Authorization"] = `Bearer ${_existing}`;
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      setAuthToken(null);
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
