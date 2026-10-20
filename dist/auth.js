"use strict";
(() => {
  const mode = document.body.dataset.authPage;
  const validation = window.DigiFlovvAuthValidation;
  const config = window.DIGIFLOVV_AUTH_CONFIG;
  let client;
  let navigating = false;
  function navigate(page) {
    if (navigating) return;
    navigating = true;
    window.location.replace(page);
  }
  try {
    const url = new URL(config.url);
    if (url.protocol !== "https:" || !/^[a-z0-9]+\.supabase\.co$/.test(url.hostname) ||
        !config.publishableKey.startsWith("sb_publishable_")) throw new Error("Invalid config");
    client = window.DigiFlovvCreateClient(url.origin, config.publishableKey, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    sessionStorage.removeItem("digiflovv.auth.preview.v1");
  } catch {
    if (mode === "dashboard") navigate("login.html");
    else document.getElementById("auth-status").textContent = "Account access is unavailable. Please allow browser storage and try again later.";
    return;
  }
  if (mode === "dashboard") {
    const shell = document.getElementById("dashboard-shell");
    const logout = document.getElementById("sign-out");
    async function deviceRequest(path, options = {}) {
        const { data, error } = await client.auth.getSession();
        if (error || !data.session) return { ok: false, status: 401 };
        const response = await fetch(path, {
          ...options,
          headers: { Authorization: `Bearer ${data.session.access_token}`, ...options.headers },
          cache: "no-store", signal: AbortSignal.timeout(options.method ? 60000 : 25000)
        });
        return { ok: response.ok, status: response.status, data: response.status === 404 ? null : await response.json() };
    }
    const devicePost = (path, body) => deviceRequest(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    window.DigiFlovvDeviceApi = Object.freeze({
      links: () => deviceRequest("/api/device-links"),
      startRainMakerLogin: email => devicePost("/api/rainmaker/login/start", { email }),
      verifyRainMakerLogin: code => devicePost("/api/rainmaker/login/verify", { code }),
      connectDevice: id => devicePost("/api/device-links/connect", { id }),
      disconnectDevice: id => devicePost("/api/device-links/disconnect", { id }),
      disconnectRainMaker: () => devicePost("/api/rainmaker/disconnect", {}),
      list: (fresh = false) => deviceRequest(fresh ? "/api/devices?fresh=1" : "/api/devices"),
      command: (id, body) => deviceRequest(`/api/devices/${encodeURIComponent(id)}/commands`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      })
    });
    let checking = false;
    async function checkSession() {
      if (checking) return;
      checking = true;
      try {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) { shell.hidden = true; navigate("login.html"); return; }
        shell.hidden = false;
        window.dispatchEvent(new Event("digiflovv:authenticated"));
      } catch { shell.hidden = true; navigate("login.html"); }
      finally { checking = false; }
    }
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") window.dispatchEvent(new Event("digiflovv:signed-out"));
      if (event === "SIGNED_OUT" && !logout.disabled) { shell.hidden = true; navigate("login.html"); }
    });
    logout.addEventListener("click", async () => {
      logout.disabled = true;
      try {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw error;
        shell.hidden = true;
        navigate("login.html");
      } catch { logout.textContent = "Retry logout"; logout.disabled = false; }
    });
    window.addEventListener("pageshow", checkSession);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) checkSession(); });
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
    const errors = validation.validateCredentials(mode, values());
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

  function resetButton() {
    submitting = false;
    submit.disabled = false;
    submit.textContent = mode === "signup" ? "Create account" : "Log in";
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submitting) return;
    const input = values();
    const errors = validation.validateCredentials(mode, input);
    fieldNames.forEach(name => { touched.add(name); renderError(name, errors[name]); });
    if (Object.keys(errors).length) {
      status.textContent = "Please correct the highlighted fields.";
      form.elements[Object.keys(errors)[0]].focus();
      return;
    }
    submitting = true;
    submit.disabled = true;
    submit.textContent = "Please wait…";
    status.textContent = "";
    try {
      const result = mode === "signup"
        ? await client.auth.signUp({
            email: input.email.trim(), password: input.password,
            options: { data: { full_name: input.name.trim() },
              emailRedirectTo: new URL("login.html", window.location.href).href }
          })
        : await client.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
      if (result.error) {
        const code = result.error.code;
        status.textContent = code === "email_not_confirmed"
          ? "Confirm your email using the link in your inbox, then log in."
          : result.error.status === 429
          ? "Too many attempts. Please wait a few minutes before trying again."
          : mode === "login"
          ? "Unable to log in. Check your email and password, confirm your email, and try again."
          : "Unable to complete sign-up. Check your details and connection, then try again. If you already have an account, log in.";
        return;
      }
      form.reset();
      if (result.data.session) navigate("dashboard.html");
      else status.textContent = "Check your inbox for a confirmation link, then return here to log in. If you already have an account, use Log in.";
    } catch {
      status.textContent = "We could not reach account services. Check your connection and try again.";
    } finally {
      form.elements.password.value = "";
      if (mode === "signup") form.elements.confirmPassword.value = "";
      resetButton();
    }
  });
  fields.disabled = false;
  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session && !submitting) navigate("dashboard.html");
  });
  // Finish PKCE confirmation before clearing callback parameters.
  client.auth.getSession().then(({ data, error }) => {
    const callback = new URL(window.location.href);
    const failed = error || callback.searchParams.has("error") || callback.hash.includes("error");
    if (callback.search || callback.hash) history.replaceState(null, "", callback.pathname);
    if (failed) status.textContent = "That confirmation link could not be completed. Try logging in, or request a new confirmation by signing up again.";
    else if (data.session) navigate("dashboard.html");
  }).catch(() => { status.textContent = "Account services are unavailable. Please try again."; });
  window.addEventListener("pageshow", event => {
    if (!event.persisted) return;
    form.reset();
    touched.clear();
    resetButton();
    status.textContent = "";
    fieldNames.forEach(name => renderError(name));
  });
})();
