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
