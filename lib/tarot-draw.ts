import type { TarotDrawPlanCard, TarotOrientation } from "./tarot-catalog";
import { z } from "zod";

export type DrawCardCandidate = {
  id: string;
  cardNumber: number;
};

export type DrawPositionCandidate = {
  id: string;
  key: string;
  order: number;
  label: string;
};

export type DrawPlanInput = {
  cards: DrawCardCandidate[];
  positions: DrawPositionCandidate[];
  reversals: boolean;
  random?: () => number;
};

export const drawRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  optional_context: z.string().trim().max(5000).optional().default(""),
  category_id: z.string().min(1).max(100),
  spread_template_id: z.string().min(1).max(100),
  deck_id: z.string().min(1).max(100),
  locale: z.enum(["en", "vi"]),
  reversals: z.boolean().optional().default(true),
});

export type DrawRequest = z.infer<typeof drawRequestSchema>;

export function parseDrawRequest(value: unknown): DrawRequest {
  return drawRequestSchema.parse(value);
}

function secureRandom(): number {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 0x1_0000_0000;
}

function readingCardId(): string {
  return globalThis.crypto.randomUUID?.() || `reading-card-${Date.now()}-${secureRandom().toString(36).slice(2)}`;
}

function orientation(reversals: boolean, random: () => number): TarotOrientation {
  return reversals && random() < 0.3 ? "reversed" : "upright";
}

export function makeDrawPlan({ cards, positions, reversals, random = secureRandom }: DrawPlanInput): TarotDrawPlanCard[] {
  if (!positions.length) throw new Error("A spread needs at least one position");
  if (cards.length < positions.length) throw new Error("The deck does not contain enough cards for this spread");

  const available = [...cards];
  for (let index = available.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.max(0, Math.min(0.999999999, random())) * (index + 1));
    [available[index], available[target]] = [available[target], available[index]];
  }

  return [...positions]
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .map((position, positionIndex) => {
      const card = available[positionIndex];
      return {
        readingCardId: readingCardId(),
        cardId: card.id,
        cardNumber: card.cardNumber,
        positionId: position.id,
        positionKey: position.key,
        positionOrder: position.order,
        positionLabel: position.label,
        orientation: orientation(reversals, random),
      };
    });
}
