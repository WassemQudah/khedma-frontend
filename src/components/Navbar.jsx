import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import LanguageSwitcher from "./LanguageSwitcher";
import "../styles/Navbar.css";

export default function Navbar() {
  const { t } = useTranslation("nav");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const closeMenus = () => {
    setMenuOpen(false);
    setDropdownOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const initials = user?.fullName
    ? user.fullName
        .trim()
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("")
    : (user?.email?.[0]?.toUpperCase() ?? "U");

  const avatarImg =
    user?.profileImageUrl ?? user?.imageUrl ?? user?.avatarUrl ?? null;

  const roleKey = `roles.${(user?.role ?? "Customer").toLowerCase()}`;

  const servicesLink = (
    <li>
      <Link
        to="/#services"
        className={
          location.pathname === "/" && location.hash === "#services"
            ? "active"
            : ""
        }
      >
        {t("services")}
      </Link>
    </li>
  );

  const guestLinks = (
    <>
      <li>
        <Link
          to="/#top"
          className={
            location.pathname === "/" && location.hash !== "#services"
              ? "active"
              : ""
          }
        >
          {t("home")}
        </Link>
      </li>
      <li>
        <Link
          to="/search"
          className={location.pathname === "/search" ? "active" : ""}
        >
          {t("browse")}
        </Link>
      </li>
      {servicesLink}
    </>
  );
  const customerLinks = (
    <>
      <li>
        <Link
          to="/search"
          className={location.pathname === "/search" ? "active" : ""}
        >
          {t("browse")}
        </Link>
      </li>
      <li>
        <Link
          to="/dashboard"
          className={location.pathname === "/dashboard" ? "active" : ""}
        >
          {t("myBookings")}
        </Link>
      </li>
    </>
  );
  const providerLinks = (
    <>
      <li>
        <Link
          to="/provider/dashboard"
          className={
            location.pathname.startsWith("/provider/dashboard") ? "active" : ""
          }
        >
          {t("myDashboard")}
        </Link>
      </li>
    </>
  );
  const adminLinks = (
    <>
      <li>
        <Link
          to="/admin"
          className={location.pathname === "/admin" ? "active" : ""}
        >
          {t("adminPanel")}
        </Link>
      </li>
    </>
  );

  const navLinks = !user
    ? guestLinks
    : user.role === "Customer"
      ? customerLinks
      : user.role === "Provider"
        ? providerLinks
        : user.role === "Admin"
          ? adminLinks
          : guestLinks;

  return (
    <nav className={`navbar ${scrolled ? "navbar--scrolled" : ""}`}>
      <div className="navbar__inner">
        <Link to="/" className="navbar__logo">
          <img src="/NoBgKhedma.png" alt="Khedma Logo" style={{ height: "52px", objectFit: "contain" }} />
        </Link>

        <button
          type="button"
          className={`navbar__hamburger ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen((p) => !p)}
          aria-label={t("toggleMenu")}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <ul
          className={`navbar__links ${menuOpen ? "open" : ""}`}
        >
          {navLinks}

          {/* Mobile-only extras */}
          <li className="navbar__mobile-divider" />
          <li className="navbar__mobile-extra">
            <LanguageSwitcher className="navbar__lang" />
          </li>
          <li className="navbar__mobile-divider" />
          {!user ? (
            <li className="navbar__mobile-extra">
              <div className="navbar__mobile-auth">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => { closeMenus(); navigate("/login"); }}
                >
                  {t("signIn")}
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => { closeMenus(); navigate("/login?tab=signup"); }}
                >
                  {t("getStarted")}
                </button>
              </div>
            </li>
          ) : (
            <>
              <li className="navbar__mobile-item">
                <div className="navbar__mobile-user">
                  <span className="navbar__avatar" style={{ width: 32, height: 32, fontSize: "0.72rem" }}>
                    {avatarImg ? (
                      <img src={avatarImg} alt="" className="navbar__avatar-img" />
                    ) : (
                      initials
                    )}
                  </span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.fullName ?? user.email}
                  </span>
                </div>
              </li>
              <li className="navbar__mobile-item">
                <Link
                  className="navbar__dropdown-item"
                  style={{ width: "100%", borderRadius: "var(--r-md)", padding: "0.65rem 1rem", fontSize: "0.875rem", marginBottom: "0.5rem" }}
                  to="/profile"
                  onClick={closeMenus}
                >
                  <i className="ri-user-line" /> {t("myProfile")}
                </Link>
                <button
                  type="button"
                  className="navbar__dropdown-item navbar__dropdown-item--danger"
                  style={{ width: "100%", borderRadius: "var(--r-md)", padding: "0.65rem 1rem", fontSize: "0.875rem" }}
                  onClick={() => { closeMenus(); handleLogout(); }}
                >
                  <i className="ri-logout-box-r-line" /> {t("signOut")}
                </button>
              </li>
            </>
          )}
        </ul>

        <LanguageSwitcher className="navbar__lang" />

        <div className="navbar__auth">
          {!user ? (
            <>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => navigate("/login")}
              >
                {t("signIn")}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => navigate("/login?tab=signup")}
              >
                {t("getStarted")}
              </button>
            </>
          ) : (
            <div className="navbar__user" ref={dropdownRef}>
              <button
                type="button"
                className="navbar__user-btn"
                onClick={() => setDropdownOpen((p) => !p)}
                aria-expanded={dropdownOpen}
              >
                <span className="navbar__avatar">
                  {avatarImg ? (
                    <img
                      src={avatarImg}
                      alt=""
                      className="navbar__avatar-img"
                    />
                  ) : (
                    initials
                  )}
                </span>
                <span className="navbar__username">
                  {user.fullName ?? user.email}
                </span>
                <i
                  className={`ri-arrow-down-s-line navbar__chevron ${dropdownOpen ? "open" : ""}`}
                />
              </button>

              {dropdownOpen && (
                <div className="navbar__dropdown">
                  <div className="navbar__dropdown-header">
                    <p className="navbar__dropdown-name">
                      {user.fullName ?? user.email}
                    </p>
                    {user.fullName && (
                      <p className="navbar__dropdown-email">{user.email}</p>
                    )}
                    <span
                      className={`badge badge--role badge--${(user.role ?? "customer").toLowerCase()}`}
                    >
                      {t(roleKey)}
                    </span>
                  </div>

                  <div className="navbar__dropdown-divider" />

                  <Link
                    className="navbar__dropdown-item"
                    to="/profile"
                    onClick={closeMenus}
                  >
                    <i className="ri-user-line" /> {t("myProfile")}
                  </Link>

                  {user.role === "Customer" && (
                    <Link
                      className="navbar__dropdown-item"
                      to="/dashboard"
                      onClick={closeMenus}
                    >
                      <i className="ri-calendar-check-line" />{" "}
                      {t("myBookings")}
                    </Link>
                  )}
                  {user.role === "Provider" && (
                    <Link
                      className="navbar__dropdown-item"
                      to="/provider/dashboard"
                      onClick={closeMenus}
                    >
                      <i className="ri-briefcase-line" />{" "}
                      {t("providerDashboard")}
                    </Link>
                  )}
                  {user.role === "Admin" && (
                    <Link
                      className="navbar__dropdown-item"
                      to="/admin"
                      onClick={closeMenus}
                    >
                      <i className="ri-shield-star-line" />{" "}
                      {t("adminPanel")}
                    </Link>
                  )}

                  <div className="navbar__dropdown-divider" />
                  <button
                    type="button"
                    className="navbar__dropdown-item navbar__dropdown-item--danger"
                    onClick={handleLogout}
                  >
                    <i className="ri-logout-box-r-line" /> {t("signOut")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
