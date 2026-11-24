import axios from "axios";

// Frontend i API powinny dzialac pod jednym adresem (Nginx: /api/).
const API_URL = import.meta.env.VITE_API_URL || "/api/";
const baseURL = API_URL.endsWith("/") ? API_URL : `${API_URL}/`;
const SIGNED_OUT_KEY = "flotivo_signed_out";
const SESSION_EXPIRED_EVENT = "flotivo:session-expired";

const apiClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
});

// Osobny klient zapobiega zapetleniu interceptorow podczas odnawiania.
const authClient = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true,
});

let accessToken = null;
let sessionVersion = 0;
let refreshPromise = null;

const publicEndpoints = [
  "auth/token/",
  "auth/token/refresh/",
  "auth/token/blacklist/",
  "auth/csrf/",
  "contact/",
];

function isPublicEndpoint(url = "") {
  const path = String(url).replace(/^\/+/, "");
  return publicEndpoints.some(
    (endpoint) => path === endpoint || path.endsWith(`/${endpoint}`),
  );
}

function removeLegacyTokens() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

// Serializuje operacje na rotowanym cookie miedzy kartami tej samej witryny.
async function withCookieLock(operation) {
  if (navigator.locks?.request) {
    return navigator.locks.request("flotivo-refresh-cookie", operation);
  }
  return operation();
}

// Migracja ze starszej wersji Flotivo: nie przejmujemy starych tokenow.
removeLegacyTokens();

export function wasExplicitlySignedOut() {
  return localStorage.getItem(SIGNED_OUT_KEY) === "1";
}

export function clearAccessToken() {
  sessionVersion += 1;
  accessToken = null;
  removeLegacyTokens();
}

export function setAuthenticatedSession(token) {
  if (!token) {
    throw new Error("Brak access tokenu.");
  }

  sessionVersion += 1;
  accessToken = token;
  localStorage.removeItem(SIGNED_OUT_KEY);
  removeLegacyTokens();
}

function readCookie(name) {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

export async function getCsrfToken() {
  await authClient.get("auth/csrf/");
  const token = readCookie("csrftoken");

  if (!token) {
    throw new Error("Nie udało się pobrać tokenu CSRF.");
  }

  return token;
}

export async function refreshAccessToken() {
  if (wasExplicitlySignedOut()) {
    throw new Error("Sesja została wylogowana.");
  }

  if (refreshPromise) return refreshPromise;

  const requestVersion = sessionVersion;

  refreshPromise = withCookieLock(async () => {
    if (requestVersion !== sessionVersion || wasExplicitlySignedOut()) {
      throw new Error("Sesja została zakończona.");
    }

    const csrfToken = await getCsrfToken();
    const response = await authClient.post(
      "auth/token/refresh/",
      {},
      { headers: { "X-CSRFToken": csrfToken } },
    );

    if (requestVersion !== sessionVersion || wasExplicitlySignedOut()) {
      throw new Error("Sesja została zakończona.");
    }

    const token = response.data?.access;
    if (!token) throw new Error("Serwer nie zwrócił access tokenu.");

    // Token istnieje wylacznie w pamieci karty przegladarki.
    accessToken = token;
    return token;
  })
    .catch((error) => {
      const invalidSession =
        error.response?.status === 401 || error.response?.status === 403;

      if (
        invalidSession &&
        requestVersion === sessionVersion &&
        !wasExplicitlySignedOut()
      ) {
        clearAccessToken();
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }

      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function logoutSession() {
  // Blokujemy odtwarzanie sesji takze po ponownym otwarciu karty.
  const pendingRefresh = refreshPromise;
  clearAccessToken();
  localStorage.setItem(SIGNED_OUT_KEY, "1");

  // Zapobiega pozostawieniu cookie rotowanego przez wczesniejsze zadanie.
  if (pendingRefresh) {
    await pendingRefresh.catch(() => {});
  }

  await withCookieLock(async () => {
    const csrfToken = await getCsrfToken();
    await authClient.post(
      "auth/token/blacklist/",
      {},
      { headers: { "X-CSRFToken": csrfToken } },
    );
  });
}

apiClient.interceptors.request.use((config) => {
  config._flotivoSessionVersion = sessionVersion;

  if (accessToken && !isPublicEndpoint(config.url)) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (
      !original ||
      error.response?.status !== 401 ||
      isPublicEndpoint(original.url) ||
      original._retry ||
      wasExplicitlySignedOut() ||
      original._flotivoSessionVersion !== sessionVersion
    ) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      const token = await refreshAccessToken();
      original.headers = original.headers || {};
      original.headers.Authorization = `Bearer ${token}`;
      return apiClient(original);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
