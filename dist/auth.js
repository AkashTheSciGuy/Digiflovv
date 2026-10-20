"use strict";

(() => {
  const auth = window.DigiFlovvAuthPreview;
  const mode = document.body.dataset.authPage;
  if (!auth) return;

  function readSession() {
    try { return auth.readPreview(window.sessionStorage); } catch { return null; }
  }

  if (mode === "dashboard") {
    // This is only a navigation guard. The dashboard contains no private data.
    let expiry;
    function checkSession() {
      clearTimeout(expiry);
      const session = readSession();
      if (!session) { window.location.replace("login.html"); return; }
      document.getElementById("dashboard-shell").hidden = false;
      expiry = window.setTimeout(checkSession, Math.min(session.expiresAt - Date.now(), auth.DURATION_MS));
    }
    document.getElementById("sign-out").addEventListener("click", () => {
      try { auth.endPreview(window.sessionStorage); }
      catch { /* Navigation still returns to the public login form. */ }
      document.getElementById("dashboard-shell").hidden = true;
      window.location.replace("login.html");
    });
    window.addEventListener("pageshow", checkSession);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) checkSession(); });
    window.addEventListener("pagehide", () => clearTimeout(expiry));
    checkSession();
    return;
  }

  const form = document.getElementById("auth-form");
  const fields = document.getElementById("auth-fields");
  const status = document.getElementById("auth-status");
  const submit = document.getElementById("auth-submit");
  const fieldNames = mode === "signup" ? ["name", "email", "password", "confirmPassword"] : ["email", "password"];
  let submitting = false;
  const touched = new Set();

  function values() {
    return Object.fromEntries(fieldNames.map(name => [name, form.elements[name].value]));
  }
  function renderError(name, error) {
    document.getElementById(`error-${name}`).textContent = error || "";
    form.elements[name].setAttribute("aria-invalid", String(Boolean(error)));
  }
  function updateField(name) {
    const errors = auth.validateCredentials(mode, values());
    renderError(name, errors[name]);
    if (name === "password" && touched.has("confirmPassword")) renderError("confirmPassword", errors.confirmPassword);
  }

  fieldNames.forEach(name => {
    const input = form.elements[name];
    input.addEventListener("blur", () => { touched.add(name); updateField(name); });
    input.addEventListener("input", () => {
      status.textContent = "";
      if (touched.has(name)) updateField(name);
    });
  });

  document.querySelectorAll("[data-password-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordToggle);
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.setAttribute("aria-pressed", String(reveal));
      button.textContent = reveal ? "Hide" : "Show";
      button.setAttribute("aria-label", `${reveal ? "Hide" : "Show"} ${input.name === "confirmPassword" ? "confirmation password" : "password"}`);
    });
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (submitting) return;
    const errors = auth.validateCredentials(mode, values());
    fieldNames.forEach(name => { touched.add(name); renderError(name, errors[name]); });
    if (Object.keys(errors).length) {
      status.textContent = "Please correct the highlighted fields.";
      form.elements[Object.keys(errors)[0]].focus();
      return;
    }
    submitting = true;
    submit.disabled = true;
    submit.textContent = "Opening preview…";
    status.textContent = "Opening the empty dashboard preview. No account is created and credentials are not verified.";
    try {
      // The adapter receives only storage, never credentials or identity.
      auth.beginPreview(window.sessionStorage);
      form.reset();
      window.location.assign("dashboard.html");
    } catch {
      // Clear password inputs even when storage is unavailable.
      form.elements.password.value = "";
      if (mode === "signup") form.elements.confirmPassword.value = "";
      status.textContent = "This browser blocked the preview session. Allow session storage for this site, then try again. No account was created.";
      submitting = false;
      submit.disabled = false;
      submit.textContent = mode === "signup" ? "Create account — preview" : "Log in — preview";
    }
  });
  // Without JavaScript, disabled controls prevent credential submission in URLs.
  fields.disabled = false;
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    form.reset();
    submitting = false;
    submit.disabled = false;
    submit.textContent = mode === "signup" ? "Create account — preview" : "Log in — preview";
    status.textContent = "";
    fieldNames.forEach(name => renderError(name));
  });
})();
