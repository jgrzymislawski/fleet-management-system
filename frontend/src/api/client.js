import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api/";

const normalizedApiUrl = API_URL.endsWith("/") ? API_URL : `${API_URL}/`;

const apiClient = axios.create({
  baseURL: normalizedApiUrl,
  timeout: 15000,
  withCredentials: true,
});

const authClient = axios.create({
  baseURL: normalizedApiUrl,
  timeout: 15000,
  withCredentials: true,
});

const publicEndpoints = [
  "auth/token/",
  "auth/token/refresh/",
  "auth/token/blacklist/",
  "auth/csrf/",
  "contact/",
];

const normalizeUrl = (url = "") => String(url).replace(/^\/+/, "");

const isPublicEndpoint = (url = "") => {
  const normalized = normalizeUrl(url);

  return publicEndpoints.some(
    (endpoint) =>
      normalized === endpoint || normalized.endsWith(`/${endpoint}`),
  );
};

let sessionGeneration = 0;
let sessionEnded = false;
let refreshPromise = null;

const clearLocalTokens = () => {
  sessionGeneration += 1;

  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
};

const redirectToLogin = () => {
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
};

const readCookie = (name) => {
  const prefix = `${name}=`;

  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.substring(prefix.length));
};

export const getCsrfToken = async () => {
  await authClient.get("auth/csrf/");

  const token = readCookie("csrftoken");

  if (!token) {
    throw new Error("Nie udało się uzyskać tokenu CSRF.");
  }

  return token;
};

export const markSessionAuthenticated = () => {
  sessionEnded = false;

  // Usuwamy token z poprzedniej wersji logowania.
  localStorage.removeItem("refresh_token");
};

export const logoutSession = async () => {
  const pendingRefresh = refreshPromise;

  sessionEnded = true;
  clearLocalTokens();

  // Czekamy, az ewentualne odswiezanie sie zakonczy,
  // aby serwer nie ustawil nowego cookie po wylogowaniu.
  if (pendingRefresh) {
    await pendingRefresh.catch(() => {});
  }

  const csrfToken = await getCsrfToken();

  await authClient.post(
    "auth/token/blacklist/",
    {},
    {
      headers: {
        "X-CSRFToken": csrfToken,
      },
    },
  );
};

export const refreshAccessToken = async () => {
  if (sessionEnded) {
    throw new Error("Sesja została zakończona.");
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  const myGeneration = sessionGeneration;

  refreshPromise = (async () => {
    const csrfToken = await getCsrfToken();

    const response = await authClient.post(
      "auth/token/refresh/",
      {},
      {
        headers: {
          "X-CSRFToken": csrfToken,
        },
      },
    );

    if (myGeneration !== sessionGeneration || sessionEnded) {
      throw new Error("Sesja została zakończona.");
    }

    const accessToken = response.data?.access;

    if (!accessToken) {
      throw new Error("Serwer nie zwrócił access tokenu.");
    }

    localStorage.setItem("access_token", accessToken);

    localStorage.removeItem("refresh_token");

    return accessToken;
  })()
    .catch((error) => {
      if (myGeneration === sessionGeneration) {
        clearLocalTokens();
        redirectToLogin();
      }

      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
};

apiClient.interceptors.request.use(
  (config) => {
    config._sessionGeneration = sessionGeneration;

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

    if (
      isPublicEndpoint(originalRequest.url) ||
      originalRequest._retry ||
      sessionEnded ||
      originalRequest._sessionGeneration !== sessionGeneration
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const accessToken = await refreshAccessToken();

      originalRequest.headers = originalRequest.headers || {};

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
