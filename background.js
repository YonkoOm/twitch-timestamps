chrome.tabs.onUpdated.addListener((tabId, changeInfo, _) => {
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      action: "URL_CHANGED",
      url: changeInfo.url,
    });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open_note_field") {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tabs[0].id, { action: "OPEN_NOTE_FIELD" });
  } else if (command === "open_popup") {
    chrome.action.openPopup();
  }
});
