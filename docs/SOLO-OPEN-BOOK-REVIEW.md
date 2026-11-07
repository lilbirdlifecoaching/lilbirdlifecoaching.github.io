# Solo open-book rebuild — review candidate

Branch: `codex/solo-open-book`. No merge or production deployment is authorized or performed.

## Design target

The reference supplied by the user is https://chatgpt.com/s/m_6aee7104ef9881918b3939928a91b86c: children overlooking a valley, open illustrated book, left course rail, progress header, right video, outline, resources and Continue action. The older bird-in-backpack concept is not the target.

The signed-in session now uses that composition. Continue reveals the existing coaching conversation on the right page; Session overview restores the media/resources. Chat history and the current input remain in place while switching these views. The actual course titles, copy, tools, status and completion rules are retained. The original dashboard, landing, checkout and access functions remain in place.

## Changes

- Added scoped session styling in `css/lilbird-solo-open-book.css` and live course navigation/progress in `solo/index.html`.
- Reused the existing tool renderer and embedded tool workflow; tools can be opened by keyboard and are visible when launched from the overview.
- Added native video controls and a keyboard-operable initial play overlay. The overlay no longer covers pause/seek controls while paused.
- Added optional `session.narratedMedia` configuration through `js/lilbird-solo-media.js`: `{src, scene, captions, language, captionLabel}`. A narration audio/video source can use its scene as the poster, with a captions track. A source error falls back once to the current signed course video. No narration or caption source has been invented or attached.
- Added the existing `journey` tab to Nest's supported initial query parameters so the new My Journey link works. Guide uses the already supported `tab=ask` route.
- Added `scripts/preview-solo-book.py`, a loopback-only sample-data preview. It modifies served HTML in memory, disconnects fetch/auth/data persistence, and blocks service connections and form submissions through Content Security Policy. It does not add a production authentication bypass.

## Local review

Run `python3 scripts/preview-solo-book.py`, then visit http://127.0.0.1:8873/solo/review/ . The preview uses sample member progress. Its video-unavailable message is expected because the signed media service is deliberately disconnected. The real shell retains its authenticated media URL loader.

## Verification

- 20 automated tests passed: existing access/start/continue tests plus two media behavior tests covering native controls, captions and fallback.
- JavaScript syntax and whitespace checks passed.
- Browser-reviewed at 1536 × 1024 and 390 × 844. Mobile document width equals viewport width (390px), with no horizontal overflow.
- Browser-tested Continue to conversation, reflection input enabling Send, overview return, switching completed sessions, locked-session disabled states, and opening/closing the real Tangle Within embedded tool.
- The pre-existing external iCloud Worker version assertion fails on baseline; it expects `v1.33-solo-access-align`. That Worker was not edited or deployed.
- Authenticated chat responses, saved progress writes, purchase, signed video playback and tool persistence have not been exercised against a test member account. Sample-data preview checks do not establish these production integrations end to end.

## Remaining differences and work

- Book artwork is a regenerated clean background from the reference, not a pixel-identical extraction. The children, leaf placement, binding and paper vary slightly.
- Header navigation retains real Home/Nest/session/theme actions; decorative search, notifications and avatar controls from the concept were not invented.
- Text and resource names use the working course's actual content, which differs from the mockup. Progress correctly uses orientation 0 plus sessions 1–7, rather than changing course numbering to the mockup's apparent 1–8.
- The scene poster uses an existing landscape asset. No source voiceover, session-specific narrated scenes or caption files were found locally. These must be supplied/located before the narrated experience can be reviewed with real media. Session 6 keeps its existing video-coming-soon state.
- Mobile stacks the overview and illustration; Continue focuses a dedicated reflection area on the same page.
- Final acceptance still needs user visual review and authenticated integration testing before any merge/deployment request.

## Artwork provenance

`solo/assets/open-book.webp` (388 KB) was made with the built-in image-generation tool and converted to WebP for the website. It is project-local. The discarded bird-in-backpack generation is not used.

Final prompt:

> Edit target supplied approved Lil Bird webpage. Asset extraction and cleanup for working website. Reproduce ONLY the central open book from this image, straight-on overhead view, exactly the same wide two-page book filling canvas with small margins, aspect ratio 1.6:1. Preserve all page edges, leather binding, watercolor leaves across upper corners, bottom left scene with TWO CHILDREN sitting on rock looking over river valley and small yellow bird. Preserve center crease and bookmark ribbon at bottom. Remove entire left navigation sidebar, top headers, outer cup, and all surrounding UI. Inside book REMOVE ALL text, session labels, yellow strokes, video rectangle, all resource cards, buttons and checklists. Upper half left page empty parchment, entire right page empty parchment. Beautiful subtle warm cream watercolor paper. Children and valley occupy lower 45 percent left page only, upper half left is blank. No UI text or markings anywhere. Small warm brown wooden table margin around book only. Faithful extraction of approved art, not a new design.
