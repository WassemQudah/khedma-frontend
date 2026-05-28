import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { useTranslation } from "react-i18next";
import { CITIES } from "../config/config";
import parseApiError from "../utils/parseApiError";
import { mergeSessionWithFreshProfile } from "../utils/authProfileMerge";
import { getMeMergedWithRoleProfile, updateProviderProfile, updateCustomerProfile, getCustomerReviews, getCustomerBookings, uploadImage, addPortfolioImages, deletePortfolioImage, getProvider } from "../api/services";
import LoadingSpinner from "../components/LoadingSpinner";
import ImageUploader from "../components/ImageUploader";
import StarRating from "../components/StarRating";
import "../styles/ProviderSetup.css";
import "../styles/Profile.css";

export default function Profile() {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const { user, setUser } = useAuth();
  const { showToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── Provider edit state ────────────────────────────────────────────────────
  const [provEdit, setProvEdit] = useState(false);
  const [provForm, setProvForm] = useState({});
  const [provSaving, setProvSaving] = useState(false);
  const [provError, setProvError] = useState("");

  // ── Portfolio state ────────────────────────────────────────────────────────
  const [portfolioItems, setPortfolioItems] = useState([]);  // { id, imageUrl }
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [portfolioError, setPortfolioError] = useState("");

  // ── Customer edit state ────────────────────────────────────────────────────
  const [custEdit, setCustEdit] = useState(false);
  const [custForm, setCustForm] = useState({ fullName: "", phoneNumber: "", profileImageUrl: "" });
  const [custSaving, setCustSaving] = useState(false);
  const [custError, setCustError] = useState("");

  // ── Customer reviews (visible on customer profile) ─────────────────────────
  const [customerReviews, setCustomerReviews] = useState([]);
  const [_reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const raw = await getMeMergedWithRoleProfile(user);
        const data = mergeSessionWithFreshProfile(user, raw ?? {});

        setProfile(data);
        setUser((prev) => ({ ...prev, ...data }));

        if (data?.role === "Customer") {
          setReviewsLoading(true);
          try {
            const candidateIds = [
              data?.customerId,
              data?.id,
              data?.userId,
              data?.nameid,
            ].filter(Boolean);

            let reviews = [];

            for (const id of candidateIds) {
              const out = await getCustomerReviews(id);
              if (Array.isArray(out) && out.length > 0) {
                reviews = out;
                break;
              }
              if (Array.isArray(out) && candidateIds.length === 1) {
                reviews = out;
              }
            }

            if (reviews.length === 0) {
              const bookings = await getCustomerBookings();
              const bookingCustomerId = bookings?.find((b) => b?.customerId)?.customerId;
              if (bookingCustomerId && !candidateIds.includes(bookingCustomerId)) {
                const out = await getCustomerReviews(bookingCustomerId);
                if (Array.isArray(out)) reviews = out;
              }
            }

            setCustomerReviews(Array.isArray(reviews) ? reviews : []);
          } catch {
            setCustomerReviews([]);
          } finally {
            setReviewsLoading(false);
          }
        } else {
          setCustomerReviews([]);
          setReviewsLoading(false);
        }
      } catch (err) {
        setError(err.response?.data?.message || t("loadError"));
      } finally {
        setLoading(false);
      }
    };
    load();
    // Intentionally omit `user`: including it retriggers after `setUser` here (same id, new object reference).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cache snapshot keyed by user?.id
  }, [setUser, user?.id]);

  // ── Provider edit handlers ─────────────────────────────────────────────────
  const enterProvEdit = () => {
    // Seed portfolio from the profile data returned by GET /api/Provider/{id}
    const existing = (profile?.portfolio ?? []).map((item) => ({
      id: item.imageId ?? item.ImageId ?? item.id ?? item.Id ?? null,
      imageUrl: item.imageUrl ?? item.ImageUrl ?? item.url ?? "",
    }));
    setPortfolioItems(existing);
    setPortfolioError("");
    setProvForm({
      fullName: profile?.fullName ?? "",
      businessName: profile?.businessName ?? "",
      bio: profile?.bio ?? "",
      basePrice: profile?.basePrice != null ? String(profile.basePrice) : "",
      workCity: profile?.workCity ?? "",
      specificLocation: profile?.specificLocation ?? "",
      profileImageUrl: profile?.profileImageUrl ?? "",
    });
    setProvError("");
    setProvEdit(true);
  };

  const handlePortfolioFileChange = async (e) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setPortfolioUploading(true);
    setPortfolioError("");
    try {
      // 1. Upload each file to /api/Upload/image
      const urls = await Promise.all(files.map((f) => uploadImage(f).then((r) => r.imageUrl)));
      // 2. Register with the backend
      await addPortfolioImages(urls);
      // 3. Re-fetch the provider profile so we get real server-side imageIds
      //    This is necessary to make DELETE /api/Provider/portfolio/{imageId} work
      const providerId = profile?.providerId ?? profile?.id ?? profile?.userId ?? profile?.nameid;
      if (providerId) {
        const fresh = await getProvider(providerId);
        const freshItems = (fresh?.portfolio ?? []).map((item) => ({
          id: item.id ?? item.Id ?? item.imageId ?? item.ImageId ?? null,
          imageUrl: item.imageUrl ?? item.ImageUrl ?? item.url ?? "",
        }));
        setPortfolioItems(freshItems);
      } else {
        // Fallback: store without IDs (delete will be local-only for these)
        setPortfolioItems((prev) => [
          ...prev,
          ...urls.map((url) => ({ id: null, imageUrl: url })),
        ]);
      }
    } catch {
      setPortfolioError(t("portfolio.uploadError"));
    } finally {
      setPortfolioUploading(false);
      e.target.value = "";
    }
  };

  const handlePortfolioDelete = async (item, idx) => {
    // Always call DELETE when we have a server-side ID
    if (item.id != null) {
      try {
        await deletePortfolioImage(item.id);
      } catch {
        setPortfolioError(t("portfolio.deleteError"));
        return; // Don't remove from UI if the API call failed
      }
    }
    setPortfolioItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const changeProvForm = (e) => {
    const { name, value } = e.target;
    setProvForm((p) => ({ ...p, [name]: value }));
  };


  const handleProviderSave = async () => {
    if (!provForm.fullName?.trim()) { setProvError(t("validation.fullNameRequired")); return; }
    if (!provForm.basePrice || isNaN(provForm.basePrice) || Number(provForm.basePrice) < 1) {
      setProvError(t("validation.basePriceMin")); return;
    }
    if (!provForm.workCity) { setProvError(t("validation.selectCity")); return; }
    setProvError("");
    setProvSaving(true);
    try {
      const updatedFromApi = await updateProviderProfile({
        fullName: provForm.fullName.trim(),
        businessName: provForm.businessName.trim() || undefined,
        bio: provForm.bio.trim() || undefined,
        basePrice: parseFloat(provForm.basePrice),
        workCity: provForm.workCity,
        specificLocation: provForm.specificLocation.trim() || undefined,
        profileImageUrl: provForm.profileImageUrl.trim(),
      });

      const merged = mergeSessionWithFreshProfile(profile, {
        ...updatedFromApi,
        fullName: provForm.fullName.trim(),
        businessName: provForm.businessName.trim(),
        bio: provForm.bio.trim(),
        basePrice: parseFloat(provForm.basePrice),
        workCity: provForm.workCity,
        specificLocation: provForm.specificLocation.trim(),
        profileImageUrl: provForm.profileImageUrl.trim(),
      });

      setProfile(merged);
      setUser((prev) => ({ ...prev, ...merged }));
      setProvEdit(false);
      showToast(t("toast.providerUpdated"), "success");
    } catch (err) {
      setProvError(parseApiError(err, t("errors.updateFailed")));
    } finally {
      setProvSaving(false);
    }
  };

  // ── Customer edit handlers ─────────────────────────────────────────────────
  const enterCustEdit = () => {
    setCustForm({
      fullName: profile?.fullName ?? "",
      phoneNumber: profile?.phoneNumber ?? "",
      profileImageUrl: profile?.profileImageUrl ?? "",
    });
    setCustError("");
    setCustEdit(true);
  };

  const handleCustomerSave = async () => {
    if (!custForm.fullName.trim()) { setCustError(t("validation.fullNameRequired")); return; }
    setCustError("");
    setCustSaving(true);
    try {
      const updatedFromApi = await updateCustomerProfile({
        fullName: custForm.fullName.trim(),
        phoneNumber: custForm.phoneNumber.trim() || undefined,
        profileImageUrl: custForm.profileImageUrl.trim(),
      });

      const merged = mergeSessionWithFreshProfile(profile, {
        ...updatedFromApi,
        fullName: custForm.fullName.trim(),
        phoneNumber: custForm.phoneNumber.trim(),
        profileImageUrl: custForm.profileImageUrl.trim(),
      });

      setProfile(merged);
      setUser((prev) => ({ ...prev, ...merged }));
      setCustEdit(false);
      showToast(t("toast.customerUpdated"), "success");
    } catch (err) {
      setCustError(parseApiError(err, t("errors.updateFailed")));
    } finally {
      setCustSaving(false);
    }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const displayName = profile?.fullName ?? user?.fullName ?? t("displayUser");
  const roleKey = profile?.role ?? user?.role ?? "";

  const roleMeta = useMemo(() => {
    const map = {
      Customer: { icon: "ri-user-3-line", color: "blue", label: t("roles.Customer") },
      Provider: { icon: "ri-tools-line", color: "green", label: t("roles.Provider") },
      Admin: { icon: "ri-shield-star-line", color: "orange", label: t("roles.Admin") },
    };
    return map[roleKey] ?? { icon: "ri-user-line", color: "muted", label: t("roles.fallback") };
  }, [roleKey, t]);

  const initials = displayName
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  // Backend responses may use different key names for uploaded image URLs.
  const profileAvatarUrl =
    profile?.profileImageUrl
    ?? profile?.imageUrl
    ?? profile?.avatarUrl
    ?? user?.profileImageUrl
    ?? user?.imageUrl
    ?? user?.avatarUrl
    ?? "";

  const customerAvgRating = customerReviews.length
    ? (
      customerReviews.reduce((sum, rev) => sum + (Number(rev.rating) || 0), 0) /
      customerReviews.length
    ).toFixed(1)
    : null;

  if (loading) return <LoadingSpinner fullPage text={t("loading")} />;

  return (
    <div className="profile-page page-wrapper">
      <div className="container profile-container">

        {error && (
          <div className="alert alert--error" style={{ marginBottom: "1.5rem" }}>
            <i className="ri-error-warning-fill" /> {error}
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => window.location.reload()}>
              {tc("retry")}
            </button>
          </div>
        )}

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <div className="profile-hero card">
          <div className="profile-hero__avatar">
            {profileAvatarUrl ? (
              <img
                key={`${profileAvatarUrl}|${displayName}`}
                src={profileAvatarUrl}
                alt={displayName}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>

          <div className="profile-hero__info">
            <h1 className="profile-hero__name">{displayName}</h1>
            <p className="profile-hero__email">
              <i className="ri-mail-line" /> {profile?.email ?? user?.email}
            </p>
            <span className={`badge badge--${roleMeta.color} profile-hero__badge`}>
              <i className={roleMeta.icon} /> {roleMeta.label}
            </span>
          </div>

          <div className="profile-hero__actions">
            {customerAvgRating && (
              <div className="profile-reviews__avg">
                <i className="ri-star-fill" /> {t("heroRating", { score: customerAvgRating })}
              </div>
            )}

          </div>
        </div>

        {/* ── Details grid ──────────────────────────────────────────────── */}
        <div className="profile-grid">

          {/* ═══════════════════════════════════════════════════════════════
              Provider: single merged card (Account Info + Provider Profile)
          ════════════════════════════════════════════════════════════════ */}
          {profile?.role === "Provider" && (
            <div className="card profile-section">
              <div className="profile-section__title-row">
                <h2 className="profile-section__title">
                  <i className="ri-tools-line" /> {t("sections.providerProfile")}
                </h2>
                {!provEdit && (
                  <button type="button" className="btn btn--outline btn--sm" onClick={enterProvEdit}>
                    <i className="ri-edit-line" /> {tc("edit")}
                  </button>
                )}
              </div>

              {provEdit ? (
                <div className="profile-edit-form">
                  {provError && (
                    <div className="alert alert--error" style={{ marginBottom: "0.75rem" }}>
                      <i className="ri-error-warning-fill" /> {provError}
                    </div>
                  )}



                  {/* Full Name */}
                  <div className="form-group">
                    <label className="form-label">{t("fields.fullName")} <span>*</span></label>
                    <input
                      name="fullName"
                      type="text"
                      placeholder={t("placeholders.fullName")}
                      value={provForm.fullName}
                      onChange={changeProvForm}
                    />
                  </div>

                  {/* Business Name
                  <div className="form-group">
                    <label className="form-label">{t("fields.businessName")}</label>
                    <input
                      name="businessName"
                      type="text"
                      placeholder={t("placeholders.business")}
                      value={provForm.businessName}
                      onChange={changeProvForm}
                    />
                  </div> */}

                  {/* Bio */}
                  <div className="form-group">
                    <label className="form-label">{t("fields.bio")}</label>
                    <textarea
                      name="bio"
                      rows={3}
                      placeholder={t("placeholders.bio")}
                      value={provForm.bio}
                      onChange={changeProvForm}
                      maxLength={500}
                    />
                    <span className="form-hint">{provForm.bio?.length ?? 0}/500</span>
                  </div>

                  {/* Price + City */}
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">{t("labels.basePriceRequired")} <span>*</span></label>
                      <input
                        name="basePrice"
                        type="number"
                        min="1"
                        step="0.5"
                        placeholder={t("placeholders.basePrice")}
                        value={provForm.basePrice}
                        onChange={changeProvForm}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{t("fields.workCity")} <span>*</span></label>
                      <select name="workCity" value={provForm.workCity} onChange={changeProvForm}>
                        <option value="">{t("placeholders.selectCity")}</option>
                        {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Specific Location */}
                  <div className="form-group">
                    <label className="form-label">{t("fields.specificLocation")}</label>
                    <input
                      name="specificLocation"
                      type="text"
                      placeholder={t("placeholders.specificLocation")}
                      value={provForm.specificLocation}
                      onChange={changeProvForm}
                    />
                  </div>

                  {/* Photo */}
                  <div className="form-group">
                    <ImageUploader
                      value={provForm.profileImageUrl}
                      onChange={(url) => setProvForm((p) => ({ ...p, profileImageUrl: url }))}
                      label={t("labels.profilePhoto")}
                      hint={t("labels.photoHint")}
                      previewShape="circle"
                      disabled={provSaving}
                    />
                  </div>

                  {/* ── Portfolio section ─────────────────────────────── */}
                  <div className="form-group">
                    <label className="form-label">
                      <i className="ri-gallery-line" /> {t("portfolio.label")}
                    </label>
                    <p className="form-hint" style={{ marginBottom: "0.6rem" }}>
                      {t("portfolio.hint")}
                    </p>

                    {/* Existing images grid */}
                    {portfolioItems.length > 0 && (
                      <div className="portfolio-grid">
                        {portfolioItems.map((item, idx) => (
                          <div key={idx} className="portfolio-thumb">
                            <img src={item.imageUrl} alt={t("portfolio.imageAlt", { n: idx + 1 })} />
                            <button
                              type="button"
                              className="portfolio-thumb__del"
                              onClick={() => handlePortfolioDelete(item, idx)}
                              disabled={provSaving || portfolioUploading}
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

                    {/* Upload button */}
                    <label
                      className={`btn btn--outline btn--sm portfolio-add-btn${portfolioUploading ? " btn--disabled" : ""}`}
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
                        disabled={portfolioUploading || provSaving}
                      />
                    </label>
                  </div>

                  <div className="profile-edit-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setProvEdit(false)}
                      disabled={provSaving}
                    >
                      {tc("cancel")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={handleProviderSave}
                      disabled={provSaving}
                    >
                      {provSaving
                        ? <LoadingSpinner size="sm" />
                        : <><i className="ri-save-line" /> {tc("saveChanges")}</>
                      }
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Read-only view: account + business fields combined ── */}
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.fullName")}</span>
                    <span className="profile-field__value">{profile?.fullName ?? tc("dash")}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.email")}</span>
                    <span className="profile-field__value">{profile?.email ?? tc("dash")}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.phone")}</span>
                    <span className="profile-field__value">
                      {profile?.phoneNumber
                        ? <a href={`tel:${profile.phoneNumber}`} className="profile-tel">{profile.phoneNumber}</a>
                        : tc("dash")}
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.accountType")}</span>
                    <span className="profile-field__value">
                      <span className={`badge badge--${roleMeta.color}`}>
                        <i className={roleMeta.icon} /> {roleMeta.label}
                      </span>
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.profileSetup")}</span>
                    <span className="profile-field__value">
                      {profile?.hasProfile
                        ? <span className="badge badge--green"><i className="ri-check-line" /> {t("fields.complete")}</span>
                        : <span className="badge badge--orange"><i className="ri-time-line" /> {t("fields.pending")}</span>
                      }
                    </span>
                  </div>

                  <div className="profile-section__divider" />

                  {/* <div className="profile-field">
                    <span className="profile-field__label">{t("fields.businessDisplay")}</span>
                    <span className="profile-field__value">{profile?.businessName ?? tc("dash")}</span>
                  </div> */}
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.workCity")}</span>
                    <span className="profile-field__value">
                      {profile?.workCity
                        ? <>{profile.workCity}</>
                        : tc("dash")}
                    </span>
                  </div>
                  {profile?.specificLocation && (
                    <div className="profile-field">
                      <span className="profile-field__label">{t("fields.specificLocation")}</span>
                      <span className="profile-field__value">
                        {profile.specificLocation}
                      </span>
                    </div>
                  )}
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.basePrice")}</span>
                    <span className="profile-field__value">
                      {profile?.basePrice != null ? t("fields.priceValue", { price: profile.basePrice }) : tc("dash")}
                    </span>
                  </div>
                  {/* provider rating field */}
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.rating")}</span>
                    <span className="profile-field__value">
                      {profile?.ratingAverage > 0
                        ? <><i className="ri-star-fill" style={{ color: "#f59e0b" }} /> {profile.ratingAverage.toFixed(1)}</>
                        : t("fields.noRatings")}
                    </span>
                  </div>
                  {profile?.bio && (
                    <div className="profile-field profile-field--column">
                      <span className="profile-field__label">{t("fields.bio")}</span>
                      <p className="profile-bio">{profile.bio}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              Customer: separate Account Information card (unchanged)
          ════════════════════════════════════════════════════════════════ */}
          {profile?.role === "Customer" && (
            <div className="card profile-section">
              <div className="profile-section__title-row">
                <h2 className="profile-section__title">
                  <i className="ri-account-circle-line" /> {t("sections.accountInfo")}
                </h2>
                {!custEdit && (
                  <button type="button" className="btn btn--outline btn--sm" onClick={enterCustEdit}>
                    <i className="ri-edit-line" /> {tc("edit")}
                  </button>
                )}
              </div>

              {custEdit ? (
                <div className="profile-edit-form">
                  {custError && (
                    <div className="alert alert--error" style={{ marginBottom: "0.75rem" }}>
                      <i className="ri-error-warning-fill" /> {custError}
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">{t("fields.fullName")} <span>*</span></label>
                    <input
                      type="text"
                      placeholder={t("placeholders.fullName")}
                      value={custForm.fullName}
                      onChange={(e) => setCustForm((p) => ({ ...p, fullName: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">{t("fields.phone")}</label>
                    <input
                      type="tel"
                      placeholder={t("placeholders.phone")}
                      value={custForm.phoneNumber}
                      onChange={(e) => setCustForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                    />
                  </div>

                  <div className="form-group">
                    <ImageUploader
                      value={custForm.profileImageUrl}
                      onChange={(url) => setCustForm((p) => ({ ...p, profileImageUrl: url }))}
                      label={t("labels.profilePhoto")}
                      hint={t("labels.photoHint")}
                      previewShape="circle"
                      disabled={custSaving}
                    />
                  </div>

                  <div className="profile-edit-actions">
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setCustEdit(false)}
                      disabled={custSaving}
                    >
                      {tc("cancel")}
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={handleCustomerSave}
                      disabled={custSaving}
                    >
                      {custSaving
                        ? <LoadingSpinner size="sm" />
                        : <><i className="ri-save-line" /> {tc("saveChanges")}</>
                      }
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.fullName")}</span>
                    <span className="profile-field__value">{profile?.fullName ?? tc("dash")}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.email")}</span>
                    <span className="profile-field__value">{profile?.email ?? tc("dash")}</span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.phone")}</span>
                    <span className="profile-field__value">
                      {profile?.phoneNumber
                        ? <a href={`tel:${profile.phoneNumber}`} className="profile-tel">{profile.phoneNumber}</a>
                        : tc("dash")}
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.accountType")}</span>
                    <span className="profile-field__value">
                      <span className={`badge badge--${roleMeta.color}`}>
                        <i className={roleMeta.icon} /> {roleMeta.label}
                      </span>
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field__label">{t("fields.profileSetup")}</span>
                    <span className="profile-field__value">
                      {profile?.hasProfile
                        ? <span className="badge badge--green"><i className="ri-check-line" /> {t("fields.complete")}</span>
                        : <span className="badge badge--orange"><i className="ri-time-line" /> {t("fields.pending")}</span>
                      }
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
