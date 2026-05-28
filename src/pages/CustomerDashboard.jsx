import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import parseApiError from "../utils/parseApiError";
import { pickDateLocale } from "../utils/dateLocale";
import {
  cancelBooking,
  getCustomerBookings,
  getReviewStatuses,
  payBooking,
  reviewProvider,
  updateBookingDetails,
} from "../api/services";
import { validateCancellation } from "../api/models";
import { useToast } from "../components/Toast";
import StarRating from "../components/StarRating";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/CustomerDashboard.css";

const statusBadgeClass = (status = "") => {
  switch (status.toLowerCase()) {
    case "accepted": return "badge--confirmed";
    case "pending": return "badge--pending";
    case "completed": return "badge--completed";
    case "cancelled": return "badge--cancelled";
    default: return "badge--muted";
  }
};

function toDateTimeInput(value) {
  const d = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Image URL returned on customer booking history (`/api/Booking/customer/history`). */
function bookingProviderPhotoUrl(booking) {
  const raw =
    booking?.providerImageUrl
    ?? booking?.ProviderImageUrl
    ?? booking?.providerProfileImageUrl
    ?? booking?.profileImageUrl
    ?? booking?.provider?.profileImageUrl
    ?? "";
  const s = String(raw ?? "").trim();
  return s || "";
}

function BookingProviderAvatar({ booking, defaultName }) {
  const { t } = useTranslation("customerDashboard");
  const name = booking?.providerName ?? defaultName;
  const url = bookingProviderPhotoUrl(booking);
  const [broken, setBroken] = useState(false);
  const letter = (name ?? "P").charAt(0).toUpperCase();
  const alt = t("providerPhotoAlt", { name: name || t("defaultProvider") });

  if (url && !broken) {
    return (
      <div className="booking-card__provider-avatar booking-card__provider-avatar--photo">
        <img src={url} alt={alt} loading="lazy" onError={() => setBroken(true)} />
      </div>
    );
  }
  return (
    <div className="booking-card__provider-avatar">
      {letter}
    </div>
  );
}

function EditModal({ booking, onClose, onSubmit }) {
  const { t } = useTranslation("customerDashboard");
  const { t: tc } = useTranslation("common");
  const [serviceDate, setServiceDate] = useState(toDateTimeInput(booking.serviceDate));
  const [serviceAddress, setServiceAddress] = useState(booking.serviceAddress ?? "");
  const [description, setDescription] = useState(booking.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!serviceDate) { setError(t("editModal.errSelectDate")); return; }
    if (new Date(serviceDate) <= new Date()) { setError(t("editModal.errFuture")); return; }
    if (!serviceAddress.trim()) { setError(t("editModal.errAddress")); return; }
    if (!description.trim()) { setError(t("editModal.errDesc")); return; }
    setError("");
    setLoading(true);
    await onSubmit(booking.bookingId, {
      serviceDate: new Date(serviceDate).toISOString(),
      serviceAddress: serviceAddress.trim(),
      description: description.trim(),
    });
    setLoading(false);
  };

  const provName = booking.providerName ?? t("editModal.subtitleDefault");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3><i className="ri-edit-line" /> {t("editModal.title")}</h3>
          <button type="button" className="modal__close" onClick={onClose}><i className="ri-close-line" /></button>
        </div>
        <p className="modal__subtitle">
          {t("editModal.subtitlePrefix")} <strong>{provName}</strong>.
        </p>

        {error && (
          <div className="alert alert--error" style={{ marginBottom: "1rem" }}>
            <i className="ri-error-warning-fill" /> {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">{t("editModal.serviceDate")} <span>*</span></label>
          <input
            type="datetime-local"
            value={serviceDate}
            min={toDateTimeInput(new Date())}
            onChange={(e) => setServiceDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t("editModal.serviceAddress")} <span>*</span></label>
          <input
            type="text"
            placeholder={t("editModal.addressPh")}
            value={serviceAddress}
            onChange={(e) => setServiceAddress(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">{t("editModal.jobDesc")} <span>*</span></label>
          <textarea
            className="modal__textarea"
            rows={4}
            placeholder={t("editModal.descPh")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
          />
          <span className="form-hint">{tc("charactersCount", { current: description.length, max: 1000 })}</span>
        </div>

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{tc("cancel")}</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? <LoadingSpinner size="sm" /> : <><i className="ri-save-line" /> {tc("saveChanges")}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function PayModal({ booking, onClose, onSubmit }) {
  const { t } = useTranslation("customerDashboard");
  const { t: tc } = useTranslation("common");
  const [method, setMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);

  const PAYMENT_METHODS = useMemo(() => ([
    { value: "Cash", label: t("payModal.cash"), icon: "ri-money-dollar-circle-line" },
  ]), [t]);

  const handleSubmit = async () => {
    setLoading(true);
    await onSubmit(booking.bookingId, method);
    setLoading(false);
  };

  const provName = booking.providerName ?? t("payModal.subtitleDefault");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3><i className="ri-secure-payment-line" /> {t("payModal.title")}</h3>
          <button type="button" className="modal__close" onClick={onClose}><i className="ri-close-line" /></button>
        </div>
        <p className="modal__subtitle">
          {t("payModal.subtitlePrefix")} <strong>{provName}</strong>.
        </p>
        <div className="pay-methods">
          {PAYMENT_METHODS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              className={`pay-method-btn ${method === value ? "pay-method-btn--active" : ""}`}
              onClick={() => setMethod(value)}
            >
              <i className={icon} />
              {method === value && <i className="ri-check-line" />}
              {label}
            </button>
          ))}
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{tc("cancel")}</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? <LoadingSpinner size="sm" /> : <><i className="ri-secure-payment-line" /> {tc("confirmPayment")}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function RateModal({ booking, onClose, onSubmit }) {
  const { t } = useTranslation("customerDashboard");
  const { t: tc } = useTranslation("common");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return;
    setLoading(true);
    await onSubmit(booking.bookingId, rating, comment);
    setLoading(false);
  };

  const provName = booking.providerName ?? t("rateModal.subtitleDefault");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{t("rateModal.title")}</h3>
          <button type="button" className="modal__close" onClick={onClose}><i className="ri-close-line" /></button>
        </div>
        <p className="modal__subtitle">
          {t("rateModal.subtitlePrefix")} <strong>{provName}</strong>?
        </p>
        <StarRating rating={rating} onRate={setRating} size="lg" />
        <textarea
          className="modal__textarea"
          placeholder={t("rateModal.placeholder")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={500}
        />
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{tc("cancel")}</button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!rating || loading}
            onClick={handleSubmit}
          >
            {loading ? <LoadingSpinner size="sm" /> : <><i className="ri-star-fill" /> {tc("submitRating")}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  const { t: tc } = useTranslation("common");
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal confirm-modal card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal__icon">
          <i className="ri-error-warning-line" />
        </div>
        <p className="confirm-modal__message">{message}</p>
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>{tc("cancel")}</button>
          <button type="button" className="btn btn--primary" onClick={onConfirm}>{tc("ok")}</button>
        </div>
      </div>
    </div>
  );
}

export default function CustomerDashboard() {
  const { t } = useTranslation("customerDashboard");
  const { t: tc, i18n } = useTranslation("common");
  const { showToast } = useToast();
  const navigate = useNavigate();

  const tabs = useMemo(() => ([
    { key: "Pending", label: t("tabs.Pending"), icon: "ri-time-line" },
    { key: "Accepted", label: t("tabs.Accepted"), icon: "ri-calendar-check-line" },
    { key: "Completed", label: t("tabs.Completed"), icon: "ri-check-double-line" },
    { key: "Cancelled", label: t("tabs.Cancelled"), icon: "ri-close-circle-line" },
  ]), [t]);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Pending");
  const [rateModal, setRateModal] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [reviewStatuses, setReviewStatuses] = useState({});

  const locale = pickDateLocale(i18n.language);

  const fetchBookings = async () => {
    setLoading(true); setError("");
    try {
      const list = await getCustomerBookings();
      setBookings(list);

      const completedIds = list
        .filter((b) => (b.status ?? "").toLowerCase() === "completed")
        .map((b) => b.bookingId);

      setReviewStatuses(await getReviewStatuses(completedIds));
    } catch (err) {
      setError(parseApiError(err, t("loadError")));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleCancel = (booking) => {
    const { valid, error: preErr } = validateCancellation(booking.status, booking.serviceDate);
    if (!valid) {
      showToast(preErr, "error");
      return;
    }
    setConfirmModal({ booking });
  };

  const handleCancelConfirmed = async () => {
    const { booking } = confirmModal;
    setConfirmModal(null);
    setCancellingId(booking.bookingId);
    try {
      await cancelBooking(booking.bookingId, booking.status, booking.serviceDate);
      showToast(t("toast.cancelOk"), "success");
      fetchBookings();
    } catch (err) {
      showToast(parseApiError(err, t("toast.cancelFail")), "error");
    } finally {
      setCancellingId(null);
    }
  };

  const handleUpdate = async (bookingId, updates) => {
    try {
      await updateBookingDetails(bookingId, updates);
      showToast(t("toast.updateOk"), "success");
      setEditModal(null);
      fetchBookings();
    } catch (err) {
      showToast(parseApiError(err, t("toast.updateFail")), "error");
    }
  };

  const handlePay = async (bookingId, paymentMethod) => {
    try {
      await payBooking(bookingId, paymentMethod);
      showToast(t("toast.payOk"), "success");
      setPayModal(null);
      fetchBookings();
    } catch (err) {
      showToast(parseApiError(err, t("toast.payFail")), "error");
    }
  };

  const handleRate = async (bookingId, rating, comment) => {
    try {
      await reviewProvider(bookingId, rating, comment);
      showToast(t("toast.rateOk"), "success");
      setRateModal(null);
      fetchBookings();
    } catch (err) {
      showToast(parseApiError(err, t("toast.rateFail")), "error");
    }
  };

  const filtered = bookings.filter(
    (b) => (b.status ?? "").toLowerCase() === activeTab.toLowerCase()
  );

  const formatDate = (iso) => {
    if (!iso) return tc("dash");
    const validIso = iso.endsWith("Z") ? iso : `${iso}Z`;
    return new Date(validIso).toLocaleString(locale, {
      month: "short", day: "2-digit", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  const statusLabel = (raw) => {
    const k = (raw ?? "pending").toLowerCase();
    return t(`statusBadge.${k}`, { defaultValue: raw ?? "" });
  };

  return (
    <div className="cdash page-wrapper">
      <div className="container">
        <div className="page-header">
          <h1><i className="ri-calendar-check-line" /> {t("pageTitle")}</h1>
          <p>{t("pageSubtitle")}</p>
        </div>

        <div className="tabs cdash-tabs">
          {tabs.map(({ key, label, icon }) => {
            const count = bookings.filter((b) => (b.status ?? "").toLowerCase() === key.toLowerCase()).length;
            return (
              <button
                key={key}
                type="button"
                className={`tab-btn ${activeTab === key ? "tab-btn--active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                <i className={icon} /> {label}
                {count > 0 && <span className="tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {loading ? (
          <LoadingSpinner fullPage text={tc("loadingBookings")} />
        ) : error ? (
          <div className="alert alert--error">
            <i className="ri-error-warning-fill" /> {error}
            <button type="button" className="btn btn--sm btn--ghost" onClick={fetchBookings}>{tc("retry")}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <i className="ri-calendar-line" />
            <h3>{t("emptyForTab", { status: t(`tabs.${activeTab}`) })}</h3>
            <p>{t("emptyHint")}</p>
            <button type="button" className="btn btn--outline" onClick={() => navigate("/search")}>
              {t("findProvider")}
            </button>
          </div>
        ) : (
          <div className="cdash-bookings">
            {filtered.map((booking) => (
              <div key={booking.bookingId} className="booking-card card card--interactive">
                <div className="booking-card__main">
                  <div className="booking-card__provider">
                    <BookingProviderAvatar booking={booking} defaultName={t("defaultProvider")} />
                    <div>
                      <p className="booking-card__provider-name">{booking.providerName ?? t("defaultProvider")}</p>
                      <p className="booking-card__date">
                        <i className="ri-calendar-line" /> {formatDate(booking.serviceDate)}
                      </p>
                    </div>
                  </div>

                  <div className="booking-card__meta">
                    <span className={`badge ${statusBadgeClass(booking.status)}`}>
                      {statusLabel(booking.status)}
                    </span>
                    {booking.basePrice != null && (
                      <span className="booking-card__price">
                        <i className="ri-money-dollar-circle-line" /> {t("jodHr", { n: booking.basePrice })}
                      </span>
                    )}
                  </div>
                </div>

                {booking.serviceAddress && (
                  <p className="booking-card__notes">
                    <i className="ri-map-pin-line" /> {booking.serviceAddress}
                  </p>
                )}
                {booking.providerPhone && (
                  <p className="booking-card__notes" style={{ cursor: "pointer" }} onClick={() => window.location.href = `tel:${booking.providerPhone}`}>
                    <i className="ri-phone-line" />
                    <a href={`tel:${booking.providerPhone}`} style={{ color: "inherit" }} onClick={(e) => e.stopPropagation()}>
                      {booking.providerPhone}
                    </a>
                  </p>
                )}
                {booking.description && (
                  <p className="booking-card__notes">
                    <i className="ri-sticky-note-line" /> {booking.description}
                  </p>
                )}
                {booking.imageUrl && (
                  <div className="cdash-attachment">
                    <a href={booking.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={booking.imageUrl} alt={t("attachedPhotoAlt")} loading="lazy" />
                    </a>
                  </div>
                )}

                <div className="booking-card__actions">
                  {["pending", "accepted"].includes((booking.status ?? "").toLowerCase()) && (
                    <Link
                      className="btn btn--ghost btn--sm"
                      to={`/chat/${booking.bookingId}`}
                    >
                      <i className="ri-chat-3-line" /> {t("chat")}
                    </Link>
                  )}
                  {(booking.status ?? "").toLowerCase() === "accepted" && !booking.isPaid && (
                    <button
                      type="button"
                      className="btn btn--success btn--sm"
                      onClick={() => setPayModal(booking)}
                    >
                      <i className="ri-secure-payment-line" /> {t("pay")}
                    </button>
                  )}
                  {(booking.status ?? "").toLowerCase() === "pending" && (
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => setEditModal(booking)}
                    >
                      <i className="ri-edit-line" /> {t("edit")}
                    </button>
                  )}

                  {["pending", "accepted"].includes((booking.status ?? "").toLowerCase()) && (
                    <button
                      type="button"
                      className="btn btn--danger btn--sm"
                      disabled={cancellingId === booking.bookingId}
                      onClick={() => handleCancel(booking)}
                    >
                      {cancellingId === booking.bookingId
                        ? <LoadingSpinner size="sm" />
                        : <><i className="ri-close-circle-line" /> {t("cancel")}</>
                      }
                    </button>
                  )}

                  {(booking.status ?? "").toLowerCase() === "completed" && !reviewStatuses[booking.bookingId]?.isRatedByCustomer && (
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => setRateModal(booking)}
                    >
                      <i className="ri-star-line" /> {t("rateProvider")}
                    </button>
                  )}
                  {(booking.status ?? "").toLowerCase() === "completed" && reviewStatuses[booking.bookingId]?.isRatedByCustomer && (
                    <span className="booking-card__rated">
                      <i className="ri-star-fill" /> {t("rated")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {payModal && (
        <PayModal
          booking={payModal}
          onClose={() => setPayModal(null)}
          onSubmit={handlePay}
        />
      )}
      {editModal && (
        <EditModal
          booking={editModal}
          onClose={() => setEditModal(null)}
          onSubmit={handleUpdate}
        />
      )}
      {rateModal && (
        <RateModal
          booking={rateModal}
          onClose={() => setRateModal(null)}
          onSubmit={handleRate}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          message={t("confirmCancelMsg")}
          onConfirm={handleCancelConfirmed}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
