/**
 * Reflection helpers for Tools for the Tangle.
 * Used by the Nest page, the Nest worker, and node tests.
 * The worker never writes these answers. The page inserts a row only after Save.
 *
 * The live worker is still v1.28-journey and only accepts Boundary Untangler.
 * This file accepts all fifteen tools. Copy it, with journey-tools.js, beside
 * the worker on an approved deploy. Do not deploy it as part of the site review.
 */

import { boundaryTool, toolById } from './journey-tools.js';

export const BOUNDARY_UNTANGLER = {
  id: 'boundary-untangler',
  version: 1,
  title: 'Boundary Untangler',
};

const FIELD_MAX = 2000;
const ANSWERS_MAX = 12000;
const INSIGHT_MAX = 2000;
const NEXT_STEP_MAX = 500;

function specFor(tool) {
  if (tool && tool.stages) return tool;
  return boundaryTool();
}

export function clipText(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanAnswers(input, tool) {
  const spec = specFor(tool);
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const answers = {};
  spec.stages.forEach((stage) => {
    answers[stage.key] = clipText(source[stage.key], FIELD_MAX);
  });
  return answers;
}

export function stageValueOk(stage, value) {
  const text = clipText(value, FIELD_MAX);
  if (stage && stage.optional && !text) return true;
  return text.length >= 2;
}

export function answersReady(answers, tool) {
  const spec = specFor(tool);
  const clean = cleanAnswers(answers, spec);
  return spec.stages.every((stage) => stageValueOk(stage, clean[stage.key]));
}

export function fallbackInsight(answers, tool) {
  const spec = specFor(tool);
  const clean = cleanAnswers(answers, spec);
  if (spec.id === 'boundary-untangler') {
    const boundary = clipText(clean.boundary, 140);
    const step = clipText(clean.nextStep, 140);
    if (boundary && step) {
      return 'The boundary you named: "' + boundary + '". The step you chose: ' + step + '. What would make that step possible this week?';
    }
    if (step) {
      return 'The step you chose: ' + step + '. What would make that step possible this week?';
    }
    return 'You have a boundary and a next step on this page. What would make the next step possible this week?';
  }
  const step = clipText(clean.nextStep, 140);
  const detail = clipText(clean[spec.detailKey], 140);
  const question = spec.fallbackQuestion || 'What would make that step possible this week?';
  const stepSentence = /[.!?]$/.test(step) ? step : step + '.';
  if (detail && step) return '"' + detail + '". The step you chose: ' + stepSentence + ' ' + question;
  if (step) return 'The step you chose: ' + stepSentence + ' ' + question;
  return question;
}

export function buildInsertRow(userId, answers, insight, tool) {
  const spec = specFor(tool);
  const clean = cleanAnswers(answers, spec);
  const note = clipText(insight, INSIGHT_MAX);
  return {
    user_id: userId,
    tool_id: spec.id,
    tool_version: spec.version,
    answers: clean,
    insight: note || null,
    next_step: clipText(clean.nextStep, NEXT_STEP_MAX) || null,
  };
}

export function prepareJourneyReflect(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Missing exercise.', status: 400 };
  }
  const spec = toolById(body.toolId);
  if (!spec || Number(body.toolVersion) !== spec.version) {
    return { error: 'Unknown exercise.', status: 400 };
  }
  const answers = cleanAnswers(body.answers, spec);
  if (!answersReady(answers, spec)) {
    return { error: 'Finish each stage before asking for a reflection.', status: 400 };
  }
  if (JSON.stringify(answers).length > ANSWERS_MAX) {
    return { error: 'That exercise is too long to reflect on.', status: 413 };
  }
  return { answers, tool: spec };
}

export function journeyReflectPrompt(answers, tool) {
  const spec = specFor(tool);
  const clean = cleanAnswers(answers, spec);
  if (spec.id === 'boundary-untangler') {
    return [
      'Situation: ' + clean.situation,
      'What makes it hard: ' + clean.difficulty,
      'Underlying need: ' + clean.need,
      'Possible boundary: ' + clean.boundary,
      'Next step: ' + clean.nextStep,
    ].join('\n');
  }
  return spec.stages
    .filter((stage) => clean[stage.key])
    .map((stage) => stage.label + ': ' + clean[stage.key])
    .join('\n');
}

export const JOURNEY_REFLECT_SYSTEM = `You are lil' bird, a warm coaching guide.

Someone just finished a short boundary exercise. Write 2 or 3 sentences, 60 words maximum.
Use one specific detail from their words.
Ask one question about the next step they chose.
Do not give a list of advice. Do not diagnose. Do not tell them the boundary is wrong.
Plain words. No bullet points. No em dashes. Do not use the words honest, genuinely, or journey.`;

export function journeyReflectSystem(tool) {
  const spec = specFor(tool);
  if (spec.id === 'boundary-untangler') return JOURNEY_REFLECT_SYSTEM;
  return `You are lil' bird, a warm coaching guide.

Someone just finished a short exercise called ${spec.title}. ${spec.reflectAim}
Write 2 or 3 sentences, 60 words maximum.
Use one specific detail from their words.
Ask one question about the next step they chose.
Do not give a list of advice. Do not diagnose. Do not tell them their conclusion is wrong.
Plain words. No bullet points. No em dashes. Do not use the words honest, genuinely, or journey.`;
}

export async function handleJourneyReflect(ctx) {
  const { request, body, env, origin, respond, respondError, getAuthUser } = ctx;
  const user = await getAuthUser(request, env);
  if (!user?.id) return respondError('Please log in again.', 401, origin);

  const prepared = prepareJourneyReflect(body);
  if (prepared.error) return respondError(prepared.error, prepared.status, origin);

  const fallback = fallbackInsight(prepared.answers, prepared.tool);
  if (!env.ANTHROPIC_API_KEY) {
    return respond({ insight: fallback, degraded: true }, 200, origin);
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: journeyReflectSystem(prepared.tool),
        messages: [{ role: 'user', content: journeyReflectPrompt(prepared.answers, prepared.tool) }],
      }),
    });
    if (!res.ok) {
      console.error('journey/reflect model status', res.status);
      return respond({ insight: fallback, degraded: true }, 200, origin);
    }
    const data = await res.json();
    const insight = clipText(data.content?.[0]?.text, INSIGHT_MAX);
    if (!insight) return respond({ insight: fallback, degraded: true }, 200, origin);
    return respond({ insight, degraded: false }, 200, origin);
  } catch (e) {
    console.error('journey/reflect model unreachable');
    return respond({ insight: fallback, degraded: true }, 200, origin);
  }
}
