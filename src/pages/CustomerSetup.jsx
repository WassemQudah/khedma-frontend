import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import LoadingSpinner from "../components/LoadingSpinner";
import ImageUploader from "../components/ImageUploader";
import parseApiError from "../utils/parseApiError";
import "../styles/CustomerSetup.css";

const LANGUAGES = [
  { code: "en", label: "English",  sublabel: "English",  flag: "🇺🇸" },
  { code: "ar", label: "العربية", sublabel: "Arabic",   flag: "🇯🇴" },
];

export default function CustomerSetup() {
  const { t, i18n } = useTranslation("customerSetup");
  const { t: tc } = useTranslation("common");
  const navigate      = useNavigate();
  const { setUser }   = useAuth();
  const { showToast } = useToast();

  const [preferredLanguage, setPreferredLanguage] = useState("en");
  const [profileImageUrl, setProfileImageUrl]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [apiError,   setApiError]   = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setApiError("");
    try {
      await api.post("/api/Customer/setup-profile", { preferredLanguage, profileImageUrl });
      localStorage.setItem("preferredLanguage", preferredLanguage);
      const { data: updatedUser } = await api.get("/api/Auth/me");
      setUser((prev) => ({ ...prev, ...updatedUser, hasProfile: true }));
      showToast(t("profileSavedToast"), "success");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setApiError(parseApiError(err, t("setupFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await api.post("/api/Customer/setup-profile", { preferredLanguage: "en", profileImageUrl: "" });
      localStorage.setItem("preferredLanguage", "en");
      i18n.changeLanguage("en");
      setUser((prev) => ({ ...prev, hasProfile: true }));
    } catch {
      /* non-fatal — navigate regardless */
    } finally {
      setSubmitting(false);
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="csetup page-wrapper">
      <div className="container csetup__container">

        <div className="csetup__header">
          <span className="badge badge--blue"><i className="ri-user-settings-line" /> {t("badge")}</span>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>

        {apiError && (
          <div className="alert alert--error">
            <i className="ri-error-warning-fill" /> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="csetup__form card">

          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <ImageUploader
              value={profileImageUrl}
              onChange={setProfileImageUrl}
              label={t("profilePhoto")}
              hint={t("photoHint")}
              previewShape="circle"
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="preferredLanguage">
              {t("preferredLanguage")}
            </label>
            <div className="csetup__lang-grid">
              {LANGUAGES.map(({ code, label, sublabel, flag }) => (
                <button
                  key={code}
                  type="button"
                  className={`csetup__lang-btn ${preferredLanguage === code ? "csetup__lang-btn--active" : ""}`}
                  onClick={() => {
                    setPreferredLanguage(code);
                    i18n.changeLanguage(code);
                  }}
                >
                  <span className="csetup__lang-flag">{flag}</span>
                  <span className="csetup__lang-text">
                    <span className="csetup__lang-name">{label}</span>
                    <span className="csetup__lang-sub">{sublabel}</span>
                  </span>
                  {preferredLanguage === code && (
                    <i className="ri-check-line csetup__lang-check" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="csetup__actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={handleSkip}
              disabled={submitting}
            >
              {t("skip")}
            </button>
            <button
              type="submit"
              className="btn btn--primary btn--lg"
              disabled={submitting}
            >
              {submitting
                ? <><LoadingSpinner size="sm" /> {tc("saving")}</>
                : <><i className="ri-check-line" /> {t("saveContinue")}</>
              }
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
