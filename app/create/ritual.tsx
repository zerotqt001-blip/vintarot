"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Heart, Infinity, Moon, Search, Sparkles, Sprout, Star } from "lucide-react";
import { useLanguage } from "@/components/language";
import { messages } from "@/lib/i18n";

type TopicKey = keyof typeof messages.en.create.topics;

const topicKeys = Object.keys(messages.en.create.topics) as TopicKey[];
const timestamp = () => Date.now();
const topicConfig = {
  work: { Icon: Briefcase, accent: "gold" },
  relationships: { Icon: Heart, accent: "rose" },
  changes: { Icon: Sprout, accent: "sage" },
  creativity: { Icon: Sparkles, accent: "amber" },
  magic: { Icon: Moon, accent: "blue" },
  idk: { Icon: Infinity, accent: "champagne" },
} as const satisfies Record<TopicKey, { Icon: typeof Briefcase; accent: string }>;

export default function CreateRitual() {
  const { locale, t } = useLanguage();
  const [selectedTopic, setSelectedTopic] = useState<TopicKey | null>(null);
  const [lastTopic, setLastTopic] = useState<TopicKey | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  function begin(value: string, topic = selectedTopic) {
    if (opening) return;
    try {
      sessionStorage.setItem(
        "vintarot:new-reading",
        JSON.stringify({
          question: value.trim().slice(0, 500),
          topic: topic,
          currentQuestion: value.trim().slice(0, 500) || null,
          selectedTopic: topic,
          created: timestamp(),
        }),
      );
      setOpening(true);
      window.location.assign("/room?ritual=1");
    } catch {
      setError(t("create.storageError"));
    }
  }

  const suggestions = messages[locale].create.suggestions[selectedTopic ?? "work"];
  const selectedConfig = selectedTopic ? topicConfig[selectedTopic] : null;
  const SelectedTopicIcon = selectedConfig?.Icon;

  return (
    <section className="question-flow create-cosmic-page" aria-labelledby="question-title">
      <div className="create-celestial-scene" aria-hidden="true">
        <div className="create-scene-layer create-scene-sky" />
        <div className="create-scene-layer create-scene-stars" />
        <div className="create-scene-layer create-scene-nebula" />
        <div className="create-scene-layer create-scene-zodiac" />
        <div className="create-scene-layer create-scene-architecture" />
        <div className="create-scene-layer create-scene-floor" />
        <div className="create-scene-layer create-scene-vignette" />
      </div>
      <div className="question-glow" />
      <button
        className="question-back"
        aria-label={selectedTopic ? t("create.backTopics") : t("create.backHome")}
        onClick={() => (selectedTopic ? setSelectedTopic(null) : window.location.assign("/"))}
      >
        <ArrowLeft size={32} strokeWidth={1} />
      </button>
      <div key={selectedTopic || "ask"} className="question-step create-stage">
        <div className="create-moon-phases" aria-hidden="true"><span>☾</span><span>◐</span><span>●</span><span>◑</span><span>☽</span></div>
        {!selectedTopic && <p className="create-kicker">{t("create.ask")}</p>}
        {selectedConfig && (
          <div className={`create-topic-identity topic-accent-${selectedConfig.accent}`}>
            <span className="create-topic-icon">{SelectedTopicIcon && <SelectedTopicIcon size={26} strokeWidth={1.35} />}</span>
            <span>{t(`create.topics.${selectedTopic}`)}</span>
          </div>
        )}
        <h1 id="question-title">{selectedTopic ? t("create.anything") : t("create.questionTitle")}</h1>
        <p className="create-subtitle">{selectedTopic ? t("create.topicInstruction") : t("create.questionSubtitle")}</p>
        {!selectedTopic ? (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (currentQuestion.trim()) begin(currentQuestion, null);
              }}
              className="question-input create-question-capsule"
            >
              <Search className="create-question-icon" size={20} strokeWidth={1.35} aria-hidden="true" />
              <input
                aria-label={t("create.ask")}
                autoComplete="off"
                maxLength={500}
                value={currentQuestion}
                onChange={(event) => setCurrentQuestion(event.target.value)}
                placeholder={t("create.placeholder")}
              />
              {currentQuestion.trim() && (
                <button
                  type="submit"
                  disabled={opening}
                  aria-label={t("create.continue")}
                >
                  <ArrowRight size={23} />
                </button>
              )}
            </form>
            <div className="create-topic-divider"><span>{t("create.chooseTopic")}</span></div>
            <div className="question-topics create-topic-grid" aria-label={t("create.chooseTopic")}>
              {topicKeys.map((key) => {
                const TopicIcon = topicConfig[key].Icon;
                return (
                  <button
                    key={key}
                    className={`create-topic-orb topic-accent-${topicConfig[key].accent}`}
                    type="button"
                    aria-pressed={lastTopic === key}
                    onClick={() => {
                      setLastTopic(key);
                      setSelectedTopic(key);
                    }}
                  >
                    <span className="create-topic-orb-icon"><TopicIcon size={29} strokeWidth={1.25} /></span>
                    <span>{t(`create.topics.${key}`)}</span>
                  </button>
                );
              })}
            </div>
            <button
              className="question-skip"
              type="button"
              disabled={opening}
              onClick={() => begin("")}
            >
              {t("create.skipTheme")}
            </button>
          </>
        ) : (
          <>
            <div className="question-suggestions create-suggestions" aria-label={t("create.topicInstruction")}>
              {suggestions.map((suggestion) => (
                <button
                  className="create-suggestion-card"
                  disabled={opening}
                  type="button"
                  key={suggestion}
                  onClick={() => {
                    setCurrentQuestion(suggestion);
                    begin(suggestion, selectedTopic);
                  }}
                >
                  <Star className="create-suggestion-star" size={15} strokeWidth={1.25} aria-hidden="true" />
                  <span>{suggestion}</span>
                  <ArrowRight size={16} />
                </button>
              ))}
            </div>
            <button
              className="question-skip"
              type="button"
              disabled={opening}
              onClick={() => begin("")}
            >
              {t("create.skipQuestion")}
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        {opening && <p role="status">{t("create.opening")}</p>}
      </div>
    </section>
  );
}
