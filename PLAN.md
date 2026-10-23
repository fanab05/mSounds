mSounds: Plan

1. Assumptions
Everything runs in the browser. No server, so GitHub Pages can host it as-is.
Track data is a hand-written list in tracks.js. You add a track by adding one entry and dropping the mp3 into audio/.
Only playlists are saved (in localStorage). Library data never changes at runtime.
Playback uses the built-in Audio object (or an <audio> tag). No libraries.
Audio file paths are relative (audio/song.mp3), so they work both locally and on GitHub Pages.
Targeting modern desktop browsers first; mobile layout is a bonus.
You own or have the right to use the mp3 files (royalty-free or your own music), since the repo will be public.
A single UI “view” is shown at a time: Library, or one Playlist.

2. Data structures
Track (in tracks.js, static):

{
  id: "t001",          // unique, never changes
  title: "Song name",
  artist: "Artist name",
  src: "audio/song.mp3",
  duration: 215        // optional, seconds
}

Playlist (in localStorage, as JSON):

{
  id: "p_1718000000000",   // unique, e.g. from Date.now()
  name: "Study mix",
  trackIds: ["t001", "t004"]
}

Key point: playlists store track ids only, not copies of the tracks. That way renaming a track or changing the file path in tracks.js updates everywhere automatically.

App state (a plain JS object in app.js, not saved):

{
  currentTrackId, queue (list of ids), queueIndex,
  isPlaying, view ("library" | playlistId), searchText
}

3. Dividing the code
File	Responsibility
index.html	Page structure only: sidebar (library + playlists), main list, search box, player bar. No logic.
style.css	All layout and looks. Dark theme, player bar fixed at the bottom.
tracks.js	One thing: const TRACKS = [...]. Loaded before app.js.
app.js	All behaviour, organised in clearly commented sections:

Sections inside app.js (you could split these later, but one file is fine for an assignment):

Storage: loadPlaylists(), savePlaylists() (wrapped in try/catch).
Playlist logic: create, rename, delete, add track, remove track. These only change data, no DOM.
Player logic: play, pause, next, previous, seek, volume, build the queue.
Rendering: functions that draw the track list, playlist list and player bar from the data.
Event wiring: one place that connects buttons and inputs to the functions above.

Rule of thumb: data functions change data, render functions draw it. Never mix the two.

4. Edge cases that matter

Playback

Mp3 file missing or fails to load: show a message and skip, don’t freeze.
Browsers block autoplay: only start audio from a user click.
Track ends: automatically go to next; at the end of the queue, stop (or loop, decide which).
Next on the last track / previous on the first track.
“Previous” after 3+ seconds usually restarts the current track instead of going back.
Clicking play when nothing is selected.
Seek bar: dragging while the track is playing must not fight with the automatic updates. Duration is NaN until metadata loads.
Volume 0 vs mute, and remembering volume between visits.

Library and search

Search is case-insensitive and ignores extra spaces.
No results: show “No tracks found”.
Search matches both title and artist.
Playing a track while a search filter is active: the queue should be the filtered list (or the full list, pick one and be consistent).

Playlists

Empty name, or only spaces, when creating/renaming.
Duplicate playlist names (allow or block).
Adding the same track twice to a playlist.
Deleting a playlist while one of its tracks is playing.
Deleting the playlist you are currently viewing.
A saved playlist contains a track id that no longer exists in tracks.js: ignore it safely.
localStorage empty, corrupted JSON, or unavailable (private mode): fall back to an empty list instead of crashing.
Confirm before delete.

General

Special characters in titles (<, &, quotes): use textContent, not innerHTML with raw text.
Very long titles: truncate with CSS.
Wrong file paths on GitHub Pages (case-sensitive: Song.mp3 ≠ song.mp3).

5. Build order (test after each step)
Skeleton: index.html, style.css, tracks.js, app.js linked together; console.log(TRACKS) works. Push to GitHub Pages early to confirm the deployment works.
Render the library: show all tracks in a list. Test: every track appears.
Play one track: click a track, it plays. Show title and artist in the player bar.
Play/pause button: toggles and updates its icon.
Next / previous with a queue. Test: edges (first/last track).
Auto-advance when a track ends.
Seek bar + time display: current time, total time, drag to seek.
Volume slider (+ optional mute).
Search: filter the list as you type; handle “no results”.
Playlists data layer: create/rename/delete/add/remove as plain functions; test them in the browser console and check localStorage in DevTools.
Playlists UI: sidebar list, view a playlist, buttons for add/remove/rename/delete.
Persistence: reload the page, confirm playlists survive. Test with corrupted localStorage.
Edge-case pass: go through section 4 one by one.
Polish and deploy: responsive layout, active-track highlight, final test on the live GitHub Pages URL. 