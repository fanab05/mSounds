/* =====================================================
   mSounds: app.js  (steps 1 to 10)
   - Show the library
   - Click a track to play it
   - Play/pause button
   - Next / previous buttons with a queue
   - Auto-advance when a track ends
   - Progress bar with elapsed and remaining time
   - Volume slider (remembered in localStorage)
   - Search by title or artist (the queue follows the shown list)
   - Playlists: data layer + saving (no visible UI yet)
   ===================================================== */

/* ---------- 1. State ----------
   The app's "memory": only what we need to remember right now.
   TRACKS comes from tracks.js, which is loaded before this file. */
   const state = {
    currentTrackId: null,  // id of the loaded track (null = none yet)
    isPlaying: false,      // true while audio is playing
    searchText: "",        // what the user typed in the search box
    queue: TRACKS.map(function (track) {
      return track.id;     // the queue = ids of the tracks currently SHOWN, in order.
    }),                    // At start that is all tracks; search changes it.
    playlists: [],         // all playlists: { id, name, trackIds: [] }.
                           // Filled from localStorage at start-up (see section 8).
    seekTarget: null       // null = user is NOT using the seek bar.
                           // A number = the second the user dragged to
                           // (chosen, but not applied to the audio yet)
  };
  
  /* Settings in one place, so they are easy to find and change */
  const RESTART_AFTER = 3;                    // seconds: "Previous" restarts the track after this
  const VOLUME_KEY = "msounds.volume";        // name used in localStorage
  const PLAYLISTS_KEY = "msounds.playlists";  // name used in localStorage
  const DEFAULT_VOLUME = 0.8;                 // 0 (silent) to 1 (full)
  
  /* One audio player for the whole app. It is not added to the page,
     we only control it from JavaScript. We reuse this one element for every
     track, which also helps browsers allow auto-advance to the next track. */
  const audio = new Audio();
  
  /* ---------- 2. Grab the HTML elements we need ----------
     Done once at the top so we don't search the page again and again. */
  const trackListEl     = document.getElementById("track-list");
  const searchInputEl   = document.getElementById("search-input");
  const noResultsEl     = document.getElementById("no-results");
  const messageEl       = document.getElementById("message");
  const npTitleEl       = document.getElementById("np-title");
  const npArtistEl      = document.getElementById("np-artist");
  const playBtnEl       = document.getElementById("play-btn");
  const prevBtnEl       = document.getElementById("prev-btn");
  const nextBtnEl       = document.getElementById("next-btn");
  const seekBarEl       = document.getElementById("seek-bar");
  const timeElapsedEl   = document.getElementById("time-elapsed");
  const timeRemainingEl = document.getElementById("time-remaining");
  const volumeBarEl     = document.getElementById("volume-bar");
  
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
  
  /* Prepare text for comparing:
     - trim()                  removes spaces at the start and end
     - replace(/\s+/g, " ")    turns any run of spaces into ONE space
     - toLowerCase()           so "SPACE" and "space" are equal
     Example: "  Space   JAM " -> "space jam" */
  function normalizeText(text) {
    return text.trim().replace(/\s+/g, " ").toLowerCase();
  }
  
  /* The tracks that match the current search, in library order.
     An empty search matches everything. A track matches when the search
     text appears in its title OR in its artist. */
  function getVisibleTracks() {
    const query = normalizeText(state.searchText);
    if (query === "") return TRACKS;
  
    return TRACKS.filter(function (track) {
      return normalizeText(track.title).includes(query) ||
             normalizeText(track.artist).includes(query);
    });
  }
  
  /* Where is the current track in the queue? 0 = first, -1 = not in the queue.
     We look it up each time instead of storing it, so it can never be out of date.
     -1 also happens when the playing track is hidden by the search. */
  function getQueueIndex() {
    return state.queue.indexOf(state.currentTrackId);
  }
  
  /* Is there a track to go to with "Next"?
     - nothing loaded, or the queue is empty: no
     - playing track is NOT in the shown list: yes, Next starts the list
       from its first track (see getNextTrackId)
     - otherwise: yes if the current track is not the last one */
  function hasNextTrack() {
    if (state.currentTrackId === null || state.queue.length === 0) return false;
  
    const index = getQueueIndex();
    if (index === -1) return true;
    return index < state.queue.length - 1;
  }
  
  /* The id of the track "Next" should play (call only if hasNextTrack() is true).
     Playing track hidden by the search -> first track of the shown list. */
  function getNextTrackId() {
    const index = getQueueIndex();
    return index === -1 ? state.queue[0] : state.queue[index + 1];
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
  
  /* Build the library list: one row per VISIBLE track.
     If the search matches nothing, show "No tracks found" instead. */
  function renderLibrary() {
    const tracks = getVisibleTracks();
  
    trackListEl.textContent = "";          // empty the list first
    noResultsEl.hidden = tracks.length > 0; // show the message only when empty
  
    tracks.forEach(function (track) {
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
  
    // Previous: needs a loaded track (it restarts the track when there is
    // nothing before it in the queue, even if the search hides the track).
    // Next: see hasNextTrack().
    prevBtnEl.disabled = (state.currentTrackId === null);
    nextBtnEl.disabled = !hasNextTrack();
  
    // Highlight the row of the current track, un-highlight the others.
    // (If the track is hidden by the search, no row is highlighted.)
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
  
  /* Go to the next track in the queue (the shown list). Does nothing when
     there is no next track (the button is disabled there too, this is just
     a safety net). If the playing track is hidden by the search, this starts
     the shown list from its first track. */
  function playNext() {
    if (!hasNextTrack()) return;
    playTrack(getNextTrackId());
  }
  
  /* Previous button:
     - nothing before this track in the queue (first track, or the track is
       hidden by the search), or 3+ seconds into a track: restart this track
     - otherwise: go back to the previous track */
  function playPrevious() {
    if (state.currentTrackId === null) return;  // nothing loaded
  
    const index = getQueueIndex();   // -1 (hidden by search) or 0 (first): nothing before it
  
    if (index <= 0 || audio.currentTime >= RESTART_AFTER) {
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
  
  /* ----- Search ----- */
  
  /* Read the search box, rebuild the queue from the shown tracks, redraw.
     Does NOT touch the audio: filtering never stops or restarts a track. */
  function applySearch() {
    state.searchText = searchInputEl.value;
    state.queue = getVisibleTracks().map(function (track) {
      return track.id;
    });
    renderLibrary();   // draws the matching rows (or "No tracks found")
    renderPlayer();    // re-applies the highlight and the Next/Previous state
  }
  
  /* ----- Playlists: saving and loading (localStorage) ----- */
  
  /* Save all playlists. Returns true if it worked, false if storage is
     blocked or full. A failed save never crashes the app: the change stays
     in memory, it is just not remembered after a reload. */
  function savePlaylists() {
    try {
      localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(state.playlists));
      return true;
    } catch (error) {
      return false;
    }
  }
  
  /* Read the saved playlists and return a CLEAN array.
     Anything wrong (nothing saved, broken JSON, not an array, blocked storage)
     gives an empty list. Inside the array, a broken playlist is skipped and
     a broken track id is dropped, so one bad entry can't break the rest.
     Never throws. */
  function loadPlaylists() {
    try {
      const raw = localStorage.getItem(PLAYLISTS_KEY);
      if (raw === null) return [];            // nothing saved yet
  
      const data = JSON.parse(raw);           // throws if the text is not valid JSON
      if (!Array.isArray(data)) return [];    // wrong shape
  
      const clean = [];
      const seenIds = new Set();              // to skip duplicate playlist ids
  
      data.forEach(function (item) {
        // Skip anything that is not a complete playlist
        if (item === null || typeof item !== "object") return;
        if (typeof item.id !== "string" || item.id === "") return;
        if (seenIds.has(item.id)) return;
        if (typeof item.name !== "string" || item.name.trim() === "") return;
        if (!Array.isArray(item.trackIds)) return;
  
        // Keep only track ids that still exist in TRACKS, without repeats
        const trackIds = [];
        item.trackIds.forEach(function (trackId) {
          if (typeof trackId === "string" &&
              getTrackById(trackId) !== undefined &&
              !trackIds.includes(trackId)) {
            trackIds.push(trackId);
          }
        });
  
        seenIds.add(item.id);
        clean.push({ id: item.id, name: item.name.trim(), trackIds: trackIds });
      });
  
      return clean;
    } catch (error) {
      return [];   // broken JSON or blocked storage: start with an empty list
    }
  }
  
  /* ----- Playlists: data functions (they change data only: no DOM, no audio) -----
     Every function returns { ok: true } on success,
     or { ok: false, reason: "..." } so the UI can show the reason later. */
  
  /* Find a playlist by id. Returns undefined if not found. */
  function getPlaylistById(id) {
    return state.playlists.find(function (playlist) {
      return playlist.id === id;
    });
  }
  
  /* Make an id that no existing playlist uses.
     Start with "p_" + the current time in milliseconds. If that is taken
     (two playlists in the same millisecond), add _1, _2, ... until it is free. */
  function makePlaylistId() {
    const base = "p_" + Date.now();
    let id = base;
    let counter = 1;
    while (getPlaylistById(id) !== undefined) {
      id = base + "_" + counter;
      counter++;
    }
    return id;
  }
  
  /* Check a playlist name and return the trimmed version,
     or null if it is not valid (not text, empty, or only spaces). */
  function cleanPlaylistName(name) {
    if (typeof name !== "string") return null;
    const trimmed = name.trim();
    return trimmed === "" ? null : trimmed;
  }
  
  /* Create a new, empty playlist. Same names are allowed (ids are unique).
     Success also returns the new id: { ok: true, id: "..." } */
  function createPlaylist(name) {
    const cleanName = cleanPlaylistName(name);
    if (cleanName === null) {
      return { ok: false, reason: "Please enter a playlist name." };
    }
  
    const playlist = { id: makePlaylistId(), name: cleanName, trackIds: [] };
    state.playlists.push(playlist);
    savePlaylists();
    return { ok: true, id: playlist.id };
  }
  
  /* Give an existing playlist a new name. */
  function renamePlaylist(id, name) {
    const playlist = getPlaylistById(id);
    if (!playlist) {
      return { ok: false, reason: "Playlist not found." };
    }
  
    const cleanName = cleanPlaylistName(name);
    if (cleanName === null) {
      return { ok: false, reason: "Please enter a playlist name." };
    }
  
    playlist.name = cleanName;
    savePlaylists();
    return { ok: true };
  }
  
  /* Delete a playlist. Only the playlist is removed: the tracks stay in the
     library, and a track that is playing keeps playing. */
  function deletePlaylist(id) {
    const index = state.playlists.findIndex(function (playlist) {
      return playlist.id === id;
    });
    if (index === -1) {
      return { ok: false, reason: "Playlist not found." };
    }
  
    state.playlists.splice(index, 1);
    savePlaylists();
    return { ok: true };
  }
  
  /* Add a track to the END of a playlist. We store the track id only. */
  function addTrackToPlaylist(playlistId, trackId) {
    const playlist = getPlaylistById(playlistId);
    if (!playlist) {
      return { ok: false, reason: "Playlist not found." };
    }
    if (!getTrackById(trackId)) {
      return { ok: false, reason: "Track not found." };
    }
    if (playlist.trackIds.includes(trackId)) {
      return { ok: false, reason: "This track is already in the playlist." };
    }
  
    playlist.trackIds.push(trackId);
    savePlaylists();
    return { ok: true };
  }
  
  /* Remove a track from a playlist (the track stays in the library). */
  function removeTrackFromPlaylist(playlistId, trackId) {
    const playlist = getPlaylistById(playlistId);
    if (!playlist) {
      return { ok: false, reason: "Playlist not found." };
    }
  
    const index = playlist.trackIds.indexOf(trackId);
    if (index === -1) {
      return { ok: false, reason: "This track is not in the playlist." };
    }
  
    playlist.trackIds.splice(index, 1);
    savePlaylists();
    return { ok: true };
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
      playNext();                // auto-advance (follows the shown list)
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
  
  /* Search box: "input" fires on every change: typing, deleting, pasting,
     and the clear (x) button. */
  searchInputEl.addEventListener("input", applySearch);
  
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
  state.playlists = loadPlaylists();   // saved playlists (or an empty list)
  setVolume(loadVolume());
  applySearch();   // reads the search box (some browsers restore its text after a
                   // reload), builds the queue, draws the list and the player bar