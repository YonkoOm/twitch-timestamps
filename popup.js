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

const setBookmarkAttributes = (imageName, controls, eventListener) => {
  const control = document.createElement("img");
  control.className = "control-element";
  control.src = "assets/" + imageName + ".svg";
  controls.appendChild(control);

  control.addEventListener("click", eventListener);
};

const clearButton = (eventListener) => {
  const clearAllButton = document.createElement("button");
  clearAllButton.innerText = "CLEAR ALL";
  clearAllButton.className = "clearAll-button";

  document.querySelector(".bookmarks-container").prepend(clearAllButton);
  clearAllButton.addEventListener("click", eventListener);
};

const addTimestamp = (timestamp, note) => {
  const bookmarks = document.querySelector(".bookmarks");
  const bookmarkCard = document.createElement("div");
  const timestampDisplay = document.createElement("div");
  const controls = document.createElement("div");
  const noteCard = document.createElement("div");
  const bookmarkDetails = document.createElement("div");

  noteCard.innerText = note;
  noteCard.className = "note";

  bookmarkCard.id = `bookmark-${timestamp}`;
  bookmarkCard.className = "bookmark";
  bookmarkCard.setAttribute("timestamp", timestamp);

  timestampDisplay.innerText = convertSecondsToTimeFormat(timestamp);

  controls.className = "timestamp-controls";
  setBookmarkAttributes("play", controls, onPlay);
  setBookmarkAttributes("trash", controls, onDelete);

  bookmarkDetails.className = "bookmark-info";
  bookmarkDetails.appendChild(noteCard);
  bookmarkDetails.appendChild(timestampDisplay);

  bookmarkCard.appendChild(bookmarkDetails);
  bookmarkCard.appendChild(controls);
  bookmarks.appendChild(bookmarkCard);
};

const displayVodLink = (vodId) => {
  const baseVodUrl = "https://www.twitch.tv/videos";
  const bookmarks = document.querySelector(".bookmarks");

  const vodLink = document.createElement("a");
  vodLink.href = baseVodUrl + `/${vodId}`;
  vodLink.innerHTML = baseVodUrl + `/${vodId}`;
  vodLink.className = "vod-link";
  vodLink.addEventListener("click", () => {
    chrome.tabs.create({ url: vodLink.href });
  });

  bookmarks.append(vodLink);
};

const createTitle = (title) => {
  const headerElement = document.createElement("h1");
  headerElement.innerText = title;

  document.querySelector(".container").prepend(headerElement);
};

const displayEmpty = (message) => {
  const bookmarks = document.querySelector(".bookmarks");
  const emptyMessage = document.createElement("div");
  emptyMessage.className = "empty-message";

  emptyMessage.innerText = message;

  bookmarks.appendChild(emptyMessage);
};

const displayTimestamps = (timestamps) => {
  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (timestamps.length > 0) {
    const button = document.querySelector(".clear-button");
    if (!button) clearButton(onClearVod);

    for (const { timestamp, note } of timestamps) {
      addTimestamp(timestamp, note);
    }
  } else {
    document.querySelector(".clear-button")?.remove();
    displayEmpty("Add timestamps to see them here :)");
  }
};

const displayVodTimestamps = async (vodId, username) => {
  const res = await chrome.storage.local.get([username]);
  const timestamps = res[username]?.[vodId] ?? [];

  createTitle(`${username}'s Timestamps`);
  displayTimestamps(timestamps);
};

const displayVodLinks = async (username = null) => {
  const emptyMessage = "Add timestamps to see VOD links here :)";
  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (!username) {
    document.querySelector(".clear-button")?.remove();
    displayEmpty(emptyMessage);
    return;
  }

  createTitle(`${username}'s VOD Links`);

  const res = await chrome.storage.local.get([username]);
  const vods = res[username];

  if (vods) {
    clearButton(onClearVodLinks);
    for (const vodId in vods) {
      displayVodLink(vodId);
    }
  } else {
    displayEmpty(emptyMessage);
  }
};

const onPlay = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.getAttribute("timestamp");
  await chrome.tabs.sendMessage(activeTab.id, {
    type: "PLAY",
    time: Number(timestamp),
  });
};

const onDelete = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.getAttribute("timestamp");

  const timestampToDelete = document.getElementById(`bookmark-${timestamp}`);
  timestampToDelete.parentNode.removeChild(timestampToDelete);

  chrome.tabs.sendMessage(
    activeTab.id,
    {
      type: "DELETE",
      time: Number(timestamp),
    },
    displayTimestamps,
  );
};

const onClearVod = async () => {
  const activeTab = await getActiveTabUrl();

  await chrome.tabs.sendMessage(
    activeTab.id,
    { type: "CLEAR_VOD" },
    displayTimestamps,
  );
};

const onClearVodLinks = async () => {
  const activeTab = await getActiveTabUrl();

  await chrome.tabs.sendMessage(
    activeTab.id,
    { type: "CLEAR_VOD_LINKS" },
    displayVodLinks,
  );
};

document.addEventListener("DOMContentLoaded", async () => {
  const activeTab = await getActiveTabUrl();
  const res = await chrome.tabs.sendMessage(activeTab.id, {
    type: "STREAM_DATA",
  });
  const { vodId, username, liveStreamStartTime } = res;

  if (!username) {
    displayEmpty(
      "Go to a vod or livestream to see/add timestamps or vod links",
    );
  } else if (!liveStreamStartTime) {
    displayVodTimestamps(vodId, username);
  } else {
    displayVodLinks(username);
  }
});
