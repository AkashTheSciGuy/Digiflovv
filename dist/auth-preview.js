"use strict";

// Frontend demonstration only. This marker is NOT authentication or authorization.
// No email, name, password, token, or account record is stored.
(() => {
  const SESSION_KEY = "digiflovv.auth.preview.v1";
  const DURATION_MS = 30 * 60 * 1000;

  function validateCredentials(mode, values = {}) {
    const errors = {};
    const name = typeof values.name === "string" ? values.name.trim() : "";
    const email = typeof values.email === "string" ? values.email.trim() : "";
    const password = typeof values.password === "string" ? values.password : "";
    const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i;
    if (mode !== "login" && mode !== "signup") throw new Error("Unsupported account form");
    if (mode === "signup" && (name.length < 2 || name.length > 100)) errors.name = "Enter your name using 2–100 characters.";
    if (email.length > 254 || !emailPattern.test(email)) errors.email = "Enter a valid email address.";
    if (mode === "signup" && password.length < 8) errors.password = "Use at least 8 characters.";
    else if (!password.length) errors.password = "Enter your password.";
    if (password.length > 128) errors.password = "Use no more than 128 characters.";
    if (mode === "signup" && (!values.confirmPassword || values.confirmPassword !== password)) errors.confirmPassword = "The passwords do not match.";
    return errors;
  }

  function beginPreview(storage, now = Date.now()) {
    const marker = { mode: "preview", version: 1, expiresAt: now + DURATION_MS };
    const serialized = JSON.stringify(marker);
    storage.setItem(SESSION_KEY, serialized);
    if (storage.getItem(SESSION_KEY) !== serialized) throw new Error("Preview session could not be saved");
    return marker;
  }

  function readPreview(storage, now = Date.now()) {
    try {
      const value = JSON.parse(storage.getItem(SESSION_KEY));
      if (value?.mode === "preview" && value.version === 1 && Number.isFinite(value.expiresAt) &&
          value.expiresAt > now && value.expiresAt <= now + DURATION_MS) return value;
      storage.removeItem(SESSION_KEY);
    } catch { /* Unavailable or corrupt storage never opens a preview session. */ }
    return null;
  }

  function endPreview(storage) {
    storage.removeItem(SESSION_KEY);
  }

  const api = Object.freeze({ SESSION_KEY, DURATION_MS, validateCredentials, beginPreview, readPreview, endPreview });
  if (typeof window !== "undefined") window.DigiFlovvAuthPreview = api;
  if (typeof module !== "undefined") module.exports = api;
})();
