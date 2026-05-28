import React, { useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CITIES } from "../config/config";
import useCategories from "../hooks/useCategories";
import "../styles/Landing.css";

const HIW_ICONS = ["ri-search-2-line", "ri-calendar-check-line", "ri-shield-check-line"];

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const { categories } = useCategories();
  const { t } = useTranslation("landing");

  const howItWorksSteps = t("howItWorks.steps", { returnObjects: true });
  const stepList = Array.isArray(howItWorksSteps) ? howItWorksSteps : [];

  const testimonialItems = t("testimonials.items", { returnObjects: true });
  const testimonialsList = Array.isArray(testimonialItems) ? testimonialItems : [];

  useEffect(() => {
    if (location.hash === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (location.hash === "#services") {
      const section = document.getElementById("services");
      if (!section) return;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (city) params.set("city", city);
    navigate(`/search?${params.toString()}`);
  };

  const year = new Date().getFullYear();

  return (
    <div className="landing">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero__bg-grid" aria-hidden />
        <div className="hero__bg-glow" aria-hidden />
        <div className="container hero__inner animate-fade-up">
          <div className="hero__eyebrow">
            <span className="badge badge--blue"><i className="ri-verified-badge-line" /> {t("hero.eyebrow")}</span>
          </div>
          <h1 className="hero__title">
            {t("hero.titleLine1")}<br />
            <span className="hero__title-accent">{t("hero.titleAccent")}</span>
          </h1>
          <p className="hero__subtitle">
            {t("hero.subtitle")}
          </p>

          <form className="hero__search" onSubmit={handleSearch}>
            <div className="hero__search-input-wrap">
              <i className="ri-search-line hero__search-icon" />
              <input
                type="text"
                placeholder={t("hero.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="hero__search-input"
              />
            </div>
            <div className="hero__search-divider" />
            <div className="hero__search-city-wrap">
              <i className="ri-map-pin-2-line hero__search-city-icon" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="hero__search-city"
              >
                <option value="">{t("hero.allCities")}</option>
                {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className="btn btn--primary btn--lg hero__search-btn">
              <i className="ri-search-line" /> {t("hero.search")}
            </button>
          </form>

        </div>
      </section>

      {/* ── Categories ──────────────────────────────────────────────────── */}
      <section id="services" className="section landing-categories">
        <div className="container">
          <div className="section-header">
            <span className="badge badge--blue">{t("categories.badge")}</span>
            <h2>{t("categories.heading")}</h2>
            <p>{t("categories.sub")}</p>
          </div>
          <div className="categories-grid">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="category-card"
                onClick={() => navigate(`/search?category=${cat.id}`)}
              >
                {cat.icon ? (
                  <i className={`category-card__icon ${cat.icon}`} aria-hidden />
                ) : (
                  <span className="category-card__emoji">{cat.emoji}</span>
                )}
                <span className="category-card__name">{cat.name}</span>
                <span className="category-card__desc">{cat.desc}</span>
                <i className="ri-arrow-right-line category-card__arrow" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section className="section section--alt landing-hiw">
        <div className="container">
          <div className="section-header">
            <span className="badge badge--green">{t("howItWorks.badge")}</span>
            <h2>{t("howItWorks.heading")}</h2>
            <p>{t("howItWorks.sub")}</p>
          </div>
          <div className="hiw-grid">
            {stepList.map((step, idx) => (
              <div key={step.step} className="hiw-card">
                <div className="hiw-card__number">{step.step}</div>
                <div className="hiw-card__icon-wrap">
                  <i className={HIW_ICONS[idx] ?? HIW_ICONS[0]} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
                {idx < stepList.length - 1 && (
                  <div className="hiw-card__connector" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────────────────── */}
      <section className="section landing-testimonials">
        <div className="container">
          <div className="section-header">
            <span className="badge badge--yellow">{t("testimonials.badge")}</span>
            <h2>{t("testimonials.heading")}</h2>
          </div>
          <div className="testimonials-grid">
            {testimonialsList.map((item) => (
              <div key={item.name} className="testimonial-card card">
                <div className="testimonial-card__stars">
                  {"★★★★★".split("").map((s, i) => <span key={`${item.name}-${i}`}>{s}</span>)}
                </div>
                <p className="testimonial-card__text">&ldquo;{item.quote}&rdquo;</p>
                <div className="testimonial-card__author">
                  <div className="testimonial-card__avatar">{item.avatar}</div>
                  <div>
                    <p className="testimonial-card__name">{item.name}</p>
                    <p className="testimonial-card__role">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Provider CTA ────────────────────────────────────────────────── */}
      <section className="section landing-cta">
        <div className="container">
          <div className="cta-banner">
            <div className="cta-banner__glow" aria-hidden />
            <div className="cta-banner__content">
              <span className="badge badge--blue"><i className="ri-tools-line" /> {t("cta.badge")}</span>
              <h2>{t("cta.heading")}</h2>
              <p>{t("cta.sub")}</p>
              <div className="cta-banner__actions">
                <button type="button" className="btn btn--primary btn--xl" onClick={() => navigate("/login?tab=signup")}>
                  <i className="ri-user-add-line" /> {t("cta.joinProvider")}
                </button>
                <button type="button" className="btn btn--ghost btn--lg" onClick={() => navigate("/search")}>
                  {t("cta.browseProviders")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="container">
          <div className="site-footer__inner">

            <nav className="site-footer__links">
              <Link to="/search">{t("footer.browse")}</Link>
              <Link to="/login?tab=signup">{t("footer.joinProvider")}</Link>
              <Link to="/privacy">{t("footer.privacy")}</Link>
              <Link to="/terms">{t("footer.terms")}</Link>
            </nav>
          </div>
          <p className="site-footer__copy">{t("footer.copyright", { year })}</p>
        </div>
      </footer>
    </div>
  );
}
