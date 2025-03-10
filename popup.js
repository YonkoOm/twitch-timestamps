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

  bookmarkCard.id = `bookmark-${timestamp}`;
  bookmarkCard.className = "bookmark";
  bookmarkCard.dataset.timestamp = timestamp;

  noteContainer.innerText = note;
  noteContainer.className = "note";

  timestampContainer.innerText = convertSecondsToTimeFormat(timestamp);

  bookmarkInfo.className = "bookmark-info";
  bookmarkInfo.appendChild(noteContainer);
  bookmarkInfo.appendChild(timestampContainer);

  controls.className = "timestamp-controls";
  createBookmarkControl("play", controls, onPlay);
  createBookmarkControl("trash", controls, onDelete);

  bookmarkCard.appendChild(bookmarkInfo);
  bookmarkCard.appendChild(controls);

  bookmarks.appendChild(bookmarkCard);
};

const addVodLink = (vodId, title) => {
  const bookmarks = document.querySelector(".bookmarks");

  const vodLink = document.createElement("a");
  vodLink.href = `https://www.twitch.tv/videos/${vodId}`;
  vodLink.innerText = title;
  vodLink.className = "vod-link";
  vodLink.addEventListener("click", () => {
    chrome.tabs.create({ url: vodLink.href });
  });

  bookmarks.append(vodLink);
};

const displayTimestamps = (timestamps) => {
  const clearButton = document.querySelector(".clear-button");

  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (timestamps.length > 0) {
    if (!clearButton) {
      addClearButton(onClearVod);
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
  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (vods) {
    addClearButton(onClearVodLinks);

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
  const vods = res[username];

  createTitle(`${username}'s VOD Links`);
  displayLinks(vods);
};

const onPlay = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.dataset.timestamp;

  await chrome.tabs.sendMessage(activeTab.id, {
    action: "SEEK_VIDEO",
    time: Number(timestamp),
  });
};

const onDelete = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.dataset.timestamp;

  const timestampToDelete = document.getElementById(`bookmark-${timestamp}`);
  timestampToDelete.parentNode.removeChild(timestampToDelete); // TODO:

  chrome.tabs.sendMessage(
    activeTab.id,
    {
      action: "DELETE_TIMESTAMP",
      time: Number(timestamp),
    },
    displayTimestamps,
  );
};

const onClearVod = async () => {
  const activeTab = await getActiveTabUrl();

  await chrome.tabs.sendMessage(
    activeTab.id,
    { action: "CLEAR_VOD" },
    displayTimestamps,
  );
};

const onClearVodLinks = async () => {
  const activeTab = await getActiveTabUrl();

  await chrome.tabs.sendMessage(
    activeTab.id,
    { action: "CLEAR_STREAMER_INFO" },
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
  } else if (!liveStreamStartTime) {
    displayVodTimestamps(vodId, username); // if there is an username but no livestream start time, indicates we are watching VOD
  } else {
    displayVodLinks(username); // watching livestream
  }
});
