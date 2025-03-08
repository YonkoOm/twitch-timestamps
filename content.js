(() => {
  let liveStreamStartTime, vodId, username, streamTitle;

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

  const getVodData = async () => {
    const res = await fetch(
      `https://twitch-timestamps.vercel.app/vod?id=${vodId}`,
    );

    if (!res.ok) {
      console.error("Failed to fetch vod");
      return null;
    }

    const { data } = await res.json();
    return { userLogin: data[0].user_login, title: data[0].title };
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
    return data[0].id;
  };

  // return streamer data if they are live, otherwise if invalid endpoint, return null
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
    const res = await chrome.storage.local.get([username]);
    const vods = res[username] ?? {};
    vods[vodId] ??= {};
    vods[vodId].timestamps ??= [];

    insertSorted(vods[vodId].timestamps, { timestamp, note });
    vods[vodId].streamTitle ??= streamTitle;

    await chrome.storage.local.set({ [username]: vods });
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

    const timestamp = getTimestamp();
    noteField.keydownHandler = async (e) => {
      if (e.key === "Enter") {
        const note = e.target.value.trim();
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
    const bookmarkButtonExists = document.querySelector(".bookmark");
    const videoPlayerControls = document.querySelector(
      ".player-controls__right-control-group",
    );

    if (bookmarkButtonExists || !videoPlayerControls) return; // videoPlayerControls checks for the case where the user in the home page of the streamer (url contains their username but stream in the background)

    const bookmarkButton = document.createElement("button");
    bookmarkButton.className = "bookmark";

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/bookmark-white.svg");

    bookmarkButton.appendChild(img);
    bookmarkButton.addEventListener("click", setupNoteField);

    videoPlayerControls.appendChild(bookmarkButton);
  };

  const removeBookmarkButton = () => {
    document.querySelector(".bookmark")?.remove();
  };

  const initializeStreamData = async () => {
    vodId = liveStreamStartTime = username = streamTitle = null;

    vodId = getVodId();
    // check if they watching vod first
    if (vodId) {
      const vodData = await getVodData();
      username = vodData.userLogin;
      streamTitle = vodData.title;
    } else {
      const liveStreamData = await getLiveStreamData();
      if (liveStreamData) {
        username = liveStreamData.user_login;
        liveStreamStartTime = liveStreamData.started_at;
        streamTitle = liveStreamData.title;

        const vod = await getLiveStreamVod(liveStreamData.id);
        if (!vod) return;

        vodId = vod.id;
      }
    }
  };

  const updateBookmarkButtonVisibility = async () => {
    if (vodId) {
      insertBookmarkButton();
    } else {
      removeBookmarkButton();
    }
  };

  const initStreamAndButton = async () => {
    await initializeStreamData();
    updateBookmarkButtonVisibility();
  };

  const observer = new MutationObserver(initStreamAndButton);
  const title = document.querySelector("title");

  // this handles the weird case where if the user is live streaming and their username is clicked, the video player stays in the background on the same url, so when the video player is clicked and  brought to the foreground, the player controls are reset
  observer.observe(title, {
    childList: true,
    subtree: true,
  });

  chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
    if (request.type === "URLChange") {
      initStreamAndButton();
    } else if (request.type === "STREAM_DATA") {
      sendResponse({ vodId, username, liveStreamStartTime });
    } else if (request.type === "PLAY") {
      const video = document.querySelector("video");
      video.currentTime = request.time;
    } else if (request.type === "DELETE") {
      (async () => {
        const res = await chrome.storage.local.get([username]);

        const vods = res[username];
        vods[vodId].timestamps = vods[vodId].timestamps.filter(
          ({ timestamp }) => timestamp !== request.time,
        );

        if (vods[vodId].timestamps.length > 0) {
          await chrome.storage.local.set({ [username]: vods });
          sendResponse(vods[vodId].timestamps);
        } else {
          chrome.storage.local.remove([username]);
          sendResponse([]);
        }
      })();

      return true; // tells chrome we want to send a response asynchronously
    } else if (request.type === "CLEAR_VOD") {
      (async () => {
        const res = await chrome.storage.local.get([username]);

        const vods = res[username];
        delete vods[vodId];

        if (Object.keys(vods).length > 0) {
          await chrome.storage.local.set({ [username]: vods });
        } else {
          await chrome.storage.local.remove([username]);
        }

        sendResponse([]);
      })();
      return true;
    } else if (request.type === "CLEAR_VOD_LINKS") {
      chrome.storage.local.remove([username]);
    }
    return false;
  });
})();
