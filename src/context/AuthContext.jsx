/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { getMeMergedWithRoleProfile } from "../api/services";
import { BASE_URL, decodeJWT } from "../config/config";
import { mergeSessionWithFreshProfile } from "../utils/authProfileMerge";

const AuthContext = createContext(null);
const AUTH_USER_STORAGE_KEY = "authUser";

function toAbsoluteImageUrl(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return `${BASE_URL}${s}`;
  return `${BASE_URL}/${s}`;
}

function normalizeUser(payload, role) {
  const profileImageUrl = toAbsoluteImageUrl(
    payload?.profileImageUrl
    ?? payload?.ProfileImageUrl
    ?? payload?.imageUrl
    ?? payload?.ImageUrl
    ?? payload?.avatarUrl
    ?? payload?.AvatarUrl
  );

  return {
    ...payload,
    role: role ?? payload?.role,
    profileImageUrl,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Wrap in async so all setState calls happen inside a callback,
    // satisfying react-hooks/set-state-in-effect.
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        setAuthLoading(false);
        return;
      }

      const decoded = decodeJWT(token);
      if (!decoded) {
        localStorage.removeItem("token");
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        setAuthLoading(false);
        return;
      }

      const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          setUser(normalizeUser(parsed, decoded.role));
          setAuthLoading(false);
          void getMeMergedWithRoleProfile(parsed)
            .then((fresh) => {
              const merged = mergeSessionWithFreshProfile(parsed, fresh);
              setUser(normalizeUser(merged, decoded.role));
            })
            .catch(() => {});
          return;
        } catch {
          localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
      }

      try {
        const fresh = await getMeMergedWithRoleProfile();
        const merged = mergeSessionWithFreshProfile({}, fresh);
        setUser(normalizeUser(merged, decoded.role));
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();

    // Clear user state when the axios interceptor fires a 401 event
    const handleExpiry = () => {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      setUser(null);
    };
    window.addEventListener("auth:expired", handleExpiry);
    return () => window.removeEventListener("auth:expired", handleExpiry);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    setUser(null);
    window.location.href = "/";
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("token", token);
    const decoded = decodeJWT(token);
    const merged = mergeSessionWithFreshProfile({}, userData ?? {});
    const normalized = normalizeUser(merged, decoded?.role);
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(normalized));
    setUser(normalized);
  };

  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
      const timer = setInterval(() => {
        logout();
      }, 15 * 60 * 1000); // 15 minutes auto-logout
      return () => clearInterval(timer);
    } else {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, setUser, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
