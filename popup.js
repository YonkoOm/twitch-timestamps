import { getActiveTabUrl } from "./utils.js";

const onPlay = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.getAttribute("timestamp");
  chrome.tabs.sendMessage(activeTab.id, {
    type: "PLAY",
    time: Number(timestamp),
  });
};

const onDelete = async (e) => {
  const activeTab = await getActiveTabUrl();
  const timestamp = e.target.parentNode.parentNode.getAttribute("timestamp");

  const bookmark = document.getElementById(`bookmark-${timestamp}`);
  bookmark.remove();

  chrome.tabs.sendMessage(activeTab.id, {
    type: "DELETE",
    time: Number(timestamp),
  });
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

const addTimestamp = (bookmarks, timestamp) => {
  const bookmarkElement = document.createElement("div");
  const timestampElement = document.createElement("div");
  const controlsElement = document.createElement("div");

  bookmarkElement.id = `bookmark-${timestamp}`;
  bookmarkElement.className = "bookmark";
  bookmarkElement.setAttribute("timestamp", timestamp);

  timestampElement.innerHTML = convertSecondsToTimeFormat(timestamp);

  controlsElement.className = "timestamp-controls";
  setBookmarkAttributes("play", controlsElement, onPlay);
  setBookmarkAttributes("trash", controlsElement, onDelete);

  bookmarkElement.appendChild(timestampElement);
  bookmarkElement.appendChild(controlsElement);
  bookmarks.appendChild(bookmarkElement);
};

const displayTimestamps = (currTimestamps) => {
  const bookmarks = document.getElementsByClassName("bookmarks")[0];

  for (const timestamp of currTimestamps) {
    addTimestamp(bookmarks, timestamp);
  }
};

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  const activeTab = await getActiveTabUrl();
  const match = activeTab.url.match(/twitch\.tv\/videos\/(\d+)/);

  if (match && match[1]) {
    console.log(match[1]);
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps[match[1]] || [];
    console.log(timestamps);
    displayTimestamps(timestamps);
  } else {
    const container = document.getElementsByClassName("container")[0];
    container.innerHTML = '<h1 class="title">This is not a VOD</h1>';
  }
});
