# Laya System 1 evaluation

## Decision

`SHADOW-ONLY`. Laya is not a NaTarot dependency, provider fallback, customer
feature, deploy authorizer, Credit/VIP/payment actor, or production service.
The adapter lives at `tools/system1/laya-adapter/` and the Node contract test
asserts that `app/`, `lib/` and `components/` do not import it.

## Audit snapshot

| Item | Evidence |
| --- | --- |
| Repository | `https://github.com/NandhaKishorM/laya` |
| Pin | `573e5b62696ba441230cd6be71d593331b5d23af` |
| Version | `0.3.5` |
| License | Apache-2.0 declared in upstream `pyproject.toml` and `LICENSE` |
| Runtime | Python `>=3.10`; Torch, Transformers, Safetensors, Hugging Face Hub, NumPy |
| Checkpoints | English, multilingual and typed-decisions; downloaded lazily from Hugging Face |
| Routing | Script/language routing is pure Python; typed-decisions is opt-in in upstream Router |
| Hardware | Upstream documents T4 GPU measurements; CPU preload/reload cost is material and was not claimed locally |
| Supply-chain posture | Upstream loads Safetensors and has CI checks against pickle/`torch.load`, shell-outs and dynamic execution |

The upstream README also documents that its base checkpoints are near chance
on typed-decisions zero-shot and that the stronger benchmark numbers come from
fine-tuning. That is why this task measures the deterministic baseline first
and does not promote an uncalibrated checkpoint into production routing.

## Adapter contract

The tool exposes five small decisions: task class, failure class, test scope,
next action and model route. Authoritative evidence wins first. An optional
injected Laya predictor is second. Unknown cases escalate explicitly to a
separate LLM/Codex review without making a network call. Shadow records are
sanitized and contain no customer questions, Tarot session IDs, cookies,
credentials or PII.

The fixture set includes English, Vietnamese and mixed technical signals for
Credit authorization, provider timeout/auth/response failures, persistence,
UI tests, documentation, security and build verification. It contains no
production customer content.

## Measured local baseline

Command:

```sh
python3 tools/system1/laya-adapter/benchmark.py
```

The checked-in result from the isolated host is:

```text
status=PASS
mode=deterministic_shadow_only
cases=12
laya_installed=false
torch_installed=false
gpu_hint=not_detected
baseline_accuracy=1.0
baseline_decision_slots=60
baseline_mean_confidence_error=0.195
latency_1_total_ms=0.05
latency_5_total_ms=0.2246
latency_10_total_ms=0.4614
laya_evaluation=NOT_WORTHWHILE
llm_evaluation=NOT_INVOKED
```

The run used Python 3.14.2 on macOS arm64 with 10 logical CPUs. On this
curated 12-fixture set, the deterministic rules matched all 60 expected
decision slots. The one/five/
ten-call total timings are local tool timings, not a production SLO. The
benchmark also prints p50/max values for each batch and records that all shadow
records were sanitized. These numbers describe the stdlib deterministic
baseline only; they are not a claim about Laya model accuracy or GPU latency.
The optional Laya package/checkpoint was not installed or downloaded in this
worktree, so cold/preloaded model latency, model calibration, and model
accuracy remain an explicit follow-up experiment in a disposable Python
environment.

## Production coupling check

The following remain true after the evaluation:

- `package.json` has no Laya dependency.
- No production `app/`, `lib/` or `components/` file imports the adapter.
- `natarot.service` remains the Node/Vinext service with the existing DeepSeek
  environment boundary.
- The member Credit reservation gate remains authoritative.
- Removing the adapter directory cannot affect `natarot.com`.
