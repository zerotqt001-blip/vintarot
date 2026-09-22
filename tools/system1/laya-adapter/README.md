# NaTarot System 1 shadow adapter

This is a development-only evaluation tool. It is intentionally stdlib-only
and is not imported by the NaTarot Node application. It cannot authorize a
production deploy, grant Credits, change payment/auth state, mutate the
database, select a customer-facing provider, or alter Tarot prompt semantics.

## Pinned upstream audit

- Repository: <https://github.com/NandhaKishorM/laya>
- Audited commit: `573e5b62696ba441230cd6be71d593331b5d23af`
- Upstream version: `0.3.5`
- License declared upstream: Apache-2.0
- Optional upstream runtime: Python 3.10+, Torch, Transformers, Safetensors,
  Hugging Face Hub and NumPy.

The upstream `Router` downloads a checkpoint from Hugging Face on first model
load. The adapter therefore accepts an injected predictor for an explicitly
isolated experiment; it never imports Laya or downloads weights by default.

## Contract

`ShadowAdapter` exposes `classifyTask`, `classifyFailure`, `selectTestScope`,
`recommendNextAction` and `recommendModelRoute`. Every result is:

```json
{"decision":"...","confidence":0.0,"source":"deterministic"}
```

Authoritative status/error/file signals use `source=deterministic`. If no
rule applies, an injected Laya predictor may return `source=laya`; otherwise
the adapter fails closed to `source=llm` with `decision=escalate_to_llm`.
That value means “request a separate review”; it does not call an LLM.

`shadowRecord` keeps only sanitized operational features, prediction,
confidence, Codex decision, known outcome and latency. It drops sensitive keys
and redacts email/auth-like strings.

## Run locally

```sh
python3 -m unittest tools/system1/laya-adapter/test_laya_adapter.py
python3 tools/system1/laya-adapter/benchmark.py
```

The benchmark uses 12 bilingual/mixed technical fixtures, measures one/five/
ten decision batches, and does not download a model. Install Laya only in a
separate disposable Python environment if a later shadow experiment needs the
injected predictor; never add it to `package.json` or the production service.
