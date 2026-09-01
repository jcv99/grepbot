# GrepBot

Tampermonkey userscript that automates [Grepolis](https://www.grepolis.com):
farming villages, resource collection, building/research queues, trade,
culture, espionage, scouting, and opt-in military helpers.

**100% AI-generated.** Every line of this project — source modules, build
script, documentation and this README — was written by AI agents (Claude
Code). No human hand-wrote the code. Review it yourself before trusting it.

**ToS-breaking.** Grepolis prohibits automation. Using this script can get
your account banned. You accept that risk by installing it.

## Features

- **Economy**: farm-village claims (learned claim options), timed resource
  collection, bandit camp rewards, cave iron stashing, rural trade/leveling.
- **Build**: native queue lanes (build/recruit/research) with FIFO virtual
  queues, goal planner, instant-buy only when free.
- **Trade**: inter-city `tradeSend` balancing, Phoenician trader single-shot
  deals, resource dump policy (HIGH-RISK, off by default).
- **Culture**: festivals/processions/theater, optional gold-funded Olympic
  games with daily budget (off by default).
- **Military (opt-in, HIGH-RISK, default OFF)**: auto-recruit, dodge,
  militia, support waves, planned attacks, spy runs. Manual confirm required
  for all attack planning.
- **Safety rails**: dry-run mode, circuit breaker, safe mode, request
  budget, captcha backoff ladder, decision memory journal (per-world,
  7-day TTL), server-pressure cooldowns.
- **UI**: Spanish panel with 9 tabs (Resumen / Militar / Ajustes /
  Diagnóstico), Queue Center window, HUD widgets, ~170 config controls,
  stats + preflight read-path probes.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. Open `grepbot.user.js` raw → Tampermonkey offers install → confirm.
3. Open any `*.grepolis.com` world. Panel appears; start with **dry run ON**
   (Ajustes → General y seguridad) to validate behavior before enabling
   write features.

Auto-update is wired via `@updateURL`/`@downloadURL`; Tampermonkey keeps the
last working copy when the update source is unreachable.

## Build from source

`src/` holds the ~53 modules; `build.py` concatenates them (order matters)
with gates on duplicate declarations, `node --check`, and ASCII escaping.

```sh
python3 build.py   # writes grepbot.user.js
```

No linter, no test runner — validation is manual in-game with dry run first.

## Repo layout

```
src/            module sources (concat order lives in build.py)
build.py        build script + gates
grepbot.user.js built artifact (install this)
docs/           backlog, roadmap, regression archaeology, audits
```

## Disclaimer

Not affiliated with InnoGames. Provided as-is, no warranty. If your account
gets banned, that's on you.

## License

MIT — see [LICENSE](LICENSE).
