"use strict";
(() => {
  const sections = ["devices", "device", "interval", "moisture", "pump", "schedule", "settings"];
  const titles = { devices: "My devices", device: "Living room plants", interval: "Interval", moisture: "Moisture Control", pump: "Pump", schedule: "Schedule", settings: "Settings" };
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
  // Offline defaults stay in HTML until dashboard-live.js receives a report.
  // Do not infer device connectivity from the browser or the Supabase session.
  document.getElementById("device-settings").addEventListener("submit", event => event.preventDefault());
  render();
})();
