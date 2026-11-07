# Solo open-book rebuild — review candidate

Draft PR: https://github.com/lilbirdlifecoaching/lilbirdlifecoaching.github.io/pull/43
Branch: `codex/solo-open-book`. Nothing merged or deployed.

## Design target and behavior

Reference: https://chatgpt.com/s/m_6aee7104ef9881918b3939928a91b86c — children overlooking a valley, illustrated book, course rail, progress header, video, outline, resources and Continue. The older bird-in-backpack concept is not the target.

The signed-in session follows that composition. Continue opens the existing coaching conversation on the right page; returning to the overview retains chat history and unsent reflection text. Desktop uses the spread; screens at 1100px and below use a readable single-page layout. Course titles, copy, tools, completion and access rules remain the real course content. Landing, checkout and the course dashboard retain their existing presentation.

## Implementation

- Scoped session styles in `css/lilbird-solo-open-book.css`, interactive course navigation/progress in `solo/index.html`, and existing tool renderer and save/result workflow.
- Keyboard-operable tool cards and player overlay; native playback controls remain accessible while paused.
- Optional `session.narratedMedia` config: `{src, scene, captions, language, captionLabel}`. A recording can play over its illustrated scene with optional captions. Source failure falls back once to the existing signed video, when one exists. Durations update from actual media metadata.
- Session navigation guards stale greetings, loaded history, delayed tool cards and completion cues. It also refuses a switch during an in-flight chat save, completion save or active embedded tool.
- Nest accepts its existing `journey` tab through initial query parameters so the new My Journey link works. Guide uses the existing `tab=ask` route.

## Local preview and actual media discovery

Run `python3 scripts/preview-solo-book.py` and open http://127.0.0.1:8873/solo/review/ . Use `?session=0` through `?session=7` to review each course state. Sample progress and disconnected services are injected only into served review HTML, not the production shell. The loopback server blocks service connections and form submissions through Content Security Policy.

A later search of the local Lil’ Bird project archive found six M4A recordings named for Story, Vision, Identity & Insight, Transitions, Rhythms and Relationships, plus existing session MP4/MOV files. These are outside the Git checkout. No caption files were found. The recordings appear to be earlier source material and need a content check against the current course before production selection.

Set `LILBIRD_NARRATION_DIR` to that local recording directory when starting the preview to enable scene-backed narration for sessions 1–6. The server serves only the six explicit filenames, supports HTTP byte ranges for seeking, and never copies them into the repository. Existing signed videos remain the production default; Session 6 retains its existing missing-video state in the production configuration. Recordings and credentials are not part of this PR.

The real Identity & Insight M4A was browser-tested locally: duration 161.685 seconds (2:41), playback advanced, pause worked, seeking worked, and there was no media error. The scene stays visible with native controls. Captions are supported by the component but are not fabricated or attached without a source transcript/caption file.

## Validation

- 26 JavaScript tests pass: existing access/start/continue coverage, media behavior, and regression tests exercising the actual shell functions under fast navigation and out-of-order responses.
- Four local HTTP media-serving tests pass: partial ranges, suffix ranges, out-of-bounds responses, and metadata/service isolation.
- JavaScript/preview syntax and whitespace checks pass.
- Browser-reviewed at 1536 × 1024, 820 × 1180, 390 × 844, and 320 × 740. No horizontal page overflow at 390px or 320px. The selected session remains visible in the horizontal mobile rail.
- All eight sessions render with expected tool counts: 0, 5, 3, 3, 2, 1, 2, 2. The missing-video state for Session 6 and orientation’s empty tool list were checked before enabling local narration.
- Browser-tested Continue, unsent reflection retention across overview toggles, fast session switching, completed/locked session navigation, Enter-key tool launch and closing a real embedded tool.
- A pre-existing external iCloud Worker version assertion fails on baseline because it expects exactly `v1.33-solo-access-align`. That Worker was not edited or deployed.
- No staging environment or test member account is available. Authenticated chat, entitlement hydration, checkout, signed production video URLs and database persistence have not been verified end to end. Fixture checks do not establish those integrations.

## Remaining review items

- User visual acceptance; artwork was regenerated from the reference and varies slightly in characters, paper, leaves and binding.
- Header retains functional Home/Nest/session/theme actions. Search, notification and avatar controls were not invented.
- Copy, resource names and orientation 0 plus sessions 1–7 reflect the working course, differing from mockup placeholders.
- Review the discovered recordings for current-course suitability, supply/recover accurate caption sources, and choose authenticated media delivery before activating narration outside the local preview.
- Complete authenticated integration checks in an approved test environment before requesting merge/deployment approval.

## Browser screenshots

[Narration playing over the scene](solo-open-book-review/narration-desktop.jpg) · [Desktop overview without local media](solo-open-book-review/desktop.jpg) · [Mobile](solo-open-book-review/mobile.jpg) · [Small mobile](solo-open-book-review/small-mobile.jpg) · [Tablet](solo-open-book-review/tablet.jpg) · [Reflection](solo-open-book-review/reflection.jpg)

Captures use sample member progress and disconnected live services. Narration captures use the real local source recording; no audio is included in screenshot files.

## Artwork provenance

`solo/assets/open-book.webp` (388 KB) was made with the built-in image-generation tool and converted to WebP for the website. It is project-local. The discarded bird-in-backpack generation is not used.

Final prompt:

> Edit target supplied approved Lil Bird webpage. Asset extraction and cleanup for working website. Reproduce ONLY the central open book from this image, straight-on overhead view, exactly the same wide two-page book filling canvas with small margins, aspect ratio 1.6:1. Preserve all page edges, leather binding, watercolor leaves across upper corners, bottom left scene with TWO CHILDREN sitting on rock looking over river valley and small yellow bird. Preserve center crease and bookmark ribbon at bottom. Remove entire left navigation sidebar, top headers, outer cup, and all surrounding UI. Inside book REMOVE ALL text, session labels, yellow strokes, video rectangle, all resource cards, buttons and checklists. Upper half left page empty parchment, entire right page empty parchment. Beautiful subtle warm cream watercolor paper. Children and valley occupy lower 45 percent left page only, upper half left is blank. No UI text or markings anywhere. Small warm brown wooden table margin around book only. Faithful extraction of approved art, not a new design.

## Readability revision

Moved the session number, duration and tool count from the translucent overlay below the children to an opaque paper panel below Tools & Resources. Labels and values have explicit dark colors and larger type. Desktop spacing keeps the panel and Continue action within the book; mobile remains free of horizontal page overflow. The 26 JavaScript checks still pass.

[Updated desktop details](solo-open-book-review/readable-details.jpg) · [Updated mobile](solo-open-book-review/mobile.jpg)
