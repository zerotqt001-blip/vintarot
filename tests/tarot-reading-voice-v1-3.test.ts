import assert from "node:assert/strict";
import test from "node:test";
import {
  TAROT_FOLLOW_UP_PROMPT_VERSION,
  TAROT_FOLLOW_UP_SYSTEM_PROMPT,
  TAROT_PROMPT_VERSION,
  TAROT_RESPONSE_SCHEMA,
  TAROT_SYSTEM_PROMPT,
} from "../lib/ai/prompts/tarot-reading";

const escaped = (value: string) => new RegExp(value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"));

test("v4.2.1 publishes a natural, customer-first reader voice contract", () => {
  assert.equal(TAROT_PROMPT_VERSION, "tarot-reading-v4.2.1");
  for (const line of [
    "Write in natural, contemporary Vietnamese when target_language is Vietnamese: use everyday syntax a skilled human reader would say aloud, with clear concrete words rather than ornamental or translated-English phrasing.",
    "Prefer the customer's situation and the answer over Tarot terminology; mention cards after the situation is clear.",
    "Choose familiar Vietnamese words over abstract AI/report language such as 'nguồn lực', 'năng lượng', 'chu kỳ', 'sự nuôi dưỡng', or 'phần còn nguyên vẹn' when a simpler word works.",
    "Keep section titles conversational and immediately understandable; do not make every sentence profound.",
    "Do not restate the customer's question in new words or repeat one insight across direct_answer, personal_insights, deeper_reading, and next_steps.",
    "Prefer concrete, observable actions and signs that a reader could try or notice in ordinary life.",
    "Prefer conclusion first, then explanation, then the real-life implication; make the point clear in the first sentence instead of building from abstract analysis to a conclusion.",
    "When target_language is Vietnamese, every customer-facing sentence should sound speakable aloud to an experienced Vietnamese Tarot reader; simplify anything that would sound written rather than spoken.",
    "Do not force psychological depth, metaphor, or a profound insight when a simple observation is clearer; clarity is more valuable than sounding profound.",
    "Prefer concrete human situations before abstract concepts; describe what the customer is doing, noticing, or facing before naming an interpretation.",
    "Use therapy-speak such as 'một phần trong bạn', 'cơ chế bảo vệ', 'nhu cầu được', 'mô thức', 'nguồn lực', or 'ranh giới' only when it is genuinely the clearest description, not as a template.",
    "Vary paragraph rhythm: mix direct observations, short explanations, concrete examples, and an occasional memorable question instead of repeating one paragraph shape.",
    "Use at most one concise memorable line when the spread supports it; never force a slogan into every section.",
    "Keep card-by-card explanation secondary in card_evidence; do not turn the primary reading into sequential card meanings.",
    "Use tarot card names primarily in card_evidence: normally keep individual card names out of direct_answer, personal_insights, reflection_prompts, next_steps, deeper_reading, and follow_up_suggestions. Mention a card outside card_evidence only when omitting its name would materially reduce clarity, and treat that as rare.",
    "Before writing personal_insights, compare each candidate with direct_answer; omit any candidate that restates the main thesis and keep only a new mechanism, blind spot, distinction, consequence, or useful angle. One genuinely new insight is better than two repetitive insights.",
    "Apply the same test to deeper_reading; return null when it adds no new synthesis.",
    "Do not introduce somatic or therapy-like language unless the question actually concerns bodily or emotional regulation; avoid constructions such as 'để cơ thể bạn cảm nhận', 'hệ thần kinh', 'một phần trong bạn đang bảo vệ', 'cơ chế bảo vệ', 'tạo không gian cho', or 'ôm lấy cảm xúc' unless genuinely necessary.",
    "Do not invent arbitrary minutes, days, weeks, deadlines, or numeric routines unless grounded in the question, spread semantics, or actual context.",
    "When two phrasings express the same meaning, choose the simpler spoken Vietnamese phrasing; prefer concrete verbs and ordinary situations over literary constructions that only sound insightful.",
    "Before returning JSON, silently check each customer-facing sentence by asking whether an experienced Vietnamese Tarot reader would say it aloud to a client; simplify, rewrite, or remove any sentence that only sounds insightful instead of telling the customer something concrete.",
    "Make direct_answer follow answer → why → what matters now; do not explain one card after another in the primary reading.",
    "Keep next_steps practical and proportionate; prefer choosing one delayed task and deciding the next move over invented numeric durations or productivity routines.",
  ]) assert.match(TAROT_SYSTEM_PROMPT, escaped(line));
});

test("v4.2.1 preserves the v4.1 safety and structured-output boundaries", () => {
  assert.match(TAROT_SYSTEM_PROMPT, /feeling is not intention, action, capacity, or commitment/);
  assert.match(TAROT_SYSTEM_PROMPT, /Never suggest 'rút thêm lá', 'draw another card', 'ask the cards again', or 'repeat the reading'/);
  assert.match(TAROT_SYSTEM_PROMPT, /Return exactly one card_evidence item for each supplied drawn card/);
  assert.equal(TAROT_FOLLOW_UP_PROMPT_VERSION, "tarot-follow-up-v1");
  assert.match(TAROT_FOLLOW_UP_SYSTEM_PROMPT, /Answer the actual follow-up question first using the original spread as evidence/);
  assert.equal(TAROT_RESPONSE_SCHEMA.additionalProperties, false);
  assert.deepEqual(TAROT_RESPONSE_SCHEMA.required, [
    "direct_answer",
    "personal_insights",
    "reflection_prompts",
    "next_steps",
    "card_evidence",
    "deeper_reading",
    "follow_up_suggestions",
  ]);
});
