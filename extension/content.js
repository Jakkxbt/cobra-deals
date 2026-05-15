/**
 * CobraDeals — Content Script
 * Detects product pages, extracts name/price, injects comparison panel.
 */

(function () {
  "use strict";

  if (window.__cobraDealsLoaded) return;
  window.__cobraDealsLoaded = true;

  // ── Product Detection ────────────────────────────────────────────────────────

  function getProductName() {
    // 1. Open Graph (most reliable for product pages)
    const og = document.querySelector('meta[property="og:title"]');
    if (og?.content) return cleanName(og.content);

    // 2. Schema.org itemprop
    const schemaName = document.querySelector('[itemprop="name"]');
    if (schemaName) return cleanName(schemaName.textContent || schemaName.content || "");

    // 3. First H1
    const h1 = document.querySelector("h1");
    if (h1?.textContent?.trim()) return cleanName(h1.textContent.trim());

    // 4. Page title (strip site name)
    const title = document.title.split(/[-|–—]/)[0].trim();
    return cleanName(title);
  }

  function getProductPrice() {
    const selectors = [
      '[itemprop="price"]',
      '[class*="price"]:not([class*="was"]):not([class*="old"])',
      '[id*="price"]',
      '[data-price]',
      '.a-price-whole',         // Amazon
      '.priceToPay',            // Amazon
      '#priceblock_ourprice',   // Amazon legacy
      '.product__price',
      '.price__current',
      '.current-price',
      '.sale-price',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (!el) continue;
        const raw = (el.getAttribute("content") || el.getAttribute("data-price") || el.textContent || "").trim();
        const price = parsePrice(raw);
        if (price) return price;
      } catch { /* skip */ }
    }
    return null;
  }

  function parsePrice(text) {
    const match = text.match(/[£$€]?\s*(\d+[,.]?\d*)/);
    if (!match) return null;
    const sym = text.match(/[£$€]/)?.[0] || "£";
    const val = parseFloat(match[1].replace(",", "."));
    return isNaN(val) ? null : { raw: `${sym}${val.toFixed(2)}`, value: val, symbol: sym };
  }

  function cleanName(str) {
    return str
      .replace(/\s*[-|–—:]\s*.*$/, "")  // strip site name suffix
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
  }

  function isProductPage() {
    const signals = [
      // Schema.org product markup
      !!document.querySelector('[itemtype*="schema.org/Product"]'),
      !!document.querySelector('[itemtype*="schema.org/Offer"]'),
      // OG type
      document.querySelector('meta[property="og:type"]')?.content === "product",
      // Cart/buy buttons
      !!document.querySelector('[name*="cart"], [id*="cart"], [class*="add-to-cart"], [class*="buy-now"], [id*="buy-now"], [name*="add-to-basket"]'),
      // Price element
      !!document.querySelector('[itemprop="price"], [class*="product-price"], .priceToPay, #priceblock_ourprice'),
      // Amazon ASIN in URL
      /\/(dp|gp\/product)\/[A-Z0-9]{10}/.test(location.href),
      // Common product URL patterns
      /\/(product|item|p|shop)\//i.test(location.pathname),
    ];
    return signals.filter(Boolean).length >= 2;
  }

  // ── Comparison Links ─────────────────────────────────────────────────────────

  const RETAILER_CATEGORIES = [
    {
      label: "Price Comparison",
      retailers: [
        { name: "Google Shopping",  color: "#4285F4", url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=shop` },
        { name: "Idealo UK",        color: "#FF5E00", url: (q) => `https://www.idealo.co.uk/cat/search.html?q=${encodeURIComponent(q)}` },
        { name: "PriceRunner",      color: "#5C2D91", url: (q) => `https://www.pricerunner.co.uk/search?q=${encodeURIComponent(q)}` },
        { name: "Kelkoo",           color: "#FF6600", url: (q) => `https://www.kelkoo.co.uk/s/q-${encodeURIComponent(q)}` },
        { name: "Shopzilla",        color: "#0066CC", url: (q) => `https://www.shopzilla.co.uk/search?keyword=${encodeURIComponent(q)}` },
        { name: "CamelCamelCamel",  color: "#00A67E", url: (q) => `https://camelcamelcamel.com/search?sq=${encodeURIComponent(q)}` },
        { name: "PriceSpy",         color: "#E30613", url: (q) => `https://pricespy.co.uk/search?search=${encodeURIComponent(q)}` },
        { name: "BeatMyPrice",      color: "#222222", url: (q) => `https://www.beatmyprice.co.uk/search?q=${encodeURIComponent(q)}` },
      ]
    },
    {
      label: "UK Marketplaces",
      retailers: [
        { name: "Amazon UK",        color: "#FF9900", url: (q) => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q)}` },
        { name: "eBay UK",          color: "#E53238", url: (q) => `https://www.ebay.co.uk/sch/i.html?_nkw=${encodeURIComponent(q)}&_sop=15` },
        { name: "OnBuy",            color: "#FF6D00", url: (q) => `https://www.onbuy.com/gb/search/?q=${encodeURIComponent(q)}` },
        { name: "Fruugo",           color: "#7B2D8B", url: (q) => `https://www.fruugo.co.uk/search?q=${encodeURIComponent(q)}` },
        { name: "Wish",             color: "#0084FF", url: (q) => `https://www.wish.com/search/${encodeURIComponent(q)}` },
        { name: "AliExpress",       color: "#FF6000", url: (q) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(q)}` },
        { name: "Vinted",           color: "#09B1A6", url: (q) => `https://www.vinted.co.uk/catalog?search_text=${encodeURIComponent(q)}` },
        { name: "Depop",            color: "#FF2300", url: (q) => `https://www.depop.com/search/?q=${encodeURIComponent(q)}` },
        { name: "Etsy",             color: "#F45800", url: (q) => `https://www.etsy.com/uk/search?q=${encodeURIComponent(q)}` },
      ]
    },
    {
      label: "UK Retailers",
      retailers: [
        { name: "Argos",            color: "#CC0000", url: (q) => `https://www.argos.co.uk/search/${encodeURIComponent(q)}/` },
        { name: "Currys",           color: "#5C2483", url: (q) => `https://www.currys.co.uk/search?q=${encodeURIComponent(q)}` },
        { name: "John Lewis",       color: "#333333", url: (q) => `https://www.johnlewis.com/search?search-term=${encodeURIComponent(q)}` },
        { name: "Very",             color: "#C8007E", url: (q) => `https://www.very.co.uk/e/q/${encodeURIComponent(q)}.end` },
        { name: "Littlewoods",      color: "#E31837", url: (q) => `https://www.littlewoods.com/e/q/${encodeURIComponent(q)}.end` },
        { name: "B&Q",              color: "#FF7200", url: (q) => `https://www.diy.com/search?term=${encodeURIComponent(q)}` },
        { name: "Screwfix",         color: "#003087", url: (q) => `https://www.screwfix.com/search?search=${encodeURIComponent(q)}` },
        { name: "Wilko",            color: "#E4002B", url: (q) => `https://www.wilko.com/en-gb/search?q=${encodeURIComponent(q)}` },
        { name: "Robert Dyas",      color: "#006633", url: (q) => `https://www.robertdyas.co.uk/search?q=${encodeURIComponent(q)}` },
        { name: "Richer Sounds",    color: "#CC0000", url: (q) => `https://www.richersounds.com/search/?q=${encodeURIComponent(q)}` },
        { name: "Smyths Toys",      color: "#0078BE", url: (q) => `https://www.smythstoys.com/uk/en-gb/search/?text=${encodeURIComponent(q)}` },
        { name: "GAME",             color: "#E4002B", url: (q) => `https://www.game.co.uk/search?q=${encodeURIComponent(q)}` },
      ]
    },
    {
      label: "Tech Specialists",
      retailers: [
        { name: "Scan",             color: "#0068B3", url: (q) => `https://www.scan.co.uk/search?q=${encodeURIComponent(q)}` },
        { name: "Overclockers",     color: "#FF6600", url: (q) => `https://www.overclockers.co.uk/search?q=${encodeURIComponent(q)}` },
        { name: "Ebuyer",           color: "#007DC6", url: (q) => `https://www.ebuyer.com/search?q=${encodeURIComponent(q)}` },
        { name: "Box.co.uk",        color: "#E63312", url: (q) => `https://www.box.co.uk/search.aspx?q=${encodeURIComponent(q)}` },
        { name: "Newegg",           color: "#FF6600", url: (q) => `https://www.newegg.com/global/uk-en/p/pl?d=${encodeURIComponent(q)}` },
        { name: "AO.com",           color: "#0073CF", url: (q) => `https://ao.com/l/${encodeURIComponent(q.replace(/ /g,"-"))}/` },
        { name: "Back Market",      color: "#28C896", url: (q) => `https://www.backmarket.co.uk/en-gb/s?q=${encodeURIComponent(q)}` },
        { name: "Music Magpie",     color: "#6633CC", url: (q) => `https://www.musicmagpie.co.uk/store/search?search%5Bq%5D=${encodeURIComponent(q)}` },
        { name: "CEX",              color: "#F7A800", url: (q) => `https://uk.webuy.com/search?stext=${encodeURIComponent(q)}` },
        { name: "Laptops Direct",   color: "#003DA5", url: (q) => `https://www.laptopsdirect.co.uk/ct/search-results?search=${encodeURIComponent(q)}` },
      ]
    },
    {
      label: "Fashion & Home",
      retailers: [
        { name: "ASOS",             color: "#000000", url: (q) => `https://www.asos.com/search/?q=${encodeURIComponent(q)}` },
        { name: "Zalando",          color: "#FF6900", url: (q) => `https://www.zalando.co.uk/catalog/?q=${encodeURIComponent(q)}` },
        { name: "Next",             color: "#000000", url: (q) => `https://www.next.co.uk/search?q=${encodeURIComponent(q)}` },
        { name: "M&S",              color: "#3F3F3F", url: (q) => `https://www.marksandspencer.com/search-results?q=${encodeURIComponent(q)}` },
        { name: "Wayfair",          color: "#7B2D8B", url: (q) => `https://www.wayfair.co.uk/keyword.php?keyword=${encodeURIComponent(q)}` },
        { name: "IKEA",             color: "#0058A3", url: (q) => `https://www.ikea.com/gb/en/search/products/?q=${encodeURIComponent(q)}` },
        { name: "Dunelm",           color: "#7A003C", url: (q) => `https://www.dunelm.com/search?q=${encodeURIComponent(q)}` },
        { name: "The Range",        color: "#E4002B", url: (q) => `https://www.therange.co.uk/search#q=${encodeURIComponent(q)}` },
      ]
    },
    {
      label: "International",
      retailers: [
        { name: "Amazon US",        color: "#FF9900", url: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}` },
        { name: "Amazon DE",        color: "#FF9900", url: (q) => `https://www.amazon.de/s?k=${encodeURIComponent(q)}` },
        { name: "Walmart",          color: "#0071CE", url: (q) => `https://www.walmart.com/search?q=${encodeURIComponent(q)}` },
        { name: "Best Buy",         color: "#0046BE", url: (q) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}` },
        { name: "B&H Photo",        color: "#333333", url: (q) => `https://www.bhphotovideo.com/c/search?q=${encodeURIComponent(q)}` },
        { name: "Banggood",         color: "#FF4444", url: (q) => `https://www.banggood.com/search/${encodeURIComponent(q)}.html` },
      ]
    },
  ];

  // Flat list for "open all"
  const RETAILERS = RETAILER_CATEGORIES.flatMap(c => c.retailers);

  // ── Panel HTML ───────────────────────────────────────────────────────────────

  function buildPanel(product, price) {
    const priceStr = price ? price.raw : "price not detected";
    const categories = RETAILER_CATEGORIES.map(cat => `
      <div class="cd-category">
        <div class="cd-category-label">${cat.label}</div>
        <div class="cd-links">
          ${cat.retailers.map(r => `
            <a href="${r.url(product)}" target="_blank" class="cd-link" style="border-left: 3px solid ${r.color}" title="${r.name}">
              <span class="cd-retailer">${r.name}</span>
              <span class="cd-arrow">→</span>
            </a>
          `).join("")}
        </div>
      </div>
    `).join("");

    return `
      <div id="cobra-deals-panel" class="cd-panel">
        <div class="cd-header">
          <span class="cd-logo">🐍 CobraDeals</span>
          <button class="cd-close" id="cobra-deals-close" title="Close">✕</button>
        </div>
        <div class="cd-product">
          <div class="cd-product-name" title="${product}">${product}</div>
          <div class="cd-product-price">Seen at: <strong>${priceStr}</strong></div>
        </div>
        <div class="cd-scroll">${categories}</div>
        <button class="cd-compare-all" id="cobra-compare-all">Open All (${RETAILERS.length})</button>
        <div class="cd-footer">CobraDeals v2.0 · ${RETAILERS.length} sources</div>
      </div>
    `;
  }

  // ── Trigger Button ───────────────────────────────────────────────────────────

  function buildTrigger() {
    return `
      <button id="cobra-deals-trigger" class="cd-trigger" title="CobraDeals — Find cheaper prices">
        🐍
      </button>
    `;
  }

  // ── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    if (!isProductPage()) return;

    const product = getProductName();
    if (!product || product.length < 3) return;

    const price = getProductPrice();
    const host = document.createElement("div");
    host.id = "cobra-deals-host";

    // Use shadow DOM to avoid CSS conflicts
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        @import url('${chrome.runtime.getURL("panel.css")}');
      </style>
      ${buildTrigger()}
      ${buildPanel(product, price)}
    `;

    document.body.appendChild(host);

    const trigger = shadow.getElementById("cobra-deals-trigger");
    const panel   = shadow.getElementById("cobra-deals-panel");
    const close   = shadow.getElementById("cobra-deals-close");
    const compareAll = shadow.getElementById("cobra-compare-all");

    // Restore last state
    chrome.storage.local.get("cdPanelOpen", (data) => {
      if (data.cdPanelOpen) panel.classList.add("cd-panel--open");
    });

    trigger.addEventListener("click", () => {
      const open = panel.classList.toggle("cd-panel--open");
      chrome.storage.local.set({ cdPanelOpen: open });
    });

    close.addEventListener("click", () => {
      panel.classList.remove("cd-panel--open");
      chrome.storage.local.set({ cdPanelOpen: false });
    });

    compareAll.addEventListener("click", () => {
      RETAILERS.forEach((r, i) => setTimeout(() => window.open(r.url(product), "_blank"), i * 200));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Message listener — popup asks for product info
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "get_product") {
      const product = getProductName();
      const price   = getProductPrice();
      sendResponse({
        product: isProductPage() ? product : null,
        price: price ? price.raw : null,
      });
    }
    return true;
  });

  // Re-check on navigation (SPA support)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const existing = document.getElementById("cobra-deals-host");
      if (existing) existing.remove();
      window.__cobraDealsLoaded = false;
      setTimeout(() => {
        window.__cobraDealsLoaded = false;
        init();
      }, 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });

})();
