import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { getMeMergedWithRoleProfile } from "../api/services";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Login.css";

const INITIAL_SIGNIN = { email: "", password: "" };
const INITIAL_SIGNUP = { fullName: "", email: "", phoneNumber: "", password: "", confirmPassword: "", accountType: "Customer" };

export default function Login() {
  const { t } = useTranslation("login");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState(searchParams.get("tab") === "signup" ? "signup" : "signin");
  const [signIn, setSignIn] = useState(INITIAL_SIGNIN);
  const [signUp, setSignUp] = useState(INITIAL_SIGNUP);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState({ si: false, su: false, suC: false });

  useEffect(() => {
    const requestedTab = searchParams.get("tab");
    if (requestedTab === "signup") {
      setTab("signup");
    } else if (requestedTab === "signin" || !requestedTab) {
      setTab("signin");
    }
  }, [searchParams]);

  const togglePw = (field) => setShowPw((p) => ({ ...p, [field]: !p[field] }));

  // hasProfile comes from GET /api/Auth/me — use it as the single source of truth.
  // Falls back to localStorage flags so existing sessions still work.
  const redirectByRole = React.useCallback((role, hasProfile) => {
    if (role === "Customer") {
      const settled = hasProfile ?? !!localStorage.getItem("preferredLanguage");
      navigate(settled ? "/search" : "/customer/setup", { replace: true });
    } else if (role === "Provider") {
      const settled = hasProfile ?? !!localStorage.getItem("providerProfileDone");
      navigate(settled ? "/provider/dashboard" : "/provider/setup", { replace: true });
    } else if (role === "Admin") {
      navigate("/admin", { replace: true });
    } else {
      navigate("/search", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (user) redirectByRole(user.role, user.hasProfile);
  }, [user, redirectByRole]);

  useEffect(() => {
    setError("");
    setErrors({});
    // Clear signup form every time the tab is opened so browser-filled values don't linger
    if (tab === "signup") setSignUp(INITIAL_SIGNUP);
  }, [tab]);

  // ── Sign-in ────────────────────────────────────────────────────────────
  const validateSignIn = () => {
    const e = {};
    const v = "validation";
    if (!signIn.email.trim()) e.email = t(`${v}.emailRequired`);
    if (!signIn.password.trim()) e.password = t(`${v}.passwordRequired`);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignIn = async (ev) => {
    ev.preventDefault();
    if (!validateSignIn()) return;
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/api/Auth/login", {
        email: signIn.email,
        password: signIn.password,
      });
      localStorage.setItem("token", data.token);
      const userData = await getMeMergedWithRoleProfile();
      login(data.token, userData);
      showToast(t("welcomeBackToast"), "success");
      redirectByRole(userData.role, userData.hasProfile);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  // ── Sign-up ────────────────────────────────────────────────────────────
  const validateSignUp = () => {
    const e = {};
    const v = "validation";
    if (!signUp.fullName.trim()) e.fullName = t(`${v}.fullNameRequired`);
    if (!signUp.email.trim()) e.email = t(`${v}.emailRequired`);
    else if (!/\S+@\S+\.\S+/.test(signUp.email)) e.email = t(`${v}.emailInvalid`);
    if (!signUp.phoneNumber.trim()) e.phoneNumber = t(`${v}.phoneRequired`);
    else if (!/^\+?[\d\s\-()]{7,15}$/.test(signUp.phoneNumber.trim()))
      e.phoneNumber = t(`${v}.phoneInvalid`);
    if (!signUp.password.trim()) e.password = t(`${v}.passwordRequired`);
    else if (signUp.password.length < 8) e.password = t(`${v}.passwordMin`);
    if (signUp.password !== signUp.confirmPassword) e.confirmPassword = t(`${v}.passwordMismatch`);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignUp = async (ev) => {
    ev.preventDefault();
    if (!validateSignUp()) return;
    setLoading(true); setError("");
    try {
      await api.post("/api/Auth/register", {
        fullName: signUp.fullName,
        email: signUp.email,
        phoneNumber: signUp.phoneNumber,
        password: signUp.password,
        accountType: signUp.accountType,
      });
      showToast(t("accountCreatedToast"), "success");
      setTab("signin");
      setSignIn((p) => ({ ...p, email: signUp.email }));
      setSignUp(INITIAL_SIGNUP);
    } catch (err) {
      setError(err.response?.data?.message || err.message || t("registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  const changeSignIn = (e) => {
    const { name, value } = e.target;
    setSignIn((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const changeSignUp = (e) => {
    const { name, value } = e.target;
    setSignUp((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  return (
    <div className="login-page page-wrapper">
      <div className="login-page__bg" aria-hidden />
      <div className="login-card card animate-fade-up">

        <Link to="/" className="login-logo">
          <span>K</span>hedma
        </Link>
        <p className="login-tagline">{t("tagline")}</p>

        <div className="tabs login-tabs">
          <button
            className={`tab-btn ${tab === "signin" ? "tab-btn--active" : ""}`}
            onClick={() => setTab("signin")}
          >
            {t("signInTab")}
          </button>
          <button
            className={`tab-btn ${tab === "signup" ? "tab-btn--active" : ""}`}
            onClick={() => setTab("signup")}
          >
            {t("createAccountTab")}
          </button>
        </div>

        {error && (
          <div className="alert alert--error">
            <i className="ri-error-warning-fill" />
            {error}
          </div>
        )}

        {tab === "signin" && (
          <form onSubmit={handleSignIn} noValidate className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="si-email">{t("emailLabel")}</label>
              <input
                id="si-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                value={signIn.email}
                onChange={changeSignIn}
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="si-password">{t("passwordLabel")}</label>
              <div className="pw-wrap">
                <input
                  id="si-password"
                  name="password"
                  type={showPw.si ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={signIn.password}
                  onChange={changeSignIn}
                />
                <button type="button" className="pw-toggle" onClick={() => togglePw("si")} tabIndex={-1}>
                  <i className={showPw.si ? "ri-eye-off-line" : "ri-eye-line"} />
                </button>
              </div>
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : <><i className="ri-login-box-line" /> {t("signInSubmit")}</>}
            </button>

            <p className="login-switch">
              {t("noAccount")}{" "}
              <button type="button" className="login-switch__link" onClick={() => setTab("signup")}>
                {t("createFree")}
              </button>
            </p>
          </form>
        )}

        {tab === "signup" && (
          <form onSubmit={handleSignUp} noValidate className="login-form">

            <div className="role-toggle">
              <button
                type="button"
                className={`role-btn ${signUp.accountType === "Customer" ? "active" : ""}`}
                onClick={() => setSignUp((p) => ({ ...p, accountType: "Customer" }))}
              >
                <i className="ri-user-line" /> {t("roleCustomer")}
              </button>
              <button
                type="button"
                className={`role-btn ${signUp.accountType === "Provider" ? "active" : ""}`}
                onClick={() => setSignUp((p) => ({ ...p, accountType: "Provider" }))}
              >
                <i className="ri-tools-line" /> {t("roleProvider")}
              </button>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="su-name">{t("fullNameLabel")} <span>*</span></label>
              <input
                id="su-name"
                name="fullName"
                type="text"
                autoComplete="off"
                placeholder={t("fullNamePlaceholder")}
                value={signUp.fullName}
                onChange={changeSignUp}
              />
              {errors.fullName && <span className="form-error">{errors.fullName}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="su-email">{t("emailAddressLabel")} <span>*</span></label>
              <input
                id="su-email"
                name="email"
                type="email"
                autoComplete="off"
                placeholder={t("emailPlaceholder")}
                value={signUp.email}
                onChange={changeSignUp}
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="su-phone">{t("phoneLabel")} <span>*</span></label>
              <input
                id="su-phone"
                name="phoneNumber"
                type="tel"
                autoComplete="off"
                placeholder={t("phonePlaceholder")}
                value={signUp.phoneNumber}
                onChange={changeSignUp}
              />
              {errors.phoneNumber && <span className="form-error">{errors.phoneNumber}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="su-pw">{t("passwordSignupLabel")} <span>*</span></label>
                <div className="pw-wrap">
                  <input
                    id="su-pw"
                    name="password"
                    type={showPw.su ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("passwordSignupPlaceholder")}
                    value={signUp.password}
                    onChange={changeSignUp}
                  />
                  <button type="button" className="pw-toggle" onClick={() => togglePw("su")} tabIndex={-1}>
                    <i className={showPw.su ? "ri-eye-off-line" : "ri-eye-line"} />
                  </button>
                </div>
                {errors.password && <span className="form-error">{errors.password}</span>}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="su-cpw">{t("confirmPasswordLabel")} <span>*</span></label>
                <div className="pw-wrap">
                  <input
                    id="su-cpw"
                    name="confirmPassword"
                    type={showPw.suC ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("confirmPasswordPlaceholder")}
                    value={signUp.confirmPassword}
                    onChange={changeSignUp}
                  />
                  <button type="button" className="pw-toggle" onClick={() => togglePw("suC")} tabIndex={-1}>
                    <i className={showPw.suC ? "ri-eye-off-line" : "ri-eye-line"} />
                  </button>
                </div>
                {errors.confirmPassword && <span className="form-error">{errors.confirmPassword}</span>}
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--full btn--lg" disabled={loading}>
              {loading ? <LoadingSpinner size="sm" /> : <><i className="ri-user-add-line" /> {t("createAccountSubmit")}</>}
            </button>

            <p className="login-switch">
              {t("haveAccount")}{" "}
              <button type="button" className="login-switch__link" onClick={() => setTab("signin")}>
                {t("signInLink")}
              </button>
            </p>

            <p className="login-terms">
              {t("termsPrefix")}{" "}
              <Link to="/terms">{t("termsLink")}</Link> {t("termsAnd")} <Link to="/privacy">{t("privacyLink")}</Link>.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
