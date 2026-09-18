# NaTarot Reading Knowledge Base v5.0

Mục tiêu: biến dữ liệu 78 lá thành lớp grounding cho một AI Tarot Reader biết đọc theo câu hỏi, vị trí, orientation và quan hệ giữa các lá - thay vì nối template.

## Nguyên tắc
- Position-first: vị trí quyết định "công việc" của lá.
- Question-aware: cùng một lá phải đổi cách diễn giải theo câu hỏi.
- Reversal-aware: reversed không mặc định = xấu hoặc nghĩa đối lập.
- Synthesis-first: bài đọc cuối là một luận điểm thống nhất, không phải 3 đoạn tra từ điển.
- Evidence-aware: Tarot là reflection/guidance; không biến biểu tượng thành bằng chứng chắc chắn về suy nghĩ người khác hay tương lai.
- Bilingual-native: viết trực tiếp bằng VI hoặc EN, không dịch máy output.
- Provider-neutral: dùng được với OpenAI, Gemini, DeepSeek.

## Pipeline khuyến nghị
question -> spread -> positions -> drawn cards -> retrieve card knowledge -> reasoning protocol -> structured output -> UI

## Cấu trúc
- 00-13: handbook phương pháp đọc
- cards/: master knowledge 78 lá
- prompts/: system/developer prompt dùng cho model
- examples/: golden examples
- evaluation/: benchmark + rubric

Không gửi toàn bộ 78 lá vào mỗi request. Chỉ retrieve các lá đã rút và phần context liên quan.

## v2 additions
- Expanded every card with 8 domain lenses.
- Six reversal lenses with usage guidance.
- Ten position modifiers per card.
- Per-card interpretation checks.
- Context retrieval policy and synthesis protocol.
- Additional golden/evaluation cases and provider A/B test guide.

## V3
V3 supersedes V1/V2. It adds card-specific master semantics across all 78 cards, deeper relationship reasoning, an output contract, prompt assembly policy, and expanded benchmark suite.

## V4
V4 focuses on combination intelligence and evaluation: curated pair signals, triad patterns, 50 golden/evaluation cases, adversarial tests, blind provider judging, and runtime retrieval/cost guidance.

## V5
V5 adds 50 complete human-style bilingual readings for few-shot/style grounding, plus selection, variation, review and fine-tuning-readiness guidance. V5 supersedes all prior versions.
