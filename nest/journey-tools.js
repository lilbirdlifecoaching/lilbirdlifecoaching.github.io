/**
 * Tools for the Tangle.
 * Fifteen exercises, each with its own questions.
 * Searching, recommending, and opening a link all happen on the page.
 * Recommendation text is not sent anywhere and is not a saved reflection.
 */

const BROAD_IDS = ['boundary-untangler', 'decision-clarity', 'energy-inventory'];
const STRONG_MATCH = 3;

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'myself', label: 'Myself' },
  { id: 'change', label: 'Change & Decisions' },
  { id: 'rhythms', label: 'Life Rhythms' },
  { id: 'family', label: 'Family' },
  { id: 'work', label: 'Work & Purpose' },
];

function stage(key, label, title, prompt, placeholder, optional) {
  return {
    key,
    label,
    title,
    prompt,
    placeholder,
    optional: optional === true,
  };
}

function tool(spec) {
  return spec;
}

export const TOOLS = [
  tool({
    id: 'boundary-untangler',
    version: 1,
    title: 'Boundary Untangler',
    category: 'relationships',
    minutes: '5 to 10 minutes',
    description: 'Name a difficult boundary, what makes it hard, what you need, a kinder way to hold it, and one step you can actually take.',
    intro: 'A boundary is a small clear line, not a wall. Take this slowly. You can close it without saving.',
    completionTitle: 'A little more clarity.',
    completionLead: 'You\'ve taken a moment to untangle something that matters. Here\'s what you\'ve discovered, and one small step you might take from here.',
    detailKey: 'boundary',
    fallbackQuestion: 'What would make that step possible this week?',
    reflectAim: 'They practiced naming a boundary and a small step.',
    phrases: ['say no', 'texts at night', 'after hours', 'boundary', 'limit', 'people pleasing', 'overcommitted', 'work chat', 'boss texts'],
    stages: [
      stage('situation', 'Situation', 'Where does this feel tangled?', 'Who is this with, and what keeps happening?', 'A person, and the pattern between you...'),
      stage('difficulty', 'Difficulty', 'What makes it hard?', 'What gets in the way of saying what you need?', 'The worry, the habit, the loyalty...'),
      stage('need', 'Need', 'What do you need underneath?', 'Under the friction, what are you actually needing?', 'Rest, respect, time, clarity...'),
      stage('boundary', 'Boundary', 'What boundary could you hold?', 'Say it in a way that is clear and still kind.', 'I can... and I will not...'),
      stage('nextStep', 'Next step', 'What is one realistic step?', 'One thing you could do in the next week. Small enough to happen.', 'One action, with a time...'),
    ],
  }),
  tool({
    id: 'communication-reset',
    version: 1,
    title: 'Communication Reset',
    category: 'relationships',
    minutes: 'about 8 minutes',
    description: 'Look again at a conversation that snagged, and find one sentence you could try.',
    intro: 'Most tangles start as a sentence that landed somewhere it was not aimed. This is a chance to hear it again, including the part you meant.',
    completionTitle: 'A sentence you can live with.',
    completionLead: 'You do not have to send anything today. Here is the conversation as you see it now, and one small way back in.',
    detailKey: 'sentence',
    fallbackQuestion: 'When would that sentence be kind to say, and when would it be kinder to wait?',
    reflectAim: 'They looked at a stuck conversation and chose one sentence or pause.',
    phrases: ['wrong thing', 'argument', 'misunderstood', 'what i said', 'fight', 'apology', 'we argued', 'conversation'],
    stages: [
      stage('said', 'What was said', 'What actually got said?', 'Stay with one conversation. What words do you remember, from you or from them?', 'The line that is still ringing...'),
      stage('meant', 'What you meant', 'What were you trying to reach?', 'Under the wording, what did you want them to understand?', 'The care, the worry, the ask...'),
      stage('heard', 'What they may have heard', 'If you stand in their place, what might have landed?', 'This is a guess, not a verdict. What could it have sounded like from over there?', 'Maybe they heard...'),
      stage('unsaid', 'Left unsaid', 'What do you wish had been said?', 'Only if something is still waiting. You can leave this blank.', 'A line you did not get to...', true),
      stage('sentence', 'A sentence to try', 'What is one sentence you could offer next?', 'Short enough to say out loud. You are not required to send it.', 'I want you to know...'),
      stage('nextStep', 'Next step', 'What is the next small move?', 'A pause, a message, or a time to talk. One move, not the whole repair.', 'This week I could...'),
    ],
  }),
  tool({
    id: 'connection-check',
    version: 1,
    title: 'Connection Check',
    category: 'relationships',
    minutes: 'about 8 minutes',
    description: 'Notice where a relationship feels close, where it feels thin, and one way to reach toward it.',
    intro: 'This is not a scorecard for someone you love. It is a quiet look at the space between you, and whether you want to cross a little of it.',
    completionTitle: 'The space between you.',
    completionLead: 'Closeness changes temperature. Here is what you noticed, and one way to reach if you still want to.',
    detailKey: 'want',
    fallbackQuestion: 'What would make that reach feel welcome, to you and to them?',
    reflectAim: 'They checked the warmth and distance in one relationship.',
    phrases: ['feel distant', 'drifted apart', 'closeness', 'miss them', 'lonely in it', 'partner feels far', 'friendship faded'],
    stages: [
      stage('who', 'Who', 'Who are you checking in on?', 'One person. A partner, a friend, someone you keep meaning to call.', 'Their name, and how you know them...'),
      stage('warmth', 'Warmth', 'Where does this still feel warm?', 'A recent moment, a habit, a way they show up. Even a small one counts.', 'I felt close when...'),
      stage('distance', 'Distance', 'Where does it feel thin?', 'Rushed, polite, far, or simply quiet. Name the texture, not a blame.', 'It feels thin when...'),
      stage('miss', 'A moment you miss', 'What do you miss, if anything?', 'Leave this blank if nothing specific comes.', 'I miss...', true),
      stage('want', 'What you want more of', 'What would you like more of here?', 'Not a demand. A direction. Time, play, truth, ease.', 'More of...'),
      stage('nextStep', 'Next step', 'What is one way to reach toward them?', 'Small enough for this week. An invitation, a question, a little time.', 'I could...'),
    ],
  }),
  tool({
    id: 'expectations-audit',
    version: 1,
    title: 'Expectations Audit',
    category: 'relationships',
    minutes: 'about 8 minutes',
    description: 'Sort what has been said from what has only been assumed, and choose a fairer version.',
    intro: 'Expectations get heavy when they stay unspoken. This is a look at one of them, and whether it still fits the relationship you actually have.',
    completionTitle: 'Said, assumed, and chosen.',
    completionLead: 'You get to keep, soften, or set down an expectation. Here is the one you examined, and a next step that is yours.',
    detailKey: 'fair',
    fallbackQuestion: 'Who else, if anyone, needs to hear the version you chose?',
    reflectAim: 'They examined one expectation and whether it is fair.',
    phrases: ['unspoken rules', 'they expect', 'always available', 'assumed', 'shoulds', 'let down', 'disappointed them'],
    stages: [
      stage('expectation', 'The expectation', 'What expectation is in the room?', 'Yours, or one you feel coming toward you. Say it in one plain line.', 'I am supposed to... or they are supposed to...'),
      stage('spoken', 'Spoken or silent', 'Has anyone said this out loud?', 'If it has only been implied, say that. Silent expectations still take up space.', 'We said it when... or we never did...'),
      stage('fair', 'Does it fit', 'Does this fit the relationship you actually have?', 'Too big, about right, or left over from somewhere else. Your read is allowed.', 'This fits because... or it does not, because...'),
      stage('origin', 'Where it came from', 'Where might this expectation have started?', 'A family habit, a workplace, a story you tell yourself. Optional.', 'It might come from...', true),
      stage('kinder', 'A kinder version', 'How would you say it so both of you could hear it?', 'Clear, and still human. You can change it or keep it.', 'What I can offer is...'),
      stage('nextStep', 'Next step', 'What will you do with this expectation?', 'Say it, shrink it, or stop carrying the silent version. One move.', 'This week I will...'),
    ],
  }),
  tool({
    id: 'shadows-sparks',
    version: 1,
    title: 'Shadows & Sparks',
    category: 'myself',
    minutes: 'about 10 minutes',
    description: 'Name what fear pushes you toward, and what aliveness pulls you toward.',
    intro: 'Fear pushes from behind. Care pulls from the front. Neither makes you wrong. Both tell you something useful about how you move.',
    completionTitle: 'What pushes, and what pulls.',
    completionLead: 'You named a shadow and a spark. The spark does not have to win the whole week. It only needs a little room.',
    detailKey: 'spark',
    fallbackQuestion: 'What would the spark notice if you gave it that small room?',
    reflectAim: 'They named a fear-based pull and a life-giving one.',
    phrases: ['shrink myself', 'fear and passion', 'hide', 'people pleaser', 'what lights me up', 'shadow', 'spark', 'avoid a feeling'],
    stages: [
      stage('shadow', 'Shadow', 'What do you do to avoid a feeling?', 'A habit that keeps something away. Performing, hiding, rushing, staying quiet.', 'When I am afraid, I...'),
      stage('protects', 'What it protects', 'What is that part trying to keep safe?', 'It learned this somewhere. You do not have to fire it. Just see it.', 'It is trying to protect...'),
      stage('spark', 'Spark', 'Where do you feel more like yourself?', 'A place, a task, a person, a kind of afternoon. Follow the aliveness.', 'I feel like myself when...'),
      stage('seen', 'Who sees it', 'Who has seen that spark, even once?', 'Leave this blank if you would rather keep it to yourself.', 'They saw it when...', true),
      stage('needs', 'What the spark needs', 'What would give that spark a little room?', 'Time, permission, a table, a closed door. Something concrete.', 'It would need...'),
      stage('nextStep', 'Next step', 'How will you make a little room this week?', 'Smaller than a new life. Large enough to notice.', 'I will...'),
    ],
  }),
  tool({
    id: 'identity-reflection',
    version: 1,
    title: 'Identity Reflection',
    category: 'myself',
    minutes: 'about 8 minutes',
    description: 'Set a role you are wearing next to the part of you that remains when the role is quiet.',
    intro: 'Roles are useful coats. This is a few minutes to feel what is still you when the coat comes off, even if you put it back on tomorrow.',
    completionTitle: 'The role, and what remains.',
    completionLead: 'You do not have to leave a role to notice yourself inside it. Here is what you found, and one way to keep a thread of it.',
    detailKey: 'remains',
    fallbackQuestion: 'Where in an ordinary day could that part of you have a little room?',
    reflectAim: 'They looked at a role they wear and what remains beside it.',
    phrases: ['who am i', 'outside this role', 'not just a parent', 'job title', 'lost myself', 'only a caregiver', 'identity'],
    stages: [
      stage('role', 'The role', 'Which role are you wearing most these days?', 'Parent, partner, the reliable one, the new person, the one who holds it together.', 'The role is...'),
      stage('asks', 'What it asks', 'What does that role expect of you?', 'List the weight of it in ordinary language.', 'It asks me to...'),
      stage('remains', 'What remains', 'When the role is quiet, what is still you?', 'A curiosity, a temper, a tenderness, a way of seeing. Not a brand.', 'Still me: ...'),
      stage('keep', 'A quality to keep', 'What do you want to keep even if the role changes?', 'Optional. One quality is enough.', 'I want to keep...', true),
      stage('nextStep', 'Next step', 'How will you let that part show, once, this week?', 'A conversation, a half hour, a choice that sounds like you.', 'I will...'),
    ],
  }),
  tool({
    id: 'courage-compass',
    version: 1,
    title: 'Courage Compass',
    category: 'myself',
    minutes: 'about 8 minutes',
    description: 'Face one brave edge: what calls you, what holds you, what you can leave, and what you need.',
    intro: 'Courage here is not a performance. Four directions are enough. Where you want to go, what holds you, what you are leaving, and what you need for the road.',
    completionTitle: 'A direction, not a leap.',
    completionLead: 'You do not have to cross the whole distance. You have a direction, and one step that counts as moving.',
    detailKey: 'toward',
    fallbackQuestion: 'What would tell you, gently, that the step had happened?',
    reflectAim: 'They oriented toward something brave and chose a small move.',
    phrases: ['scared to', 'crossroads', 'brave', 'holding me back', 'afraid to start', 'courage', 'leap'],
    stages: [
      stage('toward', 'Toward', 'Where do you want to go?', 'Name the direction, even if the map is fuzzy.', 'I am moving toward...'),
      stage('holds', 'What holds you', 'What is holding you back?', 'A fear, a loyalty, a practical snag. Name it without arguing with it.', 'I stall because...'),
      stage('leave', 'Leaving behind', 'What would you be leaving behind?', 'A story, a pace, a version of you that has worked hard. It can still be thanked.', 'I would be leaving...'),
      stage('need', 'For the road', 'What do you need with you?', 'A person, a skill, a rest, a fact. Optional if you are not sure yet.', 'I would want...', true),
      stage('nextStep', 'Next step', 'What is one step that shows something is moving?', 'Small enough to do while you are still nervous.', 'The step is...'),
    ],
  }),
  tool({
    id: 'decision-clarity',
    version: 1,
    title: 'Decision Clarity',
    category: 'change',
    minutes: 'about 10 minutes',
    description: 'Lay two options side by side and name what you already know, before you force a choice.',
    intro: 'You do not have to decide the whole thing today. Clarity often starts by telling the truth about what each option feels like, and what you already know.',
    completionTitle: 'What you already know.',
    completionLead: 'A decision can wait. What you noticed does not have to. Here are the two paths as they feel now, and one next piece of learning.',
    detailKey: 'known',
    fallbackQuestion: 'What would that next step teach you that you do not know yet?',
    reflectAim: 'They compared options and named what they already know.',
    phrases: ['cant decide', 'two options', 'whether to leave', 'stay or go', 'choice', 'stuck between', 'should i'],
    stages: [
      stage('decision', 'The decision', 'What choice is in front of you?', 'Say it as a fork, not a failure. Staying as you are can be one of the paths.', 'I am choosing between...'),
      stage('optionA', 'One path', 'What does the first path feel like?', 'Costs, reliefs, and the texture of an ordinary Tuesday on that path.', 'This path feels like...'),
      stage('optionB', 'The other path', 'What does the other path feel like?', 'Give it the same kindness. Include staying put, if that is the other path.', 'The other feels like...'),
      stage('known', 'Already known', 'What do you already know, even if you are not ready to choose?', 'A value, a limit, a fact that has stopped being a question.', 'I already know...'),
      stage('waiting', 'Waiting to feel', 'What are you hoping a feeling will settle?', 'Optional. Sometimes we wait for certainty that will not arrive first.', 'I keep waiting to feel...', true),
      stage('nextStep', 'Next step', 'What is one thing you can learn or ask before you choose?', 'A conversation, a number, a trial week. Not the final verdict.', 'Before I choose, I will...'),
    ],
  }),
  tool({
    id: 'transition-map',
    version: 1,
    title: 'Transition Map',
    category: 'change',
    minutes: 'about 8 minutes',
    description: 'Name what is ending, what you are in the middle of, and what you want to carry.',
    intro: 'Change has an ending, a messy middle, and a beginning that does not arrive all at once. You only need to notice where you are.',
    completionTitle: 'Ending, middle, and a beginning.',
    completionLead: 'You do not have to be finished to know what you are carrying. Here is the map as it looks today.',
    detailKey: 'carry',
    fallbackQuestion: 'What would it look like to carry that with you, just for this week?',
    reflectAim: 'They mapped an ending, a middle, and something to carry.',
    phrases: ['in between', 'starting over', 'what is ending', 'new chapter', 'moving on', 'transition', 'limbo'],
    stages: [
      stage('ending', 'Ending', 'What is ending?', 'A role, a place, a way of being known. Even a quiet ending counts.', 'What is ending is...'),
      stage('middle', 'The middle', 'What are you in the middle of?', 'The part that is neither the old shape nor the new one.', 'Right now I am...'),
      stage('carry', 'Carry with you', 'What do you want to carry into what is next?', 'A skill, a friendship, a way you want to treat yourself.', 'I want to bring...'),
      stage('leave', 'Leave behind', 'What are you allowed to leave behind?', 'Optional. Leaving something is not the same as calling it a waste.', 'I can leave...', true),
      stage('nextStep', 'Next step', 'What is one sign you could tend this week?', 'Not the whole next chapter. A phone call, a box, a boundary, a rest.', 'This week I will...'),
    ],
  }),
  tool({
    id: 'energy-inventory',
    version: 1,
    title: 'Energy Inventory',
    category: 'rhythms',
    minutes: 'about 8 minutes',
    description: 'Notice what filled you, what drained you, and one place energy is leaking.',
    intro: 'Energy is not a moral score. Some things fill the well. Some things spend it. This is a look at a recent stretch of days, not your whole character.',
    completionTitle: 'What fills, and what spends.',
    completionLead: 'You do not need a new personality. You need a slightly kinder proportion. Here is what you noticed.',
    detailKey: 'leak',
    fallbackQuestion: 'What would make that step likely on a tired day, not only on a good one?',
    reflectAim: 'They named what fills them, what drains them, and one leak.',
    phrases: ['exhausted', 'drained', 'burned out', 'no energy', 'tired all the time', 'what fills me', 'depleted'],
    stages: [
      stage('filled', 'Filled you', 'What filled you recently?', 'A task, a person, a kind of quiet. Something from real days, not an ideal week.', 'I felt fuller when...'),
      stage('drained', 'Drained you', 'What spent you?', 'Be specific. A meeting, a tone, a time of day, a kind of helping.', 'I felt spent after...'),
      stage('leak', 'A leak', 'Where does energy leak on repeat?', 'A pattern, not a one-off. The thing you agree to and then resent.', 'The leak is...'),
      stage('postponed', 'A postponed fill', 'What fill have you been postponing?', 'Optional. A walk, a friend, a piece of work you actually like.', 'I keep postponing...', true),
      stage('nextStep', 'Next step', 'What will you protect or shrink this week?', 'One fill you will guard, or one drain you will make smaller.', 'I will...'),
    ],
  }),
  tool({
    id: 'rhythm-reset',
    version: 1,
    title: 'Rhythm Reset',
    category: 'rhythms',
    minutes: 'about 8 minutes',
    description: 'Look at the shape of your days and change one small part of the rhythm.',
    intro: 'A life picks up a tempo. This is not a new schedule for the rest of the year. It is a look at how your days actually go, and one beat you might move.',
    completionTitle: 'The shape of a day.',
    completionLead: 'Rhythm changes by a notch, not a speech. Here is the shape you described, and the one change you chose.',
    detailKey: 'quiet',
    fallbackQuestion: 'Which day this week is the fairest trial for that change?',
    reflectAim: 'They looked at the shape of their days and chose one rhythm change.',
    phrases: ['no routine', 'rushed mornings', 'shape of my week', 'evenings disappear', 'out of rhythm', 'chaotic week', 'bedtime'],
    stages: [
      stage('days', 'How days go', 'How do your days actually go?', 'Morning to evening, in the life you have, not the one on a blank calendar.', 'A usual day looks like...'),
      stage('rushed', 'Rushed', 'Which part feels rushed?', 'Name the hour or the handoff. Rush has an address.', 'The rush is...'),
      stage('quiet', 'A quieter pocket', 'Where could a little quiet fit?', 'Even ten minutes. A pocket that is real, not theoretical.', 'Quiet could fit...'),
      stage('old', 'A rhythm you liked', 'What rhythm used to suit you?', 'Optional. A clue, not a command to go backward.', 'I used to...', true),
      stage('nextStep', 'Next step', 'What one change will you try, this week only?', 'One beat. A start time, a walk, a closed laptop, a slower morning once.', 'This week I will...'),
    ],
  }),
  tool({
    id: 'rest-or-escape',
    version: 1,
    title: 'Rest or Escape?',
    category: 'rhythms',
    minutes: 'about 8 minutes',
    description: 'Tell the difference between rest that restores you and a doorway out of something hard.',
    intro: 'Sometimes rest gives you back to yourself. Sometimes it is a way out of something you are not ready to face. Both are human. This is a curious look, not a scolding.',
    completionTitle: 'Rest that gives you back.',
    completionLead: 'You get to want relief. You also get to notice what kind. Here is what you found, and one restoring rest you can actually take.',
    detailKey: 'restores',
    fallbackQuestion: 'What would make that rest easy to start, before the doorway out looks easier?',
    reflectAim: 'They separated restoring rest from a way of stepping out.',
    phrases: ['scrolling', 'doomscroll', 'numbing', 'cant rest', 'binge', 'avoiding', 'checked out', 'phone at night'],
    stages: [
      stage('reached', 'What you reached for', 'What did you reach for when you wanted rest?', 'A screen, a nap, a drink, a task, a disappearance. Name the real thing.', 'I reached for...'),
      stage('after', 'Afterward', 'How did you feel after?', 'Restored, flatter, further away, or some mix. No grade.', 'Afterward I felt...'),
      stage('away', 'Stepping away from', 'What might you have been stepping away from?', 'A feeling, a task, a conversation. If you do not know, say that.', 'I may have been leaving...'),
      stage('restores', 'Rest that restores', 'What kind of rest actually gives you back to yourself?', 'Be concrete. A length of time, a place, a way of stopping.', 'Real rest for me is...'),
      stage('signal', 'A signal', 'What is a signal that you needed care, not a vanishing?', 'Optional. A tight chest, a sharp tone, a third cup, a silent room.', 'I can tell because...', true),
      stage('nextStep', 'Next step', 'What restoring rest will you take, and when?', 'Name the day and a rough time. Small enough to happen.', 'I will rest by...'),
    ],
  }),
  tool({
    id: 'family-expectations',
    version: 1,
    title: 'Family Expectations',
    category: 'family',
    minutes: 'about 8 minutes',
    description: 'Hear an old family expectation, then decide what you believe about it now.',
    intro: 'Families hand us lines we did not write. Some still fit. Some are echoes. This is a chance to hear one line, and choose what you believe now.',
    completionTitle: 'The line, and what you believe now.',
    completionLead: 'You can love people and still edit the sentence they handed you. Here is the one you looked at, and a step that stays kind.',
    detailKey: 'now',
    fallbackQuestion: 'Do you need to say this to anyone, or is it enough that you know it?',
    reflectAim: 'They revisited a family expectation and chose what they believe now.',
    phrases: ['my parents expect', 'family pressure', 'mum wants', 'dad wants', 'growing up', 'good child', 'family should', 'obligation'],
    stages: [
      stage('line', 'The expectation', 'What family expectation still has a voice?', 'Say the line the way you hear it in your head.', 'The line is...'),
      stage('whose', 'Whose voice', 'Whose voice does it sound like?', 'A parent, a grandparent, a whole table. It might be more than one.', 'It sounds like...'),
      stage('now', 'What you believe now', 'What do you believe about it now?', 'You may agree with part of it. You may not. Both can be said.', 'Now I believe...'),
      stage('instead', 'What you would pass on', 'What would you rather pass on?', 'Optional. To a child, a niece, or your own future self.', 'I would rather they hear...', true),
      stage('nextStep', 'Next step', 'What is one way you will live your version this week?', 'A sentence you keep, a visit you shape, a no you say gently.', 'I will...'),
    ],
  }),
  tool({
    id: 'responsibility-inventory',
    version: 1,
    title: 'Responsibility Inventory',
    category: 'family',
    minutes: 'about 8 minutes',
    description: 'Sort what is truly yours from what you picked up for someone else.',
    intro: 'Care can quietly become carrying. This is a sort: what is yours, what you picked up, and one thing you might set down without abandoning anyone.',
    completionTitle: 'Yours, and not only yours.',
    completionLead: 'Setting something down is not the same as not loving someone. Here is the sort you made, and one thing you will stop holding alone.',
    detailKey: 'picked',
    fallbackQuestion: 'What would you say, kindly, if someone notices you are not holding that anymore?',
    reflectAim: 'They sorted their responsibilities from what they picked up for others.',
    phrases: ['carry everything', 'picked it up', 'not mine to hold', 'eldest', 'i do it all', 'family load', 'resentful care'],
    stages: [
      stage('yours', 'Truly yours', 'What is truly yours to carry?', 'A duty you still claim. Be specific, and fair to yourself.', 'Mine to carry: ...'),
      stage('picked', 'Picked up', 'What did you pick up for someone else?', 'A task, a feeling, a role that was never formally yours.', 'I picked up...'),
      stage('ifdown', 'If you set it down', 'What happens if you set one thing down?', 'The fear, and also what might become possible. Both.', 'If I set it down...'),
      stage('who', 'Who else', 'Who might carry their own part?', 'Optional. A person who is more able than the story says.', 'They could carry...', true),
      stage('nextStep', 'Next step', 'What is one thing you will stop holding alone this week?', 'Name it, and how you will say so if you need to.', 'I will set down...'),
    ],
  }),
  tool({
    id: 'workload-reset',
    version: 1,
    title: 'Workload Reset',
    category: 'work',
    minutes: 'about 8 minutes',
    description: 'Look at what is on your plate, what actually needs you, and what can wait, shrink, or be shared.',
    intro: 'A full plate is not the same as a meaningful one. This is a sort of the work in front of you, so the next step is about the work, not about becoming endless.',
    completionTitle: 'The work that needs you.',
    completionLead: 'You do not have to finish the list to tell the truth about it. Here is what you sorted, and one move.',
    detailKey: 'needs',
    fallbackQuestion: 'Who or what would make that move possible before the list grows back?',
    reflectAim: 'They sorted a workload into what needs them and what can wait or be shared.',
    phrases: ['too much work', 'on my plate', 'overloaded', 'cant keep up', 'deadline pile', 'asking for help', 'scope'],
    stages: [
      stage('plate', 'On the plate', 'What is actually on your plate?', 'The real list, including the invisible coordination. A sketch is enough.', 'On my plate: ...'),
      stage('needs', 'Needs you', 'What actually needs you?', 'The part that uses your particular care, skill, or yes. Not everything that has your name on it.', 'This needs me: ...'),
      stage('wait', 'Wait, shrink, or share', 'What could wait, shrink, or be shared?', 'Name at least one. Perfect fairness is not required.', 'This could...'),
      stage('for', 'What it is for', 'What is this work for, beyond the list?', 'Optional. A person, a craft, a reason that still matters.', 'Beyond the list, it is for...', true),
      stage('nextStep', 'Next step', 'What will you move, pause, or ask about?', 'One item. A sentence to a person counts.', 'I will...'),
    ],
  }),
];

const BY_ID = new Map(TOOLS.map((item) => [item.id, item]));

export function categoryLabel(id) {
  const found = CATEGORIES.find((item) => item.id === id);
  return found ? found.label : '';
}

export function toolById(id) {
  return BY_ID.get(String(id || '').trim().toLowerCase()) || null;
}

export function boundaryTool() {
  return toolById('boundary-untangler');
}

export function normalizeSearch(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toolHaystack(item) {
  return normalizeSearch([
    item.title,
    item.description,
    item.intro,
    categoryLabel(item.category),
    item.phrases.join(' '),
  ].join(' '));
}

export function searchTools(query, categoryId) {
  const category = categoryId || 'all';
  const q = normalizeSearch(query);
  return TOOLS.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (!q) return true;
    const hay = toolHaystack(item);
    if (hay.includes(q)) return true;
    const words = q.split(' ').filter((word) => word.length > 2);
    return words.some((word) => hay.includes(word));
  });
}

function scoreTool(item, q) {
  let score = 0;
  const hay = toolHaystack(item);
  item.phrases.forEach((phrase) => {
    const clean = normalizeSearch(phrase);
    if (!clean) return;
    if (q.includes(clean)) score += clean.length > 8 ? 4 : 3;
  });
  q.split(' ').forEach((word) => {
    if (word.length < 4) return;
    if (normalizeSearch(item.title).includes(word)) score += 2;
    if (normalizeSearch(item.description).includes(word)) score += 1;
    if (hay.includes(word)) score += 1;
  });
  return score;
}

export function recommendTools(text) {
  const q = normalizeSearch(text);
  if (q.length < 3) return { status: 'empty', tools: [] };
  const ranked = TOOLS.map((item) => ({ item, score: scoreTool(item, q) }))
    .filter((entry) => entry.score >= STRONG_MATCH)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
  if (!ranked.length) {
    return { status: 'broad', tools: BROAD_IDS.map((id) => toolById(id)) };
  }
  return { status: 'matched', tools: ranked.slice(0, 3).map((entry) => entry.item) };
}

export function resolveToolLink(id) {
  const raw = String(id || '').trim().toLowerCase();
  if (!raw) return { ok: false, reason: 'missing' };
  if (!/^[a-z0-9-]{2,40}$/.test(raw)) return { ok: false, reason: 'invalid' };
  const found = toolById(raw);
  if (!found) return { ok: false, reason: 'unknown' };
  return { ok: true, tool: found };
}

export function reflectionView(row) {
  const source = row && typeof row === 'object' ? row : {};
  const answers = source.answers && typeof source.answers === 'object' && !Array.isArray(source.answers)
    ? source.answers
    : {};
  const found = toolById(source.tool_id);
  const fields = [];
  const seen = new Set();
  const stages = found ? found.stages : [];
  stages.forEach((item) => {
    seen.add(item.key);
    const value = String(answers[item.key] || '').trim();
    if (value) fields.push({ label: item.label, value });
  });
  Object.keys(answers).forEach((key) => {
    if (seen.has(key)) return;
    const value = String(answers[key] || '').trim();
    if (value) fields.push({ label: key, value });
  });
  const nextStep = String(answers.nextStep || source.next_step || '').trim();
  return {
    title: found ? found.title : 'Saved exercise',
    nextStep,
    insight: String(source.insight || '').trim(),
    fields,
  };
}
