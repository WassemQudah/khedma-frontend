import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

// `role` can be a single string or an array of strings.
export default function ProtectedRoute({ children, role }) {
  const { t } = useTranslation("common");
  const { user, authLoading } = useAuth();
  const { pathname } = useLocation();

  if (authLoading) return <LoadingSpinner fullPage text={t("authenticating")} />;
  if (!user) return <Navigate to="/login" replace />;

  // ── Profile-setup enforcement ──────────────────────────────────────────────
  // If the API says hasProfile is false, force the user through their setup
  // screen before they can access any other protected page.
  if (user.hasProfile === false) {
    if (user.role === "Customer" && pathname !== "/customer/setup") {
      return <Navigate to="/customer/setup" replace />;
    }
    if (user.role === "Provider" && pathname !== "/provider/setup") {
      return <Navigate to="/provider/setup" replace />;
    }
  }

  if (role) {
    const allowed = Array.isArray(role) ? role : [role];
    if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  }

  return children;
}
