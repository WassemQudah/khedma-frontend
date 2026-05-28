import React, { useState } from "react";
import "../styles/StarRating.css";

export default function StarRating({
  rating = 0,
  maxStars = 5,
  onRate,
  readonly = false,
  size = "md",
}) {
  const [hover, setHover] = useState(0);
  const active = hover || rating;

  return (
    <div
      className={`star-rating star-rating--${size} ${readonly ? "star-rating--readonly" : ""}`}
      aria-label={`Rating: ${rating} out of ${maxStars}`}
    >
      {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          className={`star ${star <= active ? "star--filled" : "star--empty"}`}
          onClick={() => !readonly && onRate && onRate(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          disabled={readonly}
          aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
