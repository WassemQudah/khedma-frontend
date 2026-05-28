import React, { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getProvider } from "../api/services";
import { resolveCategories } from "../config/config";
import useCategories from "../hooks/useCategories";
import { useAuth } from "../context/AuthContext";
import StarRating from "../components/StarRating";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/ProviderProfile.css";

export default function ProviderProfile() {
  const { t } = useTranslation("providerProfile");
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { categories: allCategories } = useCategories();

  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await getProvider(id);
        setProvider(data);
      } catch (err) {
        setError(err.response?.data?.message || t("errorFallback"));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, t]);

  if (loading) return <LoadingSpinner fullPage text={t("loading")} />;

  if (error || !provider) {
    return (
      <div className="page-wrapper">
        <div className="container empty-state" style={{ paddingTop: "6rem" }}>
          <i className="ri-user-unfollow-line" />
          <h3>{t("notFoundTitle")}</h3>
          <p>{error || t("notFoundDescription")}</p>
          <button type="button" className="btn btn--outline" onClick={() => navigate("/search")}>
            {t("backToSearch")}
          </button>
        </div>
      </div>
    );
  }

  const resolvedCategories = resolveCategories(provider, allCategories);

  const displayName =
    provider.businessName ?? provider.fullName ?? t("fallbackName");

  const rating = provider.ratingAverage ?? provider.rating ?? null;

  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  const canBook = user?.role === "Customer";

  return (
    <div className="provider-profile page-wrapper">
      <div className="container">

        <nav className="breadcrumb">
          <Link to="/search" className="breadcrumb-link">
            <i className="ri-arrow-left-s-line breadcrumb-link__icon" aria-hidden />
            {t("backToSearch")}
          </Link>
        </nav>

        <div className="pp-header card">
          <div className="pp-header__avatar-wrap">
            {provider.profileImageUrl ? (
              <img
                src={provider.profileImageUrl}
                alt={displayName}
                className="pp-header__avatar"
              />
            ) : (
              <div className="pp-header__avatar pp-header__avatar--placeholder">{initials}</div>
            )}
          </div>

          <div className="pp-header__info">
            <h1 className="pp-header__name">{displayName}</h1>

            <div className="pp-header__meta">
              <span>{provider.workCity}</span>
              {provider.phoneNumber && (
                <span><i className="ri-phone-line" /> {provider.phoneNumber}</span>
              )}
              {rating != null && rating > 0 && (
                <span>
                  <i className="ri-star-fill pp-star-icon" /> {Number(rating).toFixed(1)}
                  <span className="pp-header__rating-count">
                    {provider.reviewCount
                      ? ` ${t("reviewsCount", { count: provider.reviewCount })}`
                      : ""}
                  </span>
                </span>
              )}
            </div>

            {rating != null && rating > 0 && (
              <StarRating rating={Math.round(rating)} readonly size="sm" />
            )}

            {resolvedCategories.length > 0 && (
              <div className="pp-header__categories">
                {resolvedCategories.map((cat) => (
                  <span key={cat.id} className="badge badge--blue">
                    {cat.emoji && <>{cat.emoji} </>}{cat.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pp-header__cta">
            <div className="pp-header__price">
              <span className="pp-header__price-label">{t("startingFrom")}</span>
              <span className="pp-header__price-value">
                {t("priceAmount", { price: provider.basePrice })}
              </span>
              <span className="pp-header__price-unit">{t("perHour")}</span>
            </div>

            {canBook ? (
              <button
                type="button"
                className="btn btn--primary btn--xl"
                onClick={() => navigate(`/booking/${id}`)}
              >
                <i className="ri-calendar-check-line" /> {t("bookService")}
              </button>
            ) : !user ? (
              <button
                type="button"
                className="btn btn--primary btn--xl"
                onClick={() => navigate("/login")}
              >
                <i className="ri-login-box-line" /> {t("signInToBook")}
              </button>
            ) : (
              <p className="pp-header__no-book">{t("onlyCustomersBook")}</p>
            )}
          </div>
        </div>

        {provider.bio && (
          <div className="pp-section card">
            <h2 className="pp-section__title"><i className="ri-user-line" /> {t("about")}</h2>
            <p className="pp-bio">{provider.bio}</p>
          </div>
        )}

        {/* ── Portfolio ──────────────────────────────────────────────── */}
        {Array.isArray(provider.portfolio) && provider.portfolio.length > 0 && (
          <div className="pp-section card">
            <h2 className="pp-section__title">
              <i className="ri-gallery-line" /> {t("portfolio.title")}
            </h2>
            <div className="pp-portfolio-grid">
              {provider.portfolio.map((item, idx) => {
                const url = item.imageUrl ?? item.ImageUrl ?? item.url ?? "";
                return url ? (
                  <a
                    key={item.imageId ?? item.id ?? idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pp-portfolio-thumb"
                    title={t("portfolio.viewImage")}
                  >
                    <img src={url} alt={t("portfolio.imageAlt", { n: idx + 1 })} loading="lazy" />
                    <span className="pp-portfolio-thumb__overlay">
                      <i className="ri-zoom-in-line" />
                    </span>
                  </a>
                ) : null;
              })}
            </div>
          </div>
        )}

        <div className="pp-section card">
          <h2 className="pp-section__title">
            <i className="ri-briefcase-line" /> {t("serviceDetails")}
          </h2>
          <div className="pp-details-grid">
            <div className="pp-detail-item">
              <i className="ri-money-dollar-circle-line" />
              <div>
                <p className="pp-detail-label">{t("detail.basePrice")}</p>
                <p className="pp-detail-value">
                  {t("detail.basePriceValue", { price: provider.basePrice })}
                </p>
              </div>
            </div>
            <div className="pp-detail-item">
              <i className="ri-map-pin-2-line" />
              <div>
                <p className="pp-detail-label">{t("detail.serviceArea")}</p>
                <p className="pp-detail-value">{provider.workCity}</p>
              </div>
            </div>
            {provider.phoneNumber && (
              <div className="pp-detail-item">
                <i className="ri-phone-line" />
                <div>
                  <p className="pp-detail-label">{t("detail.phone")}</p>
                  <p className="pp-detail-value">{provider.phoneNumber}</p>
                </div>
              </div>
            )}
            {provider.specificLocation && (
              <div className="pp-detail-item">
                <i className="ri-map-pin-line" />
                <div>
                  <p className="pp-detail-label">{t("detail.specificLocation")}</p>
                  <p className="pp-detail-value">{provider.specificLocation}</p>
                </div>
              </div>
            )}
            {rating != null && (
              <div className="pp-detail-item">
                <i className="ri-star-line" />
                <div>
                  <p className="pp-detail-label">{t("detail.avgRating")}</p>
                  <p className="pp-detail-value">
                    {rating > 0
                      ? t("detail.ratingScore", { score: Number(rating).toFixed(1) })
                      : t("detail.noRatingsYet")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
