"use strict";
(() => {
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

  const api = { validateCredentials };
  if (typeof window !== "undefined") window.DigiFlovvAuthValidation = api;
  if (typeof module !== "undefined") module.exports = api;
})();
