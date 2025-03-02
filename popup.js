import { getActiveTabUrl } from "./utils.js";

const getVodId = async () => {
  const activeTab = await getActiveTabUrl();
  const match = activeTab.url.match(/twitch\.tv\/videos\/(\d+)/);
  return match ? match[1] : null;
};

const displayEmpty = () => {
  const bookmarks = document.getElementsByClassName("bookmarks")[0];
  const divElement = document.createElement("div");
  divElement.className = "empty-timestamps";

  divElement.innerText = "Add timestamps to see them here :)";

  bookmarks.appendChild(divElement);
};

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

  await chrome.tabs.sendMessage(activeTab.id, {
    type: "DELETE",
    time: Number(timestamp),
  });

  const vodId = await getVodId();
  const res = await chrome.storage.local.get(["timestamps"]);
  const timestamps = res.timestamps[vodId] || [];

  if (timestamps.length === 0) {
    displayEmpty();
  }
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

const addTimestamp = (bookmarks, timestamp, note) => {
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

const displayTimestamps = (currTimestamps) => {
  if (currTimestamps.length === 0) {
    displayEmpty();
  }

  const bookmarks = document.getElementsByClassName("bookmarks")[0];

  for (const timestamp of currTimestamps) {
    addTimestamp(bookmarks, timestamp.timestamp, timestamp.note);
  }
};

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  const vodId = await getVodId();

  if (vodId) {
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps[vodId] || [];
    console.log(timestamps);
    displayTimestamps(timestamps);
  } else {
    const container = document.getElementsByClassName("container")[0];
    container.innerHTML = '<div class="title">This is not a VOD</div>';
  }
});
