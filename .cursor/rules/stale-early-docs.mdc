---
description: Treat docs/, .superdesign/, .superpowers/, and MY_plan.md as early-project notes, not current truth
globs: docs/**/*.md,docs/**/*.mdc,.superdesign/**,.superpowers/**,MY_plan.md
alwaysApply: false
---

# Stale early-project docs

These files were written while the Build Arena was still premature. The repo has moved far past them. They may describe product intent, but they do **not** match the current code.

**This set:** `docs/**`, `.superdesign/**`, `.superpowers/**`, `MY_plan.md`

**Not this set:** `src/`, tests, schemas, `.cursor/plans/` (those are current)

When these files are in context:

- Do not implement, "catch up to", or redesign from them
- Prefer live source, tests, and schemas over anything they claim about APIs, tools, tabs, or architecture
- If they contradict code, **code wins**. Do not change code to match these files unless asked
- Do not silently rewrite these files to match current code unless asked

```text
# ❌ BAD
MY_plan.md says Game + Build Arena tabs → add a Game tab / inventory placement

# ✅ GOOD
Read src/ and tests. Arena + WebMCP already exist. These md files are leftover intent.
```
