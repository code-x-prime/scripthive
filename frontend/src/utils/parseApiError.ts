/** Read a human-friendly error message from any API response (JSON or plain text). */
export async function parseApiError(
  res: Response,
  fallback = "Something went wrong. Please try again."
): Promise<string> {
  const status = res.status;

  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as {
        message?: string;
        errors?: { msg?: string; path?: string }[];
      };
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const msgs = data.errors.map((e) => e.msg?.trim()).filter(Boolean) as string[];
        if (msgs.length > 0) return msgs.join(" ");
      }
      if (data.message && data.message !== "Validation failed") return data.message;
      return fallback;
    }

    const text = (await res.text()).trim();
    if (status === 429 || /too many/i.test(text)) {
      return "Too many login attempts. Please wait 15 minutes and try again.";
    }
    if (text) return text;
  } catch {
    // body already consumed or not readable
  }

  if (status === 429) {
    return "Too many login attempts. Please wait 15 minutes and try again.";
  }
  if (status === 401) {
    return "Invalid email/username or password. Please check your credentials and try again.";
  }
  if (status === 400) {
    return "Invalid request. Please check your details and try again.";
  }
  if (status >= 500) {
    return "Server error. Please try again in a few minutes.";
  }

  return fallback;
}
