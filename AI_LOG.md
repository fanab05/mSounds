# AI Log - mSounds

AI tool: Claude (claude.ai). Used to brainstorm and plan in one chat, code generation in separate chat. 

## Entry 0 - Brainstorming: choosing the app
- Goal: Pick an app to recreate for MA3. I choose approche C. Recreate or improve an existing app.
- Prompt (short): Asked which of Snapchat, Instagram and Spotify was best to recreate.
- What the AI gave: Recommended Spotify because it works as a static site without a server, is easy to demo, and has many edge cases to test.
Proposed three features: library with search, player, playlists.
My decision: I went with Spotify-inspired music player. With my own name "mSounds".

## Entry 1 - Planning before code
- Goal: Get a plan before any code is written.
- My prompt (short): Asked for assumptions, data structures, file split, edge cases and a build order. I explicitly asked claude to "not write code yet".
- What the AI gave: A plan with static HTML/CSS/JS, track IDs only, a list of about 25 edge cases, and a 14 - step build order.
- My assessment: I liked that playlists store ids instead of track copies, and that data functions and render functions are kept separate. I also checked that it uses only the three features i chose.
- My choices:
    - At end of queue: stop
    - Duplicate track in a playlist: blocked
    - Queue when search is active: the list currently shown
    - Duplicate playlist names: allowed
- Next: Build steps 1 - 5 (skeleton, library, play, next/previous)

## Entry 2 - Choosing the music
- Goal: Find music i am allowed to use and share in a public repo.
- What i considered: I asked claude if i could use songs from Spotify. Then claude explained that this is not possible, because songs cannot be downloaded as mp3 files, and they are copyrighted, so they can not be put in a public Github repo.
What i found: Claude said I could use Free Music Archive and then i checked the license on each track page.
- My decision: I chose three tracks under CC BY 4.0 and credit the artist (title, artist, source and license link) in the README under "Music credits"
- Note: Track 3 ("Cinematic Corporate Advertising Bed" by Alex Morgan) is marked as AI-generated on its source page. I still kept it, but noted this down in README.
Files: armotonic_always_with_you.mp3, wekont_space_jam.mp3, alex_morgan_corporate_bed.mp3 

## Entry 3 - Building steps 1 - 4 (library, play song, play/pause)
- Goal: Get a first working version: library list, play a track, show title and artist in the player bar, and a play/pause button.
- My prompt: I asked Claude to build just for now steps 1 - 4 of the plan. I gave it a tracks.js and required textContent (not innerHTML), a fixed playbar and an error message if an mp3 fails to load.
- What the AI gave: index.html, style.css and app.js. The app.js has a "state" object, "renderLibrary()", "renderPlayer()", "playTrack()", and "togglePlayPause()" and it listens to the audio element´s events.
- What I did: I pasted the generated codes for each file into VS Code and opned index.html in Chrome. 
- How/ what i tested: 
    I tested that all 3 tracks are listed with correct durations. 
    I tested by clicking a track then it played it and showed its title and artist in the bar. That also worked.
    That the playing track turns green in the list. Works.
    Play/pause toggles the icon.
- Edge cases tested:
    - Pressing play before choosing a track: shows "Pick a track from the library first"
    - Missing mp3 file (To test i renamed one temporarily): an error message was shown and the app does not freeze. It works now, but see Entry 4 for a bug that accured.
    - A track plays to the end, then i press play: it stops, and play starts it from the beginning. 
- Problems found: One bug with the button (play/pause) icon when a file is missing (Entry 4).

## Entry 4 - Fixing the button icon bug
- Problem: With a missing mp3, the error message appeared but the button still showed the pause icon, as if the track was playing. 
- My prompt: Describe the bug and ask Claude to explain the cause in simple terms and give the smallest fix.
What the AI gave: An explanation that the icon was drawn from a stored copy of the status ('state.isPlaying'). That copy can disagree with the real audio element when a file fails to load. The fix was to have a helper func "isReallyPlaying()", that asks the audio element directly (not paused and no error). It is used when drawing the button, and "renderPlayer()" is also called after a failed play.
- Result and re-testing: All three tracks play and switch, play/pause works, and with a missing mp3 the icon now shows play, together with the error message. 

## Entry 5 - Steps 5 - 8 (next/previous, auto-advance, progress bar, volume)
- Goal: Add a queue with next/previous, auto-advance, a progress bar that shows elapsed and remaining time, and a volume slider.
- My prompt: Pasted my current app.js and asked Claude to build on that exact file. 
- What AI gave: Updated index.html, style.css and app.js, plus a 17 - point test checklist for the new edge cases.
- How i tested: Went through the whole checklist in Chrome with open console. I tested the old functions first (play, pause, switch track), then the new ones. 
    - Next/prev, including the first and last track, previous within and after 3 seconds, and a missing mp3 (test 1 - 4) also works.
    - Auto - advance and the end of the queue (tests 5 - 6): works
    - Seek bar and times: dragging, clicking, seeking while paused, keyboard, broken track (tests 7 - 13): works
    - Volume: slider, saved volum after reload, corrupted localStorage value, private window (tests 14 - 17). works.
- Problems found: none in the checklist while testing.
- Next: Search (step 9), then playlist (steps 10 - 12)
