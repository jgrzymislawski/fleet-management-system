import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import apiClient, {
  clearAccessToken,
  refreshAccessToken,
  wasExplicitlySignedOut,
} from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const requestIdRef = useRef(0);

  const clearUser = useCallback(() => {
    requestIdRef.current += 1;
    setUser(null);
    setLoadingUser(false);
  }, []);

  const loadUser = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoadingUser(true);

    try {
      const response = await apiClient.get("auth/me/");

      if (requestId !== requestIdRef.current) return null;

      setUser(response.data);
      return response.data;
    } catch {
      if (requestId === requestIdRef.current) {
        setUser(null);
      }
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingUser(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      if (wasExplicitlySignedOut()) {
        clearUser();
        return;
      }

      try {
        await refreshAccessToken();
        if (!active) return;
        await loadUser();
      } catch {
        if (active) clearUser();
      }
    };

    const onSessionExpired = () => {
      clearUser();
    };

    const onStorage = (event) => {
      if (event.key === "flotivo_signed_out" && event.newValue === "1") {
        clearAccessToken();
        clearUser();
      }
    };

    window.addEventListener("flotivo:session-expired", onSessionExpired);
    window.addEventListener("storage", onStorage);
    void restoreSession();

    return () => {
      active = false;
      requestIdRef.current += 1;
      window.removeEventListener("flotivo:session-expired", onSessionExpired);
      window.removeEventListener("storage", onStorage);
    };
  }, [clearUser, loadUser]);

  const isOrganizationAdmin = useCallback(() => user?.role === "admin", [user]);

  const canEditCompany = useCallback(
    (companyId) => {
      if (!user) return false;
      if (user.role === "admin") return true;

      const company = user.companies?.find(
        (item) => Number(item.id) === Number(companyId),
      );

      return company?.role === "editor";
    },
    [user],
  );

  const canViewCompany = useCallback(
    (companyId) => {
      if (!user) return false;
      if (user.role === "admin") return true;

      return Boolean(
        user.companies?.some((item) => Number(item.id) === Number(companyId)),
      );
    },
    [user],
  );

  const contextValue = useMemo(
    () => ({
      user,
      loadingUser,
      loadUser,
      clearUser,
      isOrganizationAdmin,
      canEditCompany,
      canViewCompany,
    }),
    [
      user,
      loadingUser,
      loadUser,
      clearUser,
      isOrganizationAdmin,
      canEditCompany,
      canViewCompany,
    ],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth musi być używane wewnątrz AuthProvider.");
  }
  return context;
}
