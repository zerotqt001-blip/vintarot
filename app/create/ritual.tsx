"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/language";
import { messages } from "@/lib/i18n";

type TopicKey = keyof typeof messages.en.create.topics;

const topicKeys = Object.keys(messages.en.create.topics) as TopicKey[];
const timestamp = () => Date.now();

export default function CreateRitual() {
  const { locale, t } = useLanguage();
  const [topic, setTopic] = useState<TopicKey | null>(null);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  function begin(value: string) {
    if (opening) return;
    try {
      sessionStorage.setItem(
        "vintarot:new-reading",
        JSON.stringify({ question: value.trim().slice(0, 500), created: timestamp() }),
      );
      setOpening(true);
      window.location.assign("/room?ritual=1");
    } catch {
      setError(t("create.storageError"));
    }
  }

  const suggestions = messages[locale].create.suggestions[topic ?? "work"];

  return (
    <section className="question-flow" aria-labelledby="question-title">
      <div className="question-glow" />
      <button
        className="question-back"
        aria-label={topic ? t("create.backTopics") : t("create.backHome")}
        onClick={() => (topic ? setTopic(null) : window.location.assign("/"))}
      >
        <ArrowLeft size={32} strokeWidth={1} />
      </button>
      <div key={topic || "ask"} className="question-step">
        <h1 id="question-title">{topic ? t("create.anything") : t("create.ask")}</h1>
        {!topic ? (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (question.trim()) begin(question);
              }}
              className="question-input"
            >
              <input
                aria-label={t("create.ask")}
                autoComplete="off"
                maxLength={500}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t("create.placeholder")}
              />
              {question.trim() && (
                <button
                  type="submit"
                  disabled={opening}
                  aria-label={t("create.continue")}
                >
                  <ArrowRight size={23} />
                </button>
              )}
            </form>
            <h2>{t("create.chooseTopic")}</h2>
            <div className="question-topics">
              {topicKeys.map((key) => (
                <button key={key} type="button" onClick={() => setTopic(key)}>
                  {t(`create.topics.${key}`)}
                </button>
              ))}
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
            <div className="question-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  disabled={opening}
                  type="button"
                  key={suggestion}
                  onClick={() => begin(suggestion)}
                >
                  {suggestion}
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
