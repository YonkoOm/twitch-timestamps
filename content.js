// TODO: need to check for the case where the VOD may be subscribers only (MAYBE)
// TODO: create a function that grabs the access token
(() => {
  const getTwitchStreamer = () => {
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
    const streamer = getTwitchStreamer();
    const res = await fetch(`http://localhost:3000/user?login=${streamer}`);
    const { data } = await res.json();
    return data[0].id;
  };

  const getLiveStreamData = async () => {
    const streamer = getTwitchStreamer();
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
      if (timestamps[mid].timestamp > timestamp.timestamp) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    timestamps.splice(left, 0, timestamp);
  };

  const addTimestamp = async (vodId, timestamp, note) => {
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps || {};
    timestamps[vodId] = timestamps[vodId] || [];
    insertSorted(timestamps[vodId], { timestamp, note });

    await chrome.storage.local.set({ timestamps });

    console.log("Save Timestamps");
    const response = await chrome.storage.local.get(["timestamps"]);
    console.log(response.timestamps || []);
  };

  const timestamp = async (note, streamInfo) => {
    console.log("IN TIMESTAMP NOTE: " + note);

    if (streamInfo.liveStreamData) {
      const { liveStreamData, vodId } = streamInfo;
      const startedAt = new Date(liveStreamData.started_at);
      const currentTime = new Date();

      const timestamp = currentTime - startedAt;

      console.log(vodId);

      const hours = Math.floor(timestamp / (1000 * 60 * 60));
      const minutes = Math.floor((timestamp % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timestamp % (1000 * 60)) / 1000);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);

      await addTimestamp(vodId, timestamp / 1000, note);
    } else {
      const video = document.querySelector("video");
      const { vodId } = streamInfo;

      console.log(vodId);

      const timestamp = video.currentTime;

      const hours = Math.floor(timestamp / 3600);
      const minutes = Math.floor((timestamp % 3600) / 60);
      const seconds = Math.floor(timestamp % 60);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);

      await addTimestamp(vodId, timestamp, note);
    }
  };

  const addVideoPlayerButton = () => {
    const oldButton = document.getElementsByClassName("bookmark");
    if (oldButton.length > 0) {
      oldButton[0].remove();
    }

    const videoPlayer = document.getElementsByClassName(
      "player-controls__right-control-group",
    );
    if (videoPlayer.length === 0) return null;

    const button = document.createElement("button");
    const img = document.createElement("img");
    img.src = chrome.runtime.getURL("assets/bookmark-white.svg");
    button.className = "bookmark";
    button.appendChild(img);
    videoPlayer[0].append(button);

    return button;
  };

  const hideInputField = () => {
    const inputField = document.getElementsByClassName("note-input")[0];
    inputField.classList.toggle("hidden");
    inputField.value = "";
  };

  const showInputField = () => {
    const inputField = document.getElementsByClassName("note-input")[0];
    inputField.classList.toggle("hidden");
    inputField.focus();
  };

  const note = (liveStreamData) => {
    if (document.getElementsByClassName("note-input").length > 0) {
      showInputField();
      return;
    }

    const inputField = document.createElement("input");
    inputField.classList.add("note-input");
    inputField.placeholder = "enter to save or escape to exit";
    inputField.type = "text";

    document.getElementsByClassName("video-player")[0].appendChild(inputField);

    inputField.focus();

    inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const note = inputField.value.trim();
        timestamp(note, liveStreamData);
        hideInputField();
      } else if (e.key === "Escape") {
        hideInputField();
      }
    });

    inputField.addEventListener("blur", () => {
      if (!inputField.classList.contains("hidden")) hideInputField();
    });
  };

  // adds button if we are in a livestream and a vod for that livestream exists or a vod itself
  const bookmark = async () => {
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
      console.log(vod);

      const button = addVideoPlayerButton();
      if (!button) return;

      button.addEventListener("click", () => {
        note({ liveStreamData: liveStreamData, vodId: vod.id });
      });
    } else {
      const vodId = getVodId();
      if (!vodId) return;

      console.log("Watching VOD");
      const button = addVideoPlayerButton();
      if (!button) return;

      button.addEventListener("click", () => {
        note({ vodId });
      });
    }
  };

  const observer = new MutationObserver(() => {
    bookmark();
  });

  // this handles the weird case where if the user is live streaming and their username is clicked, the video player stays in the background on the same url, so when the video player is clicked and  brought to the foreground, the player controls are reset
  observer.observe(document.querySelector("title"), {
    childList: true,
    subtree: true,
  });

  chrome.runtime.onMessage.addListener(async (request) => {
    if (request.type === "URLChange") {
      console.log("URL Changed: ", request.url);
      // chrome.storage.local.clear();
      bookmark();
    } else if (request.type === "PLAY") {
      const video = document.querySelector("video");
      video.currentTime = request.time;
    } else if (request.type === "DELETE") {
      console.log("IN DELETE");
      const res = await chrome.storage.local.get(["timestamps"]);
      const vodId = getVodId();
      const timestamps = res.timestamps;
      timestamps[vodId] = timestamps[vodId].filter(
        ({ timestamp }) => timestamp !== request.time,
      );

      await chrome.storage.local.set({
        timestamps,
      });
    }
  });
})();
