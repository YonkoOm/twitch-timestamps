import { getActiveTabUrl } from "./utils.js";

const getVodId = async () => {
  const activeTab = await getActiveTabUrl();
  const match = activeTab.url.match(/twitch\.tv\/videos\/(\d+)/);
  return match ? match[1] : null;
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

const clearVodTimestampsButton = () => {
  const buttonElement = document.createElement("button");
  buttonElement.innerText = "CLEAR ALL";
  buttonElement.className = "clear-all";

  document.querySelector(".bookmarks-container").prepend(buttonElement);
  buttonElement.addEventListener("click", onClearVod);
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

const displayEmpty = (bookmarks) => {
  const divElement = document.createElement("div");
  divElement.className = "empty";

  divElement.innerText = "Add timestamps to see them here :)";

  bookmarks.appendChild(divElement);
};

const displayTimestamps = (currTimestamps) => {
  const bookmarks = document.querySelector(".bookmarks");
  bookmarks.innerHTML = "";

  console.log(currTimestamps);
  if (currTimestamps.length > 0) {
    const button = document.querySelector(".clear-all");
    if (!button) clearVodTimestampsButton();

    for (const timestamp of currTimestamps) {
      addTimestamp(bookmarks, timestamp.timestamp, timestamp.note);
    }
  } else {
    document.querySelector("button")?.remove();
    displayEmpty(bookmarks);
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
    {
      type: "CLEAR_VOD",
    },
    () => displayTimestamps([]),
  );
};

document.addEventListener("DOMContentLoaded", async () => {
  const vodId = await getVodId();

  if (vodId) {
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps[vodId] || [];
    displayTimestamps(timestamps);
  } else {
    const container = document.querySelector(".container");
    container.innerHTML = '<div class="title">This is not a VOD</div>';
  }
});
