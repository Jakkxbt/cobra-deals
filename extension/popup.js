/**
 * CobraDeals — Popup Script
 * Shows current page status and search links.
 */

const RETAILERS = [
  { name: "Google Shopping", icon: "🛒", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=shop` },
  { name: "Amazon UK",       icon: "📦", url: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}` },
  { name: "eBay UK",         icon: "🏷️", url: (q) => `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(q)}&_sop=15` },
  { name: "Idealo",          icon: "💰", url: (q) => `https://www.idealo.co.uk/cat/search.html?q=${encodeURIComponent(q)}` },
  { name: "PriceRunner",     icon: "🔍", url: (q) => `https://www.pricerunner.co.uk/search?q=${encodeURIComponent(q)}` },
  { name: "CamelCamelCamel", icon: "📈", url: (q) => `https://camelcamelcamel.com/search?sq=${encodeURIComponent(q)}` },
];

let currentProduct = "";

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function renderRetailers(query) {
  const container = document.getElementById("retailers");
  container.innerHTML = "";
  RETAILERS.forEach(r => {
    const a = document.createElement("a");
    a.className = "retailer-row";
    a.href = r.url(query);
    a.target = "_blank";
    a.innerHTML = `<span class="icon">${r.icon}</span><span class="name">${r.name}</span><span>→</span>`;
    container.appendChild(a);
  });
}

async function init() {
  const dot = document.getElementById("dot");
  const statusText = document.getElementById("status-text");
  const productInfo = document.getElementById("product-info");
  const searchAll = document.getElementById("search-all");

  try {
    const tab = await getActiveTab();
    if (!tab?.id) throw new Error("No active tab");

    // Ask content script for product info
    let result;
    try {
      result = await chrome.tabs.sendMessage(tab.id, { type: "get_product" });
    } catch {
      result = null;
    }

    if (result?.product) {
      currentProduct = result.product;
      dot.classList.add("active");
      statusText.textContent = "Product page detected";
      productInfo.classList.add("visible");
      document.getElementById("product-name").textContent = result.product;
      document.getElementById("product-price").textContent = result.price || "Price not detected";
      renderRetailers(result.product);
    } else {
      statusText.textContent = "No product detected on this page";
      // Use page title as fallback
      currentProduct = tab.title?.split(/[-|–—]/)[0].trim() || "";
      renderRetailers(currentProduct);
    }
  } catch (err) {
    statusText.textContent = "Could not detect product";
  }

  searchAll.addEventListener("click", () => {
    if (!currentProduct) return;
    RETAILERS.forEach((r, i) => {
      setTimeout(() => chrome.tabs.create({ url: r.url(currentProduct), active: false }), i * 150);
    });
    window.close();
  });
}

init();
