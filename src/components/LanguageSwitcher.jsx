import React from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS } from "../i18n/config";

/** Compact EN | عربي toggle for layouts that initialize i18n (e.g. Landing). */
export default function LanguageSwitcher({ className = "" }) {
  const { i18n, t } = useTranslation("nav");
  const current = i18n.resolvedLanguage?.split("-")[0] || i18n.language?.split("-")[0] || "en";

  return (
    <div
      className={`lang-switch ${className}`}
      role="group"
      aria-label={t("langSwitcher.ariaLabel")}
    >
      {SUPPORTED_LANGS.map(({ code, labelNative }) => {
        const active = current === code;
        return (
          <button
            key={code}
            type="button"
            className={`lang-switch__btn${active ? " lang-switch__btn--active" : ""}`}
            onClick={() => void i18n.changeLanguage(code)}
            aria-current={active ? "true" : undefined}
          >
            {labelNative}
          </button>
        );
      })}
    </div>
  );
}
