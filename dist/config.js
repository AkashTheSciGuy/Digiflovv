"use strict";
// Public storefront configuration. Never put secrets or payment credentials here.
window.DIGIFLOVV_CONFIG = Object.freeze({
  // Showcase-only release: purchases are not available.
  siteUrl: "",
  product: {
    name: "Automated plant watering system",
    specifications: { dimensions: "", power: "", compatibility: "", contents: "" },
    // Approved product photography only; empty means the gallery stays hidden.
    // { src: "assets/product-front.webp", alt: "DigiFlovv front view", label: "Front" }
    images: [],
    video: ""
  },
  checkoutUrl: "",
  displayPrice: "",
  salesNote: "",
  supportEmail: "",
  ordersOpen: false,
  policyUrls: { privacy: "", terms: "", returns: "" }
});
