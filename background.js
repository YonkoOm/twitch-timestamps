chrome.tabs.onUpdated.addListener((tabId, changeInfo, _) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      type: "URLChange",
      url: changeInfo.url,
    });
  }
});
