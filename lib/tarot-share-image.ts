import { isApprovedCardImageUrl } from "./tarot-share-projection";
import type { PublicReadingView } from "./tarot-share-contract";

export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 800;

export type ShareImageRenderResult = {
  contentType: "image/svg+xml";
  bytes: Uint8Array;
  width: 1200;
  height: 800;
  rendererVersion: string;
};

export class ShareImageRenderError extends Error {
  readonly code = "share_image_render" as const;

  constructor(message: string) {
    super(message);
    this.name = "ShareImageRenderError";
  }
}

const COLORS = {
  deep: "#061522",
  navy: "#0b2032",
  panel: "#10283b",
  gold: "#d7b36a",
  goldBright: "#e7c77d",
  ivory: "#f4ebdd",
  muted: "#a9a393",
  subtle: "#71808a",
} as const;

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function number(value: number, fallback = 0): string {
  return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : String(fallback);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function wrapText(value: string, maxCharacters: number, maxLines: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  const sourceLength = words.join(" ").length;
  if (lines.length === maxLines && sourceLength > lines.join(" ").length) {
    lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}…`;
  }
  return lines;
}

function textBlock(args: {
  value: string;
  x: number;
  y: number;
  maxCharacters: number;
  maxLines: number;
  fontSize: number;
  lineHeight?: number;
  fill?: string;
  family?: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
}): string {
  const lines = wrapText(args.value, args.maxCharacters, args.maxLines);
  const lineHeight = args.lineHeight ?? Math.round(args.fontSize * 1.28);
  return `<text x="${number(args.x)}" y="${number(args.y)}" fill="${args.fill || COLORS.ivory}" font-family="${escapeXml(args.family || "Work Sans, Arial, sans-serif")}" font-size="${args.fontSize}" font-weight="${args.weight || 400}" text-anchor="${args.anchor || "start"}">${lines.map((line, index) => `<tspan x="${number(args.x)}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function validatedQrSvg(qrSvg: string): { viewBox: string; inner: string } | null {
  if (!qrSvg || qrSvg.length > 100_000 || /<\/?(?:script|foreignObject|image)\b|\bon[a-z]+\s*=|javascript:/i.test(qrSvg)) {
    throw new ShareImageRenderError("Share QR markup is not safe.");
  }
  const match = qrSvg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/i);
  if (!match) throw new ShareImageRenderError("Share QR markup is invalid.");
  const viewBox = match[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1] || "0 0 100 100";
  if (!/^-?\d+(?:\.\d+)?(?:\s+-?\d+(?:\.\d+)?){3}$/.test(viewBox.trim())) {
    throw new ShareImageRenderError("Share QR viewBox is invalid.");
  }
  return { viewBox: viewBox.trim(), inner: match[2] };
}

function renderQrPanel(view: PublicReadingView, qrSvg: string | undefined): string {
  const title = view.locale === "vi" ? "Mở trải bài này" : "Open this reading";
  const hint = view.locale === "vi" ? "Quét để tiếp tục trên NaTarot" : "Scan to continue on NaTarot";
  if (!qrSvg) {
    return `<rect x="925" y="214" width="218" height="218" rx="14" fill="${COLORS.ivory}"/><path d="M950 240h54v54h-54zM1064 240h54v54h-54zM950 354h54v54h-54zM1020 310h16v16h-16zM1050 326h16v16h-16zM1080 310h16v16h-16z" fill="${COLORS.deep}"/><text x="1034" y="472" fill="${COLORS.ivory}" font-family="Work Sans, Arial, sans-serif" font-size="16" text-anchor="middle">${escapeXml(title)}</text><text x="1034" y="496" fill="${COLORS.muted}" font-family="Work Sans, Arial, sans-serif" font-size="12" text-anchor="middle">${escapeXml(hint)}</text>`;
  }
  const parsed = validatedQrSvg(qrSvg);
  if (!parsed) return "";
  return `<rect x="911" y="200" width="246" height="246" rx="18" fill="${COLORS.ivory}"/><svg x="925" y="214" width="218" height="218" viewBox="${escapeXml(parsed.viewBox)}" preserveAspectRatio="xMidYMid meet">${parsed.inner}</svg><text x="1034" y="472" fill="${COLORS.ivory}" font-family="Work Sans, Arial, sans-serif" font-size="16" text-anchor="middle">${escapeXml(title)}</text><text x="1034" y="496" fill="${COLORS.muted}" font-family="Work Sans, Arial, sans-serif" font-size="12" text-anchor="middle">${escapeXml(hint)}</text>`;
}

function renderCard(view: PublicReadingView, index: number): string {
  const card = view.cards[index];
  const geometry = view.geometry[index];
  if (!card || !geometry || !isApprovedCardImageUrl(card.imageUrl)) {
    throw new ShareImageRenderError("Share card rendering data is invalid.");
  }
  const scale = clamp(geometry.scale, 0.45, 1.06);
  const cardWidth = 112 * scale;
  const cardHeight = 178 * scale;
  const centerX = 76 + clamp(geometry.x, 0, 1) * 760;
  const centerY = 144 + clamp(geometry.y, 0, 1) * 470;
  const x = centerX - cardWidth / 2;
  const y = centerY - cardHeight / 2;
  const clipId = `share-card-clip-${index}`;
  const label = `${String(index + 1).padStart(2, "0")} · ${card.position.label}`;
  return `<g transform="rotate(${number(geometry.rotation)} ${number(centerX)} ${number(centerY)})" opacity="${number(clamp(0.84 + scale * 0.16, 0.88, 1))}"><rect x="${number(x + 4)}" y="${number(y + 7)}" width="${number(cardWidth)}" height="${number(cardHeight)}" rx="10" fill="#000000" opacity=".32"/><rect x="${number(x)}" y="${number(y)}" width="${number(cardWidth)}" height="${number(cardHeight)}" rx="10" fill="${COLORS.panel}" stroke="${COLORS.gold}" stroke-opacity=".72" stroke-width="1.5"/><clipPath id="${clipId}"><rect x="${number(x + 3)}" y="${number(y + 3)}" width="${number(Math.max(0, cardWidth - 6))}" height="${number(Math.max(0, cardHeight - 6))}" rx="7"/></clipPath><image href="${escapeXml(card.imageUrl)}" x="${number(x + 3)}" y="${number(y + 3)}" width="${number(Math.max(0, cardWidth - 6))}" height="${number(Math.max(0, cardHeight - 6))}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"${card.orientation === "reversed" ? ` transform="rotate(180 ${number(centerX)} ${number(centerY)})"` : ""}/><text x="${number(centerX)}" y="${number(y + cardHeight + 18)}" fill="${COLORS.goldBright}" font-family="Work Sans, Arial, sans-serif" font-size="${scale < 0.65 ? 9 : 11}" text-anchor="middle">${escapeXml(label)}</text></g>`;
}

/** Render only the sanitized public projection; this never reads a DB row or a private Room object. */
export function renderShareImage(view: PublicReadingView, options: { qrSvg?: string } = {}): ShareImageRenderResult {
  if (view.cards.length !== view.geometry.length || view.cards.length !== view.spread.cardCount) {
    throw new ShareImageRenderError("Share image card geometry is incomplete.");
  }
  const localeLabel = view.locale === "vi" ? "TRẢI BÀI ĐƯỢC CHIA SẺ" : "SHARED TAROT READING";
  const questionLabel = view.locale === "vi" ? "Câu hỏi" : "Question";
  const answerLabel = view.locale === "vi" ? "Điều đang nổi lên" : "What is emerging";
  const footer = view.locale === "vi" ? "NaTarot · Một không gian giữa bạn và những lá bài" : "NaTarot · A space between you and the cards";
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<rect width="1200" height="800" fill="${COLORS.deep}"/>
<circle cx="610" cy="360" r="320" fill="none" stroke="${COLORS.gold}" stroke-opacity=".08" stroke-width="1"/>
<circle cx="610" cy="360" r="238" fill="none" stroke="${COLORS.gold}" stroke-opacity=".06" stroke-width="1"/>
<path d="M0 650C190 590 335 735 540 660s410-65 660 24V800H0Z" fill="${COLORS.navy}" opacity=".65"/>
<text x="64" y="62" fill="${COLORS.goldBright}" font-family="Instrument Serif, Georgia, serif" font-size="32">NaTarot</text>
<text x="64" y="90" fill="${COLORS.muted}" font-family="Work Sans, Arial, sans-serif" font-size="10" letter-spacing="2.4">${escapeXml(localeLabel)}</text>
<line x1="64" y1="112" x2="1136" y2="112" stroke="${COLORS.gold}" stroke-opacity=".28"/>
<text x="64" y="148" fill="${COLORS.goldBright}" font-family="Work Sans, Arial, sans-serif" font-size="11" letter-spacing="1.2">${escapeXml(questionLabel)}</text>
${textBlock({ value: view.question, x: 64, y: 178, maxCharacters: 74, maxLines: 2, fontSize: 24, lineHeight: 31, fill: COLORS.ivory, family: "Instrument Serif, Georgia, serif" })}
${view.cards.map((_, index) => renderCard(view, index)).join("")}
<rect x="878" y="126" width="292" height="548" rx="18" fill="${COLORS.navy}" stroke="${COLORS.gold}" stroke-opacity=".22"/>
<text x="912" y="164" fill="${COLORS.goldBright}" font-family="Work Sans, Arial, sans-serif" font-size="11" letter-spacing="1.1">${escapeXml(answerLabel)}</text>
${textBlock({ value: view.reading.directAnswer, x: 912, y: 194, maxCharacters: 31, maxLines: 8, fontSize: 17, lineHeight: 24, fill: COLORS.ivory, family: "Instrument Serif, Georgia, serif" })}
${renderQrPanel(view, options.qrSvg)}
${textBlock({ value: view.publicUrl, x: 912, y: 538, maxCharacters: 35, maxLines: 2, fontSize: 11, lineHeight: 15, fill: COLORS.subtle, family: "Work Sans, Arial, sans-serif" })}
<line x1="912" y1="584" x2="1136" y2="584" stroke="${COLORS.gold}" stroke-opacity=".18"/>
${textBlock({ value: view.spread.name, x: 912, y: 616, maxCharacters: 34, maxLines: 2, fontSize: 14, lineHeight: 18, fill: COLORS.goldBright, family: "Work Sans, Arial, sans-serif" })}
<text x="64" y="748" fill="${COLORS.muted}" font-family="Work Sans, Arial, sans-serif" font-size="11">${escapeXml(footer)}</text>
<text x="1136" y="748" fill="${COLORS.muted}" font-family="Work Sans, Arial, sans-serif" font-size="11" text-anchor="end">${escapeXml(view.reading.disclaimer)}</text>
</svg>`;
  return {
    contentType: "image/svg+xml",
    bytes: new TextEncoder().encode(svg),
    width: SHARE_IMAGE_WIDTH,
    height: SHARE_IMAGE_HEIGHT,
    rendererVersion: view.rendererVersion,
  };
}
