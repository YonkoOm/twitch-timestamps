import { getActiveTabUrl } from "./utils.js";

const isWatchingVod = (url) => {
  const match = url.match(/twitch\.tv\/videos\/(\d+)/);
  return !!match;
};

const convertSecondsToTimeFormat = (timestamp) => {
  const hours = Math.floor(timestamp / (60 * 60));
  const minutes = Math.floor((timestamp % (60 * 60)) / 60);
  const seconds = Math.floor(timestamp % 60);
  const paddedHours = String(hours).padStart(2, "0");
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
};

const setBookmarkAttributes = (name, controlsElement, eventListener) => {
  const controlElement = document.createElement("img");
  controlElement.className = "control-element";
  controlElement.src = "assets/" + name + ".svg";
  controlsElement.appendChild(controlElement);

  controlElement.addEventListener("click", eventListener);
};

const clearButton = (eventListener) => {
  const buttonElement = document.createElement("button");
  buttonElement.innerText = "CLEAR ALL";
  buttonElement.className = "clear-vod";

  document.querySelector(".bookmarks-container").prepend(buttonElement);
  buttonElement.addEventListener("click", eventListener);
};

const addTimestamp = (timestamp, note) => {
  const bookmarks = document.querySelector(".bookmarks");
  const bookmarkElement = document.createElement("div");
  const timestampElement = document.createElement("div");
  const controlsElement = document.createElement("div");
  const titleElement = document.createElement("div");
  const bookmarkInfoElement = document.createElement("div");

  titleElement.innerText = note;
  titleElement.className = "note";

  bookmarkElement.id = `bookmark-${timestamp}`;
  bookmarkElement.className = "bookmark";
  bookmarkElement.setAttribute("timestamp", timestamp);

  timestampElement.innerText = convertSecondsToTimeFormat(timestamp);

  controlsElement.className = "timestamp-controls";
  setBookmarkAttributes("play", controlsElement, onPlay);
  setBookmarkAttributes("trash", controlsElement, onDelete);

  bookmarkInfoElement.className = "bookmark-info";
  bookmarkInfoElement.appendChild(titleElement);
  bookmarkInfoElement.appendChild(timestampElement);

  bookmarkElement.appendChild(bookmarkInfoElement);
  bookmarkElement.appendChild(controlsElement);
  bookmarks.appendChild(bookmarkElement);
};

const displayVodLink = (vodId) => {
  const baseVodUrl = "https://www.twitch.tv/videos";
  const bookmarks = document.querySelector(".bookmarks");

  const vodLinkElement = document.createElement("a");
  vodLinkElement.href = baseVodUrl + `/${vodId}`;
  vodLinkElement.innerHTML = baseVodUrl + `/${vodId}`;
  vodLinkElement.className = "vod-link";
  vodLinkElement.addEventListener("click", () => {
    chrome.tabs.create({ url: vodLinkElement.href });
  });

  bookmarks.append(vodLinkElement);
};

const displayEmpty = (message) => {
  const bookmarks = document.querySelector(".bookmarks");
  const divElement = document.createElement("div");
  divElement.className = "empty";

  divElement.innerText = message;

  bookmarks.appendChild(divElement);
};

const displayTimestamps = (currTimestamps) => {
  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (currTimestamps.length > 0) {
    const button = document.querySelector(".clear-vod");
    if (!button) clearButton(onClearVod);

    for (const timestamp of currTimestamps) {
      addTimestamp(timestamp.timestamp, timestamp.note);
    }
  } else {
    document.querySelector("button")?.remove();
    displayEmpty("Add timestamps to see them here :)");
  }
};

const displayVodTimestamps = async (vodId, username) => {
  const res = await chrome.storage.local.get([username]);
  const timestamps = res[username]?.[vodId] ?? [];
  displayTimestamps(timestamps);
};

const displayVodLinks = async (username = null) => {
  const emptyMessage =
    "Add timestamps to see links of vods with saved timestamps here :)";
  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  if (!username) {
    displayEmpty(emptyMessage);
    return;
  }

  const res = await chrome.storage.local.get([username]);
  const vods = res[username] ?? {};
  for (const vodId in vods) {
    displayVodLink(vodId);
  }

  if (Object.keys(vods).length > 0) {
    const button = document.querySelector(".clear-vod");
    if (!button) clearButton(onClearVodLinks);
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

  if (liveStreamStartTime) {
    displayVodLinks(username);
  } else if (isWatchingVod(activeTab.url)) {
    displayVodTimestamps(vodId, username);
  }
});
