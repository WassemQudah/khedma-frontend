import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { uploadImage } from "../api/services";

export default function ImageUploader({
  value = "",
  onChange,
  label,
  hint,
  fieldName = "file",
  previewShape = "square",
  disabled = false,
}) {
  const { t } = useTranslation("common");
  const resolvedLabel = label ?? t("upload.defaultLabel");
  const resolvedHint = hint ?? t("upload.defaultHint");
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const processFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError(t("upload.notImage"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t("upload.tooLarge"));
      return;
    }
    setUploadError("");
    setUploading(true);
    setProgress(0);
    try {
      const { imageUrl } = await uploadImage(file, fieldName, (pct) => setProgress(pct));
      onChange?.(imageUrl);
      setProgress(100);
    } catch {
      setUploadError(t("upload.failed"));
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => processFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    processFile(e.dataTransfer.files?.[0]);
  };

  const handleRemove = () => {
    onChange?.("");
    setProgress(0);
    setUploadError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const circleClass = previewShape === "circle" ? " img-uploader__preview--circle" : "";

  return (
    <div className="img-uploader">
      {resolvedLabel && (
        <label className="form-label" style={{ marginBottom: "0.5rem", display: "block" }}>
          {resolvedLabel}
        </label>
      )}

      <div
        className={`img-uploader__zone${dragging ? " img-uploader__zone--drag" : ""}${disabled ? " img-uploader__zone--disabled" : ""}`}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {value && !uploading ? (
          <img
            src={value}
            alt={t("previewAlt")}
            className={`img-uploader__preview${circleClass}`}
          />
        ) : uploading ? (
          <div className="img-uploader__progress-wrap">
            <div className="img-uploader__spinner" />
            <div className="img-uploader__progress-bar-bg">
              <div
                className="img-uploader__progress-bar"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="img-uploader__progress-pct">{progress}%</span>
          </div>
        ) : (
          <div className="img-uploader__placeholder">
            <i className="ri-image-add-line" />
            <span>{dragging ? t("upload.dropHere") : t("upload.clickOrDrag")}</span>
            {resolvedHint && <span className="form-hint">{resolvedHint}</span>}
          </div>
        )}
      </div>

      {uploading && (
        <div className="img-uploader__inline-bar-bg">
          <div className="img-uploader__inline-bar" style={{ width: `${progress}%` }} />
        </div>
      )}

      {(value || uploadError) && !uploading && (
        <div className="img-uploader__controls">
          {value && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => !disabled && inputRef.current?.click()}
              disabled={disabled}
            >
              <i className="ri-refresh-line" /> {t("upload.replace")}
            </button>
          )}
          {value && (
            <button
              type="button"
              className="btn btn--ghost btn--sm img-uploader__remove-btn"
              onClick={handleRemove}
              disabled={disabled}
            >
              <i className="ri-delete-bin-line" /> {t("upload.remove")}
            </button>
          )}
          {uploadError && <span className="form-error">{uploadError}</span>}
        </div>
      )}
      {!value && !uploading && uploadError && (
        <span className="form-error" style={{ marginTop: "0.25rem", display: "block" }}>
          {uploadError}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileInput}
        disabled={disabled}
      />
    </div>
  );
}
