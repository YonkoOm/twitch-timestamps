import { getActiveTabUrl } from "./utils.js";

const convertSecondsToTimeFormat = (timestamp) => {
  const hours = Math.floor(timestamp / (60 * 60));
  const minutes = Math.floor((timestamp % (60 * 60)) / 60);
  const seconds = Math.floor(timestamp % 60);
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
};

const createTitle = (title) => {
  const container = document.querySelector(".container");

  const headerElement = document.createElement("h1");
  headerElement.innerText = title;

  container.prepend(headerElement);
};

const displayEmpty = (message) => {
  const bookmarks = document.querySelector(".bookmarks");

  const emptyMessage = document.createElement("div");
  emptyMessage.className = "empty-message";
  emptyMessage.innerText = message;

  bookmarks.appendChild(emptyMessage);
};

const addClearButton = (eventListener) => {
  const container = document.querySelector(".bookmarks-container");

  const clearButton = document.createElement("button");
  clearButton.innerText = "CLEAR";
  clearButton.className = "clear-button";
  clearButton.addEventListener("click", eventListener);

  container.prepend(clearButton);
};

const createBookmarkControl = (imageName, controls, eventListener) => {
  const control = document.createElement("img");

  control.className = "control-element";
  control.src = "assets/" + imageName + ".svg";
  control.addEventListener("click", eventListener);

  controls.appendChild(control);
};

const addTimestamp = (timestamp, note) => {
  const bookmarks = document.querySelector(".bookmarks");
  const bookmarkCard = document.createElement("div");
  const timestampContainer = document.createElement("div");
  const noteContainer = document.createElement("div");
  const controls = document.createElement("div");
  const bookmarkInfo = document.createElement("div");

  bookmarkCard.className = "bookmark";
  bookmarkCard.dataset.timestamp = timestamp;

  noteContainer.innerText = note;
  noteContainer.className = "note";

  timestampContainer.innerText = convertSecondsToTimeFormat(timestamp);

  bookmarkInfo.className = "bookmark-info";
  bookmarkInfo.appendChild(noteContainer);
  bookmarkInfo.appendChild(timestampContainer);

  controls.className = "timestamp-controls";
  createBookmarkControl("play", controls, playTimestamp);
  createBookmarkControl("trash", controls, deleteTimestamp);

  bookmarkCard.appendChild(bookmarkInfo);
  bookmarkCard.appendChild(controls);

  bookmarks.appendChild(bookmarkCard);
};

const addVodLink = (vodId, title) => {
  const bookmarks = document.querySelector(".bookmarks");
  const vodLinkCard = document.createElement("div");
  const controls = document.createElement("div");

  vodLinkCard.className = "bookmark";
  vodLinkCard.dataset.vodId = vodId;

  controls.className = "timestamp-controls";
  createBookmarkControl("trash", controls, deleteVodLink);

  const vodLink = document.createElement("a");
  vodLink.href = `https://www.twitch.tv/videos/${vodId}`;
  vodLink.innerText = title.substring(0, 100);
  vodLink.className = "vod-link";
  vodLink.addEventListener("click", () => {
    chrome.tabs.create({ url: vodLink.href });
  });

  vodLinkCard.appendChild(vodLink);
  vodLinkCard.appendChild(controls);

  bookmarks.appendChild(vodLinkCard);
};

const displayTimestamps = (timestamps) => {
  const clearButton = document.querySelector(".clear-button");

  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (timestamps.length > 0) {
    if (!clearButton) {
      addClearButton(deleteVod);
    }

    for (const { timestamp, note } of timestamps) {
      addTimestamp(timestamp, note);
    }
  } else {
    clearButton?.remove();
    displayEmpty("Add timestamps to see them here :)");
  }
};

const displayVodTimestamps = async (vodId, username) => {
  const res = await chrome.storage.local.get([username]);
  const timestamps = res[username]?.[vodId]?.timestamps ?? [];

  createTitle(`${username}'s Timestamps`);
  displayTimestamps(timestamps);
};

const displayLinks = (vods) => {
  const clearButton = document.querySelector(".clear-button");

  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (Object.keys(vods).length > 0) {
    if (!clearButton) {
      addClearButton(deleteVodLinks);
    }

    for (const vodId in vods) {
      addVodLink(vodId, vods[vodId].streamTitle);
    }
  } else {
    const clearButton = document.querySelector(".clear-button");
    clearButton?.remove();

    displayEmpty("Add timestamps to see VOD links here :)");
  }
};

const displayVodLinks = async (username) => {
  const res = await chrome.storage.local.get([username]);
  const vods = res[username] ?? {};

  createTitle(`${username}'s VOD Links`);
  displayLinks(vods);
};

const playTimestamp = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.dataset.timestamp;

  await chrome.tabs.sendMessage(activeTab.id, {
    action: "SEEK_VIDEO",
    time: Number(timestamp),
  });
};

const deleteTimestamp = async (e) => {
  const activeTab = await getActiveTabUrl();

  const timestampToDelete = e.target.parentNode.parentNode;
  const timestamp = timestampToDelete.dataset.timestamp;

  timestampToDelete.remove();

  chrome.tabs.sendMessage(
    activeTab.id,
    {
      action: "DELETE_TIMESTAMP",
      time: Number(timestamp),
    },
    displayTimestamps,
  );
};

const deleteVod = async () => {
  const activeTab = await getActiveTabUrl();

  await chrome.tabs.sendMessage(
    activeTab.id,
    { action: "DELETE_VOD" },
    displayTimestamps,
  );
};

const deleteVodLinks = async () => {
  const activeTab = await getActiveTabUrl();

  await chrome.tabs.sendMessage(
    activeTab.id,
    { action: "CLEAR_STREAMER_INFO" },
    displayLinks,
  );
};

const deleteVodLink = async (e) => {
  const activeTab = await getActiveTabUrl();

  const vodLinkToRemove = e.target.parentNode.parentNode;
  const vodId = vodLinkToRemove.dataset.vodId;

  vodLinkToRemove.remove();

  await chrome.tabs.sendMessage(
    activeTab.id,
    { action: "DELETE_VOD", vodId: vodId },
    displayLinks,
  );
};

document.addEventListener("DOMContentLoaded", async () => {
  const activeTab = await getActiveTabUrl();
  const res = await chrome.tabs.sendMessage(activeTab.id, {
    action: "GET_STREAM_DATA",
  });
  const { vodId, username, liveStreamStartTime } = res;

  // check for missing username instead of missing VOD ID, as the user could be on a livestream without a VOD attached to it
  if (!username) {
    displayEmpty(
      "Go to a vod or livestream to see/add timestamps or vod links",
    );
  } else if (vodId && !liveStreamStartTime) {
    displayVodTimestamps(vodId, username); // watching vod
  } else {
    displayVodLinks(username); // watching livestream or on user homepage
  }
});
