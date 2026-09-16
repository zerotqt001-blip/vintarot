# AI Website Cloner integration

Upstream: https://github.com/JCodesMore/ai-website-cloner-template
Revision: 92872bc40ced2c5edb4d5dc9fd3970d40c77f4ca
License: MIT, retained in vendor/ai-website-cloner-template/LICENSE.

Full source snapshot is kept under vendor/ai-website-cloner-template. Its Codex workflow is installed at .codex/skills/clone-website/SKILL.md. The vendored starter is excluded from VinTarot TypeScript compilation so its separate src/app scaffold cannot collide with the working app. Do not install its separate dependencies or replace VinTarot package.json.

Adaptations: existing user-authorized routes, brand VinTarot, durable D1 data and Sites deployment take precedence over upstream demo-only defaults. Sites owner implements changes; research is written before edits. No upstream template code is executed during the app runtime.
