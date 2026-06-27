const APP_CONFIG = {
  siteName: "Equity Merchants Ltd",
  businessId: "equity-merchants",
  whatsappNumber: "254759043208",
  logoSrc: "Equity Merchants.png",
  logoAlt: "Equity Merchants Ltd logo",
  workerBaseUrl: "https://equity-merchants-listings.ujao.workers.dev",
  footerCredit: "Built by Ujao Defined"
};

function getWorkerUrl() {
  const url = new URL(APP_CONFIG.workerBaseUrl);
  url.searchParams.set("businessId", APP_CONFIG.businessId);
  return url.toString();
}

function applyBranding() {
  document.querySelectorAll("[data-brand-site-name]").forEach((element) => {
    element.textContent = APP_CONFIG.siteName;
  });

  document.querySelectorAll("[data-brand-logo]").forEach((element) => {
    if (element.tagName.toLowerCase() === "img") {
      element.src = APP_CONFIG.logoSrc;
      element.alt = APP_CONFIG.logoAlt;
    }
  });

  document.querySelectorAll("[data-brand-credit]").forEach((element) => {
    element.textContent = APP_CONFIG.footerCredit;
  });
}

window.addEventListener("DOMContentLoaded", applyBranding);
