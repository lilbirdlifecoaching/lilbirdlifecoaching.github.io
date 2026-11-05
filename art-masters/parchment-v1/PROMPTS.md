# Parchment generation specifications

Tool: built-in image generation, largest available PNG per asset. Reference images: repository `approved-concept-3-day.png` and `night-reference.png`. Original returned resolutions preserved; no artificial upscaling.

## Common prompt

Blank aged handmade warm ivory cotton-rag paper matching the approved Lil’ Bird reference cards. Fine paper fibers and quiet natural mottling, honey/ochre patina near perimeter, shallow creases confined to outer edges. Soft asymmetric torn/deckled silhouettes and irregular corners. Full sheet visible straight-on with transparent margin. Calm light center for dark live text. No text, words, glyphs, rules, symbols, drawings, leaves, logos, UI, buttons, internal frames, scenery, drop-shadow halos, circles, tiled grain, holes, heavy central stains, scorched pirate-map edges or rolled scroll ends. Transparency outside paper only; request visually opaque interior.

## 01 — Wide hero

Landscape approximately 3:2, full sheet, gently uneven hand-torn edges, asymmetrical softly rounded corners, tiny fibers, slight edge thickness, restrained irregular edge nicks. Interior 80% light and quiet; beautiful cared-for field journal paper.

## 02 — Square card

Square sheet, gently irregular perimeter, deeper inward nick on right, small uneven shoulder upper left, shallow wrinkles near perimeter. Distinct handmade outline rather than geometric rounded rectangle.

## 03 — Landscape card

Landscape approximately 4:3. Gently scalloped asymmetrical top edge, subtly sloping lower edge, soft irregular corners and little frayed fibers. Different silhouette from square card.

## 04 — Sidebar

Narrow approximately 1:3 portrait. Long gently uneven sides, wavering top/bottom, soft asymmetric corners and subtle deckle fibers; no exaggerated missing chunks.

## 05 — Mobile page

Portrait approximately 2:3. Torn irregular silhouette, fine fibers and gentle edge patina, shallow corner creases, calm interior and all edges visible.

## 06 — Journal spread

Landscape approximately 3:2. Blank open two-page field journal paper, top-down, two ivory pages meeting at a narrow central binding crease, slight layered page edges at bottom/outside. No cover, desk, bookmark, illustrations, text or ruled lines. Warm patina on perimeter/crease, blank calm writing areas.

## 07 — Edge frame

Square edge-only parchment frame, not a filled sheet. Continuous approximately 10%-wide paper band around four sides; central 70% × 70% transparent, exterior transparent. Irregular deckled outer silhouette and soft asymmetric outer corners; straight rectangular inner window with square inner corners to join an opaque CSS fill. Midsections approximately straight for independent edge stretching. Ivory fibers and outer-rim age only. No decoration, writing, UI, drop shadow, circles or filled center.

## QA observations

The generator provided real external alpha, but panel interiors are near-opaque rather than exactly alpha 255. Use an opaque backing in implementation as described in README-FOR-CLAUDE.md. The frame has a genuine transparent center. No panel was altered by image-processing code; metadata/alpha inspection only.
