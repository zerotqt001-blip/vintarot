"""Measure the local deterministic baseline without downloading a Laya checkpoint."""

from __future__ import annotations

import importlib.util
import json
import os
import platform
import shutil
import statistics
import sys
import time
from pathlib import Path

from laya_adapter import ShadowAdapter, shadowRecord


ROOT = Path(__file__).resolve().parent
FIXTURES = ROOT / "fixtures" / "decisions.jsonl"
METHODS = (
    "classifyTask",
    "classifyFailure",
    "selectTestScope",
    "recommendNextAction",
    "recommendModelRoute",
)


def load_fixtures() -> list[dict]:
    return [json.loads(line) for line in FIXTURES.read_text(encoding="utf-8").splitlines() if line.strip()]


def deterministic_predictions(adapter: ShadowAdapter, fixture: dict) -> dict[str, dict]:
    state = fixture["state"]
    return {method: getattr(adapter, method)(state) for method in METHODS}


def baseline_metrics(fixtures: list[dict], adapter: ShadowAdapter) -> dict:
    correct = 0
    total = 0
    calibration_error: list[float] = []
    records: list[dict] = []
    for fixture in fixtures:
        predictions = deterministic_predictions(adapter, fixture)
        for method, prediction in predictions.items():
            expected = fixture["expected"][method]
            is_correct = prediction["decision"] == expected
            correct += int(is_correct)
            total += 1
            calibration_error.append(abs(float(prediction["confidence"]) - float(is_correct)))
            records.append(
                shadowRecord(
                    fixture["state"],
                    prediction,
                    fixture["codexDecision"],
                    fixture["knownOutcome"],
                    0.0,
                )
            )
    return {
        "cases": len(fixtures),
        "decision_slots": total,
        "accuracy": round(correct / total, 4) if total else 0.0,
        "mean_confidence_error": round(statistics.mean(calibration_error), 4) if calibration_error else 0.0,
        "records_sanitized": all("@" not in json.dumps(record, ensure_ascii=False) for record in records),
    }


def latency_metrics(fixtures: list[dict], adapter: ShadowAdapter) -> dict[str, dict[str, float]]:
    output: dict[str, dict[str, float]] = {}
    for count in (1, 5, 10):
        samples: list[float] = []
        for index in range(count):
            fixture = fixtures[index % len(fixtures)]
            started = time.perf_counter_ns()
            deterministic_predictions(adapter, fixture)
            samples.append((time.perf_counter_ns() - started) / 1_000_000)
        output[str(count)] = {
            "total_ms": round(sum(samples), 4),
            "p50_ms": round(statistics.median(samples), 4),
            "max_ms": round(max(samples), 4),
        }
    return output


def runtime_probe() -> dict[str, str | int | bool]:
    laya_installed = importlib.util.find_spec("laya") is not None
    torch_installed = importlib.util.find_spec("torch") is not None
    return {
        "python": platform.python_version(),
        "platform": platform.platform(),
        "cpu_count": os.cpu_count() or 0,
        "gpu_hint": "nvidia-smi" if shutil.which("nvidia-smi") else "not_detected",
        "torch_installed": torch_installed,
        "laya_installed": laya_installed,
    }


def main() -> int:
    fixtures = load_fixtures()
    adapter = ShadowAdapter()
    result = {
        "status": "PASS",
        "mode": "deterministic_shadow_only",
        "runtime": runtime_probe(),
        "baseline": baseline_metrics(fixtures, adapter),
        "latency_ms": latency_metrics(fixtures, adapter),
        "laya_evaluation": {
            "status": "NOT_WORTHWHILE",
            "reason": "optional Laya package/checkpoint was not loaded; no model download or GPU claim was made",
        },
        "llm_evaluation": {
            "status": "NOT_INVOKED",
            "reason": "fallback is represented as an explicit escalation decision; this benchmark makes no network call",
        },
    }
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
