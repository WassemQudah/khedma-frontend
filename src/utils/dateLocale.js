/** BCP 47 locale for Date.prototype.toLocaleString / toLocaleDateString */
export function pickDateLocale(lang) {
  const short = (lang || "en").split("-")[0];
  return short === "ar" ? "ar-JO" : "en-US";
}
