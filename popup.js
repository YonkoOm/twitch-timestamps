import { getActiveTabUrl } from "./utils.js";

const addTimestamp = (bookmarks, timestamp) => {
  const divTimestamp = document.createElement("div");
  divTimestamp.innerHTML = timestamp;
  bookmarks.appendChild(divTimestamp);
};

const displayTimestamps = (currTimestamps) => {
  const bookmarks = document.getElementsByClassName("bookmarks")[0];

  for (const timestamp of currTimestamps) {
    addTimestamp(bookmarks, timestamp);
  }
};

// Wait until the DOM is fully loaded
document.addEventListener("DOMContentLoaded", async () => {
  const url = await getActiveTabUrl();
  const match = url.match(/twitch\.tv\/videos\/(\d+)/);

  if (match && match[1]) {
    console.log(match[1]);
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps[match[1]] || [];
    console.log(timestamps);
    displayTimestamps(timestamps);
  } else {
    const container = document.getElementsByClassName("container")[0];
    container.innerHTML = '<div class="title">This is not a VOD</div>';
  }
});
