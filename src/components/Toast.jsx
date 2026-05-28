/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useState } from "react";
import "../styles/Toast.css";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success", duration = 4500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            onClick={() => remove(t.id)}
            role="alert"
          >
            <span className="toast-icon">
              {t.type === "success" ? (
                <i className="ri-checkbox-circle-fill" />
              ) : t.type === "error" ? (
                <i className="ri-error-warning-fill" />
              ) : (
                <i className="ri-information-fill" />
              )}
            </span>
            <span className="toast-message">{t.message}</span>
            <button className="toast-close" onClick={() => remove(t.id)} aria-label="Dismiss">
              <i className="ri-close-line" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
