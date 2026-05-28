import React from "react";
import "../styles/LoadingSpinner.css";

export default function LoadingSpinner({ size = "md", text, fullPage = false }) {
  const spinner = (
    <div className="spinner-wrapper">
      <div className={`spinner spinner--${size}`} />
      {text && <p className="spinner-text">{text}</p>}
    </div>
  );

  if (fullPage) {
    return <div className="spinner-overlay">{spinner}</div>;
  }
  return spinner;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton--avatar" />
      <div className="skeleton-body">
        <div className="skeleton skeleton--line skeleton--wide" />
        <div className="skeleton skeleton--line skeleton--medium" />
        <div className="skeleton skeleton--line skeleton--short" />
      </div>
    </div>
  );
}
