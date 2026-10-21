import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const loadUser = async () => {
    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
      setUser(null);
      setLoadingUser(false);
      return;
    }

    try {
      const response = await api.get("/me/");
      setUser(response.data);
    } catch (error) {
      console.error("Nie udało się pobrać danych użytkownika:", error);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const clearUser = () => {
    setUser(null);
  };

  const isOrganizationAdmin = () => {
    return user?.role === "admin";
  };

  const canEditCompany = (companyId) => {
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
  };

  const canViewCompany = (companyId) => {
    if (!user) {
      return false;
    }

    if (user.role === "admin") {
      return true;
    }

    return user.companies?.some(
      (item) => Number(item.id) === Number(companyId),
    );
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loadingUser,
        loadUser,
        clearUser,
        isOrganizationAdmin,
        canEditCompany,
        canViewCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
