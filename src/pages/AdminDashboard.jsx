import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { resolveCategories } from "../config/config";
import useCategories from "../hooks/useCategories";
import { useToast } from "../components/Toast";
import LoadingSpinner from "../components/LoadingSpinner";
import parseApiError from "../utils/parseApiError";
import "../styles/AdminDashboard.css";

export default function AdminDashboard() {
  const { t } = useTranslation("admin");
  const { t: tc } = useTranslation("common");
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  const { categories: allCategories } = useCategories();

  const [stats,       setStats]       = useState(null);
  const [users,       setUsers]       = useState([]);
  const [providers,   setProviders]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [actionId,    setActionId]    = useState(null);

  const [csvFile,      setCsvFile]      = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const csvInputRef = useRef(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true); setError("");
    try {
      const [statsRes, usersRes] = await Promise.allSettled([
        api.get("/api/Admin/stats"),
        api.get("/api/Admin/users"),
      ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);

      if (usersRes.status === "fulfilled") {
        const all = Array.isArray(usersRes.value.data)
          ? usersRes.value.data
          : (usersRes.value.data?.data ?? []);
        setUsers(all.filter((u) => (u.role ?? u.accountType) !== "Provider"));
        setProviders(all.filter((u) => (u.role ?? u.accountType) === "Provider"));
      } else {
        setError(parseApiError(usersRes.reason, t("loadUsersErrorFallback")));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId, name) => {
    setActionId(`toggle-${userId}`);
    try {
      await api.put(`/api/Admin/users/${userId}/toggle-status`);
      showToast(t("toastToggle", { name }), "success");
      fetchAll();
    } catch (err) {
      showToast(parseApiError(err, t("toastToggleFail")), "error");
    } finally {
      setActionId(null);
    }
  };

  const handleCsvUpload = async (e) => {
    e.preventDefault();
    if (!csvFile) return;
    const formData = new FormData();
    formData.append("file", csvFile);
    setCsvUploading(true);
    try {
      await api.post("/api/Admin/seed-categories-csv", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast(t("toastCsvOk"), "success");
      setCsvFile(null);
      if (csvInputRef.current) csvInputRef.current.value = "";
    } catch (err) {
      showToast(parseApiError(err, t("toastCsvFail")), "error");
    } finally {
      setCsvUploading(false);
    }
  };

  const revenueDisplay =
      stats?.totalRevenue != null
        ? t("currencyJod", { amount: Number(stats.totalRevenue).toFixed(0) })
        : stats?.revenue != null
          ? t("currencyJod", { amount: Number(stats.revenue).toFixed(0) })
          : t("revenueUnavailable");

  const statCards = [
    { icon: "ri-user-line",               labelKey: "stats.totalUsers",     value: stats?.totalUsers     ?? stats?.usersCount     ?? users.length },
    { icon: "ri-tools-line",              labelKey: "stats.providers",       value: stats?.totalProviders ?? stats?.providersCount ?? providers.length },
    { icon: "ri-calendar-check-line",     labelKey: "stats.totalBookings",  value: stats?.totalBookings  ?? stats?.bookingsCount  ?? tc("dash") },
    { icon: "ri-money-dollar-circle-line",labelKey: "stats.revenue", value: revenueDisplay },
  ];

  const ActionCell = ({ id, name }) => {
    const uid = id;
    return (
      <div className="admin-actions">
        <button
          className="btn btn--ghost btn--sm"
          disabled={!!actionId}
          onClick={() => handleToggleStatus(uid, name)}
          title={t("toggleTitle")}
        >
          {actionId === `toggle-${uid}`
            ? <LoadingSpinner size="sm" />
            : <><i className="ri-toggle-line" /> {t("toggle")}</>
          }
        </button>
      </div>
    );
  };

  return (
    <div className="admin page-wrapper">
      <div className="container">
        <div className="page-header">
          <h1><i className="ri-shield-star-line" /> {t("pageTitle")}</h1>
          <p>{t("tagline")}</p>
        </div>

        <div className="admin-stats">
          {statCards.map(({ icon, labelKey, value }) => (
            <div key={labelKey} className="admin-stat card">
              <i className={icon} />
              <div>
                <span className="admin-stat__count">{value}</span>
                <span className="admin-stat__label">{t(labelKey)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="tabs admin-tabs">
          {[
            { key: "users",     icon: "ri-user-line",   label: t("tabs.usersCount", { count: users.length }) },
            { key: "providers", icon: "ri-tools-line",  label: t("tabs.providersCount", { count: providers.length }) },
            { key: "tools",     icon: "ri-settings-3-line", label: t("tabs.tools") },
          ].map(({ key, icon, label }) => (
            <button
              key={key}
              className={`tab-btn ${activeTab === key ? "tab-btn--active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              <i className={icon} /> {label}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner fullPage text={t("loadingData")} />
        ) : error ? (
          <div className="alert alert--error">
            <i className="ri-error-warning-fill" /> {error}
            <button className="btn btn--sm btn--ghost" onClick={fetchAll}>{tc("retry")}</button>
          </div>
        ) : (
          <>
            {activeTab === "users" && (
              <div className="card admin-table-card">
                {users.length === 0 ? (
                  <div className="empty-state"><i className="ri-user-line" /><p>{t("table.noUsers")}</p></div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr><th>{t("table.name")}</th><th>{t("table.email")}</th><th>{t("table.role")}</th><th>{t("table.status")}</th><th>{t("table.actions")}</th></tr>
                      </thead>
                      <tbody>
                        {users.map((u) => {
                          const uid = u.id ?? u.userId;
                          const roleLabel = u.role ?? t("rolesFallback.customer");
                          return (
                            <tr key={uid}>
                              <td>
                                <div className="admin-user-name">
                                  <div className="admin-avatar">{(u.fullName ?? u.email ?? "U").charAt(0).toUpperCase()}</div>
                                  {u.fullName ?? tc("dash")}
                                </div>
                              </td>
                              <td className="admin-email">{u.email}</td>
                              <td>
                                <span className={`badge badge--${(u.role ?? "customer").toLowerCase()}`}>
                                  {roleLabel}
                                </span>
                              </td>
                              <td>
                                <span className={`badge badge--${u.isActive === false || u.isBanned ? "cancelled" : "confirmed"}`}>
                                  {u.isActive === false || u.isBanned ? t("statusBadges.banned") : t("statusBadges.active")}
                                </span>
                              </td>
                              <td><ActionCell id={uid} name={u.fullName ?? u.email} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "providers" && (
              <div className="card admin-table-card">
                {providers.length === 0 ? (
                  <div className="empty-state"><i className="ri-tools-line" /><p>{t("table.noProviders")}</p></div>
                ) : (
                  <div className="table-wrapper">
                    <table className="table">
                      <thead>
                        <tr><th>{t("table.businessName")}</th><th>{t("table.city")}</th><th>{t("table.categories")}</th><th>{t("table.email")}</th><th>{t("table.status")}</th><th>{t("table.actions")}</th></tr>
                      </thead>
                      <tbody>
                        {providers.map((p) => {
                          const uid = p.id ?? p.userId ?? p.providerId;
                          return (
                            <tr key={uid}>
                              <td>
                                <div className="admin-user-name">
                                  <div className="admin-avatar admin-avatar--green">
                                    {(p.businessName ?? p.fullName ?? "P").charAt(0).toUpperCase()}
                                  </div>
                                  {p.businessName ?? p.fullName ?? tc("dash")}
                                </div>
                              </td>
                              <td>{p.workCity ?? tc("dash")}</td>
                              <td>
                                <span className="admin-categories">
                                  {resolveCategories(p, allCategories).map((c) => c.name).join(", ") || tc("dash")}
                                </span>
                              </td>
                              <td className="admin-email">{p.email}</td>
                              <td>
                                <span className={`badge badge--${p.isActive === false || p.isBanned ? "cancelled" : "confirmed"}`}>
                                  {p.isActive === false || p.isBanned ? t("statusBadges.banned") : t("statusBadges.active")}
                                </span>
                              </td>
                              <td><ActionCell id={uid} name={p.businessName ?? p.fullName ?? p.email} /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "tools" && (
              <div className="admin-tools">
                <div className="card admin-tool-card">
                  <div className="admin-tool-card__header">
                    <i className="ri-file-upload-line" />
                    <div>
                      <h3>{t("tools.csvTitle")}</h3>
                      <p>{t("tools.csvDesc")}</p>
                    </div>
                  </div>
                  <form onSubmit={handleCsvUpload} className="admin-csv-form">
                    <label className="admin-csv-label" htmlFor="csvFile">
                      {csvFile ? (
                        <><i className="ri-file-text-line" /> {csvFile.name}</>
                      ) : (
                        <><i className="ri-upload-2-line" /> {t("tools.csvSelect")}</>
                      )}
                      <input
                        ref={csvInputRef}
                        id="csvFile"
                        type="file"
                        accept=".csv,text/csv"
                        className="admin-csv-input"
                        onChange={(e) => setCsvFile(e.target.files[0] ?? null)}
                      />
                    </label>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={!csvFile || csvUploading}
                    >
                      {csvUploading
                        ? <><LoadingSpinner size="sm" /> {t("tools.uploading")}</>
                        : <><i className="ri-upload-cloud-line" /> {t("tools.uploadSeed")}</>
                      }
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
