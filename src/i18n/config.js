import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import landingEn from "../locales/en/landing.json";
import landingAr from "../locales/ar/landing.json";
import navEn from "../locales/en/nav.json";
import navAr from "../locales/ar/nav.json";
import searchEn from "../locales/en/search.json";
import searchAr from "../locales/ar/search.json";
import providerProfileEn from "../locales/en/providerProfile.json";
import providerProfileAr from "../locales/ar/providerProfile.json";
import commonEn from "../locales/en/common.json";
import commonAr from "../locales/ar/common.json";
import notFoundEn from "../locales/en/notFound.json";
import notFoundAr from "../locales/ar/notFound.json";
import loginEn from "../locales/en/login.json";
import loginAr from "../locales/ar/login.json";
import bookingEn from "../locales/en/booking.json";
import bookingAr from "../locales/ar/booking.json";
import customerSetupEn from "../locales/en/customerSetup.json";
import customerSetupAr from "../locales/ar/customerSetup.json";
import providerSetupEn from "../locales/en/providerSetup.json";
import providerSetupAr from "../locales/ar/providerSetup.json";
import customerDashboardEn from "../locales/en/customerDashboard.json";
import customerDashboardAr from "../locales/ar/customerDashboard.json";
import providerDashboardEn from "../locales/en/providerDashboard.json";
import providerDashboardAr from "../locales/ar/providerDashboard.json";
import profileEn from "../locales/en/profile.json";
import profileAr from "../locales/ar/profile.json";
import adminEn from "../locales/en/admin.json";
import adminAr from "../locales/ar/admin.json";
import chatEn from "../locales/en/chat.json";
import chatAr from "../locales/ar/chat.json";
import privacyEn from "../locales/en/privacy.json";
import privacyAr from "../locales/ar/privacy.json";
import termsEn from "../locales/en/terms.json";
import termsAr from "../locales/ar/terms.json";

/** @type {const} */
export const SUPPORTED_LANGS = [
  { code: "en", labelEn: "EN", labelNative: "EN", rtl: false },
  { code: "ar", labelEn: "AR", labelNative: "عربي", rtl: true },
];

export const LANGUAGE_STORAGE_KEY = "khedma-lang";

function readStoredLanguage() {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (raw === "en" || raw === "ar") return raw;
  } catch {
    /* ignore private mode etc. */
  }
  return "en";
}

function applyDocumentLanguage(code) {
  const cfg = SUPPORTED_LANGS.find((l) => l.code === code) ?? SUPPORTED_LANGS[0];
  document.documentElement.lang = cfg.code === "ar" ? "ar" : "en";
  document.documentElement.dir = cfg.rtl ? "rtl" : "ltr";
}

const namespaces = [
  "landing",
  "nav",
  "search",
  "providerProfile",
  "common",
  "notFound",
  "login",
  "booking",
  "customerSetup",
  "providerSetup",
  "customerDashboard",
  "providerDashboard",
  "profile",
  "admin",
  "chat",
  "privacy",
  "terms",
];

i18n.use(initReactI18next).init({
  resources: {
    en: {
      landing: landingEn,
      nav: navEn,
      search: searchEn,
      providerProfile: providerProfileEn,
      common: commonEn,
      notFound: notFoundEn,
      login: loginEn,
      booking: bookingEn,
      customerSetup: customerSetupEn,
      providerSetup: providerSetupEn,
      customerDashboard: customerDashboardEn,
      providerDashboard: providerDashboardEn,
      profile: profileEn,
      admin: adminEn,
      chat: chatEn,
      privacy: privacyEn,
      terms: termsEn,
    },
    ar: {
      landing: landingAr,
      nav: navAr,
      search: searchAr,
      providerProfile: providerProfileAr,
      common: commonAr,
      notFound: notFoundAr,
      login: loginAr,
      booking: bookingAr,
      customerSetup: customerSetupAr,
      providerSetup: providerSetupAr,
      customerDashboard: customerDashboardAr,
      providerDashboard: providerDashboardAr,
      profile: profileAr,
      admin: adminAr,
      chat: chatAr,
      privacy: privacyAr,
      terms: termsAr,
    },
  },
  lng: readStoredLanguage(),
  fallbackLng: "en",
  defaultNS: "landing",
  ns: namespaces,
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(i18n.language);

i18n.on("languageChanged", (lng) => {
  const short = lng?.split("-")[0] === "ar" ? "ar" : "en";
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, short);
  } catch {
    /* ignore */
  }
  applyDocumentLanguage(short);
});

export default i18n;
