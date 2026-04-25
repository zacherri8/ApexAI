"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { getCurrentUser, loginRequest, updateProfileRequest } from "@/services/api";
import { UserProfileUpdate, UserResponse } from "@/types/api";

type AuthContextValue = {
  user: UserResponse | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  updateProfile: (payload: UserProfileUpdate) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const AUTH_TOKEN_KEY = "apexai_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = window.localStorage.getItem(AUTH_TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    setToken(storedToken);
    getCurrentUser(storedToken)
      .then(setUser)
      .catch(() => {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const response = await loginRequest({ username, password });
    window.localStorage.setItem(AUTH_TOKEN_KEY, response.access_token);
    setToken(response.access_token);
    const profile = await getCurrentUser(response.access_token);
    setUser(profile);
  }

  async function updateProfile(payload: UserProfileUpdate) {
    if (!token) {
      throw new Error("You need to be signed in to update your profile.");
    }

    const profile = await updateProfileRequest(payload, token);
    setUser(profile);
  }

  function logout() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, token, loading, login, updateProfile, logout }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
