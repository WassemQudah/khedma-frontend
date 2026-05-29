import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import Landing         from "./pages/Landing";
import Login           from "./pages/Login";
import Search          from "./pages/Search";
import ProviderProfile from "./pages/ProviderProfile";
import Booking         from "./pages/Booking";
import CustomerDashboard  from "./pages/CustomerDashboard";
import CustomerSetup      from "./pages/CustomerSetup";
import Chat               from "./pages/Chat";
import Profile            from "./pages/Profile";
import ProviderSetup      from "./pages/ProviderSetup";
import ProviderDashboard  from "./pages/ProviderDashboard";
import AdminDashboard     from "./pages/AdminDashboard";
import Privacy         from "./pages/Privacy";
import Terms           from "./pages/Terms";
import NotFound        from "./pages/NotFound";
import ForgotPassword  from "./pages/ForgotPassword";

export default function App() {
  return (
    <>
      <Navbar />

      <Routes>
        {/* ── Public ────────────────────────────────────────────────────── */}
        <Route path="/"                   element={<Landing />} />
        <Route path="/login"              element={<Login />} />
        <Route path="/forgot-password"    element={<ForgotPassword />} />
        <Route path="/search" element={<Search />} />
        {/* /provider/setup and /provider/dashboard rank above /provider/:id
            because static segments score higher than dynamic ones in RR v6  */}
        <Route path="/provider/setup"
          element={
            <ProtectedRoute role="Provider">
              <ProviderSetup />
            </ProtectedRoute>
          }
        />
        <Route path="/provider/dashboard"
          element={
            <ProtectedRoute role="Provider">
              <ProviderDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/provider/:id" element={<ProviderProfile />} />
        <Route path="/privacy"      element={<Privacy />} />
        <Route path="/terms"        element={<Terms />} />

        {/* ── Customer ──────────────────────────────────────────────────── */}
        <Route path="/customer/setup"
          element={
            <ProtectedRoute role="Customer">
              <CustomerSetup />
            </ProtectedRoute>
          }
        />
        <Route path="/dashboard"
          element={
            <ProtectedRoute role="Customer">
              <CustomerDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/booking/:providerId"
          element={
            <ProtectedRoute role="Customer">
              <Booking />
            </ProtectedRoute>
          }
        />

        {/* ── Profile (any logged-in user) ──────────────────────────────── */}
        <Route path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* ── Chat (Customer & Provider) ────────────────────────────────── */}
        <Route path="/chat/:bookingId"
          element={
            <ProtectedRoute role={["Customer", "Provider"]}>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* ── Admin ─────────────────────────────────────────────────────── */}
        <Route path="/admin"
          element={
            <ProtectedRoute role="Admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* ── Fallback ──────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
