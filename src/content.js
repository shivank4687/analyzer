var MessageType = {
  PRICE_UPDATE: "PRICE_UPDATE",
};

// Snapshot holders
let lastBuySnapshot = [];
let lastSellSnapshot = [];

function createAnalysisSnapshot({
  price,
  trades,
  orderBook,
  marketStats,
  timestamp = Date.now(),
}) {
  const buyTrades = trades.filter((t) => t.direction === "buy");
  const sellTrades = trades.filter((t) => t.direction === "sell");
  const totalSize = trades.reduce((sum, t) => sum + t.size, 0);
  const buySize = buyTrades.reduce((sum, t) => sum + t.size, 0);
  const sellSize = sellTrades.reduce((sum, t) => sum + t.size, 0);
  const buyRatio = totalSize ? (buySize / totalSize) * 100 : 0;

  const spread =
    orderBook.topAsk?.price && orderBook.topBid?.price
      ? orderBook.topAsk.price - orderBook.topBid.price
      : null;

  return {
    timestamp,
    price,

    volume: {
      totalSize,
      buySize,
      sellSize,
      buyRatio: Number(buyRatio.toFixed(2)),
      recentTrades: trades,
    },

    orderBook: {
      ...orderBook,
      spread,
      imbalance:
        orderBook.buyDepth + orderBook.sellDepth
          ? (orderBook.buyDepth / (orderBook.buyDepth + orderBook.sellDepth)) *
            100
          : 0,
    },
    marketStats,
    // signals: {
    //   buyPressure: buyRatio > 70,
    //   spoofingDetected: detectSpoofing(orderBook.changes),
    //   wallMovement: detectWallMovement(orderBook.changes),
    //   momentum: detectMomentum(price), // basic price velocity trend
    // },
  };
}

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
        const price = parseFloat(cells[0].innerText);
        const takerText = cells[1].innerText.trim().toLowerCase();
        const size = parseFloat(cells[2].innerText);
        const timeStr = cells[3].innerText.trim(); // e.g. "10:23:45"

        // Parse time string to epoch
        const time = parseTimeToEpoch(timeStr) || now;
        return {
          price,
          size,
          direction: takerText === "buy" ? "buy" : "sell",
          isBuyer: takerText === "buy",
          time,
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
      return lastDataPoint;
    }
    return null;
  }

  function syncPriceAndTrades(priceSelector, tradeTableSelector) {
    const targetNode = document.querySelector(priceSelector);
    if (!targetNode) {
      console.log("❌ Price element not found.");
      return;
    }

    // Initial extraction
    // latestPrice = extractPrice(priceSelector);
    // recentTrades = extractRecentTrades(tradeTableSelector);
    // updatePrices(latestPrice);
    const observer = new MutationObserver(() => {
      const newPrice = extractPrice(priceSelector);

      if (newPrice !== latestPrice) {
        let latestPoint = updatePrices(newPrice);
        if (latestPoint) {
          recentTrades = extractRecentTrades(tradeTableSelector);
          const orderBook = getOrderBookSnapshot();
          const marketStats = extractHeaderStats();
          const snapshot = createAnalysisSnapshot({
            price: lastDataPoint.numericValue,
            orderBook,
            trades: recentTrades,
            marketStats,
          });
          console.log(snapshot);
        }
        latestPrice = newPrice;
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

function getOrderBookSnapshot() {
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
  lastBuySnapshot = buyOrders;
  lastSellSnapshot = sellOrders;
  const topBid = buyOrders[0] || null;
  const topAsk = sellOrders[0] || null;

  const spread =
    topBid && topAsk ? Math.abs(topAsk.price - topBid.price) : null;

  const buyDepth = buyOrders.reduce((sum, o) => sum + o.size, 0);
  const sellDepth = sellOrders.reduce((sum, o) => sum + o.size, 0);

  const bidWall = getWall(buyOrders); // max size
  const askWall = getWall(sellOrders);

  return {
    topBid,
    topAsk,
    spread,
    buyDepth: Number(buyDepth.toFixed(2)),
    sellDepth: Number(sellDepth.toFixed(2)),
    bidWall,
    askWall,
    changes: [...buyChanges, ...sellChanges],
    buyOrders,
    sellOrders,
  };
}

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

function parseTimeToEpoch(hhmmss) {
  const [hh, mm, ss] = hhmmss.split(":").map(Number);
  const now = new Date();
  if (isNaN(hh) || isNaN(mm) || isNaN(ss)) return null;

  now.setHours(hh, mm, ss, 0);
  return now.getTime();
}

function getWall(orders = []) {
  if (!orders.length) return null;

  let maxOrder = orders[0];
  for (const order of orders) {
    if (order.size > maxOrder.size) {
      maxOrder = order;
    }
  }
  return maxOrder;
}

setTimeout(monitorPrices, 3000);

function detectSpoofing(changes = []) {
  const spoofThreshold = 5; // size ≥ 5 units (tune based on symbol)
  const priceCounts = {};

  for (const change of changes) {
    if (
      (change.type === "added" || change.type === "removed") &&
      change.size >= spoofThreshold
    ) {
      const key = `${change.side}-${change.price}`;
      priceCounts[key] = (priceCounts[key] || 0) + 1;
    }
  }

  // If the same price saw both added + removed in same round, suspicious
  const suspicious = Object.entries(priceCounts).some(
    ([_, count]) => count > 1
  );

  return suspicious;
}

function detectWallMovement(changes = []) {
  const wallSize = 5;
  const wallMoves = changes.filter((c) => {
    return (c.type === "removed" || c.type === "added") && c.size >= wallSize;
  });

  // You can get fancier later: check if price shifted multiple ticks
  return wallMoves.length >= 2;
}

function extractHeaderStats() {
  const header = document.querySelector("#header-placeholder");
  if (!header) return {};

  function getValue(labelText) {
    const label = Array.from(header.querySelectorAll(".header-label")).find(
      (el) => el.textContent.trim().includes(labelText)
    );
    if (!label) return null;
    const valueEl = label.closest(".sc-kIPQKe")?.querySelector(".header-value");
    return valueEl?.innerText.trim() || null;
  }

  return {
    change24h: parsePercentage(getValue("24h Change")), // 0.0035
    volume24h: parseDollarValue(getValue("24h Vol.")), // 531800000
    openInterest: parseDollarValue(getValue("OI")), // 56900000
    fundingRate: parseFundingRate(
      document.querySelector(".funding-value")?.innerText
    ),
    estNextFunding: parseFundingRate(getValue("Est. Next Funding")),
    nextFundingSeconds: parseCountdownToSeconds(getValue("Next Funding In")),
    high24h: parseDollarValue(getValue("24h High")), // 114542.0
    low24h: parseDollarValue(getValue("24h Low")), // 112597.5
  };
}

const priceHistory = []; // global

function detectMomentum(currentPrice) {
  const now = Date.now();
  priceHistory.push({ price: currentPrice, time: now });

  // Keep only last 10 seconds
  while (priceHistory.length && now - priceHistory[0].time > 10000) {
    priceHistory.shift();
  }

  if (priceHistory.length < 2) return "flat";

  const first = priceHistory[0].price;
  const last = priceHistory[priceHistory.length - 1].price;
  const change = last - first;
  const pct = (change / first) * 100;

  if (pct > 0.1) return "rising";
  if (pct < -0.1) return "falling";
  return "flat";
}

function parseDollarValue(valueStr) {
  if (!valueStr) return 0;

  valueStr = valueStr.replace(/[\$,]/g, "").trim().toUpperCase(); // "$531.8M" → "531.8M"

  const multiplier = valueStr.endsWith("M")
    ? 1_000_000
    : valueStr.endsWith("B")
    ? 1_000_000_000
    : 1;

  const number = parseFloat(valueStr);
  return isNaN(number) ? 0 : number * multiplier;
}

function parseCountdownToSeconds(countdownStr) {
  if (!countdownStr) return 0;

  const regex = /(\d{1,2})h:(\d{1,2})m:(\d{1,2})s/;
  const match = countdownStr.match(regex);

  if (!match) return 0;

  const [, h, m, s] = match.map(Number);
  return h * 3600 + m * 60 + s;
}

function parsePercentage(percentStr, asFraction = false) {
  if (!percentStr) return 0;

  const num = parseFloat(percentStr.replace("%", "").trim());
  if (isNaN(num)) return 0;

  return asFraction ? num / 100 : num;
}

function parseFundingRate(rateStr) {
  // "0.0100% /8h" → 0.0001
  if (!rateStr) return 0;
  const [percent] = rateStr.split("/");
  return parsePercentage(percent);
}
