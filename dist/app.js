"use strict";

function getCheckoutUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function getSalesState(config = {}) {
  if (!config || typeof config !== "object") config = {};
  const checkoutUrl = getCheckoutUrl(config.checkoutUrl);
  const displayPrice = typeof config.displayPrice === "string" ? config.displayPrice.trim() : "";
  const salesNote = typeof config.salesNote === "string" ? config.salesNote.trim() : "";
  return { checkoutUrl, displayPrice, salesNote, ready: getLaunchIssues(config).length === 0 };
}

function getLaunchIssues(config = {}) {
  if (!config || typeof config !== "object") config = {};
  const issues = [];
  if (config.ordersOpen !== true) issues.push("Orders are not enabled (ordersOpen).");
  if (!getCheckoutUrl(config.checkoutUrl)) issues.push("Add an approved HTTPS payment link (checkoutUrl).");
  for (const key of ["displayPrice", "salesNote"]) {
    if (typeof config[key] !== "string" || !config[key].trim()) issues.push(`Complete ${key}.`);
  }
  for (const key of ["privacy", "terms", "returns"]) {
    if (!getCheckoutUrl(config.policyUrls?.[key])) issues.push(`Add an approved HTTPS ${key} policy URL.`);
  }
  return issues;
}

function initializeStorefront() {
  const config = window.DIGIFLOVV_CONFIG || {};
  const sales = getSalesState(config);
  const dialog = document.getElementById("notice-dialog");
  const checkoutDialog = document.getElementById("checkout-dialog");
  function showNotice(title, message) {
    document.getElementById("notice-title").textContent = title;
    document.getElementById("notice-text").textContent = message;
    if (!dialog.open) dialog.showModal();
  }
  if (sales.ready) {
    document.getElementById("product-price").textContent = sales.displayPrice;
    document.getElementById("sales-note").textContent = sales.salesNote;
    document.getElementById("availability").textContent = "AVAILABLE TO ORDER";
    document.getElementById("mobile-price").textContent = sales.displayPrice;
    document.getElementById("review-price").textContent = sales.displayPrice;
    document.getElementById("review-sales-note").textContent = sales.salesNote;
    document.getElementById("payment-destination").textContent = new URL(sales.checkoutUrl).hostname;
    document.getElementById("continue-checkout").href = sales.checkoutUrl;
    document.querySelectorAll("[data-checkout-policy]").forEach(link => {
      link.href = getCheckoutUrl(config.policyUrls[link.dataset.checkoutPolicy]);
    });
  }
  document.querySelectorAll("[data-purchase]").forEach(button => button.addEventListener("click", () => {
    if (sales.ready) {
      if (!checkoutDialog.open) checkoutDialog.showModal();
    }
    else showNotice("Ordering opens soon", "We’re finalizing the price and purchasing details. No order has been placed and no payment has been taken.");
  }));
  const email = config.supportEmail;
  if (typeof email === "string" && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(email)) {
    const link = document.getElementById("contact-link");
    link.href = "mailto:" + encodeURIComponent(email);
    link.textContent = "Email DigiFlovv ↗";
    document.getElementById("contact-description").textContent = "Have a question about the system or your setup? Get in touch at " + email + ".";
  }
  const policies = {
    privacy: ["Privacy information", "This first version has no contact submission form, customer accounts, or analytics scripts. Hosting may process request information. DigiFlovv’s full privacy policy will be available before ordering opens."],
    terms: ["Terms & conditions", "Sales terms are being finalized. Orders are not currently open. Please review the final pricing, shipping, payment, and warranty terms before purchasing."],
    returns: ["Returns & refunds", "The return, refund, and cancellation policies have not yet been finalized. They will be available before ordering opens."]
  };
  document.querySelectorAll("[data-policy]").forEach(button => {
    button.addEventListener("click", () => {
      const policyUrl = getCheckoutUrl(config.policyUrls?.[button.dataset.policy]);
      if (policyUrl) window.location.assign(policyUrl);
      else showNotice(...policies[button.dataset.policy]);
    });
  });
}
function initializeProductDemo() {
  const durationInput =
    document.getElementById("demo-duration");

  if (!durationInput) {
    return;
  }


  const durationValue =
    document.getElementById(
      "demo-duration-value"
    );

  const durationDisplay =
    document.getElementById(
      "demo-duration-display"
    );

  const routineDuration =
    document.getElementById(
      "demo-routine-duration"
    );

  const wateringTime =
    document.getElementById(
      "demo-watering-time"
    );

  const nextTime =
    document.getElementById(
      "demo-next-time"
    );

  const routineSummary =
    document.getElementById(
      "demo-routine-summary"
    );

  const saveButton =
    document.getElementById(
      "demo-save-schedule"
    );

  const waterButton =
    document.getElementById(
      "demo-water-now"
    );

  const wateringStatus =
    document.getElementById(
      "watering-status"
    );

  const wateringTitle =
    document.getElementById(
      "watering-status-title"
    );

  const wateringText =
    document.getElementById(
      "watering-status-text"
    );

  const reservoir =
    document.getElementById(
      "demo-reservoir"
    );

  const reservoirBar =
    document.getElementById(
      "demo-reservoir-bar"
    );


  let reservoirLevel = 78;
  let wateringTimer = null;


  function formatDays(days) {
    if (days.length === 0) {
      return "No watering days selected";
    }

    if (days.length === 1) {
      return days[0];
    }

    if (days.length === 2) {
      return `${days[0]} and ${days[1]}`;
    }

    return (
      days.slice(0, -1).join(", ") +
      " and " +
      days[days.length - 1]
    );
  }


  function getSelectedDays() {
    return Array.from(
      document.querySelectorAll(
        ".schedule-days input:checked"
      )
    ).map(input => input.value);
  }


  function updateDuration() {
    const seconds =
      Number(durationInput.value);

    durationValue.textContent =
      `${seconds} sec`;

    durationDisplay.textContent =
      `${seconds} sec`;

    routineDuration.textContent =
      `Water for ${seconds} seconds`;
  }


  function saveSchedule() {
    const selectedDays =
      getSelectedDays();

    const time =
      wateringTime.value || "08:00";


    if (selectedDays.length === 0) {
      routineSummary.textContent =
        "No automatic watering days selected";

      document.getElementById(
        "demo-next-watering"
      ).textContent = "Paused";

      nextTime.textContent = "—";

      return;
    }


    routineSummary.textContent =
      `${formatDays(selectedDays)} at ${time}`;

    document.getElementById(
      "demo-next-watering"
    ).textContent =
      selectedDays[0];

    nextTime.textContent =
      time;


    const originalText =
      saveButton.textContent;

    saveButton.textContent =
      "Schedule saved ✓";

    saveButton.disabled = true;


    window.setTimeout(() => {
      saveButton.textContent =
        originalText;

      saveButton.disabled = false;
    }, 1200);
  }


  function stopWatering() {
    wateringStatus.classList.remove(
      "is-watering"
    );

    wateringTitle.textContent =
      "Watering complete";

    wateringText.textContent =
      "The system is ready for the next cycle.";

    waterButton.disabled = false;

    waterButton.innerHTML =
      'Water now <span aria-hidden="true">↗</span>';

    wateringTimer = null;


    window.setTimeout(() => {
      wateringTitle.textContent =
        "System ready";

      wateringText.textContent =
        "Waiting for the next scheduled cycle.";
    }, 2500);
  }


  function startWatering() {
    if (wateringTimer) {
      return;
    }


    const duration =
      Number(durationInput.value);


    wateringStatus.classList.add(
      "is-watering"
    );

    wateringTitle.textContent =
      "Watering now";

    wateringText.textContent =
      `Running a ${duration}-second watering cycle.`;

    waterButton.disabled = true;
    waterButton.textContent =
      "Watering…";


    reservoirLevel =
      Math.max(
        0,
        reservoirLevel - 3
      );

    reservoir.textContent =
      `${reservoirLevel}%`;

    reservoirBar.style.width =
      `${reservoirLevel}%`;


    /*
      The real product may water for
      20+ seconds.

      For the website demo we shorten
      the visual simulation to 3 seconds.
    */
    wateringTimer =
      window.setTimeout(
        stopWatering,
        3000
      );
  }


  durationInput.addEventListener(
    "input",
    updateDuration
  );


  saveButton.addEventListener(
    "click",
    saveSchedule
  );


  waterButton.addEventListener(
    "click",
    startWatering
  );


  updateDuration();
}
if (typeof document !== "undefined") {
  initializeStorefront();
  initializeProductDemo();
}
if (typeof module !== "undefined") module.exports = { getCheckoutUrl, getSalesState, getLaunchIssues };
