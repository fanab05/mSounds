/* =====================================================
   mSounds: app.js  (steps 1 to 4)
   - Show the library
   - Click a track to play it
   - Play/pause button
   ===================================================== */

/* ---------- 1. State ----------
   The app's "memory": only what we need to remember right now.
   TRACKS comes from tracks.js, which is loaded before this file. */
   const state = {
    currentTrackId: null,  // id of the loaded track (null = none yet)
    isPlaying: false       // true while audio is playing
  };
  
  /* One audio player for the whole app. It is not added to the page,
     we only control it from JavaScript. */
  const audio = new Audio();
  
  /* ---------- 2. Grab the HTML elements we need ----------
     Done once at the top so we don't search the page again and again. */
  const trackListEl = document.getElementById("track-list");
  const messageEl   = document.getElementById("message");
  const npTitleEl   = document.getElementById("np-title");
  const npArtistEl  = document.getElementById("np-artist");
  const playBtnEl   = document.getElementById("play-btn");
  
  /* ---------- 3. Helper functions ---------- */
  
  /* Find a track object by its id. Returns undefined if not found. */
  function getTrackById(id) {
    return TRACKS.find(function (track) {
      return track.id === id;
    });
  }
  
  /* Turn seconds into "m:ss". Example: 74 -> "1:14" */
  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    // padStart adds a leading zero: 5 -> "05"
    return minutes + ":" + String(seconds).padStart(2, "0");
  }
  
  /* Show or hide the message box.
     Pass text to show it, or nothing to hide it. */
  function showMessage(text) {
    if (text) {
      messageEl.textContent = text;  // textContent: safe, text only
      messageEl.hidden = false;
    } else {
      messageEl.textContent = "";
      messageEl.hidden = true;
    }
  }
  
  /* ---------- 4. Rendering (drawing the page from the data) ---------- */
  
  /* Build the library list: one row per track. */
  function renderLibrary() {
    trackListEl.textContent = "";  // empty the list first
  
    TRACKS.forEach(function (track) {
      // <li><button class="track-item"> ... </button></li>
      const li = document.createElement("li");
  
      const button = document.createElement("button");
      button.type = "button";
      button.className = "track-item";
      button.dataset.id = track.id;  // remember which track this row is
  
      // Left side: title and artist
      const info = document.createElement("div");
      info.className = "track-info";
  
      const title = document.createElement("div");
      title.className = "track-title";
      title.textContent = track.title;    // textContent, never innerHTML
  
      const artist = document.createElement("div");
      artist.className = "track-artist";
      artist.textContent = track.artist;
  
      info.append(title, artist);
  
      // Right side: duration
      const duration = document.createElement("div");
      duration.className = "track-duration";
      duration.textContent = formatTime(track.duration);
  
      button.append(info, duration);
  
      // Clicking the row plays this track
      button.addEventListener("click", function () {
        handleTrackClick(track.id);
      });
  
      li.appendChild(button);
      trackListEl.appendChild(li);
    });
  }
  
  /* The single place that decides "is audio really playing?"
   - !audio.paused : the audio element is not paused
   - !audio.error  : the file did not fail to load
   A missing mp3 leaves paused === false, so we must check error too. */
function isReallyPlaying() {
    return !audio.paused && !audio.error;
  }

  /* Update the player bar and highlight the active row.
     Called every time something changes. */
  function renderPlayer() {
    const track = getTrackById(state.currentTrackId);
  
    if (track) {
      npTitleEl.textContent = track.title;
      npArtistEl.textContent = track.artist;
    } else {
      npTitleEl.textContent = "Nothing playing";
      npArtistEl.textContent = "Pick a track";
    }
  
    // The button shows the action it WILL do: ▶ when paused, ❚❚ when playing
  state.isPlaying = isReallyPlaying();  // keep state in sync for later steps

  if (state.isPlaying) {
    playBtnEl.textContent = "❚❚";
    playBtnEl.setAttribute("aria-label", "Pause");
  } else {
    playBtnEl.textContent = "▶";
    playBtnEl.setAttribute("aria-label", "Play");
  }
  
    // Highlight the row of the current track, un-highlight the others
    const rows = trackListEl.querySelectorAll(".track-item");
    rows.forEach(function (row) {
      row.classList.toggle("active", row.dataset.id === state.currentTrackId);
    });
  }
  
  /* ---------- 5. Player logic (changes data, then redraws) ---------- */
  
  /* Load a track and start playing it. */
  function playTrack(trackId) {
    const track = getTrackById(trackId);
    if (!track) return;  // unknown id: do nothing
  
    showMessage("");                 // clear any old error
    state.currentTrackId = trackId;
    audio.src = track.src;           // load the mp3
    renderPlayer();                  // show the new title/artist at once
  
    // audio.play() returns a Promise: it can fail (file missing, etc.)
    audio.play().catch(function (error) {
        // AbortError just means a newer click replaced this one: ignore it
        if (error.name !== "AbortError") {
          showMessage('Could not play "' + track.title + '". Check that the file exists in the audio/ folder.');
        }
        renderPlayer();  // redraw so the icon matches reality after a failure
      });
  }
  
  /* Play or pause the current track. */
  function togglePlayPause() {
    if (state.currentTrackId === null) {
      showMessage("Pick a track from the library first.");
      return;
    }
  
    if (isReallyPlaying()) {
      audio.pause();
    } else {
      // Covers both "paused" and "failed to load": try playing again
      audio.play().catch(function (error) {
        if (error.name !== "AbortError") {
          showMessage("Could not play this track. Check that the file exists in the audio/ folder.");
        }
        renderPlayer();
      });
    }
  }
  
  /* A click on a row: same track = toggle, different track = play it. */
  function handleTrackClick(trackId) {
    if (trackId === state.currentTrackId) {
        togglePlayPause();
    } else {
        playTrack(trackId);
    }
}
  
  /* ---------- 6. Audio events ----------
     The audio element tells us what is really happening.
     We copy that into our state, so the button icon is always correct,
     even if playback stops for a reason we did not cause. */
  
  audio.addEventListener("play", function () {
    state.isPlaying = true;
    renderPlayer();
  });
  
  audio.addEventListener("pause", function () {
    state.isPlaying = false;
    renderPlayer();
  });
  
  audio.addEventListener("ended", function () {
    // Track finished. (Auto-advance to the next track comes in step 6.)
    state.isPlaying = false;
    renderPlayer();
  });

  audio.addEventListener("error", function () {
    // Fires when the file is missing or cannot be decoded
    const track = getTrackById(state.currentTrackId);
    const name = track ? track.title : "this track";
    showMessage('Could not load "' + name + '". Check that the file exists in the audio/ folder.');
    renderPlayer();  // isReallyPlaying() is false now because audio.error is set
  });
  
  /* ---------- 7. Start the app ---------- */
  playBtnEl.addEventListener("click", togglePlayPause);
  renderLibrary();
  renderPlayer();