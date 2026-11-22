import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import apiClient from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const clearUser = useCallback(() => {
    setUser(null);
    setLoadingUser(false);
  }, []);

  const loadUser = useCallback(async () => {
    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
      setUser(null);
      setLoadingUser(false);

      return null;
    }

    try {
      setLoadingUser(true);

      const response = await apiClient.get("auth/me/");

      setUser(response.data);

      return response.data;
    } catch (error) {
      console.error("Nie udało się pobrać danych użytkownika:", error);

      setUser(null);

      return null;
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const isOrganizationAdmin = useCallback(() => {
    return user?.role === "admin";
  }, [user]);

  const canEditCompany = useCallback(
    (companyId) => {
      if (!user) {
        return false;
      }

      if (user.role === "admin") {
        return true;
      }

      const company = user.companies?.find(
        (item) => Number(item.id) === Number(companyId),
      );

      return company?.role === "editor";
    },
    [user],
  );

  const canViewCompany = useCallback(
    (companyId) => {
      if (!user) {
        return false;
      }

      if (user.role === "admin") {
        return true;
      }

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
