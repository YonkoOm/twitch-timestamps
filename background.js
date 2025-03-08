chrome.tabs.onUpdated.addListener((tabId, changeInfo, _) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      action: "URL_CHANGED",
      url: changeInfo.url,
    });
  }
});
