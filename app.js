/* =====================================================
   mSounds: app.js  (steps 1 to 11)
   - Show the library
   - Click a track to play it
   - Play/pause button
   - Next / previous buttons with a queue
   - Auto-advance when a track ends
   - Progress bar with elapsed and remaining time
   - Volume slider (remembered in localStorage)
   - Search by title or artist (the queue follows the shown list)
   - Playlists: data layer + saving
   - Playlists: sidebar, playlist view, rename, delete, add, remove
   - "← Library" back button in the playlist heading
   ===================================================== */

/* ---------- 1. State ----------
   The app's "memory": only what we need to remember right now.
   TRACKS comes from tracks.js, which is loaded before this file. */
   const state = {
    currentTrackId: null,  // id of the loaded track (null = none yet)
    isPlaying: false,      // true while audio is playing
    searchText: "",        // what the user typed in the search box
    view: "library",       // what is shown: "library" or a playlist id
    renaming: false,       // true while the inline rename box is open
    menu: null,            // the open "+" menu: { el, trigger }, or null
    queue: TRACKS.map(function (track) {
      return track.id;     // the queue = ids of the tracks currently SHOWN, in order.
    }),                    // At start that is all tracks; search and views change it.
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
  const CONFIRM_MS = 3500;                    // how long a green confirmation stays visible
  
  /* One audio player for the whole app. It is not added to the page,
     we only control it from JavaScript. We reuse this one element for every
     track, which also helps browsers allow auto-advance to the next track. */
  const audio = new Audio();
  
  /* ---------- 2. Grab the HTML elements we need ----------
     Done once at the top so we don't search the page again and again. */
  const trackListEl        = document.getElementById("track-list");
  const searchInputEl      = document.getElementById("search-input");
  const noResultsEl        = document.getElementById("no-results");
  const messageEl          = document.getElementById("message");
  const viewHeaderEl       = document.getElementById("view-header");
  const libraryNavEl       = document.getElementById("nav-library");
  const playlistNavEl      = document.getElementById("playlist-nav");
  const noPlaylistsEl      = document.getElementById("no-playlists");
  const newPlaylistFormEl  = document.getElementById("new-playlist-form");
  const newPlaylistInputEl = document.getElementById("new-playlist-input");
  const npTitleEl          = document.getElementById("np-title");
  const npArtistEl         = document.getElementById("np-artist");
  const playBtnEl          = document.getElementById("play-btn");
  const prevBtnEl          = document.getElementById("prev-btn");
  const nextBtnEl          = document.getElementById("next-btn");
  const seekBarEl          = document.getElementById("seek-bar");
  const timeElapsedEl      = document.getElementById("time-elapsed");
  const timeRemainingEl    = document.getElementById("time-remaining");
  const volumeBarEl        = document.getElementById("volume-bar");
  
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
  
  /* Timer id of the "hide the confirmation" countdown (null = none running) */
  let messageTimer = null;
  
  /* Show or hide the message box.
     showMessage("text")        red message (errors), stays until replaced
     showMessage("text", "ok")  green confirmation, hides itself after a few seconds
     showMessage("")            hide the box */
  function showMessage(text, kind) {
    clearTimeout(messageTimer);   // a newer message cancels the old countdown
  
    if (text) {
      messageEl.textContent = text;  // textContent: safe, text only
      messageEl.classList.toggle("message-ok", kind === "ok");
      messageEl.hidden = false;
      if (kind === "ok") {
        messageTimer = setTimeout(function () {
          showMessage("");
        }, CONFIRM_MS);
      }
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
  
  /* The tracks that are SHOWN right now, in the order they are shown.
     - Playlist view: the playlist's tracks in saved order (the search is ignored).
     - Library view: all tracks that match the search, in library order.
       An empty search matches everything. A track matches when the search
       text appears in its title OR in its artist. */
  function getVisibleTracks() {
    if (state.view !== "library") {
      const playlist = getPlaylistById(state.view);
      if (!playlist) return [];
      return playlist.trackIds
        .map(function (id) { return getTrackById(id); })
        .filter(function (track) { return track !== undefined; });
    }
  
    const query = normalizeText(state.searchText);
    if (query === "") return TRACKS;
  
    return TRACKS.filter(function (track) {
      return normalizeText(track.title).includes(query) ||
             normalizeText(track.artist).includes(query);
    });
  }
  
  /* Where is the current track in the queue? 0 = first, -1 = not in the queue.
     We look it up each time instead of storing it, so it can never be out of date.
     -1 also happens when the playing track is not in the shown list
     (hidden by the search, or not in the playlist you are viewing). */
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
     Playing track not in the shown list -> first track of the shown list. */
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
  
  /* Build the list of the current view: one row per SHOWN track.
     Each row has TWO sibling buttons (never a button inside a button):
       <li class="track-row">
         <button class="track-main">  title, artist, duration  (click = play)
         <button class="track-action"> "+" in the library, "Remove" in a playlist
       </li>
     If the list is empty, show a message instead. */
  function renderTrackList() {
    closeMenu();   // an open "+" menu belongs to a row that is about to be replaced
  
    const inLibrary = (state.view === "library");
    const tracks = getVisibleTracks();
  
    trackListEl.textContent = "";            // empty the list first
    noResultsEl.textContent = inLibrary ? "No tracks found" : "This playlist is empty";
    noResultsEl.hidden = tracks.length > 0;  // show the message only when empty
  
    tracks.forEach(function (track) {
      const li = document.createElement("li");
      li.className = "track-row";
      li.dataset.id = track.id;  // remember which track this row is
  
      // --- Main button: title, artist, duration. Clicking it plays the track ---
      const main = document.createElement("button");
      main.type = "button";
      main.className = "track-main";
  
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
  
      main.append(info, duration);
  
      main.addEventListener("click", function () {
        handleTrackClick(track.id);
      });
  
      // --- Action button: next to the main button, not inside it ---
      const action = document.createElement("button");
      action.type = "button";
      action.className = "track-action";
  
      if (inLibrary) {
        // "+" opens the "add to playlist" menu
        action.textContent = "+";
        action.title = "Add to playlist";
        action.setAttribute("aria-label", 'Add "' + track.title + '" to a playlist');
        action.setAttribute("aria-haspopup", "true");
        action.setAttribute("aria-expanded", "false");
        action.addEventListener("click", function () {
          if (state.menu && state.menu.trigger === action) {
            closeMenu(true);                  // second click on the same "+" closes it
          } else {
            openMenu(track, action, li);
          }
        });
      } else {
        // "Remove" takes the track out of the playlist you are viewing
        action.classList.add("track-action-text");
        action.textContent = "Remove";
        action.setAttribute("aria-label", 'Remove "' + track.title + '" from this playlist');
        action.addEventListener("click", function () {
          handleRemoveTrack(track.id);
        });
      }
  
      li.append(main, action);
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
    // nothing before it in the queue, even if the track is not in the shown list).
    // Next: see hasNextTrack().
    prevBtnEl.disabled = (state.currentTrackId === null);
    nextBtnEl.disabled = !hasNextTrack();
  
    // Highlight the row of the current track, un-highlight the others.
    // (If the track is not in the shown list, no row is highlighted.)
    const rows = trackListEl.querySelectorAll(".track-row");
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
     a safety net). If the playing track is not in the shown list, this starts
     the shown list from its first track. */
  function playNext() {
    if (!hasNextTrack()) return;
    playTrack(getNextTrackId());
  }
  
  /* Previous button:
     - nothing before this track in the queue (first track, or the track is
       not in the shown list), or 3+ seconds into a track: restart this track
     - otherwise: go back to the previous track */
  function playPrevious() {
    if (state.currentTrackId === null) return;  // nothing loaded
  
    const index = getQueueIndex();   // -1 (not in shown list) or 0 (first): nothing before it
  
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
  
  /* ----- Keeping the queue and the screen in step -----
     None of these functions touch `audio`: changing the view, or adding,
     removing, renaming or deleting, never stops or restarts the music. */
  
  /* The queue is always the list that is shown. Call after anything that
     changes which tracks are shown. */
  function rebuildQueue() {
    state.queue = getVisibleTracks().map(function (track) {
      return track.id;
    });
  }
  
  /* Rebuild the queue, then redraw the list and the player bar. */
  function refreshList() {
    rebuildQueue();
    renderTrackList();   // draws the rows (or the "empty" message)
    renderPlayer();      // re-applies the highlight and the Next/Previous state
  }
  
  /* Redraw everything that depends on the view. */
  function refreshView() {
    renderSidebar();
    renderViewHeader();
    refreshList();
  }
  
  /* Switch between the library and a playlist.
     An unknown id falls back to the library. */
  function setView(view) {
    if (view !== "library" && !getPlaylistById(view)) {
      view = "library";
    }
    state.view = view;
    state.renaming = false;   // a half-open rename box is dropped
    refreshView();
  }
  
  /* ----- Search ----- */
  
  /* Read the search box, rebuild the queue from the shown tracks, redraw.
     Does NOT touch the audio: filtering never stops or restarts a track.
     (The box is only visible in the library view.) */
  function applySearch() {
    state.searchText = searchInputEl.value;
    refreshList();
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
  
  /* ----- Playlists: sidebar and heading (drawing) ----- */
  
  /* Draw the sidebar: the Library entry and one entry per playlist
     (name + number of tracks). The entry of the current view is highlighted. */
  function renderSidebar() {
    const inLibrary = (state.view === "library");
    libraryNavEl.classList.toggle("active", inLibrary);
    if (inLibrary) {
      libraryNavEl.setAttribute("aria-current", "page");
    } else {
      libraryNavEl.removeAttribute("aria-current");
    }
  
    playlistNavEl.textContent = "";
    noPlaylistsEl.hidden = state.playlists.length > 0;
  
    state.playlists.forEach(function (playlist) {
      const count = playlist.trackIds.length;
      const isActive = (state.view === playlist.id);
  
      const li = document.createElement("li");
  
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nav-item";
      button.classList.toggle("active", isActive);
      if (isActive) button.setAttribute("aria-current", "page");
      // Screen readers read this instead of "Study 3"
      button.setAttribute("aria-label",
        playlist.name + ", " + count + (count === 1 ? " track" : " tracks"));
  
      const name = document.createElement("span");
      name.className = "nav-name";
      name.textContent = playlist.name;     // textContent, never innerHTML
  
      const badge = document.createElement("span");
      badge.className = "nav-count";
      badge.textContent = String(count);
  
      button.append(name, badge);
      button.addEventListener("click", function () {
        setView(playlist.id);
      });
  
      li.appendChild(button);
      playlistNavEl.appendChild(li);
    });
  }
  
  /* Draw the heading of the current view:
     - library: "Library" (and the search box is visible)
     - playlist: a "← Library" back button, its name, and Rename and Delete
       buttons (search box hidden)
     - playlist while renaming: an input with Save and Cancel instead of the name */
  function renderViewHeader() {
    viewHeaderEl.textContent = "";
  
    const playlist = (state.view === "library") ? undefined : getPlaylistById(state.view);
    searchInputEl.hidden = Boolean(playlist);   // search only applies to the library
  
    if (!playlist) {
      const heading = document.createElement("h2");
      heading.className = "view-title";
      heading.textContent = "Library";
      viewHeaderEl.appendChild(heading);
      return;
    }
  
    if (state.renaming) {
      const form = document.createElement("form");
      form.className = "rename-form";
  
      const input = document.createElement("input");
      input.type = "text";
      input.className = "rename-input";
      input.maxLength = 60;
      input.value = playlist.name;
      input.setAttribute("aria-label", "Playlist name");
  
      const save = document.createElement("button");
      save.type = "submit";
      save.className = "btn btn-primary";
      save.textContent = "Save";
  
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "btn";
      cancel.textContent = "Cancel";
  
      form.append(input, save, cancel);
      viewHeaderEl.appendChild(form);
  
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        handleRenameSubmit(playlist.id, input);
      });
      cancel.addEventListener("click", cancelRename);
      input.addEventListener("keydown", function (event) {
        if (event.key === "Escape") cancelRename();
      });
  
      input.focus();     // the box is ready to type in
      input.select();
      return;
    }
  
    const heading = document.createElement("h2");
    heading.className = "view-title";
    heading.textContent = playlist.name;     // textContent, never innerHTML
  
    const actions = document.createElement("div");
    actions.className = "view-actions";
  
    const renameBtn = document.createElement("button");
    renameBtn.type = "button";
    renameBtn.className = "btn rename-btn";
    renameBtn.textContent = "Rename";
    renameBtn.setAttribute("aria-label", 'Rename playlist "' + playlist.name + '"');
    renameBtn.addEventListener("click", function () {
      state.renaming = true;
      renderViewHeader();
    });
  
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-danger";
    deleteBtn.textContent = "Delete";
    deleteBtn.setAttribute("aria-label", 'Delete playlist "' + playlist.name + '"');
    deleteBtn.addEventListener("click", function () {
      handleDeletePlaylist(playlist.id);
    });
  
    actions.append(renameBtn, deleteBtn);
  
    // "Back" button: a clear way out of the playlist, to the library
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "btn";
    backBtn.textContent = "← Library";
    backBtn.setAttribute("aria-label", "Back to library");
    backBtn.addEventListener("click", function () {
      setView("library");
    });
  
    // First row: back button
    const backRow = document.createElement("div");
    backRow.className = "view-back-row";
    backRow.appendChild(backBtn);

    // Second row: playlist name, Rename and Delete
    const titleRow = document.createElement("div");
    titleRow.className = "view-title-row";
    titleRow.append(heading, actions);

    viewHeaderEl.append(backRow, titleRow);
  }
  
  /* ----- Playlists: actions (what the buttons do) -----
     Pattern: call a data function, show its reason if it failed,
     then redraw. The audio is never touched. */
  
  /* Put the keyboard focus back on the Rename button (after Save / Cancel) */
  function focusRenameButton() {
    const button = viewHeaderEl.querySelector(".rename-btn");
    if (button) button.focus();
  }
  
  /* Cancel the inline rename: nothing is saved */
  function cancelRename() {
    state.renaming = false;
    renderViewHeader();
    focusRenameButton();
  }
  
  /* Save the new name from the inline rename box.
     An empty name is rejected: the reason is shown and the box stays open. */
  function handleRenameSubmit(playlistId, input) {
    const result = renamePlaylist(playlistId, input.value);
    if (!result.ok) {
      showMessage(result.reason);
      input.focus();
      return;
    }
  
    state.renaming = false;
    showMessage("Playlist renamed.", "ok");
    renderSidebar();        // the new name in the sidebar
    renderViewHeader();     // the new name as heading
    focusRenameButton();
  }
  
  /* Delete a playlist after confirm().
     If it is the playlist we are viewing, go back to the library.
     Audio is not touched, so a track from the playlist keeps playing. */
  function handleDeletePlaylist(playlistId) {
    const playlist = getPlaylistById(playlistId);
    if (!playlist) return;
  
    const name = playlist.name;
    if (!window.confirm('Delete the playlist "' + name + '"?\nThe tracks stay in your library.')) {
      return;   // user pressed Cancel
    }
  
    const result = deletePlaylist(playlistId);
    if (!result.ok) {
      showMessage(result.reason);
      return;
    }
  
    if (state.view === playlistId) {
      setView("library");       // the viewed playlist is gone: show the library
      libraryNavEl.focus();     // keep keyboard users oriented
    } else {
      renderSidebar();
    }
    showMessage('Playlist "' + name + '" deleted.', "ok");
  }
  
  /* Remove a track from the playlist we are viewing.
     The queue is rebuilt without it. Audio is not touched: if that track is
     playing, it keeps playing (it is just no longer in the shown list). */
  function handleRemoveTrack(trackId) {
    const playlist = getPlaylistById(state.view);
    if (!playlist) return;
  
    const track = getTrackById(trackId);
    const rowIndex = playlist.trackIds.indexOf(trackId);
  
    const result = removeTrackFromPlaylist(playlist.id, trackId);
    if (!result.ok) {
      showMessage(result.reason);
      return;
    }
  
    showMessage('Removed "' + (track ? track.title : "track") + '" from "' + playlist.name + '".', "ok");
    refreshList();     // new queue + list + player bar (the heading is not redrawn)
    renderSidebar();   // the track count
  
    // The row we clicked is gone: move focus to the row that took its place
    const buttons = trackListEl.querySelectorAll(".track-action");
    if (buttons.length > 0) {
      buttons[Math.min(rowIndex, buttons.length - 1)].focus();
    } else {
      focusRenameButton();
    }
  }
  
  /* ----- The "+" menu in the library (add a track to a playlist) ----- */
  
  /* Close the menu if one is open. returnFocus = true puts the keyboard
     focus back on the "+" button that opened it. */
  function closeMenu(returnFocus) {
    if (!state.menu) return;
  
    const menu = state.menu;
    state.menu = null;                       // set first, so nothing re-enters
    menu.el.remove();
    menu.trigger.setAttribute("aria-expanded", "false");
    if (returnFocus) menu.trigger.focus();
  }
  
  /* Open a small menu under the row, listing all playlists.
     Closing: choose a playlist, press Escape, press Tab, click outside. */
  function openMenu(track, trigger, row) {
    closeMenu();   // only one menu at a time
  
    const menu = document.createElement("div");
    menu.className = "menu";
  
    if (state.playlists.length === 0) {
      const empty = document.createElement("p");
      empty.className = "menu-empty";
      empty.textContent = "You have no playlists yet. Create one in the sidebar.";
      menu.appendChild(empty);
    } else {
      menu.setAttribute("role", "menu");
      menu.setAttribute("aria-label", 'Add "' + track.title + '" to playlist');
  
      state.playlists.forEach(function (playlist) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "menu-item";
        item.setAttribute("role", "menuitem");
        item.textContent = playlist.name;    // textContent, never innerHTML
        item.addEventListener("click", function () {
          handleAddToPlaylist(playlist.id, track.id);
        });
        menu.appendChild(item);
      });
    }
  
    // Keyboard inside the menu: arrows move, Tab closes (and continues from the "+")
    menu.addEventListener("keydown", function (event) {
      if (event.key === "Tab") {
        closeMenu(true);   // focus goes back to "+", then Tab moves on from there
        return;            // (no preventDefault: the Tab itself still happens)
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const items = Array.from(menu.querySelectorAll(".menu-item"));
        if (items.length === 0) return;
        const current = items.indexOf(document.activeElement);
        const step = (event.key === "ArrowDown") ? 1 : -1;
        items[(current + step + items.length) % items.length].focus();
        event.preventDefault();   // do not scroll the page
      }
    });
  
    row.appendChild(menu);
    trigger.setAttribute("aria-expanded", "true");
    state.menu = { el: menu, trigger: trigger };
  
    const first = menu.querySelector(".menu-item");
    if (first) first.focus();   // keyboard users land on the first playlist
  }
  
  /* A playlist was chosen in the menu: add the track and tell the user. */
  function handleAddToPlaylist(playlistId, trackId) {
    const playlist = getPlaylistById(playlistId);
    const track = getTrackById(trackId);
    const result = addTrackToPlaylist(playlistId, trackId);
  
    closeMenu(true);
  
    const playlistName = playlist ? playlist.name : "playlist";
    if (result.ok) {
      showMessage('Added "' + (track ? track.title : "track") + '" to "' + playlistName + '".', "ok");
    } else {
      showMessage(playlistName + ": " + result.reason);   // e.g. "already in the playlist"
    }
    renderSidebar();   // the track count may have changed
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
  
  /* Sidebar: the Library entry (playlist entries are wired in renderSidebar) */
  libraryNavEl.addEventListener("click", function () {
    setView("library");
  });
  
  /* Sidebar: "New playlist" form. Success opens the new playlist;
     failure shows the reason in the message box. */
  newPlaylistFormEl.addEventListener("submit", function (event) {
    event.preventDefault();   // do not reload the page
  
    const result = createPlaylist(newPlaylistInputEl.value);
    if (!result.ok) {
      showMessage(result.reason);
      newPlaylistInputEl.focus();
      return;
    }
  
    newPlaylistInputEl.value = "";
    setView(result.id);       // open the new playlist
    showMessage('Playlist "' + getPlaylistById(result.id).name + '" created.', "ok");
  });
  
  /* "+" menu: close it on Escape (focus returns to the "+" button)
     and on a click anywhere outside the menu and its "+" button. */
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.menu) {
      closeMenu(true);
    }
  });
  document.addEventListener("click", function (event) {
    if (!state.menu) return;
    if (state.menu.el.contains(event.target)) return;       // click inside the menu
    if (state.menu.trigger.contains(event.target)) return;  // the "+" handles itself
    closeMenu();
  });
  
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
  renderSidebar();      // Library + playlists
  renderViewHeader();   // "Library" heading, search box visible
  applySearch();   // reads the search box (some browsers restore its text after a
                   // reload), builds the queue, draws the list and the player bar