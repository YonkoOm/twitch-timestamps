(() => {
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

  const storeTimestampInfo = async (vodId, timestamp, note) => {
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps || {};
    timestamps[vodId] = timestamps[vodId] || [];

    insertSorted(timestamps[vodId], { timestamp, note });

    await chrome.storage.local.set({ timestamps });
  };

  const getTimestamp = (streamStartTime) => {
    if (streamStartTime) {
      const liveStreamStartTime = new Date(streamStartTime);
      const currentTime = new Date();

      const timestamp = (currentTime - liveStreamStartTime) / 1000;

      const hours = Math.floor(timestamp / (1000 * 60 * 60));
      const minutes = Math.floor((timestamp % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timestamp % (1000 * 60)) / 1000);

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

  const addBookmarkButton = () => {
    const oldButton = document.getElementsByClassName("bookmark");
    if (oldButton.length > 0) {
      oldButton[0].remove();
    }

    const videoPlayerControls = document.getElementsByClassName(
      "player-controls__right-control-group",
    );
    if (videoPlayerControls.length === 0) return null; // checks for the case where the user in the home page of the streamer (url contains their username)

    const button = document.createElement("button");
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/bookmark-white.svg");
    button.className = "bookmark";
    button.appendChild(img);
    videoPlayerControls[0].append(button);

    return button;
  };

  const showNoteField = () => {
    const inputField = document.getElementsByClassName("note-input")[0];
    inputField.classList.remove("hidden");
    inputField.focus();
  };

  const hideNoteField = () => {
    const inputField = document.getElementsByClassName("note-input")[0];
    inputField.classList.add("hidden");
    inputField.value = "";
  };

  const saveTimestampWithNote = async (note, liveStreamInfo) => {
    const timestamp = getTimestamp(liveStreamInfo.startedAt);
    await storeTimestampInfo(liveStreamInfo.vodId, timestamp, note);
  };

  const handleNoteKeydown = async (e, liveStreamData) => {
    if (e.key === "Enter") {
      await saveTimestampWithNote(e.target.value.trim(), liveStreamData);
      hideNoteField();
    } else if (e.key === "Escape") {
      hideNoteField();
    }
  };

  const setupNoteField = (liveStreamInfo) => {
    let noteField = document.querySelector(".note-input");
    if (!noteField) {
      noteField = document.createElement("input");
      noteField.classList.add("note-input", "hidden");
      noteField.placeholder = "enter to save or escape to exit";
      noteField.type = "text";
      document.getElementsByClassName("video-player")[0].appendChild(noteField);
    } else {
      noteField.removeEventListener("keydown", noteField.keydownHandler);
      noteField.removeEventListener("blur", noteField.blurHandler);
    }

    console.log(liveStreamInfo);
    noteField.keydownHandler = (e) => handleNoteKeydown(e, liveStreamInfo);

    noteField.blurHandler = () => {
      if (!noteField.classList.contains("hidden")) {
        hideNoteField();
      }
    };

    noteField.addEventListener("keydown", noteField.keydownHandler);
    noteField.addEventListener("blur", noteField.blurHandler);

    showNoteField();
  };

  const createBookmarkButton = (vodId, startedAt = null) => {
    const button = addBookmarkButton();
    if (!button) return;

    button.addEventListener("click", () => {
      setupNoteField({ vodId, startedAt });
    });
  };

  const setupBookmarkButton = async () => {
    const liveStreamData = await getLiveStreamData();
    if (liveStreamData) {
      console.log("Watching Livestream");
      const vod = await getLiveStreamVod(liveStreamData.id);

      if (!vod) {
        const bookmarkButton = document.getElementsByClassName("bookmark");
        if (bookmarkButton.length > 0) {
          bookmarkButton[0].remove();
        }
        console.log("VOD not available");
        return;
      }

      createBookmarkButton(vod.id, liveStreamData.started_at);
    } else {
      const vodId = getVodId();
      if (!vodId) return;

      console.log("Watching VOD");

      createBookmarkButton(vodId);
    }
  };

  const observer = new MutationObserver(() => {
    setupBookmarkButton();
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
      setupBookmarkButton();
    } else if (request.type === "PLAY") {
      const video = document.querySelector("video");
      video.currentTime = request.time;
    } else if (request.type === "DELETE") {
      (async () => {
        const res = await chrome.storage.local.get(["timestamps"]);
        const vodId = getVodId();
        if (!vodId) {
          sendResponse([]);
          return;
        }

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
