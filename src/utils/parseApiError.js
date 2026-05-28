/**
 * Extracts a human-readable error message from an Axios error response.
 * Handles three common shapes from the ASP.NET Core backend:
 *
 *  1. ProblemDetails validation errors:
 *     { errors: { Field: ["msg1", "msg2"] }, title: "One or more validation errors…" }
 *  2. Plain message:
 *     { message: "Something went wrong." }
 *  3. ProblemDetails title only:
 *     { title: "Conflict" }
 */
export default function parseApiError(err, fallback = "Something went wrong. Please try again.") {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;

  // 1. Validation errors object — collect all field messages
  if (data.errors && typeof data.errors === "object") {
    const msgs = Object.values(data.errors).flat();
    if (msgs.length) return msgs.join(" ");
  }

  // 2. Plain message field
  if (typeof data.message === "string" && data.message) return data.message;

  // 3. ProblemDetails title
  if (typeof data.title === "string" && data.title) return data.title;

  return fallback;
}
