"use strict";
(() => {
  let devices = [];
  let selectedId;
  let timer;
  let busy = false;
  let active = false;
  let generation = 0;
  let liveView = false;
  const list = document.getElementById("devices");
  const template = list.querySelector(".device-card").cloneNode(true);
  const container = document.createElement("div");
  container.className = "live-device-list";
  const cards = new Map();
  let pendingCommand = false;
  let pendingRequest;
  let settingsDirty = false;
  let draftRevision;
  let awaitingReport;
  const form = document.getElementById("device-settings");
  const commandStatus = document.createElement("p");
  commandStatus.id = "device-command-status";
  commandStatus.setAttribute("role", "status");
  commandStatus.setAttribute("aria-live", "polite");
  document.getElementById("main").prepend(commandStatus);
  const fieldNames = { duration: "Duration", hour: "Hour", minute: "Minute", intervalMinutes: "IntervalMinutes" };
  const powerTargets = { pump: "Pump", schedule: "Schedule", interval: "Interval", moisture: "Moisture Control" };

  function activity(device) {
    if (!device?.online || typeof device.power?.pump !== "boolean") return "Pump state unknown";
    return device.power.pump ? "Pump reports ON" : "Pump reports OFF";
  }
  function paintSelection() {
    if (!liveView) return;
    const device = devices.find(item => item.id === selectedId) || {
      name: "No linked device", online: false, power: {}, settings: {}, observedAt: null
    };
    document.getElementById("heading-device").textContent = device.name;
    document.querySelectorAll("#device .device-badge").forEach(el => { el.textContent = "Linked device"; });
    document.querySelectorAll("#device [data-connection]").forEach(el => {
      el.dataset.connection = device.online ? "online" : "offline";
      el.textContent = device.online ? "Online" : "Offline";
    });
    document.querySelectorAll("#device [data-activity]").forEach(el => { el.textContent = activity(device); });
    document.querySelector("[data-status-detail]").textContent = device.observedAt
      ? `RainMaker report checked ${new Date(device.observedAt).toLocaleTimeString()}.`
      : "No current device report is available.";
    const writable = device.writable === true && device.online && !pendingCommand && !!device.revision;
    if (awaitingReport?.nodeId === device.id && device.online) {
      const matches = Object.entries(awaitingReport.values).every(([name, value]) => {
        if (awaitingReport.target !== "Settings") {
          const mode = Object.keys(powerTargets).find(mode => powerTargets[mode] === awaitingReport.target);
          return device.power?.[mode] === value;
        }
        const field = Object.keys(fieldNames).find(field => fieldNames[field] === name);
        return device.settings?.[field] === value;
      });
      if (matches) {
        commandStatus.textContent = "RainMaker now reports the requested value.";
        if (awaitingReport.target === "Settings") document.getElementById("settings-result").textContent = commandStatus.textContent;
        awaitingReport = undefined;
      }
    }
    document.querySelector("#device .dashboard-note").textContent = device.writable ? "Controls use RainMaker. Switches show the latest reported state." : "Live device reports. Website controls are being connected.";
    document.querySelector(".device-controls").setAttribute("aria-label", "Device controls");
    document.querySelectorAll(".device-controls small").forEach(el => { el.textContent = "View reported state ↗"; });
    document.querySelectorAll("[data-moisture-card]").forEach(el => { el.hidden = device.capabilities?.moisture === false; });
    for (const mode of Object.keys(powerTargets)) {
      const state = device.online ? device.power?.[mode] : null;
      document.getElementById(`${mode}-power-label`).textContent = typeof state === "boolean" ? (state ? "On" : "Off") : "Unknown";
      document.querySelectorAll(`[data-power="${mode}"]`).forEach(button => {
        button.disabled = !writable || typeof state !== "boolean";
        button.setAttribute("aria-checked", String(state === true));
        const pending = pendingRequest && pendingRequest.nodeId === device.id && pendingRequest.target === powerTargets[mode];
        button.setAttribute("aria-busy", String(!!pending));
        if (pending) button.dataset.pending = pendingRequest.values.Power ? "on" : "off";
        else delete button.dataset.pending;
        const label = button.parentElement.querySelector(":scope > span:not([aria-hidden])");
        if (label) label.textContent = pending ? `Turning ${pendingRequest.values.Power ? "on" : "off"}…` : typeof state === "boolean" ? `Reported ${state ? "On" : "Off"}` : "Power unknown";
      });
    }
    document.querySelectorAll("[data-control-connection]").forEach(el => { el.textContent = device.online ? "Online · RainMaker reported state" : "Offline · Current state unavailable"; });
    document.querySelectorAll(".control-help").forEach(el => { el.textContent = device.writable ? "Commands are sent through RainMaker. Reported state updates after sending." : "Read-only preview — use the RainMaker app to make changes."; });
    document.getElementById("settings-fields").disabled = !writable;
    form.querySelector("button").textContent = "Save settings";
    document.querySelector('label[for="setting-duration"] span').textContent = "Duration (minutes)";
    for (const field of ["duration", "intervalMinutes"]) document.getElementById(`setting-${field}`).max = "71582";
    for (const field of ["duration", "hour", "minute", "intervalMinutes"]) {
      const value = device.online ? device.settings?.[field] : null;
      if (!settingsDirty || !device.online) document.getElementById(`setting-${field}`).value = Number.isSafeInteger(value) ? value : "";
    }
    document.querySelectorAll("#interval .eyebrow, #moisture .eyebrow, #pump .eyebrow, #schedule .eyebrow, #settings .eyebrow").forEach(el => { el.textContent = device.name; });
    window.dispatchEvent(new CustomEvent("digiflovv:device-selected", { detail: { id: device.id, name: device.name } }));
    if (location.hash === "#device") document.title = `${device.name} | DigiFlovv`;
  }
  function paint() {
    liveView = true;
    list.querySelector(":scope > .device-card")?.remove();
    list.querySelector(".dashboard-note").textContent = devices.length ? "Your linked RainMaker devices. Changes in the phone app appear here automatically." : "No devices are linked to this account.";
    for (const [id, card] of cards) {
      if (!devices.some(device => device.id === id)) { card.remove(); cards.delete(id); }
    }
    if (!container.isConnected) list.append(container);
    for (const device of devices) {
      let card = cards.get(device.id);
      if (!card) {
        card = template.cloneNode(true);
        card.addEventListener("click", () => { if (selectedId !== device.id) { settingsDirty = false; commandStatus.textContent = ""; document.getElementById("settings-result").textContent = ""; } selectedId = device.id; paintSelection(); });
        cards.set(device.id, card);
        container.append(card);
      }
      card.setAttribute("aria-label", `Open ${device.name}`);
      card.querySelector("h2").textContent = device.name;
      card.querySelector(".device-badge").textContent = "Linked device";
      const connection = card.querySelector("[data-connection]");
      connection.textContent = device.online ? "Online" : "Offline";
      connection.dataset.connection = device.online ? "online" : "offline";
      card.querySelector("[data-activity]").textContent = activity(device);
    }
    if (!devices.some(device => device.id === selectedId)) { selectedId = devices[0]?.id; settingsDirty = false; }
    paintSelection();
    if (!devices.length && location.hash && location.hash !== "#devices") location.hash = "devices";
  }
  function unavailable() {
    // Clear old on/off values immediately when a fresh cloud read fails.
    devices = devices.map(device => ({ ...device, online: false, power: {}, settings: {} }));
    if (devices.length) {
      paint();
      document.querySelectorAll("[data-connection]").forEach(el => { el.textContent = "Status unavailable"; });
      document.querySelector("[data-status-detail]").textContent = "A current RainMaker report could not be retrieved.";
    }
  }
  async function refresh() {
    clearTimeout(timer);
    if (busy || pendingCommand || !active || document.hidden || !window.DigiFlovvDeviceApi) return;
    busy = true;
    const requestGeneration = generation;
    try {
      const result = await window.DigiFlovvDeviceApi.list(!!awaitingReport);
      if (!active || requestGeneration !== generation) return;
      if (result.status === 404) { active = false; return; } // Static deployments retain the existing placeholder.
      if (!result.ok || !Array.isArray(result.data?.devices)) throw new Error("Unavailable");
      devices = result.data.devices;
      paint();
    } catch { if (active && requestGeneration === generation) unavailable(); }
    finally {
      busy = false;
      if (active && !document.hidden) timer = setTimeout(refresh, awaitingReport ? 1000 : 5000);
    }
  }
  async function sendCommand(target, values, expectedRevision) {
    const device = devices.find(item => item.id === selectedId);
    if (!device?.online || !device.writable || pendingCommand) return;
    pendingCommand = true;
    window.dispatchEvent(new CustomEvent("digiflovv:command-pending", { detail: { pending: true } }));
    pendingRequest = { nodeId: device.id, target, values };
    awaitingReport = undefined;
    generation++; // Ignore reads that began before this command.
    clearTimeout(timer);
    commandStatus.textContent = "Sending command to RainMaker…";
    const settingsResult = document.getElementById("settings-result");
    if (target === "Settings") settingsResult.textContent = commandStatus.textContent;
    paintSelection();
    let receivedDevice = false;
    try {
      const result = await window.DigiFlovvDeviceApi.command(device.id, {
        requestId: crypto.randomUUID(), expectedRevision: expectedRevision || device.revision,
        expiresAt: device.commandExpiresAt, target, values
      });
      if (!result.ok) commandStatus.textContent = result.data?.error || "Command rejected. Refresh and retry.";
      else {
        if (result.data.device?.id === device.id) {
          devices = devices.map(item => item.id === device.id ? result.data.device : item);
          receivedDevice = true;
        }
        commandStatus.textContent = {
          reported: "RainMaker now reports the requested value.",
          already_reported: "RainMaker already reports this value. No command was needed.",
          sent: "Command sent. Waiting for a matching RainMaker report.",
          unconfirmed: "Delivery could not be confirmed. Check the latest state before retrying."
        }[result.data.state] || "Check the latest device state before retrying.";
        if (["sent", "unconfirmed"].includes(result.data.state)) awaitingReport = { nodeId: device.id, target, values };
      }
    } catch {
      awaitingReport = { nodeId: device.id, target, values };
      commandStatus.textContent = "Delivery could not be confirmed. Check the app and latest state before retrying.";
    }
    finally {
      if (target === "Settings") { settingsDirty = false; settingsResult.textContent = commandStatus.textContent; }
      pendingCommand = false;
      window.dispatchEvent(new CustomEvent("digiflovv:command-pending", { detail: { pending: false } }));
      pendingRequest = undefined;
      if (receivedDevice) {
        paint();
        if (active && !document.hidden) timer = setTimeout(refresh, awaitingReport ? 1000 : 5000);
      } else { await refresh(); paintSelection(); }
    }
  }
  document.querySelectorAll("[data-power]").forEach(button => button.addEventListener("click", () => {
    const mode = button.dataset.power;
    const device = devices.find(item => item.id === selectedId);
    if (typeof device?.power?.[mode] === "boolean") sendCommand(powerTargets[mode], { Power: !device.power[mode] });
  }));
  form.addEventListener("input", () => {
    if (!settingsDirty) draftRevision = devices.find(device => device.id === selectedId)?.revision;
    settingsDirty = true;
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(Object.entries(fieldNames).map(([field, name]) => [name, Number(document.getElementById(`setting-${field}`).value)]));
    sendCommand("Settings", values, settingsDirty ? draftRevision : undefined);
  });
  window.addEventListener("digiflovv:authenticated", () => { active = true; refresh(); });
  window.addEventListener("digiflovv:signed-out", () => { active = false; generation++; clearTimeout(timer); devices = []; container.replaceChildren(); cards.clear(); });
  window.addEventListener("digiflovv:links-changed", () => { generation++; clearTimeout(timer); devices = []; settingsDirty = false; awaitingReport = undefined; commandStatus.textContent = ""; document.getElementById("settings-result").textContent = ""; paint(); refresh(); });
  window.addEventListener("hashchange", paintSelection);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(timer); else refresh(); });
})();

