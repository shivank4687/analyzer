// This is a service worker in Manifest V3

chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed and background is ready.");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const MessageType = {
    PRICE_UPDATE: "PRICE_UPDATE",
  };
  switch (message.type) {
    case MessageType.PRICE_UPDATE:
      chrome.storage.local.get([MessageType.PRICE_UPDATE], (result) => {
        const updates = result[MessageType.PRICE_UPDATE] || [];
        updates.push(message.payload);
        chrome.storage.local.set(
          { [MessageType.PRICE_UPDATE]: updates },
          () => {
            sendResponse({ status: "OK" });
          }
        );
      });
      break;
    case MessageType.GET_PRICE:
      sendResponse({ price: 100 });
      break;
    // ... other cases
  }
});
