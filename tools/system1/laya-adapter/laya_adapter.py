"""Development-only, deterministic-first System 1 shadow adapter.

This module deliberately has no third-party dependencies.  An audited Laya
predictor may be injected by a tool-local experiment, but nothing in the
NaTarot Node graph imports this module or calls a model from production.
"""

from __future__ import annotations

import re
from typing import Any, Callable, Dict, Iterable, Mapping, Optional


Decision = Dict[str, Any]
LayaPredictor = Callable[[str, Mapping[str, Any]], Mapping[str, Any]]

_SOURCES = {"deterministic", "laya", "llm"}
_SENSITIVE_KEY_PARTS = (
    "api_key",
    "apikey",
    "authorization",
    "cookie",
    "email",
    "password",
    "phone",
    "secret",
    "session",
    "token",
)
_SAFE_STATE_KEYS = {
    "changed_files",
    "error_category",
    "files",
    "http_status",
    "locale",
    "model",
    "provider",
    "signals",
    "status",
    "task",
    "tests",
}
_EMAIL_RE = re.compile(r"\b[^\s@]+@[^\s@]+\.[^\s@]+\b")
_BEARER_RE = re.compile(r"\bBearer\s+[^\s]+", re.IGNORECASE)
_LONG_SECRET_RE = re.compile(r"\b(?:sk|key|token|secret)[-_=:][A-Za-z0-9._=-]{12,}\b", re.IGNORECASE)


def _clean_text(value: Any, limit: int = 180) -> str:
    text = str(value).strip()
    text = _EMAIL_RE.sub("[redacted-email]", text)
    text = _BEARER_RE.sub("[redacted-auth]", text)
    text = _LONG_SECRET_RE.sub("[redacted-secret]", text)
    if len(text) > limit:
        text = text[:limit] + "…"
    return text


def _sensitive_key(key: str) -> bool:
    normalized = key.lower().replace("-", "_")
    return any(part in normalized for part in _SENSITIVE_KEY_PARTS)


def _safe_value(key: str, value: Any, depth: int = 0) -> Any:
    if depth > 2 or _sensitive_key(key):
        return "[redacted]"
    if isinstance(value, Mapping):
        return {
            str(child_key): _safe_value(str(child_key), child_value, depth + 1)
            for child_key, child_value in value.items()
            if not _sensitive_key(str(child_key))
        }
    if isinstance(value, (list, tuple)):
        return [_safe_value(key, item, depth + 1) for item in list(value)[:20]]
    if isinstance(value, (bool, int, float)) or value is None:
        return value
    return _clean_text(value)


def sanitizeState(state: Any) -> Dict[str, Any]:
    """Keep only bounded operational features suitable for a shadow record."""

    if not isinstance(state, Mapping):
        return {"signals": [_clean_text(state)]}
    return {
        str(key): _safe_value(str(key), value)
        for key, value in state.items()
        if str(key) in _SAFE_STATE_KEYS and not _sensitive_key(str(key))
    }


def _text(state: Mapping[str, Any]) -> str:
    values: list[str] = []

    def visit(value: Any) -> None:
        if isinstance(value, Mapping):
            for key, child in value.items():
                if not _sensitive_key(str(key)):
                    visit(child)
        elif isinstance(value, (list, tuple)):
            for child in value:
                visit(child)
        elif isinstance(value, (str, int, float)):
            values.append(str(value).lower())

    visit(state)
    return " ".join(values)


def _signal_text(state: Mapping[str, Any]) -> str:
    values = [state.get("error_category", ""), state.get("provider", "")]
    signals = state.get("signals", [])
    values.extend(signals if isinstance(signals, (list, tuple)) else [signals])
    return " ".join(str(value).lower() for value in values)


def _status(state: Mapping[str, Any]) -> Optional[int]:
    for key in ("status", "http_status"):
        value = state.get(key)
        try:
            if value is not None:
                return int(value)
        except (TypeError, ValueError):
            continue
    return None


def _files(state: Mapping[str, Any]) -> list[str]:
    values: list[str] = []
    for key in ("files", "changed_files"):
        value = state.get(key, [])
        if isinstance(value, str):
            values.append(value.lower())
        elif isinstance(value, Iterable):
            values.extend(str(item).lower() for item in value)
    return values


def _result(decision: str, confidence: float, source: str, fallback_reason: Optional[str] = None) -> Decision:
    if source not in _SOURCES:
        raise ValueError(f"unsupported decision source: {source}")
    result: Decision = {
        "decision": _clean_text(decision, 96),
        "confidence": max(0.0, min(1.0, round(float(confidence), 4))),
        "source": source,
    }
    if fallback_reason:
        result["fallbackReason"] = _clean_text(fallback_reason, 140)
    return result


def _fallback(name: str, state: Mapping[str, Any], predictor: Optional[LayaPredictor]) -> Decision:
    if predictor is not None:
        try:
            raw = predictor(name, sanitizeState(state))
            decision = raw.get("decision") if isinstance(raw, Mapping) else None
            confidence = raw.get("confidence") if isinstance(raw, Mapping) else None
            if isinstance(decision, str) and isinstance(confidence, (int, float)):
                return _result(decision, confidence, "laya")
        except Exception:
            pass
        return _result("escalate_to_llm", 0.2, "llm", "laya predictor failed closed")
    return _result("escalate_to_llm", 0.2, "llm", "no authoritative signal; Laya is optional and not enabled")


def _decide(name: str, state: Any, rule: Callable[[Mapping[str, Any]], Optional[Decision]], predictor: Optional[LayaPredictor]) -> Decision:
    safe_state = state if isinstance(state, Mapping) else {"signals": [state]}
    deterministic = rule(safe_state)
    if deterministic is not None:
        return deterministic
    return _fallback(name, safe_state, predictor)


def _classify_task_rule(state: Mapping[str, Any]) -> Optional[Decision]:
    task = state.get("task")
    if isinstance(task, str) and task.strip().lower() in {"debug", "verify", "implement", "document", "audit"}:
        return _result(task.strip().lower(), 0.99, "deterministic")
    text = _text(state)
    signal_text = _signal_text(state)
    files = _files(state)
    if any("/docs/" in path or path.startswith("docs/") or path.endswith(".md") for path in files) and not any(word in signal_text for word in ("error", "failure", "timeout", "malformed", "sqlite")):
        return _result("document", 0.91, "deterministic")
    if any(word in text for word in ("security", "audit", "bảo mật", "bao mat")):
        return _result("audit", 0.91, "deterministic")
    if (_status(state) is not None and _status(state) >= 400) or any(word in signal_text for word in ("error", "failure", "incident", "timeout", "402", "malformed", "sqlite")):
        return _result("debug", 0.94, "deterministic")
    if any(word in text for word in ("test", "build", "lint", "verify", "kiểm tra", "kiem tra")):
        return _result("verify", 0.93, "deterministic")
    if any(path.endswith((".tsx", ".css", ".jsx")) or "/app/" in path for path in files):
        return _result("implement", 0.89, "deterministic")
    if any(word in text for word in ("docs", "documentation", "runbook", "tài liệu", "tai lieu")):
        return _result("document", 0.91, "deterministic")
    return None


def _classify_failure_rule(state: Mapping[str, Any]) -> Optional[Decision]:
    category = str(state.get("error_category", "")).strip().lower()
    status = _status(state)
    text = _signal_text(state)
    if category in {"credits_insufficient", "credit_insufficient"} or status == 402 or any(phrase in text for phrase in ("credit gate", "credits required", "thiếu credit", "thieu credit")):
        return _result("credits_insufficient", 0.99, "deterministic")
    if status in {401, 403} or any(word in text for word in ("auth", "unauthorized", "forbidden", "api key")):
        return _result("provider_auth", 0.97, "deterministic")
    if category in {"timeout", "provider_unavailable", "network"} or status in {408, 429} or status is not None and status >= 500:
        return _result("provider_unavailable", 0.94, "deterministic")
    if category in {"response_invalid", "invalid_response"} or any(word in text for word in ("malformed", "parse", "schema")):
        return _result("response_invalid", 0.94, "deterministic")
    if category in {"persistence", "persistence_failed"} or any(word in text for word in ("sqlite", "database", "persist")):
        return _result("persistence_failed", 0.94, "deterministic")
    return None


def _test_scope_rule(state: Mapping[str, Any]) -> Optional[Decision]:
    files = _files(state)
    text = _text(state)
    if any("app/room" in path or "lib/i18n" in path or path.endswith((".tsx", ".jsx", ".css")) for path in files):
        return _result("focused_ui_typecheck_build", 0.96, "deterministic")
    if any("production-ai-health-gate" in path for path in files):
        return _result("health_gate_contract_production", 0.96, "deterministic")
    if any("lib/ai/" in path or "tarot-reading-route" in path for path in files):
        return _result("health_gate_contract_production", 0.93, "deterministic")
    if any("migration" in path or "/db" in path or path.startswith("db/") or path.startswith("drizzle/") for path in files):
        return _result("migration_backup_restore_regression", 0.98, "deterministic")
    if any(word in text for word in ("docs", "documentation", "runbook")):
        return _result("docs_contract", 0.9, "deterministic")
    return None


def _next_action_rule(state: Mapping[str, Any]) -> Optional[Decision]:
    failure = _classify_failure_rule(state)
    if failure and failure["decision"] == "credits_insufficient":
        return _result("explain_credit_boundary", 0.99, "deterministic")
    if failure and failure["decision"] in {"provider_auth", "provider_unavailable", "response_invalid"}:
        return _result("run_ai_health_gate", 0.96, "deterministic")
    if failure and failure["decision"] == "persistence_failed":
        return _result("inspect_persistence_and_rollback", 0.96, "deterministic")
    text = _text(state)
    if "test" in text and any(word in text for word in ("fail", "failed", "failure")):
        return _result("reproduce_focused_failure", 0.93, "deterministic")
    if state.get("status") == 0 or "clean" in text:
        return _result("run_verification", 0.86, "deterministic")
    return None


def _model_route_rule(state: Mapping[str, Any]) -> Optional[Decision]:
    text = _text(state)
    signal_text = _signal_text(state)
    files = _files(state)
    failure = _classify_failure_rule(state)
    if failure and failure["decision"] in {"credits_insufficient", "provider_auth", "persistence_failed"}:
        return _result("frontier_review", 0.96, "deterministic")
    if failure and failure["decision"] in {"provider_unavailable", "response_invalid"}:
        return _result("frontier_debug", 0.94, "deterministic")
    if any("/docs/" in path or path.startswith("docs/") or path.endswith(".md") for path in files):
        return _result("local_fast", 0.88, "deterministic")
    if any(word in signal_text for word in ("security", "auth", "payment", "credit", "migration")) or any("security" in path or "auth" in path for path in files):
        return _result("frontier_review", 0.96, "deterministic")
    if any(word in text for word in ("provider", "deepseek", "timeout", "incident")):
        return _result("frontier_debug", 0.94, "deterministic")
    if any(path.endswith((".tsx", ".css", ".md")) for path in files) or any(word in text for word in ("test", "docs", "ui")):
        return _result("local_fast", 0.88, "deterministic")
    return None


class ShadowAdapter:
    """Run authoritative rules first, then an injected Laya predictor, then LLM escalation."""

    def __init__(self, laya_predictor: Optional[LayaPredictor] = None):
        self.laya_predictor = laya_predictor

    def classifyTask(self, state: Any) -> Decision:
        return _decide("classifyTask", state, _classify_task_rule, self.laya_predictor)

    def classifyFailure(self, state: Any) -> Decision:
        return _decide("classifyFailure", state, _classify_failure_rule, self.laya_predictor)

    def selectTestScope(self, state: Any) -> Decision:
        return _decide("selectTestScope", state, _test_scope_rule, self.laya_predictor)

    def recommendNextAction(self, state: Any) -> Decision:
        return _decide("recommendNextAction", state, _next_action_rule, self.laya_predictor)

    def recommendModelRoute(self, state: Any) -> Decision:
        return _decide("recommendModelRoute", state, _model_route_rule, self.laya_predictor)


_DEFAULT_ADAPTER = ShadowAdapter()


def classifyTask(state: Any) -> Decision:
    return _DEFAULT_ADAPTER.classifyTask(state)


def classifyFailure(state: Any) -> Decision:
    return _DEFAULT_ADAPTER.classifyFailure(state)


def selectTestScope(state: Any) -> Decision:
    return _DEFAULT_ADAPTER.selectTestScope(state)


def recommendNextAction(state: Any) -> Decision:
    return _DEFAULT_ADAPTER.recommendNextAction(state)


def recommendModelRoute(state: Any) -> Decision:
    return _DEFAULT_ADAPTER.recommendModelRoute(state)


def shadowRecord(
    state: Any,
    prediction: Mapping[str, Any],
    codex_decision: str,
    known_outcome: str,
    latency_ms: float,
) -> Dict[str, Any]:
    """Build a bounded record safe for local evaluation artifacts."""

    safe_prediction = _result(
        str(prediction.get("decision", "unknown")),
        float(prediction.get("confidence", 0.0)),
        str(prediction.get("source", "llm")),
        str(prediction.get("fallbackReason", "")) or None,
    )
    return {
        "state": sanitizeState(state),
        "prediction": safe_prediction["decision"],
        "confidence": safe_prediction["confidence"],
        "source": safe_prediction["source"],
        "codexDecision": _clean_text(codex_decision, 96),
        "knownOutcome": _clean_text(known_outcome, 96),
        "latencyMs": round(max(0.0, float(latency_ms)), 3),
    }


__all__ = [
    "ShadowAdapter",
    "classifyFailure",
    "classifyTask",
    "recommendModelRoute",
    "recommendNextAction",
    "sanitizeState",
    "selectTestScope",
    "shadowRecord",
]
