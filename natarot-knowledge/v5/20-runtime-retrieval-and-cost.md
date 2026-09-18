# Runtime Retrieval & Cost v4

For each request retrieve:
- stable system + safety + language guide (cache where possible)
- one domain guide
- spread position definitions
- only drawn cards
- each card's master_semantics + core + orientation data
- matching context and position modifier
- relevant combination heuristics
- zero or one curated pair/triad hint when a strong match exists
- optionally one semantically close golden example

Never send all cards, all pairs, or golden-50.

Log model/provider, prompt version, input/output tokens, latency, schema validity, retry count. Do not log secrets.
