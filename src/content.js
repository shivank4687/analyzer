var MessageType = {
  PRICE_UPDATE: "PRICE_UPDATE",
};
function monitorPrices() {
  if (window.StockAnalysisContentScriptLoaded) return;
  window.StockAnalysisContentScriptLoaded = true;
  let all_prices = [];
  let latestPrice = null;
  let recentTrades = [];
  let lastDataPoint = null;
  function extractPrice(selector) {
    const el = document.querySelector(selector);
    return el ? el.innerText.trim() : null;
  }

  function extractRecentTrades(tableSelector) {
    const table = document.querySelector(tableSelector);
    if (!table) return [];
    const rows = table.querySelectorAll("tbody tr");
    return Array.from(rows)
      .map((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) return null;
        return {
          price: parseFloat(cells[0].innerText),
          taker: cells[1].innerText.trim(),
          size: parseFloat(cells[2].innerText),
          time: cells[3].innerText.trim(),
        };
      })
      .filter(Boolean);
  }

  function updatePrices(data) {
    if (!all_prices) all_prices = [];

    let value = data,
      color = "";
    if (typeof data === "object" && data !== null) {
      value = data.value;
      color = data.color || "";
    }
    const numericValue = extractNumericValue(value);
    const isNewData =
      !lastDataPoint ||
      Math.abs(lastDataPoint.numericValue - numericValue) > 0.0001;
    if (isNewData) {
      const timestamp = new Date();
      lastDataPoint = {
        value: value,
        color: color,
        timestamp: timestamp.getTime(),
        numericValue: numericValue,
      };

      all_prices.push(lastDataPoint);
      notifyUpdate(lastDataPoint);
    }
  }

  function syncPriceAndTrades(priceSelector, tradeTableSelector) {
    const targetNode = document.querySelector(priceSelector);
    if (!targetNode) {
      console.log("❌ Price element not found.");
      return;
    }

    // Initial extraction
    latestPrice = extractPrice(priceSelector);
    recentTrades = extractRecentTrades(tradeTableSelector);
    updatePrices(latestPrice);
    const observer = new MutationObserver(() => {
      const newPrice = extractPrice(priceSelector);

      if (newPrice !== latestPrice) {
        updatePrices(newPrice);
        latestPrice = newPrice;
        recentTrades = extractRecentTrades(tradeTableSelector);
      }
    });

    observer.observe(targetNode, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    console.log("✅ Price observer attached.");
  }

  // Listen for popup requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getLatestData") {
      sendResponse({ data: lastDataPoint || "No data yet" });
    } else if (message.action === "getRecentTrades") {
      sendResponse({ trades: recentTrades || [] });
    } else if (message.action === "getAllData") {
      sendResponse({ data: all_prices || "No data yet" });
    } else if (message.action === "ping") {
      sendResponse({ status: "ready", monitorExists: !!latestPrice });
    }
    return true;
  });

  // Start minimal monitoring
  syncPriceAndTrades(".style--pU94z", "table.style--LQOfQ");
}

function notifyUpdate(data) {
  chrome.runtime.sendMessage({
    type: MessageType.PRICE_UPDATE,
    payload: data,
  });
}
// Utility to parse float safely
const parseNumber = (text) => parseFloat(text.replace(/,/g, "").trim()) || 0;

// Extract rows from DOM
function extractOrderBookRows(type = "buy") {
  const rows = document.querySelectorAll(
    `tbody[data-palette="TableRows"] tr.${type}`
  );
  return Array.from(rows)
    .map((row) => {
      const cells = row.querySelectorAll("td");
      return {
        price: parseNumber(cells[0]?.innerText),
        size: parseNumber(cells[1]?.innerText),
        total: parseNumber(cells[2]?.innerText),
      };
    })
    .filter((order) => order.price > 0); // Skip empty/invalid rows
}

// Compare snapshots
function compareOrderBooks(prev, current) {
  const changes = [];

  const prevMap = new Map(prev.map((order) => [order.price, order]));
  const currMap = new Map(current.map((order) => [order.price, order]));

  // Detect updates and additions
  for (const [price, currOrder] of currMap) {
    const prevOrder = prevMap.get(price);
    if (!prevOrder) {
      changes.push({ type: "added", side: currOrder.side, ...currOrder });
    } else if (currOrder.size !== prevOrder.size) {
      changes.push({
        type: "updated",
        side: currOrder.side,
        price,
        from: prevOrder.size,
        to: currOrder.size,
      });
    }
  }

  // Detect removals
  for (const [price, prevOrder] of prevMap) {
    if (!currMap.has(price)) {
      changes.push({ type: "removed", side: prevOrder.side, ...prevOrder });
    }
  }

  return changes;
}

// Snapshot holders
let lastBuySnapshot = [];
let lastSellSnapshot = [];

function trackOrderBook() {
  const buyOrders = extractOrderBookRows("buy").map((o) => ({
    ...o,
    side: "buy",
  }));
  const sellOrders = extractOrderBookRows("sell").map((o) => ({
    ...o,
    side: "sell",
  }));

  const buyChanges = compareOrderBooks(lastBuySnapshot, buyOrders);
  const sellChanges = compareOrderBooks(lastSellSnapshot, sellOrders);

  if (buyChanges.length > 0 || sellChanges.length > 0) {
    console.log("Order Book Movement:", [...buyChanges, ...sellChanges]);
    // You can optionally trigger a callback or send this to background script/storage
  }

  lastBuySnapshot = buyOrders;
  lastSellSnapshot = sellOrders;
}

setTimeout(monitorPrices, 3000);

function extractNumericValue(text) {
  if (!text) return null;

  // Convert to string and clean up
  const cleanText = text.toString().trim();
  // console.log('Extracting numeric value from:', cleanText);

  // Try different patterns for numeric extraction
  let match = null;

  // Pattern 1: Currency format ($50,000.00)
  match = cleanText.match(/[\$€£¥₹]?([\d,]+\.?\d*)/);
  if (match) {
    const value = parseFloat(match[1].replace(/,/g, ""));
    // console.log('Extracted currency value:', value);
    return value;
  }

  // Pattern 2: Pure numbers (50000.00)
  match = cleanText.match(/^([\d,]+\.?\d*)$/);
  if (match) {
    const value = parseFloat(match[1].replace(/,/g, ""));
    // console.log('Extracted pure number:', value);
    return value;
  }

  // Pattern 3: Numbers with text (Price: 50000.00)
  match = cleanText.match(/([\d,]+\.?\d*)/);
  if (match) {
    const value = parseFloat(match[1].replace(/,/g, ""));
    // console.log('Extracted number from text:', value);
    return value;
  }

  // console.log('No numeric value found in:', cleanText);
  return null;
}
