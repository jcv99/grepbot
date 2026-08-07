# run-grepbot

Build, syntax-check and headlessly drive the GrepBot userscript panel.

Full smoke (build + `node --check` + boot in headless Chromium + click all
11 tabs + `Actions > Preflight` + screenshots):

```sh
node .claude/skills/run-grepbot/driver.mjs
```

Exit `0` pass, `1` build/artifact problem, `2` boot or panel failure.
Artifacts land in `data/smoke/`.

Poke the live panel instead (stdin REPL — `tab`, `click`, `text`, `html`,
`eval`, `ss`, `errors`, `preflight`, `quit`):

```sh
printf 'tab config\ntext #grepbot-panel section[data-tab=config]\nss cfg\nquit\n' \
  | node .claude/skills/run-grepbot/driver.mjs repl --no-build
```

Full docs, gotchas and troubleshooting:
`.claude/skills/run-grepbot/SKILL.md`.
