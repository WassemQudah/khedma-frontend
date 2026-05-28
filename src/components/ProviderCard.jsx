import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BASE_URL, resolveCategories } from "../config/config";
import useCategories from "../hooks/useCategories";
import StarRating from "./StarRating";
import "../styles/ProviderCard.css";

export default function ProviderCard({ provider, listMode = false }) {
  const { t } = useTranslation("search");
  const navigate = useNavigate();
  const { categories: allCategories } = useCategories();

  // resolveCategories handles both the new `categories:[{id,name}]` shape
  // and the legacy `categoryIds:[1,2]` shape transparently.
  const categories = resolveCategories(provider, allCategories);

  // API may return businessName (profile endpoint) or fullName (search endpoint)
  const displayName = provider.businessName ?? provider.fullName ?? t("providerCard.fallbackName");

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // API may return ratingAverage (profile) or rating (legacy)
  const rating = provider.ratingAverage ?? provider.rating ?? null;
  const reviewCount = provider.reviewCount ?? provider.totalReviews ?? null;
  const hasRating = rating != null && rating > 0;

  const rawAvatarUrl =
    provider.profileImageUrl
    ?? provider.ProfileImageUrl
    ?? provider.profileImageURL
    ?? provider.ProfileImageURL
    ?? provider.imageUrl
    ?? provider.ImageUrl
    ?? provider.avatarUrl
    ?? provider.AvatarUrl
    ?? "";
  const avatarUrl = (() => {
    if (!rawAvatarUrl) return "";
    const s = String(rawAvatarUrl).trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith("/")) return `${BASE_URL}${s}`;
    return `${BASE_URL}/${s}`;
  })();

  return (
    <article
      className={`provider-card${listMode ? " provider-card--list" : ""}`}
      onClick={() => navigate(`/provider/${provider.providerId}`)}
    >
      {/* Top accent bar */}
      <div className="provider-card__accent-bar" />

      <div className="provider-card__body">
        <div className="provider-card__header">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="provider-card__avatar"
              loading="lazy"
            />
          ) : (
            <div className="provider-card__avatar provider-card__avatar--placeholder">
              {initials}
            </div>
          )}
          <div className="provider-card__info">
            <h3 className="provider-card__name">{displayName}</h3>
            <p className="provider-card__city">
              <i className="ri-map-pin-2-line" /> {provider.workCity}
              {provider.specificLocation && (
                <span className="provider-card__location"> · {provider.specificLocation}</span>
              )}
            </p>
            {/* Rating row */}
            <div className="provider-card__rating">
              {hasRating ? (
                <>
                  <StarRating rating={Math.round(rating)} readonly size="sm" />
                  <span className="provider-card__rating-score">
                    {Number(rating).toFixed(1)}
                  </span>
                  {reviewCount != null && (
                    <span className="provider-card__rating-count">
                      ({reviewCount})
                    </span>
                  )}
                </>
              ) : (
                <span className="provider-card__rating-empty">
                  <i className="ri-star-line" /> {t("providerCard.noReviewsYet")}
                </span>
              )}
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <div className="provider-card__categories">
            {categories.slice(0, 3).map((cat) => (
              <span key={cat.id} className="badge badge--blue provider-card__cat-badge">
                {cat.icon && (
                  <i className={`provider-card__cat-icon ${cat.icon}`} aria-hidden />
                )}
                <span>{cat.name}</span>
              </span>
            ))}
            {categories.length > 3 && (
              <span className="badge badge--muted">+{categories.length - 3}</span>
            )}
          </div>
        )}

        <div className="provider-card__footer">
          <div className="provider-card__price-block">
            <span className="provider-card__price-label">{t("providerCard.startingFrom")}</span>
            <span className="provider-card__price-value">
              <strong>{provider.basePrice}</strong>
              <span className="provider-card__price-currency"> JOD</span>
              <span className="provider-card__price-unit">{t("providerCard.perHour")}</span>
            </span>
          </div>
          <button
            className="btn btn--primary btn--sm provider-card__cta"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/provider/${provider.providerId}`);
            }}
          >
            {t("providerCard.viewProfile")}
            <i className="ri-arrow-right-line" />
          </button>
        </div>
      </div>
    </article>
  );
}
