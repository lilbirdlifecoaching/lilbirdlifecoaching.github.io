# Glow Map pilot — deploy checklist (Luke)

This file is your step-by-step for getting **https://lilbird.life/tools/glow-map.html** live. The page is built; nothing else is required in code unless you want copy tweaks.

---

## What was built

| File | Purpose |
|------|---------|
| `tools/glow-map.html` | Full pilot: intro landing → interactive Glow Map → personalized read + CTAs (First Flight, Solo, Intensive) |

**Features**
- No login, no Supabase (scores save in the visitor’s browser only)
- Intro explains the tool; “Start” opens the map
- Completion screen highlights dim/bright areas + three next-step cards
- Discount codes: **IMREADY** (First Flight), **SOLO50** (Solo)
- Return link: `?start=1` skips intro if they’ve been before

---

## What you need to do (I cannot do these for you)

### 1. Deploy the static files

Upload/push the site repo so these files are on your live host:

- `tools/glow-map.html` **(required)**
- `bird-logo.png` at site root **(already there — nav uses `../bird-logo.png`)**

**If you use GitHub Pages / Cloudflare Pages from this folder:** commit and push; wait for the deploy to finish.

**If you deploy manually (FTP, etc.):** copy the whole `tools/` folder into the same directory as `index.html` on the server.

### 2. Verify the live URL

Open in a browser (ideally logged out / incognito):

**https://lilbird.life/tools/glow-map.html**

Checklist:
- [ ] Intro loads; logo shows in nav
- [ ] “Start your Glow Map” → sliders + chart update
- [ ] “See my read” → insight + three CTA buttons work
- [ ] Calendly First Flight link opens
- [ ] Solo link opens `https://lilbird.life/solo/`
- [ ] Intensive link opens `book.html#intensive`
- [ ] Refresh page — scores should still be there (localStorage)
- [ ] “Start over” resets sliders

### 3. Confirm discount codes in Stripe / Calendly

The page displays **IMREADY** and **SOLO50**. You need those promotions active wherever checkout happens — I can’t verify your Stripe/Calendly setup from here.

### 4. (Optional) Add to sitemap

After deploy, add to `sitemap.xml`:

```xml
  <url>
    <loc>https://lilbird.life/tools/glow-map.html</loc>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
```

Then redeploy. Helps Google; not required for sharing on social/email.

### 5. (Optional) Link from homepage pathfinder

In `index.html`, add a pathfinder row pointing to `tools/glow-map.html` when you’re ready to promote it site-wide. Not required for the pilot — you can share the direct URL first.

### 6. Share the link

**Canonical share URL:**  
`https://lilbird.life/tools/glow-map.html`

**Skip intro (return visitors):**  
`https://lilbird.life/tools/glow-map.html?start=1`

**UTM example (Instagram):**  
`https://lilbird.life/tools/glow-map.html?utm_source=instagram&utm_medium=social&utm_campaign=glow-map`

Track UTMs in whatever analytics you use (Cloudflare, Plausible, etc.) — not wired in the HTML by default.

---

## What I did *not* include (by design)

- Email capture / Beehiiv gate
- Supabase cloud save
- Homepage pathfinder entry (your call when to promote)
- OG image unique to Glow Map (uses `bird-logo.png` like other pages)

Say the word if you want any of those added later.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| 404 on `/tools/glow-map.html` | `tools/` folder not deployed | Push/copy `tools/glow-map.html` |
| Broken logo | `bird-logo.png` missing at root | Ensure root logo exists (same as homepage) |
| `book.html#intensive` 404 | Wrong relative path on host | Should work if `book.html` lives at site root like `index.html` |
| Page works locally but not live | Old deploy / CDN cache | Hard refresh or purge Cloudflare cache |

---

*Built May 2026 · lil' bird coaching*
