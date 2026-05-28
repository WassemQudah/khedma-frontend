import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CITIES } from "../config/config";
import useCategories from "../hooks/useCategories";
import parseApiError from "../utils/parseApiError";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import LoadingSpinner from "../components/LoadingSpinner";
import ImageUploader from "../components/ImageUploader";
import { getMe, setupProviderProfile, uploadImage, addPortfolioImages } from "../api/services";
import "../styles/ProviderSetup.css";

export default function ProviderSetup() {
  const { t } = useTranslation("providerSetup");
  const { t: tc } = useTranslation("common");
  const navigate      = useNavigate();
  const { user, setUser } = useAuth();
  const { showToast } = useToast();

  const { categories: CATEGORIES } = useCategories();

  React.useEffect(() => {
    const hasApiProfile = !!(user?.businessName || user?.hasProfile);
    if (hasApiProfile) {
      navigate("/provider/dashboard", { replace: true });
    }
  }, [user, navigate]);

  const [form, setForm] = useState({
    businessName:    "",
    bio:             "",
    basePrice:       "",
    workCity:        "",
    specificLocation: "",
    profileImageUrl: "",
  });
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [errors,      setErrors]      = useState({});
  const [submitting,  setSubmitting]  = useState(false);
  const [apiError,    setApiError]    = useState("");

  // ── Portfolio state ────────────────────────────────────────────────────────
  const [portfolioUrls,      setPortfolioUrls]      = useState([]);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioError,     setPortfolioError]     = useState("");

  const change = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: "" }));
  };

  const toggleCategory = (id) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
    if (errors.categories) setErrors((p) => ({ ...p, categories: "" }));
  };

  const handlePortfolioFileChange = async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPortfolioUploading(true);
    setPortfolioError("");
    try {
      const urls = await Promise.all(files.map((f) => uploadImage(f).then((r) => r.imageUrl)));
      setPortfolioUrls((prev) => [...prev, ...urls]);
    } catch {
      setPortfolioError(t("portfolio.uploadError"));
    } finally {
      setPortfolioUploading(false);
      e.target.value = "";
    }
  };

  const removePortfolioUrl = (idx) =>
    setPortfolioUrls((prev) => prev.filter((_, i) => i !== idx));

  const validate = () => {
    const e = {};
    const v = "validation";
    if (!form.basePrice)
      e.basePrice = t(`${v}.basePriceRequired`);
    else if (isNaN(form.basePrice) || Number(form.basePrice) < 1)
      e.basePrice = t(`${v}.priceMin`);
    else if (Number(form.basePrice) > 1000)
      e.basePrice = t(`${v}.priceMax`);
    if (!form.workCity)
      e.workCity  = t(`${v}.cityRequired`);
    if (selectedCategories.length === 0)
      e.categories = t(`${v}.categoriesRequired`);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError("");
    try {
      await setupProviderProfile({
        businessName:    form.businessName.trim(),
        bio:             form.bio.trim(),
        basePrice:       parseFloat(form.basePrice),
        workCity:        form.workCity,
        specificLocation: form.specificLocation.trim() || undefined,
        profileImageUrl: form.profileImageUrl.trim() || undefined,
        categoryIds:     [...selectedCategories],
      });
      // Upload portfolio images after the profile exists on the backend
      if (portfolioUrls.length > 0) {
        try { await addPortfolioImages(portfolioUrls); } catch { /* non-fatal */ }
      }
      const updatedUser = await getMe();
      const merged = {
        ...user,
        ...updatedUser,
        hasProfile: true,
        profileImageUrl:
          updatedUser?.profileImageUrl
          ?? updatedUser?.imageUrl
          ?? updatedUser?.avatarUrl
          ?? form.profileImageUrl
          ?? user?.profileImageUrl
          ?? "",
      };
      setUser((prev) => ({ ...prev, ...merged }));
      showToast(t("successToast"), "success");
      navigate("/provider/dashboard", { replace: true });
    } catch (err) {
      setApiError(parseApiError(err, t("setupFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="psetup page-wrapper">
      <div className="container psetup__container">
        <div className="psetup__header">
          <span className="badge badge--green"><i className="ri-tools-line" /> {t("badge")}</span>
          <h1>{t("title")}</h1>
          <p>{t("subtitle")}</p>
        </div>

        {apiError && (
          <div className="alert alert--error">
            <i className="ri-error-warning-fill" /> {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="psetup__form card">

          <div className="form-group">
            <label className="form-label" htmlFor="businessName">
              {t("businessNameLabel")} <span className="form-hint">{t("optionalHint")}</span>
            </label>
            <input
              id="businessName"
              name="businessName"
              type="text"
              placeholder={t("businessPlaceholder")}
              value={form.businessName}
              onChange={change}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bio">
              {t("bioLabel")} <span className="form-hint">{t("optionalHint")}</span>
            </label>
            <textarea
              id="bio"
              name="bio"
              rows={4}
              placeholder={t("bioPlaceholder")}
              value={form.bio}
              onChange={change}
              maxLength={500}
            />
            <span className="form-hint">{t("bioHint", { len: form.bio.length })}</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="basePrice">
                {t("basePriceLabel")} <span>*</span>
              </label>
              <div className="psetup__price-wrap">
                <input
                  id="basePrice"
                  name="basePrice"
                  type="number"
                  min="1"
                  step="0.5"
                  placeholder={t("basePricePlaceholder")}
                  value={form.basePrice}
                  onChange={change}
                />
                <span className="psetup__price-suffix">{t("jodHr")}</span>
              </div>
              {errors.basePrice && <span className="form-error">{errors.basePrice}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="workCity">
                {t("workCityLabel")} <span>*</span>
              </label>
              <select id="workCity" name="workCity" value={form.workCity} onChange={change}>
                <option value="">{t("selectCity")}</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {errors.workCity && <span className="form-error">{errors.workCity}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="specificLocation">
              {t("specificLocationLabel")} <span className="form-hint">{t("optionalHint")}</span>
            </label>
            <input
              id="specificLocation"
              name="specificLocation"
              type="text"
              placeholder={t("locationPlaceholder")}
              value={form.specificLocation}
              onChange={change}
            />
          </div>

          {/* Profile Photo */}
          <div className="form-group">
            <ImageUploader
              value={form.profileImageUrl}
              onChange={(url) => setForm((p) => ({ ...p, profileImageUrl: url }))}
              label={t("photoLabel")}
              hint={t("photoHint")}
              fieldName="file"
              previewShape="circle"
              disabled={submitting}
            />
          </div>

          {/* ── Portfolio Photos ─────────────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">
              <i className="ri-gallery-line" /> {t("portfolio.label")}
              <span className="form-hint" style={{ marginInlineStart: "0.4rem" }}>{t("optionalHint")}</span>
            </label>
            <p className="form-hint" style={{ marginBottom: "0.6rem" }}>
              {t("portfolio.hint")}
            </p>

            {portfolioUrls.length > 0 && (
              <div className="psetup-portfolio-grid">
                {portfolioUrls.map((url, idx) => (
                  <div key={idx} className="psetup-portfolio-thumb">
                    <img src={url} alt={t("portfolio.imageAlt", { n: idx + 1 })} />
                    <button
                      type="button"
                      className="psetup-portfolio-thumb__del"
                      onClick={() => removePortfolioUrl(idx)}
                      disabled={submitting}
                      title={t("portfolio.remove")}
                    >
                      <i className="ri-delete-bin-line" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {portfolioError && (
              <span className="form-error" style={{ display: "block", marginBottom: "0.4rem" }}>
                {portfolioError}
              </span>
            )}

            <label
              className={`btn btn--outline btn--sm psetup-portfolio-add${portfolioUploading ? " btn--disabled" : ""}`}
              style={{ cursor: portfolioUploading ? "not-allowed" : "pointer" }}
            >
              {portfolioUploading
                ? <><LoadingSpinner size="sm" /> {t("portfolio.uploading")}</>
                : <><i className="ri-image-add-line" /> {t("portfolio.addPhotos")}</>
              }
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handlePortfolioFileChange}
                disabled={portfolioUploading || submitting}
              />
            </label>
          </div>

          {/* ── Service Categories ───────────────────────────────────────── */}
          <div className="form-group">
            <label className="form-label">
              {t("categoriesLabel")} <span>*</span>
              {selectedCategories.length > 0 && (
                <span className="form-hint" style={{ marginLeft: "0.5rem" }}>
                  {t("selectedCount", { n: selectedCategories.length })}
                </span>
              )}
            </label>
            <div className="psetup__categories">
              {CATEGORIES.map((cat) => {
                const active = selectedCategories.includes(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`psetup__cat-btn ${active ? "psetup__cat-btn--active" : ""}`}
                    onClick={() => toggleCategory(cat.id)}
                  >
                    {cat.icon ? (
                      <i className={`psetup__cat-icon ${cat.icon}`} aria-hidden />
                    ) : cat.emoji ? (
                      <span className="psetup__cat-emoji">{cat.emoji}</span>
                    ) : null}
                    <span className="psetup__cat-name">{cat.name}</span>
                    {active && <i className="ri-check-line psetup__cat-check" />}
                  </button>
                );
              })}
            </div>
            {errors.categories && <span className="form-error">{errors.categories}</span>}
          </div>

          <div className="alert alert--info">
            <i className="ri-information-line" />
            {t("reviewNote")}
          </div>

          <div className="psetup__submit-row">
            <button type="submit" className="btn btn--primary btn--xl" disabled={submitting}>
              {submitting
                ? <><LoadingSpinner size="sm" /> {tc("submitting")}</>
                : <><i className="ri-check-line" /> {t("completeSetup")}</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
