"use strict";

/* =========================================================
   CHECKOUT / LAUNCH CONFIGURATION
   ========================================================= */

function getCheckoutUrl(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}


function getSalesState(config = {}) {
  if (!config || typeof config !== "object") {
    config = {};
  }

  const checkoutUrl = getCheckoutUrl(
    config.checkoutUrl
  );

  const displayPrice =
    typeof config.displayPrice === "string"
      ? config.displayPrice.trim()
      : "";

  const salesNote =
    typeof config.salesNote === "string"
      ? config.salesNote.trim()
      : "";

  return {
    checkoutUrl,
    displayPrice,
    salesNote,
    ready: getLaunchIssues(config).length === 0
  };
}


function getLaunchIssues(config = {}) {
  if (!config || typeof config !== "object") {
    config = {};
  }

  const issues = [];

  if (config.ordersOpen !== true) {
    issues.push(
      "Orders are not enabled (ordersOpen)."
    );
  }

  if (!getCheckoutUrl(config.checkoutUrl)) {
    issues.push(
      "Add an approved HTTPS payment link (checkoutUrl)."
    );
  }

  for (const key of [
    "displayPrice",
    "salesNote"
  ]) {
    if (
      typeof config[key] !== "string" ||
      !config[key].trim()
    ) {
      issues.push(`Complete ${key}.`);
    }
  }

  for (const key of [
    "privacy",
    "terms",
    "returns"
  ]) {
    if (
      !getCheckoutUrl(
        config.policyUrls?.[key]
      )
    ) {
      issues.push(
        `Add an approved HTTPS ${key} policy URL.`
      );
    }
  }

  return issues;
}


/* =========================================================
   MAIN STOREFRONT
   ========================================================= */

function initializeStorefront() {
  const config =
    window.DIGIFLOVV_CONFIG || {};

  const sales =
    getSalesState(config);

  const dialog =
    document.getElementById(
      "notice-dialog"
    );

  const checkoutDialog =
    document.getElementById(
      "checkout-dialog"
    );


  function showNotice(title, message) {
    const titleElement =
      document.getElementById(
        "notice-title"
      );

    const textElement =
      document.getElementById(
        "notice-text"
      );

    if (
      !dialog ||
      !titleElement ||
      !textElement
    ) {
      return;
    }

    titleElement.textContent = title;
    textElement.textContent = message;

    if (!dialog.open) {
      dialog.showModal();
    }
  }


  /* ---------------------------------------------------------
     PURCHASE CONFIGURATION
     --------------------------------------------------------- */

  if (sales.ready) {
    const productPrice =
      document.getElementById(
        "product-price"
      );

    const salesNote =
      document.getElementById(
        "sales-note"
      );

    const availability =
      document.getElementById(
        "availability"
      );

    const mobilePrice =
      document.getElementById(
        "mobile-price"
      );

    const reviewPrice =
      document.getElementById(
        "review-price"
      );

    const reviewSalesNote =
      document.getElementById(
        "review-sales-note"
      );

    const paymentDestination =
      document.getElementById(
        "payment-destination"
      );

    const continueCheckout =
      document.getElementById(
        "continue-checkout"
      );


    if (productPrice) {
      productPrice.textContent =
        sales.displayPrice;
    }

    if (salesNote) {
      salesNote.textContent =
        sales.salesNote;
    }

    if (availability) {
      availability.textContent =
        "AVAILABLE TO ORDER";
    }

    if (mobilePrice) {
      mobilePrice.textContent =
        sales.displayPrice;
    }

    if (reviewPrice) {
      reviewPrice.textContent =
        sales.displayPrice;
    }

    if (reviewSalesNote) {
      reviewSalesNote.textContent =
        sales.salesNote;
    }

    if (paymentDestination) {
      paymentDestination.textContent =
        new URL(
          sales.checkoutUrl
        ).hostname;
    }

    if (continueCheckout) {
      continueCheckout.href =
        sales.checkoutUrl;
    }


    document
      .querySelectorAll(
        "[data-checkout-policy]"
      )
      .forEach(link => {
        const policyUrl =
          getCheckoutUrl(
            config.policyUrls?.[
            link.dataset.checkoutPolicy
            ]
          );

        if (policyUrl) {
          link.href = policyUrl;
        }
      });
  }


  /* ---------------------------------------------------------
     BUY BUTTONS
     --------------------------------------------------------- */

  document
    .querySelectorAll("[data-purchase]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          if (sales.ready) {
            if (
              checkoutDialog &&
              !checkoutDialog.open
            ) {
              checkoutDialog.showModal();
            }

            return;
          }

          showNotice(
            "Ordering opens soon",
            "We’re finalizing the price and purchasing details. No order has been placed and no payment has been taken."
          );
        }
      );
    });


  /* ---------------------------------------------------------
     SUPPORT EMAIL
     --------------------------------------------------------- */

  const email =
    config.supportEmail;

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  if (
    typeof email === "string" &&
    emailPattern.test(email)
  ) {
    const link =
      document.getElementById(
        "contact-link"
      );

    const description =
      document.getElementById(
        "contact-description"
      );


    if (link) {
      link.href =
        "mailto:" +
        encodeURIComponent(email);

      link.textContent =
        "Email DigiFlovv ↗";
    }


    if (description) {
      description.textContent =
        "Have a question about the system or your setup? Get in touch at " +
        email +
        ".";
    }
  }


  /* ---------------------------------------------------------
     POLICY FALLBACKS
     --------------------------------------------------------- */

  const policies = {
    privacy: [
      "Privacy information",
      "This first version has no contact submission form, customer accounts, or analytics scripts. Hosting may process request information. DigiFlovv’s full privacy policy will be available before ordering opens."
    ],

    terms: [
      "Terms & conditions",
      "Sales terms are being finalized. Orders are not currently open. Please review the final pricing, shipping, payment, and warranty terms before purchasing."
    ],

    returns: [
      "Returns & refunds",
      "The return, refund, and cancellation policies have not yet been finalized. They will be available before ordering opens."
    ]
  };


  document
    .querySelectorAll("[data-policy]")
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const policyName =
            button.dataset.policy;

          const policyUrl =
            getCheckoutUrl(
              config.policyUrls?.[
              policyName
              ]
            );

          if (policyUrl) {
            window.location.assign(
              policyUrl
            );

            return;
          }

          const fallback =
            policies[policyName];

          if (fallback) {
            showNotice(
              fallback[0],
              fallback[1]
            );
          }
        }
      );
    });
}


/* =========================================================
   INTERACTIVE PRODUCT DEMO
   ========================================================= */

function initializeProductDemo() {
  const durationInput =
    document.getElementById(
      "demo-duration"
    );

  /*
   * If the demo section does not exist,
   * stop here without affecting the rest
   * of the storefront.
   */
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

  const nextWatering =
    document.getElementById(
      "demo-next-watering"
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


  /*
   * Starting value used only for the
   * frontend demonstration.
   */
  let reservoirLevel = 78;

  let wateringTimer = null;

  let statusResetTimer = null;

  let nextWateringIndex = 0;


  const dayNames = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday"
  };


  /* ---------------------------------------------------------
     DAY FORMATTING
     --------------------------------------------------------- */

  function formatDays(days) {
    const names =
      days.map(
        day =>
          dayNames[day] || day
      );


    if (names.length === 0) {
      return "No watering days selected";
    }


    if (names.length === 1) {
      return names[0];
    }


    if (names.length === 2) {
      return (
        names[0] +
        " and " +
        names[1]
      );
    }


    return (
      names
        .slice(0, -1)
        .join(", ") +
      " and " +
      names[names.length - 1]
    );
  }


  function getSelectedDays() {
    return Array.from(
      document.querySelectorAll(
        ".schedule-days input:checked"
      )
    ).map(
      input => input.value
    );
  }

  function updateNextWatering() {
    const selectedDays =
      getSelectedDays();

    if (selectedDays.length === 0) {
      if (nextWatering) {
        nextWatering.textContent =
          "Paused";
      }

      if (nextTime) {
        nextTime.textContent =
          "—";
      }

      return;
    }

    if (
      nextWateringIndex >=
      selectedDays.length
    ) {
      nextWateringIndex = 0;
    }

    const nextDay =
      selectedDays[
      nextWateringIndex
      ];

    if (nextWatering) {
      nextWatering.textContent =
        dayNames[nextDay] ||
        nextDay;
    }

    if (nextTime) {
      nextTime.textContent =
        wateringTime?.value ||
        "08:00";
    }
  }


  /* ---------------------------------------------------------
     DURATION
     --------------------------------------------------------- */

  function updateDuration() {
    const seconds =
      Number(
        durationInput.value
      );


    if (durationValue) {
      durationValue.textContent =
        `${seconds} sec`;
    }


    if (durationDisplay) {
      durationDisplay.textContent =
        `${seconds} sec`;
    }


    if (routineDuration) {
      routineDuration.textContent =
        `Water for ${seconds} seconds`;
    }
  }


  /* ---------------------------------------------------------
     SCHEDULE
     --------------------------------------------------------- */

  function saveSchedule() {
    const selectedDays =
      getSelectedDays();

    const time =
      wateringTime?.value ||
      "08:00";


    if (selectedDays.length === 0) {
      if (routineSummary) {
        routineSummary.textContent =
          "No automatic watering days selected";
      }


      if (nextWatering) {
        nextWatering.textContent =
          "Paused";
      }


      if (nextTime) {
        nextTime.textContent =
          "—";
      }


      if (saveButton) {
        const originalText =
          saveButton.textContent;

        saveButton.textContent =
          "Schedule paused";

        saveButton.disabled =
          true;


        window.setTimeout(
          () => {
            saveButton.textContent =
              originalText;

            saveButton.disabled =
              false;
          },
          1200
        );
      }

      return;
    }


    if (routineSummary) {
      routineSummary.textContent =
        `${formatDays(
          selectedDays
        )} at ${time}`;
    }


    nextWateringIndex = 0;

    updateNextWatering();

    if (!saveButton) {
      return;
    }


    const originalText =
      saveButton.textContent;


    saveButton.textContent =
      "Schedule saved ✓";

    saveButton.disabled =
      true;


    window.setTimeout(
      () => {
        saveButton.textContent =
          originalText;

        saveButton.disabled =
          false;
      },
      1200
    );
  }


  /* ---------------------------------------------------------
     WATERING SIMULATION
     --------------------------------------------------------- */

  function resetStatus() {
    if (
      !wateringTitle ||
      !wateringText
    ) {
      return;
    }


    wateringTitle.textContent =
      "System ready";

    wateringText.textContent =
      "Waiting for the next scheduled cycle.";
  }


  function stopWatering() {
    if (wateringStatus) {
      wateringStatus.classList.remove(
        "is-watering"
      );
    }


    if (wateringTitle) {
      wateringTitle.textContent =
        "Watering complete";
    }


    if (wateringText) {
      wateringText.textContent =
        "The system is ready for the next cycle.";
    }


    if (waterButton) {
      waterButton.disabled =
        false;

      waterButton.innerHTML =
        'Water now <span aria-hidden="true">↗</span>';
    }


    wateringTimer = null;

    const selectedDays =
      getSelectedDays();

    if (selectedDays.length > 0) {
      nextWateringIndex =
        (
          nextWateringIndex + 1
        ) %
        selectedDays.length;

      updateNextWatering();
    }


    if (statusResetTimer) {
      window.clearTimeout(
        statusResetTimer
      );
    }


    statusResetTimer =
      window.setTimeout(
        resetStatus,
        2500
      );
  }


  function startWatering() {
    if (
      wateringTimer ||
      !waterButton
    ) {
      return;
    }


    const duration =
      Number(
        durationInput.value
      );


    if (statusResetTimer) {
      window.clearTimeout(
        statusResetTimer
      );

      statusResetTimer =
        null;
    }


    if (wateringStatus) {
      wateringStatus.classList.add(
        "is-watering"
      );
    }


    if (wateringTitle) {
      wateringTitle.textContent =
        "Watering now";
    }


    if (wateringText) {
      wateringText.textContent =
        `Running a ${duration}-second watering cycle.`;
    }


    waterButton.disabled =
      true;

    waterButton.textContent =
      "Watering…";


    /*
     * Simulate water usage.
     *
     * Each manual cycle reduces the
     * displayed reservoir by 3%.
     */
    reservoirLevel =
      Math.max(
        0,
        reservoirLevel - 3
      );


    if (reservoir) {
      reservoir.textContent =
        `${reservoirLevel}%`;
    }


    if (reservoirBar) {
      reservoirBar.style.width =
        `${reservoirLevel}%`;
    }


    /*
     * The selected watering duration may
     * be 20–60 seconds, but waiting that
     * long during a presentation would be
     * inconvenient.
     *
     * The visual demo therefore completes
     * after three seconds.
     */
    wateringTimer =
      window.setTimeout(
        stopWatering,
        3000
      );
  }


  /* ---------------------------------------------------------
     EVENT LISTENERS
     --------------------------------------------------------- */

  durationInput.addEventListener(
    "input",
    updateDuration
  );


  if (saveButton) {
    saveButton.addEventListener(
      "click",
      saveSchedule
    );
  }


  if (waterButton) {
    waterButton.addEventListener(
      "click",
      startWatering
    );
  }


  /*
   * Update the active routine immediately
   * when the watering time changes.
   */
  if (wateringTime) {
    wateringTime.addEventListener(
      "change",
      () => {
        const selectedDays =
          getSelectedDays();

        if (
          selectedDays.length > 0 &&
          routineSummary
        ) {
          routineSummary.textContent =
            `${formatDays(
              selectedDays
            )} at ${wateringTime.value
            }`;
        }
      }
    );
  }


  /*
   * Initial state.
   */
  updateDuration();
}

/* =========================================================
   USE CASE EXPLORER
   ========================================================= */

function initializeUseCaseExplorer() {
  const buttons =
    document.querySelectorAll(
      "[data-use-case]"
    );

  if (!buttons.length) {
    return;
  }


  const title =
    document.getElementById(
      "use-case-title"
    );

  const description =
    document.getElementById(
      "use-case-description"
    );

  const days =
    document.getElementById(
      "use-case-days"
    );

  const time =
    document.getElementById(
      "use-case-time"
    );

  const duration =
    document.getElementById(
      "use-case-duration"
    );

  const note =
    document.getElementById(
      "use-case-note"
    );

  const applyButton =
    document.getElementById(
      "apply-use-case"
    );


  const scenarios = {
    busy: {
      title:
        "A little help during a busy week.",

      description:
        "Set a straightforward Monday, Wednesday and Friday routine and let DigiFlovv handle the repetition.",

      days: [
        "Mon",
        "Wed",
        "Fri"
      ],

      daysLabel:
        "Mon / Wed / Fri",

      time:
        "07:30",

      duration:
        20,

      note:
        "An example routine for days when plant care is easy to forget."
    },


    away: {
      title:
        "Keep the routine going while you’re away.",

      description:
        "Set a simple weekend watering routine so DigiFlovv can keep things running while you’re away.",

      days: [
        "Sat",
        "Sun"
      ],

      daysLabel:
        "Sat / Sun",

      time:
        "08:00",

      duration:
        30,

      note:
        "Before real-world use, the water supply, power and plant requirements should always be checked."
    },


    daily: {
      title:
        "A small cycle as part of every day.",

      description:
        "Choose shorter watering cycles across the week for a setup where frequent watering is appropriate.",

      days: [
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
        "Sun"
      ],

      daysLabel:
        "Every day",

      time:
        "08:30",

      duration:
        15,

      note:
        "Watering needs vary by plant and environment. These values are only frontend demonstration examples."
    }
  };


  let activeScenario =
    scenarios.busy;


  function renderScenario(
    key
  ) {
    const scenario =
      scenarios[key];

    if (!scenario) {
      return;
    }


    activeScenario =
      scenario;


    buttons.forEach(
      button => {
        const isActive =
          button.dataset.useCase ===
          key;


        button.classList.toggle(
          "is-active",
          isActive
        );


        button.setAttribute(
          "aria-pressed",
          String(isActive)
        );
      }
    );


    if (title) {
      title.textContent =
        scenario.title;
    }


    if (description) {
      description.textContent =
        scenario.description;
    }


    if (days) {
      days.textContent =
        scenario.daysLabel;
    }


    if (time) {
      time.textContent =
        scenario.time;
    }


    if (duration) {
      duration.textContent =
        `${scenario.duration} sec`;
    }


    if (note) {
      note.textContent =
        scenario.note;
    }
  }


  function applyToDemo() {
    const demoSection =
      document.getElementById(
        "demo"
      );


    const demoTime =
      document.getElementById(
        "demo-watering-time"
      );


    const demoDuration =
      document.getElementById(
        "demo-duration"
      );


    const saveSchedule =
      document.getElementById(
        "demo-save-schedule"
      );


    const dayInputs =
      document.querySelectorAll(
        ".schedule-days input"
      );


    dayInputs.forEach(
      input => {
        input.checked =
          activeScenario.days.includes(
            input.value
          );
      }
    );


    if (demoTime) {
      demoTime.value =
        activeScenario.time;

      demoTime.dispatchEvent(
        new Event(
          "change",
          {
            bubbles: true
          }
        )
      );
    }


    if (demoDuration) {
      demoDuration.value =
        String(
          activeScenario.duration
        );

      demoDuration.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true
          }
        )
      );
    }


    if (saveSchedule) {
      saveSchedule.click();
    }


    if (demoSection) {
      demoSection.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });
    }
  }


  buttons.forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          renderScenario(
            button.dataset.useCase
          );
        }
      );
    }
  );


  if (applyButton) {
    applyButton.addEventListener(
      "click",
      applyToDemo
    );
  }


  renderScenario("busy");
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

if (
  typeof document !==
  "undefined"
) {
  initializeStorefront();
  initializeProductDemo();
  initializeUseCaseExplorer();
}


/* =========================================================
   NODE TEST EXPORTS
   ========================================================= */

if (
  typeof module !==
  "undefined"
) {
  module.exports = {
    getCheckoutUrl,
    getSalesState,
    getLaunchIssues
  };
}