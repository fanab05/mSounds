# mSounds

A music player web app inspired by Spotify, built with AI (Claude) for Mandatory Assignment 3 (Vibe Coding) in DAVE3625. It is my own prototype and is not affiliated with Spotify. It used no Spotify code, name or logo.

** Live demo:** https://fanab05.github.io/mSounds/

## Purpose
To explore how generative AI can turn an idea into a working app, and how i must plan, test and correct the AI´s code myself.

## Feature
1. **Library with search:** search by title or artist, case - insensitive.
2. **L Player:** play/pause, next/previous, auto - advance, a seek bar with elapsed and remaining time, and a volume slider that is remembered.
3. **Playlists:** create, rename, delete, add and remove tracks. They are saved in the borwser (localStorage).

## How to run
No installation. Open the live demo, or open 'index.html' in a browser.

## How i used AI
I used Claude to brainstorm, plan, generate code, test and improve the app. I wrote the decisions myself (the features, the queue rule, the handling of edge cases) and tested each step before the next. The full process is in 'AI_LOG.md", and the plan is in 'PLAN.md'.

## Testing and what i fixed
I tested each step in Chrome with the console open, including edge cases such as a missing mp3 file, and empty playlist name and corrupted localStorage f.eks. the button icon bug. See AI_LOG.md entries 3 and 4.

## Known limitations
- Playlists are stored only in this browser (no accounts or sync)
- Playlist track cannot be reordered.
- The volume slider has no effect on iPhones (iOS uesed device volume).



## Music credits

All tracks are from Free Music Archive and used unmodified under CC BY 4.0.

| No. | File | Title | Artist | Source | License |
|-----|------|-------|--------|--------|---------|
| 1 | audio/armotonic_always_with_you.mp3 | Always With You | Armotonic | [Free Music Archive](https://freemusicarchive.org/music/3am-sky/3am-sky/always-with-you/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| 2 | audio/wekont_space_jam.mp3 | space jam | wekont | [Free Music Archive](https://freemusicarchive.org/music/wekont/single/space-jam/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) |
| 3 | audio/alex_morgan_corporate_bed.mp3 | Cinematic Corporate Advertising Bed | Alex Morgan | [Free Music Archive](https://freemusicarchive.org/music/alex-morgan/cinematic-epic-trailers-vol-1/cinematic-corporate-advertising-bed/) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) (AI-generated, as stated on the source page) |

