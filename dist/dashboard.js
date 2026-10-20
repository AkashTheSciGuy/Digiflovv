"use strict";
(() => {
  const sections = ["devices", "device", "interval", "pump", "schedule", "settings"];
  const titles = { devices: "My devices", device: "Living room plants", interval: "Interval", pump: "Pump", schedule: "Schedule", settings: "Settings" };
  function render(focus = false) {
    const requested = location.hash.slice(1);
    const current = sections.includes(requested) ? requested : "devices";
    document.querySelectorAll("[data-dashboard-view]").forEach(section => {
      section.hidden = section.dataset.dashboardView !== current;
    });
    document.title = `${titles[current]} | DigiFlovv`;
    if (focus) document.querySelector(`[data-dashboard-view="${current}"] h1`).focus();
  }
  window.addEventListener("hashchange", () => render(true));
  const preview = document.getElementById("status-preview");
  function updateStatus() {
    const state = preview.value;
    const offline = state === "offline";
    document.querySelectorAll("[data-connection]").forEach(element => {
      element.dataset.connection = offline ? "offline" : "online";
      element.textContent = offline ? "Offline" : "Online";
    });
    document.querySelectorAll("[data-activity]").forEach(element => {
      element.dataset.activity = state;
      element.textContent = offline ? "Watering status unknown" : state === "watering" ? "Watering now" : "Not watering";
    });
    document.querySelector("[data-status-detail]").textContent = offline
      ? "Example readings · Device is unreachable. Current watering activity cannot be confirmed."
      : state === "watering" ? "Example readings · A watering cycle is in progress."
      : "Example readings · Device is ready and not watering.";
    document.querySelectorAll("[data-control-connection]").forEach(element => {
      element.textContent = offline ? "Offline · Current state unavailable" : "Online · Example device";
    });
    document.querySelectorAll("[data-power]").forEach(button => {
      button.disabled = offline;
      const key = button.dataset.power;
      if (key === "pump") power.pump = state === "watering";
      button.setAttribute("aria-checked", String(power[key]));
      document.getElementById(`${key}-power-label`).textContent = offline ? "Unknown" : power[key] ? "On" : "Off";
    });
    document.getElementById("settings-fields").disabled = offline;
  }
  const power = { interval: false, pump: false, schedule: false };
  preview.addEventListener("change", updateStatus);
  document.querySelectorAll("[data-power]").forEach(button => {
    button.addEventListener("click", () => {
      if (preview.value === "offline") return;
      const key = button.dataset.power;
      power[key] = !power[key];
      if (key === "pump") preview.value = power.pump ? "watering" : "idle";
      updateStatus();
    });
  });
  const form = document.getElementById("device-settings");
  const result = document.getElementById("settings-result");
  let savedSettings = { duration: 5, hour: 7, minute: 0, intervalMinutes: 10 };
  form.addEventListener("input", () => { result.textContent = "Unsaved changes."; });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (preview.value === "offline") return;
    const values = Object.fromEntries(Object.keys(savedSettings).map(key => [key, Number(form.elements[key].value)]));
    if (!form.reportValidity() || Object.values(values).some(value => !Number.isSafeInteger(value))) {
      result.textContent = "Enter valid whole numbers within the displayed field limits.";
      return;
    }
    savedSettings = values;
    result.textContent = `Example settings saved: Duration ${values.duration}, time ${String(values.hour).padStart(2,"0")}:${String(values.minute).padStart(2,"0")}, interval ${values.intervalMinutes} minutes. No hardware was updated.`;
  });
  updateStatus();
  render();
})();
