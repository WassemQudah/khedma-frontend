import React from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import "../styles/StaticPage.css";

export default function Privacy() {
  const { t } = useTranslation("privacy");
  const sections = t("sections", { returnObjects: true });
  const list = Array.isArray(sections) ? sections : [];

  return (
    <div className="static-page page-wrapper">
      <div className="container">
        <div className="static-page__header">
          <h1>{t("title")}</h1>
          <p>{t("lastUpdated")}</p>
        </div>
        <div className="static-page__content card">
          {list.map((section, idx) => (
            <section key={idx}>
              <h2>{section.heading}</h2>
              {Array.isArray(section.paragraphs) &&
                section.paragraphs.map((para, j) => <p key={j}>{para}</p>)}
              {Array.isArray(section.list) && (
                <ul>
                  {section.list.map((item, k) => (
                    <li key={k}>{item}</li>
                  ))}
                </ul>
              )}
              {section.contactHtml && (
                <p>
                  <Trans
                    defaults={section.contactHtml}
                    components={{ mail: <a href="mailto:privacy@khedma.jo" /> }}
                  />
                </p>
              )}
            </section>
          ))}
        </div>
        <div className="static-page__footer">
          <Link to="/">{t("backHome")}</Link>
          <Link to="/terms">{t("linkTerms")}</Link>
        </div>
      </div>
    </div>
  );
}
