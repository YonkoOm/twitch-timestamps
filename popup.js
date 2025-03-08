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

const addClearButton = (eventListener) => {
  const container = document.querySelector(".bookmarks-container");

  const clearButton = document.createElement("button");
  clearButton.innerText = "CLEAR";
  clearButton.className = "clear-button";
  clearButton.addEventListener("click", eventListener);

  container.prepend(clearButton);
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

const displayVodLink = (vodId, title) => {
  const bookmarks = document.querySelector(".bookmarks");

  const vodLink = document.createElement("a");
  vodLink.href = `https://www.twitch.tv/videos/${vodId}`;
  vodLink.innerHTML = title;
  vodLink.className = "vod-link";
  vodLink.addEventListener("click", () => {
    chrome.tabs.create({ url: vodLink.href });
  });

  bookmarks.append(vodLink);
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

const displayVodLinks = async (username) => {
  const emptyMessage = "Add timestamps to see VOD links here :)";

  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (!username) {
    const clearButton = document.querySelector(".clear-button");
    clearButton?.remove();
    displayEmpty(emptyMessage);
    return;
  }

  createTitle(`${username}'s VOD Links`);

  const res = await chrome.storage.local.get([username]);
  const vods = res[username];

  if (vods) {
    addClearButton(onClearVodLinks);
    for (const vodId in vods) {
      displayVodLink(vodId, vods[vodId].streamTitle);
    }
  } else {
    displayEmpty(emptyMessage);
  }
};

const onPlay = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.getAttribute("timestamp");
  await chrome.tabs.sendMessage(activeTab.id, {
    action: "SEEK_VIDEO",
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
    displayVodLinks,
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
    displayVodTimestamps(vodId, username); // if there is an unsername but no livestream start time, indicates we are watching VOD
  } else {
    displayVodLinks(username);
  }
});
