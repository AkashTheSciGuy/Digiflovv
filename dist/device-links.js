"use strict";
(() => {
  const dialog = document.getElementById("device-links-dialog");
  const status = document.getElementById("device-links-status");
  const devices = document.getElementById("link-device-list");
  const emailForm = document.getElementById("rainmaker-email-form");
  const codeForm = document.getElementById("rainmaker-code-form");
  const email = document.getElementById("rainmaker-email");
  const code = document.getElementById("rainmaker-code");
  const confirmPanel = document.getElementById("link-disconnect-confirmation");
  const confirmButton = document.getElementById("link-disconnect-confirm");
  const disconnectDevice = document.getElementById("disconnect-device");
  const disconnectAccount = document.getElementById("disconnect-rainmaker");
  let selected, target, busy = false, commandPending = false, generation = 0;
  const api = () => window.DigiFlovvDeviceApi;
  function controls() {
    dialog.querySelectorAll("button:not([data-close-links]), input").forEach(el => { el.disabled = busy || commandPending; });
    disconnectDevice.disabled = !selected?.id || busy || commandPending;
    dialog.setAttribute("aria-busy", String(busy));
  }
  function showError(result) {
    if (result.status === 401) return "Please sign into DigiFlovv again.";
    return result.data?.error || "The connection could not be updated. Please try later.";
  }
  async function load(viewGeneration = generation) {
    const result = await api().links();
    if (viewGeneration !== generation) return;
    if (!result.ok) throw new Error(showError(result));
    if (!Array.isArray(result.data?.devices)) throw new Error("Device discovery is unavailable.");
    devices.replaceChildren();
    if (!result.data.devices.length) {
      const empty = document.createElement("p");
      empty.textContent = result.data.connected ? "No compatible watering devices were found. Check your RainMaker account and pair your device in the phone app first." : "No devices are authorized for this dashboard. Google sign-in linking is not available yet.";
      devices.append(empty);
    }
    for (const device of result.data.devices) {
      const row = document.createElement("div"); row.className = "link-device-row";
      const label = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = device.name;
      const state = document.createElement("small"); state.textContent = device.connected ? "Connected to this dashboard" : "Available to connect";
      label.append(name, state);
      const button = document.createElement("button"); button.type = "button"; button.className = "button small link-secondary";
      button.textContent = device.connected ? "Disconnect" : "Connect";
      button.setAttribute("aria-label", `${device.connected ? "Disconnect" : "Connect"} ${device.name}`);
      button.addEventListener("click", () => {
        if (device.connected) confirmation({ id: device.id, name: device.name });
        else run(() => api().connectDevice(device.id), true);
      });
      row.append(label, button); devices.append(row);
    }
    document.getElementById("rainmaker-connection-label").textContent = result.data.connected
      ? result.data.email ? `RainMaker verified: ${result.data.email}` : "Your existing RainMaker connection"
      : "Connect your RainMaker account";
    controls();
  }
  async function run(action, changed = false, after) {
    if (busy || commandPending || !api()) return;
    busy = true; controls(); status.textContent = "Please wait…";
    const viewGeneration = generation;
    try {
      const result = await action();
      if (viewGeneration !== generation) return;
      if (!result.ok) throw new Error(showError(result));
      status.textContent = result.data?.message || "Connection updated.";
      if (changed) {
        window.dispatchEvent(new Event("digiflovv:links-changed"));
        confirmPanel.hidden = true; target = undefined;
        await load(viewGeneration);
      }
      after?.();
    } catch (error) { if (viewGeneration === generation) status.textContent = error.message; }
    finally { if (viewGeneration === generation) { busy = false; controls(); } }
  }
  function confirmation(device) {
    target = device;
    document.getElementById("link-confirm-title").textContent = device ? `Disconnect ${device.name}?` : "Disconnect RainMaker?";
    document.getElementById("link-confirm-description").textContent = device
      ? "This removes this device from your website dashboard. It stays in your RainMaker app. Watering and schedules already running on the device continue."
      : "This removes all devices and the saved RainMaker sign-in from this website. Your phone app and device settings stay in place. Watering already running on the device continues.";
    confirmPanel.hidden = false;
    confirmButton.focus();
  }
  async function open() {
    if (!api()) return;
    generation++; busy = false; confirmPanel.hidden = true; target = undefined;
    dialog.showModal(); controls(); status.textContent = "Loading your connection…";
    const viewGeneration = generation;
    try { await load(viewGeneration); if (viewGeneration === generation) status.textContent = ""; }
    catch (error) { if (viewGeneration === generation) status.textContent = error.message; }
  }
  document.getElementById("connect-device").addEventListener("click", open);
  disconnectDevice.addEventListener("click", async () => {
    if (!selected?.id || commandPending) return;
    const current = { ...selected }; await open(); if (dialog.open) confirmation(current);
  });
  disconnectAccount.addEventListener("click", () => confirmation(null));
  confirmButton.addEventListener("click", () => run(() => target ? api().disconnectDevice(target.id) : api().disconnectRainMaker(), true));
  document.getElementById("link-disconnect-cancel").addEventListener("click", () => { confirmPanel.hidden = true; target = undefined; });
  dialog.querySelectorAll("[data-close-links]").forEach(button => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("close", () => {
    generation++; busy = false; code.value = ""; email.value = ""; codeForm.hidden = true; confirmPanel.hidden = true; target = undefined; controls();
  });
  emailForm.addEventListener("submit", event => {
    event.preventDefault(); if (!emailForm.reportValidity()) return;
    const address = email.value.trim();
    run(() => api().startRainMakerLogin(address), false, () => {
      document.getElementById("rainmaker-code-destination").textContent = `Enter the code sent to ${address}.`;
      codeForm.hidden = false; code.value = ""; code.disabled = false; code.focus();
    });
  });
  codeForm.addEventListener("submit", event => {
    event.preventDefault(); if (!codeForm.reportValidity()) return;
    const entered = code.value;
    run(() => api().verifyRainMakerLogin(entered), true, () => { codeForm.hidden = true; }).finally(() => { code.value = ""; });
  });
  window.addEventListener("digiflovv:device-selected", event => { selected = event.detail?.id ? event.detail : undefined; controls(); });
  window.addEventListener("digiflovv:command-pending", event => { commandPending = event.detail.pending; controls(); });
  window.addEventListener("digiflovv:signed-out", () => { if (dialog.open) dialog.close(); selected = undefined; devices.replaceChildren(); status.textContent = ""; controls(); });
  controls();
})();
