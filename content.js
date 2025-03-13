(() => {
  let liveStreamStartTime, vodId, username, streamTitle;

  const getStreamerUsername = () => {
    const url = window.location.href;
    const match = url.match(/twitch\.tv\/([^\/?]+)/);
    return match ? match[1] : null;
  };

  const getVodId = () => {
    const url = window.location.href;
    const match = url.match(/twitch\.tv\/videos\/(\d+)/);
    return match ? match[1] : null;
  };

  const getVodData = async () => {
    const res = await fetch(
      `https://twitch-timestamps.vercel.app/vod?id=${vodId}`,
    );

    if (!res.ok) {
      console.error("Failed to fetch vod");
      return null;
    }

    const { data } = await res.json();
    return { username: data[0].user_login, title: data[0].title };
  };

  const getStreamerID = async () => {
    const streamer = getStreamerUsername();
    if (!streamer) {
      return null;
    }

    const res = await fetch(
      `https://twitch-timestamps.vercel.app/streamer?login=${streamer}`,
    );

    if (!res.ok) {
      console.error("Failed to fetch streamer's id");
      return null;
    }

    const { data } = await res.json();
    return data.length > 0 ? data[0].id : null;
  };

  // return streamer data if they are live, otherwise return null for an invalid endpoint
  const getLiveStreamData = async () => {
    const streamer = getStreamerUsername();
    if (!streamer) {
      return null;
    }

    const res = await fetch(
      `https://twitch-timestamps.vercel.app/livestream?username=${streamer}`,
    );

    if (!res.ok) {
      console.error(
        "Failed to fetch livestream data with status code: " + res.status,
      );
      return null;
    }

    const { data } = await res.json();
    return data.length > 0 ? data[0] : null;
  };

  const getStreamerVods = async () => {
    const streamerId = await getStreamerID();
    if (!streamerId) {
      return null;
    }

    const res = await fetch(
      `https://twitch-timestamps.vercel.app/vods/${streamerId}`,
    );

    if (!res.ok) {
      console.error("Failed to fetch vods");
      return null;
    }

    const { data } = await res.json();
    return data;
  };

  // make sure the latest vod belongs to the current livestream
  const getLiveStreamVod = async (streamId) => {
    const vods = await getStreamerVods();
    if (!vods) {
      return null;
    }

    const vod = vods.find((vod) => vod.stream_id === streamId);
    return vod;
  };

  const insertSorted = (timestamps, timestamp, note) => {
    let left = 0,
      right = timestamps.length - 1;

    while (left <= right) {
      let mid = Math.floor((left + right) / 2);
      if (timestamps[mid].timestamp === timestamp) {
        alert("Timestamp already saved at this time");
        return;
      } else if (timestamps[mid].timestamp > timestamp) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    timestamps.splice(left, 0, { timestamp: timestamp, note: note });
  };

  const storeTimestampWithNote = async (timestamp, note) => {
    const res = await chrome.storage.local.get([username]);
    const vods = res[username] ?? {};
    vods[vodId] ??= {};
    vods[vodId].timestamps ??= [];

    insertSorted(vods[vodId].timestamps, timestamp, note);
    vods[vodId].streamTitle ??= streamTitle; // just use first title when storing timestamps as title can change

    await chrome.storage.local.set({ [username]: vods });
  };

  const getTimestamp = () => {
    let timestamp; // in seconds
    if (liveStreamStartTime) {
      const startTime = new Date(liveStreamStartTime);
      const currentTime = new Date();

      timestamp = (currentTime - startTime) / 1000;

      const hours = Math.floor(timestamp / 3600);
      const minutes = Math.floor((timestamp % 3600) / 60);
      const seconds = Math.floor(timestamp % 60);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);
    } else {
      const video = document.querySelector("video");

      timestamp = video.currentTime;

      const hours = Math.floor(timestamp / 3600);
      const minutes = Math.floor((timestamp % 3600) / 60);
      const seconds = Math.floor(timestamp % 60);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);
    }
    return timestamp;
  };

  const showNoteField = () => {
    const noteField = document.querySelector(".note-input");
    noteField.dataset.timestamp = getTimestamp();
    noteField.classList.remove("hidden");
    noteField.focus();
  };

  const hideNoteField = () => {
    const noteField = document.querySelector(".note-input");
    noteField.classList.add("hidden");
    noteField.value = "";
  };

  const addNoteField = () => {
    let noteField = document.querySelector(".note-input");
    const videoPlayer = document.querySelector(".video-player");

    if (noteField || !videoPlayer) return;

    noteField = document.createElement("input");
    noteField.classList.add("note-input", "hidden");
    noteField.placeholder = "enter to save";
    noteField.type = "text";

    noteField.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const note = e.target.value.trim();
        const timestamp = Number(noteField.dataset.timestamp);

        await storeTimestampWithNote(timestamp, note);
        hideNoteField();
      } else if (e.key === "Escape") {
        hideNoteField();
      }
    });

    noteField.addEventListener("blur", hideNoteField);

    videoPlayer.appendChild(noteField);
  };

  const removeNoteField = () => {
    document.querySelector(".note-input")?.remove();
  };

  const insertBookmarkButton = () => {
    let bookmarkButton = document.querySelector(".bookmark");
    const videoPlayerControls = document.querySelector(
      ".player-controls__right-control-group",
    );

    if (bookmarkButton || !videoPlayerControls) return; // videoPlayerControls checks if the user is on the streamer's home page (URL contains their username) while the stream is playing in the background

    bookmarkButton = document.createElement("button");
    bookmarkButton.className = "bookmark";

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/bookmark-white.svg");

    bookmarkButton.appendChild(img);
    bookmarkButton.addEventListener("click", showNoteField);

    videoPlayerControls.appendChild(bookmarkButton);
  };

  const removeBookmarkButton = () => {
    document.querySelector(".bookmark")?.remove();
  };

  const jumpToNextTimestamp = async () => {
    const videoPlayer = document.querySelector("video");
    const res = await chrome.storage.local.get([username]);
    const timestamps = res[username]?.[vodId]?.timestamps;

    if (!videoPlayer || !timestamps) {
      return;
    }

    const currentTime = videoPlayer.currentTime;
    const nextTimestamp = timestamps.find(
      ({ timestamp }) => timestamp > currentTime,
    );

    if (nextTimestamp) {
      videoPlayer.currentTime = nextTimestamp.timestamp;
    }
  };

  const jumpToPreviousTimestamp = async () => {
    const videoPlayer = document.querySelector("video");
    const res = await chrome.storage.local.get([username]);
    const timestamps = res[username]?.[vodId]?.timestamps;

    if (!videoPlayer || !timestamps) {
      return;
    }

    const currentTime = videoPlayer.currentTime;
    const previousTimestamps = timestamps.filter(
      ({ timestamp }) => timestamp < currentTime,
    );

    if (previousTimestamps.length > 1) {
      // if user tries to to go back within 3 seconds of the previous timestamp, go to the one before the previous timestamp
      if (
        previousTimestamps[previousTimestamps.length - 1].timestamp >
        currentTime - 3
      ) {
        videoPlayer.currentTime =
          previousTimestamps[previousTimestamps.length - 2].timestamp;
      } else {
        videoPlayer.currentTime =
          previousTimestamps[previousTimestamps.length - 1].timestamp;
      }
    } else if (previousTimestamps[0]) {
      videoPlayer.currentTime = previousTimestamps[0].timestamp;
    }
  };

  const initializeStreamData = async () => {
    vodId = liveStreamStartTime = username = streamTitle = null;

    vodId = getVodId();
    // check if user is watching vod
    if (vodId) {
      const vodData = await getVodData();
      username = vodData.username;
      streamTitle = vodData.title;
      return;
    }

    // Check if the user is watching a livestream (watching directly or on streamer's homepage when they are live)
    const liveStreamData = await getLiveStreamData();
    if (liveStreamData) {
      username = liveStreamData.user_login;
      liveStreamStartTime = liveStreamData.started_at;
      streamTitle = liveStreamData.title;

      // check if there is a VOD associated with the livestream
      const vod = await getLiveStreamVod(liveStreamData.id);
      vodId = vod ? vod.id : null;
      return;
    }

    // if the streamer isn't live or we are not in a vod, check if user is in a streamer's home page
    const streamerId = await getStreamerID();
    username = streamerId ? getStreamerUsername() : null;
  };

  const updateBookmarkUI = async () => {
    // insert bookmark UI if VOD exists
    if (vodId) {
      insertBookmarkButton();
      addNoteField();
    } else {
      removeBookmarkButton();
      removeNoteField();
    }
  };

  const initStreamAndBookmarkUI = async () => {
    await initializeStreamData();
    updateBookmarkUI();
  };

  const setStreamerVods = async (vods) => {
    if (Object.keys(vods).length > 0) {
      await chrome.storage.local.set({ [username]: vods });
    } else {
      await chrome.storage.local.remove([username]);
    }
  };

  const observer = new MutationObserver(initStreamAndBookmarkUI);
  const title = document.querySelector("title");

  // this handles the weird case where clicking the username during a livestream puts the video player in the background, resetting the player controls (url stays the same)
  observer.observe(title, {
    childList: true,
    subtree: true,
  });

  document.addEventListener("keydown", async (e) => {
    if (e.altKey && e.key === "ArrowRight") {
      jumpToNextTimestamp();
    } else if (e.altKey && e.key === "ArrowLeft") {
      jumpToPreviousTimestamp();
    }
  });

  chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
    if (request.action === "URL_CHANGED") {
      initStreamAndBookmarkUI();
    } else if (request.action === "GET_STREAM_DATA") {
      sendResponse({ vodId, username, liveStreamStartTime });
    } else if (request.action === "OPEN_NOTE_FIELD") {
      const noteField = document.querySelector(".note-input");
      if (noteField) {
        showNoteField();
      }
    } else if (request.action === "SEEK_VIDEO") {
      const video = document.querySelector("video");
      if (request.time <= video.duration) {
        video.currentTime = request.time;
      }
    } else if (request.action === "DELETE_TIMESTAMP") {
      (async () => {
        const res = await chrome.storage.local.get([username]);

        const vods = res[username];
        vods[vodId].timestamps = vods[vodId].timestamps.filter(
          ({ timestamp }) => timestamp !== request.time,
        );

        if (vods[vodId].timestamps.length === 0) {
          delete vods[vodId];
        }

        await setStreamerVods(vods);
        sendResponse(vods[vodId]?.timestamps ?? []);
      })();

      return true; // tells chrome we want to send a response asynchronously
    } else if (request.action === "DELETE_VOD") {
      (async () => {
        const res = await chrome.storage.local.get([username]);
        const vods = res[username];

        // if a specific vodId is provided, delete that VOD; otherwise, delete the current VOD
        delete vods[request.vodId ?? vodId];

        await setStreamerVods(vods);
        sendResponse(request.vodId ? vods : []);
      })();

      return true;
    } else if (request.action === "CLEAR_STREAMER_INFO") {
      chrome.storage.local.remove([username]);
      sendResponse({});
    }
    return false;
  });
})();
