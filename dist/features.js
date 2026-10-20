"use strict";

function validEmail(value) {
  return typeof value === "string" && value.length <= 254 &&
    /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,}$/i.test(value);
}

function validateEnquiry(data) {
  const errors = {};
  if (typeof data.name !== "string" || data.name.trim().length < 2 || data.name.length > 100) errors.name = "Enter a name between 2 and 100 characters.";
  if (!validEmail(data.email)) errors.email = "Enter a valid email address.";
  if (typeof data.subject !== "string" || data.subject.trim().length < 3 || data.subject.length > 120) errors.subject = "Enter a subject between 3 and 120 characters.";
  if (typeof data.message !== "string" || data.message.trim().length < 10 || data.message.length > 2000) errors.message = "Enter a message between 10 and 2,000 characters.";
  return errors;
}

function enquiryText(data) {
  return `Name: ${data.name.trim()}\nEmail: ${data.email.trim()}\nSubject: ${data.subject.trim()}\n\n${data.message.trim()}`;
}

function safeMedia(value) {
  if (typeof value !== "string") return null;
  if (/^assets\/[a-zA-Z0-9/_-]+\.(webp|png|jpe?g|mp4|webm)$/i.test(value) && !value.includes("..")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function nextSchedule(days, time, now = new Date()) {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (!Array.isArray(days) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    date.setHours(hours, minutes, 0, 0);
    if (date > now && days.includes(labels[date.getDay()])) return date;
  }
  return null;
}

function initializeFeatures() {
  const config = window.DIGIFLOVV_CONFIG || {};
  const menu = document.getElementById("main-navigation");
  const toggle = document.getElementById("menu-toggle");
  toggle.hidden = false;
  const closeMenu = () => { toggle.setAttribute("aria-expanded", "false"); menu.classList.remove("is-open"); };
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open)); menu.classList.toggle("is-open", open);
  });
  menu.addEventListener("click", event => { if (event.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { closeMenu(); toggle.focus(); } });
  document.documentElement.classList.add("menu-ready");

  const specifications = config.product?.specifications || {};
  document.querySelectorAll("[data-spec]").forEach(element => {
    const value = specifications[element.dataset.spec];
    if (typeof value === "string" && value.trim()) element.textContent = value.trim();
  });
  const productName = config.product?.name;
  if (typeof productName === "string" && productName.trim()) {
    document.querySelectorAll("[data-product-name]").forEach(element => { element.textContent = productName.trim(); });
  }

  const images = Array.isArray(config.product?.images) ? config.product.images.filter(item => item && safeMedia(item.src) && typeof item.alt === "string" && item.alt.trim()) : [];
  const gallery = document.getElementById("gallery");
  if (images.length) {
    gallery.hidden = false;
    const main = document.getElementById("gallery-image");
    const caption = document.getElementById("gallery-caption");
    const tabs = document.getElementById("gallery-controls");
    function select(index) {
      main.src = safeMedia(images[index].src); main.alt = images[index].alt;
      caption.textContent = images[index].caption || images[index].alt;
      [...tabs.children].forEach((button, i) => button.setAttribute("aria-pressed", String(index === i)));
    }
    images.forEach((image, index) => {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = image.label || `Photo ${index + 1}`;
      button.addEventListener("click", () => select(index));
      tabs.append(button);
    });
    main.addEventListener("error", () => { caption.textContent = "This product photo could not be loaded. Please try another photo."; });
    select(0);
  }
  const video = config.product?.video;
  if (safeMedia(video)) {
    gallery.hidden = false;
    const player = document.getElementById("product-video");
    player.hidden = false; player.src = safeMedia(video);
    if (!images.length) document.getElementById("gallery-photos").hidden = true;
  }

  const form = document.getElementById("enquiry-form");
  const status = document.getElementById("enquiry-status");
  const draft = document.getElementById("enquiry-draft");
  const emailLink = document.getElementById("send-enquiry");
  document.getElementById("enquiry-fields").disabled = false;
  form.addEventListener("submit", event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    const errors = validateEnquiry(data);
    for (const key of ["name", "email", "subject", "message"]) {
      form.elements[key].setAttribute("aria-invalid", String(Boolean(errors[key])));
      document.getElementById(`error-${key}`).textContent = errors[key] || "";
    }
    if (Object.keys(errors).length) {
      document.getElementById("enquiry-preview").hidden = true;
      emailLink.removeAttribute("href");
      status.textContent = "Please correct the highlighted fields.";
      form.elements[Object.keys(errors)[0]].focus(); return;
    }
    draft.value = enquiryText(data);
    document.getElementById("enquiry-preview").hidden = false;
    if (validEmail(config.supportEmail)) {
      emailLink.hidden = false;
      emailLink.href = `mailto:${encodeURIComponent(config.supportEmail)}?subject=${encodeURIComponent(data.subject.trim())}&body=${encodeURIComponent(draft.value)}`;
      status.textContent = "Your draft is ready. Open your email app to review and send it.";
    } else {
      emailLink.hidden = true;
      status.textContent = "Your draft is ready to copy. DigiFlovv’s support address has not been published yet. Nothing has been sent.";
    }
    draft.focus();
  });
  form.addEventListener("input", () => {
    document.getElementById("enquiry-preview").hidden = true;
    emailLink.removeAttribute("href");
    status.textContent = "";
  });
  document.getElementById("copy-enquiry").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(draft.value); status.textContent = "Draft copied. Nothing has been sent."; }
    catch { draft.focus(); draft.select(); status.textContent = "Select and copy the draft above."; }
  });
}

if (typeof window !== "undefined") {
  window.nextSchedule = nextSchedule;
  document.addEventListener("DOMContentLoaded", initializeFeatures, { once: true });
}
if (typeof module !== "undefined") module.exports = { validEmail, validateEnquiry, enquiryText, safeMedia, nextSchedule };
