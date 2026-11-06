# Cursor deploy note: career-change path (6 Nov 2026)

The site side is live on GitHub Pages. These steps update the Cloudflare workers so the Guide and the Journey coaching note match. Nothing here touches secrets.

## 1. `lilbird-chat` worker (My Guide + Journey reflect)

Copy these three repo files beside the worker source (iCloud `lilbird site/`), replacing the old copies:

- `nest/nest-guide.js`
- `nest/journey-tools.js`
- `nest/journey-reflect.js`

Keep the imports exactly as they are (`./journey-tools.js`, no `?v=`). Then redeploy `lilbird-chat`.

What changes:

- Guide prompt: says it is an AI guide; when someone plainly asks for a step it gives one small information-finding move (talk to someone who does the work, read three real job descriptions, a small trial) plus one question; it never suggests careers or job titles they have not named, and never writes CVs or applications.
- Urgent work/money pressure (just lost a job, income running out): no job-search, legal, financial, or benefits advice; it says 1:1 with Luke is the right next step and adds `[COACHING]`. The worker now returns `coaching: true`, and the page shows a "Work with Luke one to one" card linking to `/book.html#coaching`. Offered once per conversation (page sends `coachingOffered`).
- Safety line: if someone mentions harm to themselves or others, it points to emergency services or a crisis line instead.
- New tool `career-crossroads` (Career Crossroads) in the Guide's tool list and in the Journey library, so `/journey/reflect` can write a coaching note for it. Until redeploy, that tool falls back to the on-page note (it still saves).

Check after deploy: in My Guide, send "I just got made redundant and need income in 6 weeks". Expect a short reply plus the coaching card. Send "I want to change careers, give me one thing to do this week". Expect one small find-out step and one question.

## 2. `worker-solo` (Solo session AI)

Add this to the Solo session system prompt, below the existing coaching rules. Do not remove any existing guardrails.

```
When they plainly ask for something practical, give one small move first, then your one question. Make the move about finding something out, not deciding: a conversation with someone who does that work, reading a few real job descriptions, or a small trial this week, with a day attached. Do not suggest careers, job titles, or industries they have not named; work from their words. If they are under urgent pressure about work and money (job loss, income running out), do not coach a job search or give financial advice. Say that working with Luke one to one is the right next step.
```

Redeploy `worker-solo`. Check: in Session 2 (Vision & Goals), say "I have two hours a week, give me one practical step". Expect one concrete find-out step plus one question, not only more noticing.
