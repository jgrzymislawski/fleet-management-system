import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api/";

const normalizedApiUrl = API_URL.endsWith("/") ? API_URL : `${API_URL}/`;

const apiClient = axios.create({
  baseURL: normalizedApiUrl,
  timeout: 15000,
});

const refreshClient = axios.create({
  baseURL: normalizedApiUrl,
  timeout: 15000,
});

const publicEndpoints = ["token/", "token/refresh/", "contact/"];

const normalizeUrl = (url = "") => {
  return String(url).replace(/^\/+/, "");
};

const isPublicEndpoint = (url = "") => {
  const normalizedUrl = normalizeUrl(url);

  return publicEndpoints.some(
    (endpoint) =>
      normalizedUrl === endpoint || normalizedUrl.endsWith(`/${endpoint}`),
  );
};

const clearTokens = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};

const redirectToLogin = () => {
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
};

let refreshPromise = null;

const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem("refresh_token");

  if (!refreshToken) {
    clearTokens();
    redirectToLogin();
    throw new Error("Brak tokenu odświeżającego.");
  }

  refreshPromise = refreshClient
    .post("token/refresh/", {
      refresh: refreshToken,
    })
    .then((response) => {
      const newAccessToken = response.data?.access;

      if (!newAccessToken) {
        throw new Error("Serwer nie zwrócił nowego tokenu dostępu.");
      }

      localStorage.setItem("access_token", newAccessToken);

      if (response.data?.refresh) {
        localStorage.setItem("refresh_token", response.data.refresh);
      }

      return newAccessToken;
    })
    .catch((error) => {
      clearTokens();
      redirectToLogin();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (token && !isPublicEndpoint(config.url)) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isPublicEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (originalRequest._retry) {
      clearTokens();
      redirectToLogin();

      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const newAccessToken = await refreshAccessToken();

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
