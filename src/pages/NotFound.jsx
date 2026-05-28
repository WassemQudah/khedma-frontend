import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../styles/NotFound.css";

export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation("notFound");

  return (
    <div className="not-found page-wrapper">
      <div className="not-found__inner animate-fade-up">
        <div className="not-found__glitch" aria-hidden>404</div>
        <div className="not-found__code">404</div>
        <h1 className="not-found__title">{t("title")}</h1>
        <p className="not-found__subtitle">{t("subtitle")}</p>
        <div className="not-found__actions">
          <button className="btn btn--primary btn--lg" onClick={() => navigate("/")}>
            <i className="ri-home-4-line" /> {t("backHome")}
          </button>
          <button className="btn btn--ghost btn--lg" onClick={() => navigate("/search")}>
            <i className="ri-search-line" /> {t("browseServices")}
          </button>
        </div>
        <div className="not-found__deco" aria-hidden>
          <div className="not-found__deco-circle not-found__deco-circle--1" />
          <div className="not-found__deco-circle not-found__deco-circle--2" />
        </div>
      </div>
    </div>
  );
}
