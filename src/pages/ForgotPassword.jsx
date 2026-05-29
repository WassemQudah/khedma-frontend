import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { useToast } from "../components/Toast";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/Login.css";
import "../styles/ForgotPassword.css";

export default function ForgotPassword() {
  const { t } = useTranslation("forgotPassword");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState("request"); // "request" | "reset"

  // Step 1
  const [email, setEmail] = useState("");
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");

  // Step 2
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const digitRefs = Array.from({ length: 6 }, () => React.createRef());
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCPw, setShowCPw] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");

  // OTP helpers
  const handleDigit = (i, val) => {
    const char = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    setDigits(next);
    setResetError("");
    if (char && i < 5) digitRefs[i + 1].current?.focus();
  };
  const handleDigitKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      digitRefs[i - 1].current?.focus();
    }
  };
  const handleDigitPaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      digitRefs[5].current?.focus();
    }
    e.preventDefault();
  };
  const otpCode = digits.join("");

  // Step 1 — request code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setReqError(t("validation.emailRequired")); return; }
    if (!/\S+@\S+\.\S+/.test(trimmed)) { setReqError(t("validation.emailInvalid")); return; }
    setReqLoading(true); setReqError("");
    try {
      await api.post("/api/auth/forgot-password", { email: trimmed });
      setStep("reset");
    } catch (err) {
      setReqError(err.response?.data?.message || err.message || t("requestFailed"));
    } finally { setReqLoading(false); }
  };

  // Step 2 — reset password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) { setResetError(t("validation.codeLength")); return; }
    if (!newPassword) { setResetError(t("validation.passwordRequired")); return; }
    if (newPassword.length < 8) { setResetError(t("validation.passwordMin")); return; }
    if (newPassword !== confirmPassword) { setResetError(t("validation.passwordMismatch")); return; }
    setResetLoading(true); setResetError("");
    try {
      await api.post("/api/auth/reset-password", {
        email: email.trim(), token: otpCode, newPassword,
      });
      showToast(t("successToast"), "success");
      navigate("/login", { replace: true });
    } catch (err) {
      setResetError(err.response?.data?.message || err.message || t("resetFailed"));
    } finally { setResetLoading(false); }
  };

  const goBack = () => {
    setStep("request");
    setDigits(["", "", "", "", "", ""]);
    setNewPassword(""); setConfirmPassword(""); setResetError("");
  };

  return (
    <div className="login-page page-wrapper">
      <div className="login-page__bg" aria-hidden />
      <div className="login-card card animate-fade-up">

        <Link to="/" className="login-logo" style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}>
          <img src="/NoBgKhedma.png" alt="Khedma Logo" />
        </Link>

        {/* ── STEP 1: email ── */}
        {step === "request" && (
          <>
            <div className="fp-page-header">

              <h1 className="fp-page-title">{t("step1.title")}</h1>
              <p className="fp-page-desc">{t("step1.desc")}</p>
            </div>

            {reqError && (
              <div className="alert alert--error">
                <i className="ri-error-warning-fill" /> {reqError}
              </div>
            )}

            <form onSubmit={handleRequestCode} noValidate className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="fp-email">
                  {t("step1.emailLabel")}
                </label>
                <input
                  id="fp-email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("step1.emailPlaceholder")}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setReqError(""); }}
                />
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={reqLoading}
              >
                {reqLoading
                  ? <><LoadingSpinner size="sm" /> {t("step1.sending")}</>
                  : <><i className="ri-mail-send-line" /> {t("step1.sendCode")}</>
                }
              </button>

              <p className="login-switch">
                <Link to="/login" className="login-switch__link">
                  ← {t("backToLogin")}
                </Link>
              </p>
            </form>
          </>
        )}

        {/* ── STEP 2: code + new password ── */}
        {step === "reset" && (
          <>
            <div className="fp-page-header">
              <h1 className="fp-page-title">{t("step2.title")}</h1>
              <p className="fp-page-desc">
                {t("step2.sentTo")} <strong>{email}</strong>
              </p>
            </div>

            {resetError && (
              <div className="alert alert--error">
                <i className="ri-error-warning-fill" /> {resetError}
              </div>
            )}

            <form onSubmit={handleResetPassword} noValidate className="login-form">
              {/* OTP boxes */}
              <div className="form-group">
                <label className="form-label">{t("step2.codeLabel")}</label>
                <div className="fp-otp-row" onPaste={handleDigitPaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={digitRefs[i]}
                      id={`fp-otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigit(i, e.target.value)}
                      onKeyDown={(e) => handleDigitKey(i, e)}
                      className={`fp-otp-box ${d ? "fp-otp-box--filled" : ""}`}
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                    />
                  ))}
                </div>
                <span className="form-hint"><i className="ri-spam-2-line" /> {t("step2.codeHint")}</span>
              </div>

              {/* New password */}
              <div className="form-group">
                <label className="form-label" htmlFor="fp-pw">
                  {t("step2.newPasswordLabel")}
                </label>
                <div className="pw-wrap">
                  <input
                    id="fp-pw"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("step2.newPasswordPlaceholder")}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setResetError(""); }}
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                    <i className={showPw ? "ri-eye-off-line" : "ri-eye-line"} />
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="form-group">
                <label className="form-label" htmlFor="fp-cpw">
                  {t("step2.confirmPasswordLabel")}
                </label>
                <div className="pw-wrap">
                  <input
                    id="fp-cpw"
                    type={showCPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={t("step2.confirmPasswordPlaceholder")}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setResetError(""); }}
                  />
                  <button type="button" className="pw-toggle" onClick={() => setShowCPw(p => !p)} tabIndex={-1}>
                    <i className={showCPw ? "ri-eye-off-line" : "ri-eye-line"} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={resetLoading}
              >
                {resetLoading
                  ? <><LoadingSpinner size="sm" /> {t("step2.resetting")}</>
                  : <><i className="ri-shield-check-line" /> {t("step2.resetSubmit")}</>
                }
              </button>

              <p className="login-switch">
                {t("step2.noCode")}{" "}
                <button type="button" className="login-switch__link" onClick={goBack}>
                  {t("step2.resend")}
                </button>
              </p>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
