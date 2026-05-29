import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { pickDateLocale } from "../utils/dateLocale";
import api from "../api/axios";
import parseApiError from "../utils/parseApiError";
import { useToast } from "../components/Toast";
import { getReviewStatuses, getCustomerReviews } from "../api/services";
import StarRating from "../components/StarRating";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/ProviderDashboard.css";
import "../styles/Profile.css";


function RateCustomerModal({ booking, onClose, onSubmit }) {
  const { t } = useTranslation("providerDashboard");
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

  const cust = booking.customerName ?? t("rateModal.subtitleFallback");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3>{t("rateModal.title")}</h3>
          <button type="button" className="modal__close" onClick={onClose}><i className="ri-close-line" /></button>
        </div>
        <p className="modal__subtitle">
          {t("rateModal.subtitlePrefix")} <strong>{cust}</strong>?
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

/* ── Confirm Dialog ─────────────────────────────────────────────────────────── */
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

/**
 * Extracts the customer's profile image URL from a booking object,
 * checking all common field-name aliases the API might return.
 */
function getCustomerAvatar(booking) {
  const raw =
    booking.customerProfileImageUrl
    ?? booking.CustomerProfileImageUrl
    ?? booking.customerImageUrl
    ?? booking.CustomerImageUrl
    ?? booking.customerAvatarUrl
    ?? booking.CustomerAvatarUrl
    ?? booking.customer?.profileImageUrl
    ?? booking.customer?.imageUrl
    ?? booking.Customer?.profileImageUrl
    ?? booking.Customer?.imageUrl
    ?? "";
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return s; // relative paths are fine for <img src>
}

/** Avatar circle: shows photo when available, coloured initials otherwise. */
function CustomerAvatar({ booking, size = 42 }) {
  const name = booking.customerName ?? booking.CustomerName ?? "C";
  const initial = name.charAt(0).toUpperCase();
  const imgUrl = getCustomerAvatar(booking);
  const style = { width: size, height: size, flexShrink: 0 };

  if (imgUrl) {
    return (
      <img
        src={imgUrl}
        alt={name}
        className="pdash-request__avatar pdash-request__avatar--img"
        style={style}
        loading="lazy"
        onError={(e) => {
          // fall back to initials on broken image
          e.currentTarget.style.display = "none";
          e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = "flex");
        }}
      />
    );
  }
  return (
    <div className="pdash-request__avatar" style={style}>
      {initial}
    </div>
  );
}



function CustomerReputation({ rating }) {
  const { t } = useTranslation("providerDashboard");

  return (
    <div className="customer-reputation" style={{ display: "flex", alignItems: "center", gap: "0.25rem", fontSize: "0.85rem", marginTop: "2px", marginBottom: "4px" }}>
      {rating && rating > 0 ? (
        <>
          <i className="ri-star-fill" style={{ color: "#f59e0b" }} />
          <span style={{ fontWeight: 600, color: "#374151" }}>{Number(rating).toFixed(1)}</span>
        </>
      ) : (
        <>
          <i className="ri-star-line" style={{ color: "#9ca3af" }} />
          <span style={{ color: "#9ca3af" }}>{t("noReviews", "No reviews yet")}</span>
        </>
      )}
    </div>
  );
}

export default function ProviderDashboard() {
  const { t } = useTranslation("providerDashboard");
  const { t: tc, i18n } = useTranslation("common");
  const { showToast } = useToast();

  const tabs = useMemo(() => [
    { key: "pending", label: t("tabs.pending"), icon: "ri-notification-4-line" },
    { key: "accepted", label: t("tabs.accepted"), icon: "ri-calendar-check-line" },
    { key: "completed", label: t("tabs.completed"), icon: "ri-check-double-line" },
    { key: "rejected", label: t("tabs.rejected"), icon: "ri-close-circle-line" },
  ], [t]);

  const locale = pickDateLocale(i18n.language);

  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [actionId, setActionId] = useState(null);
  const [rateModal, setRateModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null); // { action, bookingId, message }
  // bookingId → { isRatedByCustomer, isRatedByProvider }
  const [reviewStatuses, setReviewStatuses] = useState({});

  const fetchBookings = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/api/Booking/provider/requests");
      const list = Array.isArray(data) ? data : (data.data ?? []);
      setAllBookings(list);
      if (list.length > 0) {
        console.log("📦 First booking fields:", JSON.stringify(list[0], null, 2));
      }

      const completedIds = list
        .filter((b) => (b.status ?? "").toLowerCase() === "completed")
        .map((b) => b.bookingId ?? b.BookingId)
        .filter((id) => id != null && id !== "");

      const statuses = await getReviewStatuses(completedIds);

      setReviewStatuses(statuses);
    } catch (err) {
      setError(parseApiError(err, t("loadError")));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleComplete = async (id) => {
    setConfirmModal({
      action: "complete",
      bookingId: id,
      message: t("confirm.complete"),
    });
  };

  const handleAccept = async (id) => {
    setActionId(id);
    try {
      await api.put(`/api/Booking/${id}/status`, { status: "Accepted" });
      showToast(t("toast.accepted"), "success");
      fetchBookings();
    } catch (err) {
      showToast(parseApiError(err, t("toast.acceptFail")), "error");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id) => {
    setConfirmModal({
      action: "reject",
      bookingId: id,
      message: t("confirm.reject"),
    });
  };

  const handleConfirmAction = async () => {
    const { action, bookingId } = confirmModal;
    setConfirmModal(null);
    setActionId(bookingId);

    if (action === "complete") {
      try {
        await api.put(`/api/Booking/${bookingId}/status`, { status: "Completed" });
        showToast(t("toast.completed"), "success");
        fetchBookings();
      } catch (err) {
        showToast(parseApiError(err, t("toast.completeFail")), "error");
      } finally {
        setActionId(null);
      }
    } else if (action === "reject") {
      try {
        await api.put(`/api/Booking/${bookingId}/status`, { status: "Rejected" });
        showToast(t("toast.declined"), "success");
        fetchBookings();
      } catch (err) {
        showToast(parseApiError(err, t("toast.declineFail")), "error");
      } finally {
        setActionId(null);
      }
    }
  };

  const handleRateCustomer = async (bookingId, rating, comment) => {
    try {
      await api.post("/api/Review/rate-customer", { bookingId, rating, comment });
      showToast(t("toast.ratingSubmitted"), "success");
      setRateModal(null);
      fetchBookings();
    } catch (err) {
      showToast(parseApiError(err, t("toast.ratingFail")), "error");
    }
  };

  const pending = allBookings.filter((b) => (b.status ?? "").toLowerCase() === "pending");
  const accepted = allBookings.filter((b) => (b.status ?? "").toLowerCase() === "accepted");
  const completed = allBookings.filter((b) => (b.status ?? "").toLowerCase() === "completed");
  const rejected = allBookings.filter((b) => (b.status ?? "").toLowerCase() === "rejected");

  const formatDate = (iso) => {
    if (!iso) return tc("dash");
    const validIso = iso.endsWith("Z") ? iso : `${iso}Z`;
    return new Date(validIso).toLocaleString(locale, {
      month: "short", day: "2-digit", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  const tabData = { pending, accepted, completed, rejected };
  const emptyMessages = {
    pending: { icon: "ri-inbox-line", text: t("empty.pending") },
    accepted: { icon: "ri-calendar-2-line", text: t("empty.accepted") },
    completed: { icon: "ri-check-double-line", text: t("empty.completed") },
    rejected: { icon: "ri-close-circle-line", text: t("empty.rejected") },
  };

  if (loading) return <LoadingSpinner fullPage text={t("loading")} />;

  const activeList = tabData[activeTab] ?? [];

  return (
    <div className="pdash page-wrapper">
      <div className="container">



        {error && (
          <div className="alert alert--error">
            <i className="ri-error-warning-fill" /> {error}
            <button type="button" className="btn btn--sm btn--ghost" onClick={fetchBookings}>{tc("retry")}</button>
          </div>
        )}

        {/* ── Summary strip ──────────────────────────────────────────── */}
        <div className="pdash-stats">
          {[
            { labelKey: "stats.Requests", count: pending.length, icon: "ri-notification-4-line", color: "warning" },
            { labelKey: "stats.Upcoming", count: accepted.length, icon: "ri-calendar-line", color: "accent" },
            { labelKey: "stats.Completed", count: completed.length, icon: "ri-check-double-line", color: "success" },
            { labelKey: "stats.Declined", count: rejected.length, icon: "ri-close-circle-line", color: "danger" },
          ].map(({ labelKey, count, icon, color }) => (
            <div key={labelKey} className={`pdash-stat pdash-stat--${color}`}>
              <i className={icon} />
              <span className="pdash-stat__count">{count}</span>
              <span className="pdash-stat__label">{t(labelKey)}</span>
            </div>
          ))}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div className="tabs pdash-tabs">
          {tabs.map(({ key, label, icon }) => {
            const count = tabData[key]?.length ?? 0;
            return (
              <button
                key={key}
                className={`tab-btn ${activeTab === key ? "tab-btn--active" : ""}`}
                onClick={() => setActiveTab(key)}
              >
                <i className={icon} /> {label}
                {count > 0 && <span className="tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ────────────────────────────────────────────── */}
        {activeList.length === 0 ? (
          <div className="empty-state">
            <i className={emptyMessages[activeTab].icon} />
            <p>{emptyMessages[activeTab].text}</p>
          </div>
        ) : (
          <div className="pdash-cards">

            {/* Requests tab */}
            {activeTab === "pending" && activeList.map((booking) => (
              <div key={booking.bookingId ?? booking.BookingId} className="pdash-request card card--interactive">
                <div className="pdash-request__top">
                  <div className="pdash-request__customer">
                    <CustomerAvatar booking={booking} />
                    <div className="pdash-request__customer-text">
                      <p className="pdash-request__name">{booking.customerName ?? booking.CustomerName ?? t("customer")}</p>
                      <CustomerReputation rating={booking.customerRating ?? booking.CustomerRating} />
                      <p className="pdash-request__date">
                        <i className="ri-calendar-line" /> {formatDate(booking.serviceDate)}
                      </p>
                    </div>
                  </div>
                  <div className="pdash-request__meta">
                    <span className="badge badge--pending">{t("badges.pending")}</span>
                  </div>
                </div>
                {booking.serviceAddress && (
                  <p className="pdash-request__notes"><i className="ri-map-pin-line" /> {booking.serviceAddress}</p>
                )}
                {booking.customerPhone && (
                  <p className="pdash-request__notes" style={{ cursor: "pointer" }} onClick={() => window.location.href = `tel:${booking.customerPhone}`}>
                    <i className="ri-phone-line" />
                    <a href={`tel:${booking.customerPhone}`} style={{ color: "inherit" }} onClick={(e) => e.stopPropagation()}>
                      {booking.customerPhone}
                    </a>
                  </p>
                )}
                {booking.description && (
                  <p className="pdash-request__notes"><i className="ri-sticky-note-line" /> "{booking.description}"</p>
                )}
                {(booking.problemImageUrl ?? booking.imageUrl) && (
                  <div className="pdash-attachment">
                    <div className="pdash-attachment__label">
                      <i className="ri-camera-line" /> {t("customerPhoto")}
                    </div>
                    <a href={booking.problemImageUrl ?? booking.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={booking.problemImageUrl ?? booking.imageUrl} alt={t("attachmentAlt")} loading="lazy" />
                    </a>
                  </div>
                )}

                <div className="pdash-request__actions">
                  <Link className="btn btn--ghost btn--sm" to={`/chat/${booking.bookingId ?? booking.BookingId}`}>
                    <i className="ri-chat-3-line" /> {t("chat")}
                  </Link>
                  <button
                    className="btn btn--success"
                    disabled={actionId === (booking.bookingId ?? booking.BookingId)}
                    onClick={() => handleAccept(booking.bookingId ?? booking.BookingId)}
                  >
                    {actionId === (booking.bookingId ?? booking.BookingId) ? <LoadingSpinner size="sm" /> : <><i className="ri-check-line" /> {t("accept")}</>}
                  </button>
                  <button
                    className="btn btn--danger"
                    disabled={actionId === (booking.bookingId ?? booking.BookingId)}
                    onClick={() => handleReject(booking.bookingId ?? booking.BookingId)}
                  >
                    <i className="ri-close-line" /> {t("decline")}
                  </button>
                </div>
              </div>
            ))}

            {/* Upcoming tab */}
            {activeTab === "accepted" && activeList.map((booking) => (
              <div key={booking.bookingId} className="pdash-request card card--interactive">
                <div className="pdash-request__top">
                  <div className="pdash-request__customer">
                    <CustomerAvatar booking={booking} />
                    <div className="pdash-request__customer-text">
                      <p className="pdash-request__name">{booking.customerName ?? booking.CustomerName ?? t("customer")}</p>
                      <CustomerReputation rating={booking.customerRating ?? booking.CustomerRating} />
                      <p className="pdash-request__date">
                        <i className="ri-calendar-line" /> {formatDate(booking.serviceDate)}
                      </p>
                    </div>
                  </div>
                  <div className="pdash-request__meta">
                    <span className="badge badge--accepted">{t("badges.accepted")}</span>
                  </div>
                </div>
                {booking.serviceAddress && (
                  <p className="pdash-request__notes"><i className="ri-map-pin-line" /> {booking.serviceAddress}</p>
                )}
                {booking.customerPhone && (
                  <p className="pdash-request__notes" style={{ cursor: "pointer" }} onClick={() => window.location.href = `tel:${booking.customerPhone}`}>
                    <i className="ri-phone-line" />
                    <a href={`tel:${booking.customerPhone}`} style={{ color: "inherit" }} onClick={(e) => e.stopPropagation()}>
                      {booking.customerPhone}
                    </a>
                  </p>
                )}
                {booking.description && (
                  <p className="pdash-request__notes"><i className="ri-sticky-note-line" /> {booking.description}</p>
                )}
                {(booking.problemImageUrl ?? booking.imageUrl) && (
                  <div className="pdash-attachment">
                    <div className="pdash-attachment__label">
                      <i className="ri-camera-line" /> {t("customerPhoto")}
                    </div>
                    <a href={booking.problemImageUrl ?? booking.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={booking.problemImageUrl ?? booking.imageUrl} alt={t("attachmentAlt")} loading="lazy" />
                    </a>
                  </div>
                )}
                <div className="pdash-request__actions">
                  <Link className="btn btn--ghost btn--sm" to={`/chat/${booking.bookingId}`}>
                    <i className="ri-chat-3-line" /> {t("chat")}
                  </Link>
                  <button
                    className="btn btn--success"
                    disabled={actionId === booking.bookingId}
                    onClick={() => handleComplete(booking.bookingId)}
                  >
                    {actionId === booking.bookingId ? <LoadingSpinner size="sm" /> : <><i className="ri-check-double-line" /> {t("complete")}</>}
                  </button>
                </div>
              </div>
            ))}

            {/* Completed tab */}
            {activeTab === "completed" && activeList.map((booking) => (
              <div key={booking.bookingId} className="pdash-request card card--interactive">
                <div className="pdash-request__top">
                  <div className="pdash-request__customer">
                    <CustomerAvatar booking={booking} />
                    <div className="pdash-request__customer-text">
                      <p className="pdash-request__name">{booking.customerName ?? booking.CustomerName ?? t("customer")}</p>
                      <CustomerReputation rating={booking.customerRating ?? booking.CustomerRating} />
                      <p className="pdash-request__date">
                        <i className="ri-calendar-line" /> {formatDate(booking.serviceDate)}
                      </p>
                    </div>
                  </div>
                  <div className="pdash-request__meta">
                    <span className="badge badge--completed">{t("badges.completed")}</span>
                  </div>
                </div>
                {booking.serviceAddress && (
                  <p className="pdash-request__notes"><i className="ri-map-pin-line" /> {booking.serviceAddress}</p>
                )}
                {booking.customerPhone && (
                  <p className="pdash-request__notes" style={{ cursor: "pointer" }} onClick={() => window.location.href = `tel:${booking.customerPhone}`}>
                    <i className="ri-phone-line" />
                    <a href={`tel:${booking.customerPhone}`} style={{ color: "inherit" }} onClick={(e) => e.stopPropagation()}>
                      {booking.customerPhone}
                    </a>
                  </p>
                )}
                {booking.description && (
                  <p className="pdash-request__notes"><i className="ri-sticky-note-line" /> {booking.description}</p>
                )}
                {(booking.problemImageUrl ?? booking.imageUrl) && (
                  <div className="pdash-attachment">
                    <div className="pdash-attachment__label">
                      <i className="ri-camera-line" /> {t("customerPhoto")}
                    </div>
                    <a href={booking.problemImageUrl ?? booking.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={booking.problemImageUrl ?? booking.imageUrl} alt={t("attachmentAlt")} loading="lazy" />
                    </a>
                  </div>
                )}
                <div className="pdash-request__actions">
                  {reviewStatuses[booking.bookingId]?.isRatedByProvider === false ? (
                    <button className="btn btn--outline" onClick={() => setRateModal(booking)}>
                      <i className="ri-star-line" /> {t("rateCustomer")}
                    </button>
                  ) : reviewStatuses[booking.bookingId]?.isRatedByProvider === true ? (
                    <span className="booking-card__rated" style={{ fontWeight: 600, color: "#f59e0b" }}>
                      <i className="ri-star-fill" /> {t("rated")}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}

            {/* Declined tab */}
            {activeTab === "rejected" && activeList.map((booking) => (
              <div key={booking.bookingId} className="pdash-request card card--interactive">
                <div className="pdash-request__top">
                  <div className="pdash-request__customer">
                    <CustomerAvatar booking={booking} />
                    <div className="pdash-request__customer-text">
                      <p className="pdash-request__name">{booking.customerName ?? booking.CustomerName ?? t("customer")}</p>
                      <CustomerReputation rating={booking.customerRating ?? booking.CustomerRating} />
                      <p className="pdash-request__date">
                        <i className="ri-calendar-line" /> {formatDate(booking.serviceDate)}
                      </p>
                    </div>
                  </div>
                  <div className="pdash-request__meta">
                    <span className="badge badge--rejected">{t("badges.rejected")}</span>
                  </div>
                </div>
                {booking.serviceAddress && (
                  <p className="pdash-request__notes"><i className="ri-map-pin-line" /> {booking.serviceAddress}</p>
                )}
                {booking.customerPhone && (
                  <p className="pdash-request__notes" style={{ cursor: "pointer" }} onClick={() => window.location.href = `tel:${booking.customerPhone}`}>
                    <i className="ri-phone-line" />
                    <a href={`tel:${booking.customerPhone}`} style={{ color: "inherit" }} onClick={(e) => e.stopPropagation()}>
                      {booking.customerPhone}
                    </a>
                  </p>
                )}
                {booking.description && (
                  <p className="pdash-request__notes"><i className="ri-sticky-note-line" /> {booking.description}</p>
                )}
                {(booking.problemImageUrl ?? booking.imageUrl) && (
                  <div className="pdash-attachment">
                    <div className="pdash-attachment__label">
                      <i className="ri-camera-line" /> {t("customerPhoto")}
                    </div>
                    <a href={booking.problemImageUrl ?? booking.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={booking.problemImageUrl ?? booking.imageUrl} alt={t("attachmentAlt")} loading="lazy" />
                    </a>
                  </div>
                )}
              </div>
            ))}

          </div>
        )}
      </div>

      {rateModal && (
        <RateCustomerModal
          booking={rateModal}
          onClose={() => setRateModal(null)}
          onSubmit={handleRateCustomer}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
