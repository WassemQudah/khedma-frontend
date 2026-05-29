import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { getProvider } from "../api/services";
import { resolveCategories } from "../config/config";
import useCategories from "../hooks/useCategories";
import LoadingSpinner from "../components/LoadingSpinner";
import ImageUploader from "../components/ImageUploader";
import { useToast } from "../components/Toast";
import parseApiError from "../utils/parseApiError";
import "../styles/Booking.css";

function toLocalDateTimeInput(date) {
  const d = date ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Booking() {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { t: tb } = useTranslation("booking");
  const { t: tc } = useTranslation("common");

  const [provider, setProvider] = useState(null);
  const [loadingProv, setLoadingProv] = useState(true);
  const [provError, setProvError] = useState("");

  const [serviceDate, setServiceDate] = useState(toLocalDateTimeInput());
  const [serviceAddress, setServiceAddress] = useState("");
  const [description, setDescription] = useState("");
  const [problemImageUrl, setProblemImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getProvider(providerId)
      .then((data) => setProvider(data))
      .catch(() => setProvError(tb("loadProviderError")))
      .finally(() => setLoadingProv(false));
  }, [providerId, tb]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serviceDate) { setError(tb("validation.selectDate")); return; }
    if (new Date(serviceDate) <= new Date()) { setError(tb("validation.dateFuture")); return; }
    if (!serviceAddress.trim()) { setError(tb("validation.addressRequired")); return; }
    if (!description.trim()) { setError(tb("validation.descriptionRequired")); return; }
    setError("");
    setSubmitting(true);
    try {
      await api.post("/api/Booking/request", {
        providerId: Number(providerId),
        serviceDate: new Date(serviceDate).toISOString(),
        serviceAddress: serviceAddress.trim(),
        description: description.trim(),
        ...(problemImageUrl ? { problemImageUrl } : {}),
      });
      showToast(tb("successToast"), "success");
      navigate("/dashboard");
    } catch (err) {
      setError(parseApiError(err, tb("submitFallback")));
    } finally {
      setSubmitting(false);
    }
  };

  const { categories: allCategories } = useCategories();
  const categories = resolveCategories(provider ?? {}, allCategories);

  return (
    <div className="booking-page page-wrapper">
      <div className="container">
        <nav className="breadcrumb">
          <Link to={`/provider/${providerId}`}>← {tb("backProfile")}</Link>
        </nav>

        <div className="booking-layout">

          {/* ── Provider summary ──────────────────────────────────────── */}
          <aside className="booking-summary card">
            <h2 className="booking-summary__title">{tb("bookingSummary")}</h2>
            {loadingProv ? (
              <LoadingSpinner />
            ) : provError ? (
              <p className="form-error">{provError}</p>
            ) : provider && (
              <>
                <div className="booking-summary__provider">
                  <div className="booking-summary__avatar">
                    {provider.profileImageUrl ? (
                      <img src={provider.profileImageUrl} alt={provider.businessName} />
                    ) : (
                      <span>
                        {(provider.businessName ?? tb("defaultInitial")).split(" ").slice(0, 2).map((w) => w[0]).join("")}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="booking-summary__name">{provider.businessName}</p>
                    <p className="booking-summary__city">
                      <i className="ri-map-pin-2-line" /> {provider.workCity}
                      {provider.specificLocation && ` · ${provider.specificLocation}`}
                    </p>
                  </div>
                </div>

                {categories.length > 0 && (
                  <div className="booking-summary__categories">
                    {categories.map((cat) => (
                      <span key={cat.id} className="badge badge--blue">
                        {cat.emoji && <>{cat.emoji} </>}{cat.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="booking-summary__price-row">
                  <span>{tb("baseRate")}</span>
                  <strong>{tb("priceHr", { price: provider.basePrice })}</strong>
                </div>
                <p className="booking-summary__note">
                  <i className="ri-information-line" />
                  {tb("priceNote")}
                </p>
              </>
            )}
          </aside>

          {/* ── Booking form ──────────────────────────────────────────── */}
          <section className="booking-form-section card">
            <h2 className="booking-form__title">
              <i className="ri-calendar-add-line" /> {tb("bookingFormTitle")}
            </h2>

            {error && (
              <div className="alert alert--error">
                <i className="ri-error-warning-fill" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="booking-form" noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="serviceDate">
                  {tb("serviceDate")} <span>*</span>
                </label>
                <input
                  id="serviceDate"
                  type="datetime-local"
                  value={serviceDate}
                  min={toLocalDateTimeInput(new Date())}
                  onChange={(e) => setServiceDate(e.target.value)}
                  required
                />
                <span className="form-hint">{tb("serviceDateHint")}</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="serviceAddress">
                  {tb("serviceAddress")} <span>*</span>
                </label>
                <input
                  id="serviceAddress"
                  type="text"
                  placeholder={tb("addressPlaceholder")}
                  value={serviceAddress}
                  onChange={(e) => setServiceAddress(e.target.value)}
                  required
                />
                <span className="form-hint">{tb("addressHint")}</span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="description">
                  {tb("jobDescription")} <span>*</span>
                </label>
                <textarea
                  id="description"
                  rows={5}
                  placeholder={tb("descriptionPlaceholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                />
                <span className="form-hint">{tc("charactersCount", { current: description.length, max: 1000 })}</span>
              </div>

              {/* Optional photo of the problem */}
              <div className="form-group booking-photo-upload">
                <label className="form-label">
                  <i className="ri-image-add-line" /> {tb("photoUpload.label")}
                  <span className="badge badge--muted" style={{ marginLeft: "0.5rem", fontSize: "0.7rem" }}>
                    {tb("photoUpload.optional")}
                  </span>
                </label>
                <p className="form-hint" style={{ marginBottom: "0.5rem" }}>{tb("photoUpload.hint")}</p>
                <ImageUploader
                  value={problemImageUrl}
                  onChange={setProblemImageUrl}
                  fieldName="file"
                  label=""
                  hint={tb("photoUpload.uploaderHint")}
                  disabled={submitting}
                />
              </div>

              <div className="booking-form__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => navigate(-1)}
                >
                  {tc("cancel")}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary btn--lg"
                  disabled={submitting || loadingProv}
                >
                  {submitting
                    ? <><LoadingSpinner size="sm" /> {tc("processing")}</>
                    : <><i className="ri-check-line" /> {tb("confirmBooking")}</>
                  }
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
