(() => {
  let liveStreamStartTime, vodId;

  const getStreamerUsername = () => {
    const url = window.location.href;
    const match = url.match(/twitch\.tv\/([^\/?]+)$/);
    return match ? match[1] : null;
  };

  const getVodId = () => {
    const url = window.location.href;
    const match = url.match(/twitch\.tv\/videos\/(\d+)/);
    return match ? match[1] : null;
  };

  const getStreamerID = async () => {
    const streamer = getStreamerUsername();
    const res = await fetch(`http://localhost:3000/user?login=${streamer}`);
    const { data } = await res.json();
    return data[0].id;
  };

  const getLiveStreamData = async () => {
    const streamer = getStreamerUsername();
    if (!streamer) return null;

    const res = await fetch(
      `http://localhost:3000/livestream?username=${streamer}`,
    );
    const { data } = await res.json();

    return data.length > 0 ? data[0] : null;
  };

  const getStreamerVods = async () => {
    const streamerId = await getStreamerID();
    const res = await fetch(`http://localhost:3000/vods/${streamerId}`);
    const { data } = await res.json();
    return data;
  };

  // make sure the latest vod belongs to the current livestream
  const getLiveStreamVod = async (streamId) => {
    const vods = await getStreamerVods();
    const vod = vods.find((vod) => vod.stream_id === streamId);
    return vod;
  };

  const insertSorted = (timestamps, timestamp) => {
    let left = 0,
      right = timestamps.length - 1;

    while (left <= right) {
      let mid = Math.floor((left + right) / 2);
      if (timestamps[mid].timestamp === timestamp.timestamp) {
        alert("Timestamp already saved at this time");
        return;
      } else if (timestamps[mid].timestamp > timestamp.timestamp) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    timestamps.splice(left, 0, timestamp);
  };

  const storeTimestampWithNote = async (timestamp, note) => {
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps || {};
    timestamps[vodId] = timestamps[vodId] || [];

    insertSorted(timestamps[vodId], { timestamp, note });

    await chrome.storage.local.set({ timestamps });
  };

  const getTimestamp = () => {
    if (liveStreamStartTime) {
      const startTime = new Date(liveStreamStartTime);
      const currentTime = new Date();

      const timestamp = (currentTime - startTime) / 1000;

      const hours = Math.floor(timestamp / 3600);
      const minutes = Math.floor((timestamp % 3600) / 60);
      const seconds = Math.floor(timestamp % 60);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);

      return timestamp;
    } else {
      const video = document.querySelector("video");

      const timestamp = video.currentTime;

      const hours = Math.floor(timestamp / 3600);
      const minutes = Math.floor((timestamp % 3600) / 60);
      const seconds = Math.floor(timestamp % 60);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);

      return timestamp;
    }
  };

  const showNoteField = () => {
    const inputField = document.querySelector(".note-input");
    inputField.classList.remove("hidden");
    inputField.focus();
  };

  const hideNoteField = () => {
    const inputField = document.querySelector(".note-input");
    inputField.classList.add("hidden");
    inputField.value = "";
  };

  const setupNoteField = () => {
    let noteField = document.querySelector(".note-input");
    if (!noteField) {
      noteField = document.createElement("input");
      noteField.classList.add("note-input", "hidden");
      noteField.placeholder = "enter to save or escape to exit";
      noteField.type = "text";
      document.querySelector(".video-player")?.appendChild(noteField);
    } else {
      noteField.removeEventListener("keydown", noteField.keydownHandler);
      noteField.removeEventListener("blur", noteField.blurHandler);
    }

    noteField.keydownHandler = async (e) => {
      if (e.key === "Enter") {
        const note = e.target.value.trim();
        const timestamp = getTimestamp();
        await storeTimestampWithNote(timestamp, note);
        hideNoteField();
      } else if (e.key === "Escape") {
        hideNoteField();
      }
    };

    noteField.blurHandler = () => {
      if (!noteField.classList.contains("hidden")) {
        hideNoteField();
      }
    };

    noteField.addEventListener("keydown", noteField.keydownHandler);
    noteField.addEventListener("blur", noteField.blurHandler);

    showNoteField();
  };

  const insertBookmarkButton = () => {
    if (document.querySelector(".bookmark")) return;

    const videoPlayerControls = document.querySelector(
      ".player-controls__right-control-group",
    );
    if (!videoPlayerControls) return null; // checks for the case where the user in the home page of the streamer (url contains their username but stream in the background)

    const bookmarkButton = document.createElement("button");
    bookmarkButton.className = "bookmark";

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/bookmark-white.svg");

    bookmarkButton.appendChild(img);
    videoPlayerControls.appendChild(bookmarkButton);

    bookmarkButton.addEventListener("click", () => {
      setupNoteField();
    });

    return bookmarkButton;
  };

  const removeBookmarkButton = () =>
    document.querySelector(".bookmark")?.remove();

  const initializeStreamData = async () => {
    vodId = liveStreamStartTime = null;
    const liveStreamData = await getLiveStreamData();

    if (liveStreamData) {
      const vod = await getLiveStreamVod(liveStreamData.id);
      if (!vod) return;

      vodId = vod.id;
      liveStreamStartTime = liveStreamData.started_at;
    } else {
      vodId = getVodId();
    }
  };

  const observer = new MutationObserver(async () => {
    await initializeStreamData();
    if (vodId || liveStreamStartTime) {
      insertBookmarkButton();
    } else {
      removeBookmarkButton();
    }
  });

  // this handles the weird case where if the user is live streaming and their username is clicked, the video player stays in the background on the same url, so when the video player is clicked and  brought to the foreground, the player controls are reset
  observer.observe(document.querySelector("title"), {
    childList: true,
    subtree: true,
  });

  chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
    if (request.type === "URLChange") {
      console.log("URL Changed: ", request.url);
      // chrome.storage.local.clear();
      (async () => {
        await initializeStreamData();
        if (vodId || liveStreamStartTime) {
          insertBookmarkButton();
        } else {
          removeBookmarkButton();
        }
      })();
    } else if (request.type === "PLAY") {
      const video = document.querySelector("video");
      video.currentTime = request.time;
    } else if (request.type === "DELETE") {
      (async () => {
        const res = await chrome.storage.local.get(["timestamps"]);

        const timestamps = res.timestamps;
        timestamps[vodId] = timestamps[vodId].filter(
          ({ timestamp }) => timestamp !== request.time,
        );

        await chrome.storage.local.set({ timestamps });
        sendResponse(timestamps[vodId]);
      })();

      return true; // tells chrome we want to send a response asynchronously
    }
  });
})();
