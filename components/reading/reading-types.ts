import type { TarotLocale, TarotReadingPayload, TarotSupplementaryDraw } from "@/lib/ai/types";

export type ReadingArtwork = {
  src: string;
  alt: string;
};

export type ReadingFollowUp = {
  id: string;
  question: string;
  answer: string;
};

export type ReadingClarification = TarotSupplementaryDraw;

export type ReadingTranslator = (key: string) => string;

export type ReadingEvidence = TarotReadingPayload["cardEvidence"][number];
export type ReadingInsight = TarotReadingPayload["personalInsights"][number];
export type ReadingNextStep = TarotReadingPayload["nextSteps"][number];

export type ReadingSessionMetadata = {
  question: string;
  readerName?: string | null;
  spreadName?: string | null;
  deckName?: string | null;
};

export type ReadingPanelProps = {
  reading: TarotReadingPayload | null;
  locale: TarotLocale;
  session: ReadingSessionMetadata;
  artworkByReadingCardId: Record<string, ReadingArtwork>;
  t: ReadingTranslator;
  isLoading?: boolean;
  isSaving?: boolean;
  error?: string | null;
  onClose?: () => void;
  onSave?: () => void;
  onShare?: () => void | Promise<void>;
  isSharing?: boolean;
  shareUrl?: string | null;
  shareError?: string | null;
  onFollowUpSubmit?: (question: string) => Promise<string>;
  onClarificationSubmit?: (question: string) => Promise<ReadingClarification>;
  followUpResetKey?: number;
};
