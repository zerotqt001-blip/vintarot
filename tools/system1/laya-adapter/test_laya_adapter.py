import json
import pathlib
import sys
import unittest


ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from laya_adapter import (  # noqa: E402
    ShadowAdapter,
    classifyFailure,
    classifyTask,
    recommendNextAction,
    recommendModelRoute,
    selectTestScope,
    shadowRecord,
)


class LayaAdapterContractTests(unittest.TestCase):
    def test_authoritative_credit_failure_wins_without_laya(self):
        state = {
            "status": 402,
            "error_category": "credits_insufficient",
            "signals": ["thieu Credit", "member reading"],
        }
        result = classifyFailure(state)
        self.assertEqual(result["decision"], "credits_insufficient")
        self.assertEqual(result["source"], "deterministic")
        self.assertGreaterEqual(result["confidence"], 0.95)

    def test_bilingual_ui_signals_select_a_bounded_test_scope(self):
        state = {
            "files": ["app/room/room.tsx", "lib/i18n.ts"],
            "signals": ["Vietnamese copy", "402 account action"],
        }
        result = selectTestScope(state)
        self.assertEqual(result["decision"], "focused_ui_typecheck_build")
        self.assertEqual(result["source"], "deterministic")

    def test_known_incident_next_action_never_grants_credit(self):
        result = recommendNextAction({"status": 402, "error_category": "credits_insufficient"})
        self.assertEqual(result["decision"], "explain_credit_boundary")
        self.assertNotIn(result["decision"], {"grant_credit", "bypass_credit_gate", "charge_customer"})

    def test_unknown_state_escalates_to_explicit_fallback(self):
        result = ShadowAdapter().classifyTask({"signals": ["ambiguous mixed technical input"]})
        self.assertEqual(result["source"], "llm")
        self.assertEqual(result["decision"], "escalate_to_llm")
        self.assertIn("fallbackReason", result)

    def test_injected_laya_result_is_sanitized_to_the_shadow_shape(self):
        adapter = ShadowAdapter(laya_predictor=lambda _name, _state: {"decision": "debug", "confidence": 0.81})
        result = adapter.classifyTask({"signals": ["ambiguous input"]})
        self.assertEqual(result, {"decision": "debug", "confidence": 0.81, "source": "laya"})

    def test_shadow_record_redacts_sensitive_state_and_keeps_only_safe_metadata(self):
        record = shadowRecord(
            {"email": "member@example.com", "session_id": "sess-private", "signals": ["mixed EN/VI"]},
            {"decision": "debug", "confidence": 0.81, "source": "laya"},
            "debug",
            "provider_error_classified",
            1.25,
        )
        serialized = json.dumps(record, ensure_ascii=False)
        self.assertNotIn("member@example.com", serialized)
        self.assertNotIn("sess-private", serialized)
        self.assertEqual(record["prediction"], "debug")
        self.assertEqual(record["codexDecision"], "debug")
        self.assertEqual(record["knownOutcome"], "provider_error_classified")
        self.assertEqual(record["source"], "laya")

    def test_public_functions_have_typed_decision_shapes(self):
        state = {"files": ["scripts/production-ai-health-gate.mjs"], "signals": ["provider timeout"]}
        for function in (classifyTask, classifyFailure, selectTestScope, recommendNextAction, recommendModelRoute):
            result = function(state)
            self.assertIn(result["source"], {"deterministic", "laya", "llm"})
            self.assertIsInstance(result["decision"], str)
            self.assertGreaterEqual(result["confidence"], 0.0)
            self.assertLessEqual(result["confidence"], 1.0)


if __name__ == "__main__":
    unittest.main()
