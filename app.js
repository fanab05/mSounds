/* =====================================================
   mSounds: app.js  (steps 1 to 8)
   - Show the library
   - Click a track to play it
   - Play/pause button
   - Next / previous buttons with a queue
   - Auto-advance when a track ends
   - Progress bar with elapsed and remaining time
   - Volume slider (remembered in localStorage)
   ===================================================== */

/* ---------- 1. State ----------
   The app's "memory": only what we need to remember right now.
   TRACKS comes from tracks.js, which is loaded before this file. */
   const state = {
    currentTrackId: null,  // id of the loaded track (null = none yet)
    isPlaying: false,      // true while audio is playing
    queue: TRACKS.map(function (track) {
      return track.id;     // the queue = all track ids, in library order
    }),
    seekTarget: null       // null = user is NOT using the seek bar.
                           // A number = the second the user dragged to
                           // (chosen, but not applied to the audio yet)
  };
  
  /* Settings in one place, so they are easy to find and change */
  const RESTART_AFTER = 3;          // seconds: "Previous" restarts the track after this
  const VOLUME_KEY = "msounds.volume";   // name used in localStorage
  const DEFAULT_VOLUME = 0.8;       // 0 (silent) to 1 (full)
  
  /* One audio player for the whole app. It is not added to the page,
     we only control it from JavaScript. We reuse this one element for every
     track, which also helps browsers allow auto-advance to the next track. */
  const audio = new Audio();
  
  /* ---------- 2. Grab the HTML elements we need ----------
     Done once at the top so we don't search the page again and again. */
  const trackListEl    = document.getElementById("track-list");
  const messageEl      = document.getElementById("message");
  const npTitleEl      = document.getElementById("np-title");
  const npArtistEl     = document.getElementById("np-artist");
  const playBtnEl      = document.getElementById("play-btn");
  const prevBtnEl      = document.getElementById("prev-btn");
  const nextBtnEl      = document.getElementById("next-btn");
  const seekBarEl      = document.getElementById("seek-bar");
  const timeElapsedEl  = document.getElementById("time-elapsed");
  const timeRemainingEl = document.getElementById("time-remaining");
  const volumeBarEl    = document.getElementById("volume-bar");
  
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
  
  /* Where is the current track in the queue? 0 = first, -1 = not in queue.
     We look it up each time instead of storing it, so it can never be out of date. */
  function getQueueIndex() {
    return state.queue.indexOf(state.currentTrackId);
  }
  
  /* Is there a track after the current one? */
  function hasNextTrack() {
    const index = getQueueIndex();
    return index !== -1 && index < state.queue.length - 1;
  }
  
  /* Length of the current track in seconds.
     audio.duration is NaN until the browser has read the start of the mp3,
     so until then we use the duration written in tracks.js.
     Returns 0 when there is no track. */
  function getDuration() {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    const track = getTrackById(state.currentTrackId);
    return track && Number.isFinite(track.duration) ? track.duration : 0;
  }
  
  /* Can the user seek right now? Only when the browser knows the real
     length (metadata loaded) and the file did not fail to load. */
  function canSeek() {
    return Number.isFinite(audio.duration) && audio.duration > 0 && !audio.error;
  }
  
  /* Paint the green "filled" part of a slider.
     Reads the slider's value, turns it into a percentage and stores it
     in the CSS variable --fill, which style.css uses for the colour. */
  function updateFill(rangeEl) {
    const min = Number(rangeEl.min);
    const max = Number(rangeEl.max);
    const percent = max > min
      ? ((Number(rangeEl.value) - min) / (max - min)) * 100
      : 0;
    rangeEl.style.setProperty("--fill", percent + "%");
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
  
  /* Show the elapsed time (left) and remaining time (right).
     Both use WHOLE seconds, so elapsed + remaining always equals the total.
     Example: total 74, elapsed 5.3 -> elapsed "0:05", remaining "-1:09". */
  function renderTimes(current, duration) {
    const elapsedSec = Math.floor(current);
    const totalSec = Math.round(duration);
    const remainingSec = Math.max(0, totalSec - elapsedSec);
  
    timeElapsedEl.textContent = formatTime(elapsedSec);
    timeRemainingEl.textContent = "-" + formatTime(remainingSec);
  }
  
  /* Update the seek bar and the two time labels from the audio element.
     Runs many times per second while playing (see "timeupdate" below). */
  function renderProgress() {
    // The user is dragging the thumb: do NOT move it, or it would fight their hand.
    if (state.seekTarget !== null) return;
  
    const seekable = canSeek();
    const duration = getDuration();
    const current = audio.currentTime || 0;   // "|| 0" guards against NaN
  
    seekBarEl.disabled = !seekable;
    seekBarEl.max = seekable ? audio.duration : 0;   // set max BEFORE value
    seekBarEl.value = seekable ? current : 0;
    updateFill(seekBarEl);
    renderTimes(current, duration);
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
  
    // Previous: needs a loaded track (on the first track it restarts it).
    // Next: needs a loaded track AND a track after it.
    prevBtnEl.disabled = (getQueueIndex() === -1);
    nextBtnEl.disabled = !hasNextTrack();
  
    // Highlight the row of the current track, un-highlight the others
    const rows = trackListEl.querySelectorAll(".track-item");
    rows.forEach(function (row) {
      row.classList.toggle("active", row.dataset.id === state.currentTrackId);
    });
  
    renderProgress();  // seek bar and times
  }
  
  /* ---------- 5. Player logic (changes data, then redraws) ---------- */
  
  /* Load a track and start playing it. */
  function playTrack(trackId) {
    const track = getTrackById(trackId);
    if (!track) return;  // unknown id: do nothing
  
    showMessage("");                 // clear any old error
    state.currentTrackId = trackId;
    state.seekTarget = null;         // forget a half-finished drag on the old track
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
  
  /* Go to the next track in the queue. Does nothing on the last track
     (the button is disabled there too, this is just a safety net). */
  function playNext() {
    if (!hasNextTrack()) return;
    playTrack(state.queue[getQueueIndex() + 1]);
  }
  
  /* Previous button:
     - on the first track, or 3+ seconds into a track: restart this track
     - otherwise: go back to the previous track */
  function playPrevious() {
    const index = getQueueIndex();
    if (index === -1) return;  // nothing loaded
  
    if (index === 0 || audio.currentTime >= RESTART_AFTER) {
      audio.currentTime = 0;   // restart (play/pause state is not changed)
      renderProgress();
    } else {
      playTrack(state.queue[index - 1]);
    }
  }
  
  /* Apply the second the user chose on the seek bar to the audio.
     Safe to call more than once: after the first call seekTarget is null,
     so the next call does nothing. */
  function commitSeek() {
    if (state.seekTarget === null) return;  // user was not seeking
  
    if (canSeek()) {
      audio.currentTime = state.seekTarget;
    }
    state.seekTarget = null;   // automatic updates may move the bar again
    renderProgress();
  }
  
  /* ----- Volume (saved in localStorage) ----- */
  
  /* Read the saved volume. Falls back to the default if nothing is saved,
     the value is broken, or localStorage is blocked (e.g. private mode). */
  function loadVolume() {
    try {
      const saved = parseFloat(localStorage.getItem(VOLUME_KEY));
      if (Number.isFinite(saved) && saved >= 0 && saved <= 1) {
        return saved;
      }
    } catch (error) {
      // storage not available: just use the default below
    }
    return DEFAULT_VOLUME;
  }
  
  /* Save the volume. If storage is blocked or full, ignore the error:
     the volume still works, it is just not remembered. */
  function saveVolume(value) {
    try {
      localStorage.setItem(VOLUME_KEY, String(value));
    } catch (error) {
      // ignore
    }
  }
  
  /* Apply a volume (0 to 1) to the audio AND to the slider. */
  function setVolume(value) {
    audio.volume = value;   // note: iPhones ignore this, they use the device volume
    volumeBarEl.value = Math.round(value * 100);
    updateFill(volumeBarEl);
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
    if (hasNextTrack()) {
      playNext();                // auto-advance to the next track
    } else {
      state.isPlaying = false;   // end of the queue: stop
      renderPlayer();
    }
  });
  
  audio.addEventListener("error", function () {
    // Fires when the file is missing or cannot be decoded
    const track = getTrackById(state.currentTrackId);
    const name = track ? track.title : "this track";
    showMessage('Could not load "' + name + '". Check that the file exists in the audio/ folder.');
    renderPlayer();  // isReallyPlaying() is false now because audio.error is set
  });
  
  /* Keep the seek bar and times up to date */
  audio.addEventListener("timeupdate", renderProgress);       // about 4 times per second
  audio.addEventListener("loadedmetadata", renderProgress);   // real duration is now known
  audio.addEventListener("durationchange", renderProgress);   // duration changed (e.g. NaN -> real)
  
  /* ---------- 7. Control events (what the user does) ---------- */
  
  playBtnEl.addEventListener("click", togglePlayPause);
  prevBtnEl.addEventListener("click", playPrevious);
  nextBtnEl.addEventListener("click", playNext);
  
  /* Seek bar.
     "input"  = fires continuously while the thumb moves (also on a click or arrow key).
                We only PREVIEW: remember the target and update the time labels.
     "change" = fires when the user lets go (or after an arrow key): apply the seek.
     "pointerup" / "pointercancel" on the window = backup, in case the mouse/finger
                is released away from the bar. commitSeek() is safe to run twice. */
  seekBarEl.addEventListener("input", function () {
    state.seekTarget = Number(seekBarEl.value);   // also pauses automatic updates
    updateFill(seekBarEl);
    renderTimes(state.seekTarget, getDuration());
  });
  seekBarEl.addEventListener("change", commitSeek);
  window.addEventListener("pointerup", commitSeek);
  window.addEventListener("pointercancel", commitSeek);
  
  /* Volume slider: apply instantly while moving, save once when released
     (so we don't write to localStorage dozens of times per drag). */
  volumeBarEl.addEventListener("input", function () {
    setVolume(Number(volumeBarEl.value) / 100);
  });
  volumeBarEl.addEventListener("change", function () {
    saveVolume(Number(volumeBarEl.value) / 100);
  });
  
  /* ---------- 8. Start the app ---------- */
  setVolume(loadVolume());
  renderLibrary();
  renderPlayer();