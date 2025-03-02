// TODO: Need to check for the case where the VOD may be subscribers only
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

  const addTimestamp = async (vodId, timestamp) => {
    const res = await chrome.storage.local.get(["timestamps"]);
    const timestamps = res.timestamps || {};
    timestamps[vodId] = timestamps[vodId] || [];
    timestamps[vodId].push(timestamp);

    await chrome.storage.local.set({ timestamps });

    console.log("Save Timestamps");
    const response = await chrome.storage.local.get(["timestamps"]);
    console.log(response.timestamps || []);
  };

  // TODO: maybe fix the parameters
  const timestamp = async (liveStreamData = null, vodId = 0) => {
    if (liveStreamData) {
      const startedAt = new Date(liveStreamData.started_at);
      const currentTime = new Date();

      const timestamp = currentTime - startedAt;

      console.log(vodId);

      const hours = Math.floor(timestamp / (1000 * 60 * 60));
      const minutes = Math.floor((timestamp % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timestamp % (1000 * 60)) / 1000);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);

      await addTimestamp(vodId, timestamp / 1000);
    } else {
      const video = document.querySelector("video");
      const vodId = getVodId();

      console.log(vodId);

      const timestamp = video.currentTime;

      const hours = Math.floor(timestamp / 3600);
      const minutes = Math.floor((timestamp % 3600) / 60);
      const seconds = Math.floor(timestamp % 60);

      console.log(`${hours} hours, ${minutes} minutes, ${seconds} seconds`);

      await addTimestamp(vodId, timestamp);
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

      button.addEventListener("click", () => timestamp(liveStreamData, vod.id));
    } else if (getVodId()) {
      console.log("Watching VOD");
      const button = addVideoPlayerButton();
      if (!button) return;

      button.addEventListener("click", () => timestamp());
    }
  };

  const observer = new MutationObserver(() => bookmark());

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
        (timestamp) => timestamp !== request.time,
      );

      await chrome.storage.local.set({
        timestamps,
      });
    }
  });
})();
