# Context Retrieval Policy v2

Never dump the whole knowledge base into a request.

Build context from:
1. core reading protocol
2. target-language voice guide
3. domain guide matching the question
4. exact spread + position semantics
5. only drawn-card records
6. only relevant context fields (love/career/etc.)
7. reversal lens data only for reversed cards
8. at most 1-2 golden examples selected by semantic similarity

Context builder should prefer compact structured facts over long prose. Cache stable system material where provider supports it.
