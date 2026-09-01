#!/usr/bin/env python3
"""One-off: split grepbot_v6.0.15-rc4-dev6.user.js back into src/ modules.

Boundary rule: each module starts at the line of its anchor declaration
(found via the top-level decl map) and runs to the next module's anchor.
Coverage is verified: concatenating header + modules + footer must
reproduce the original file byte-for-byte. Run before build.py; the build
artifact is then validated against the comment-stripped original.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
ARTIFACT = os.path.join(ROOT, 'grepbot_v6.0.15-rc4-dev6.user.js')

# (module, anchor_regex) — anchor matches the FIRST line of the module body.
# Order is the concat order; every anchor must match exactly one line.
D = r"^  (?:(?:async )?function\s*\*?\s*|(?:const|let|var)\s+)"
MODULES = [
    ('core.js',          D + r"GB_RELEASE\s*="),
    ('planner.js',       D + r"plannerCfgRoot\b"),
    ('tx.js',            D + r"TX_TERMINAL_TTL\b"),
    ('bridge.js',        D + r"selfBridgeLog\b"),
    ('journal.js',       D + r"JRN_DEDUP_MS\b"),
    ('spy.js',           D + r"SPY_LOAD_GATE_RE\b"),
    ('parse-inline.js',  D + r"tryParseJson\b"),
    ('farms.js',         D + r"farmRelLogSig\b"),
    ('towns.js',         D + r"townsFromGame\b"),
    ('collect.js',       D + r"collectMaxMin\b"),
    ('bandit.js',        D + r"banditIdle\b"),
    ('build-tab.js',     D + r"ibSafeFreeThresh\b"),
    ('city-designer.js', D + r"CD_PROFILE_DEFAULTS\b"),
    ('goals.js',         D + r"goalProfiles\b"),
    ('native-ui.js',     D + r"NATIVE_QUEUE_LANES\b"),
    ('build-auto.js',    D + r"abGetTown\b"),
    ('cave.js',          D + r"CAVE_MIN_STORE\b"),
    ('culture.js',       D + r"CULTURE_COSTS\b"),
    ('emergency.js',     D + r"EMERGENCY_MIN_RISK\b"),
    ('trade.js',         D + r"setTradeTownEnabled\b"),
    ('transport.js',     D + r"transportReservePct\b"),
    ('dump.js',          D + r"DUMP_SURPLUS_SHARE\b"),
    ('rural.js',         D + r"ruralFarmModels\b"),
    ('research-graph.js', D + r"RESEARCH_CS_FAST\b"),
    ('research.js',      D + r"researchCandidate\b"),
    ('telegram.js',      D + r"telegramApiUrl\b"),
    ('alerts.js',        D + r"alertIsTelegram\b"),
    ('merchant.js',      D + r"merchantRowPrice\b"),
    ('phoenician.js',    D + r"ptViewCache\b"),
    ('favor.js',         D + r"favorHasTemplePlunder\b"),
    ('god-spells.js',    D + r"godSpellCooldownStamp\b"),
    ('wonder.js',        D + r"wonderSpentToday\b"),
    ('dodge.js',         D + r"defenseLocalStrength\b"),
    ('recruit.js',       D + r"RECRUIT_AUTO_SPELL_BY_CONTROLLER\b"),
    ('qol.js',           D + r"gbWidgetSaveGeom\b"),
    ('orchestrate.js',   D + r"ORCH_JITTER\b"),
    ('intel.js',         D + r"intelMyIdentity\b"),
    ('quests.js',        D + r"questMo\b"),
    ('attack.js',        D + r"ATTACK_HISTORY_MAX\b"),
    ('shared-plan.js',   D + r"readAttackForm\b"),
    ('military.js',      D + r"playerHeroModels\b"),
    ('support.js',       D + r"SUPPORT_LEDGER_PRUNE_MS\b"),
    ('reinforce.js',     D + r"RF_MODE_ES\b"),
    ('spy-send.js',      D + r"spsCfg\b"),
    ('diagnostics.js',   D + r"SNAPSHOT_BUDGET_BYTES\b"),
    ('stats.js',         D + r"preflightLast\b"),
    ('context-menu.js',  D + r"CTX_POPUP_SEL\b"),
    ('hud.js',           D + r"HUD_ETA_CAP_H\b"),
    ('queue-center.js',  D + r"gbQueueCenterResearchPick\b"),
    ('ui.js',            D + r"tabFilters\b"),
    ('boot.js',          D + r"BOOT_TIMING\b"),
]

with open(ARTIFACT, encoding='utf-8') as f:
    lines = f.readlines()

# header: everything up to (not incl.) the GB_RELEASE line — userscript block
# + IIFE open + 'use strict'.
# footer: the final `})();` to EOF.
footer_idx = None
for i in range(len(lines) - 1, -1, -1):
    if lines[i].strip() == '})();':
        footer_idx = i
        break
if footer_idx is None:
    sys.exit('error: IIFE close not found')

anchors = []  # (module, line_idx)
for name, pat in MODULES:
    rx = re.compile(pat)
    hits = [i for i, L in enumerate(lines) if rx.match(L)]
    if len(hits) != 1:
        sys.exit(f'error: anchor for {name} matched {len(hits)} lines: {hits[:5]}')
    anchors.append((name, hits[0]))

idxs = [i for _, i in anchors]
if idxs != sorted(idxs):
    sys.exit('error: anchors out of order: ' + ', '.join(
        f'{n}@{i}' for (n, i), (pn, pi) in zip(anchors, anchors[1:]) if i <= pi))

if footer_idx <= idxs[-1]:
    sys.exit('error: footer before last anchor')

header_txt = ''.join(lines[:idxs[0]])
footer_txt = ''.join(lines[footer_idx:])

parts = [('header.js', header_txt)]
for k, (name, start) in enumerate(anchors):
    end = idxs[k + 1] if k + 1 < len(idxs) else footer_idx
    parts.append((name, ''.join(lines[start:end])))
parts.append(('footer.js', footer_txt))

# Coverage gate: concat must reproduce the original exactly.
if ''.join(t for _, t in parts) != ''.join(lines):
    sys.exit('error: split does not reproduce the artifact byte-for-byte')

os.makedirs(SRC, exist_ok=True)
written = []
for name, text in parts:
    # keep old modules not produced by this split out of the build
    path = os.path.join(SRC, name)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    written.append(name)

STALE = ['build-targets.js']  # merged into goals.js in the 6.x layout
for name in STALE:
    path = os.path.join(SRC, name)
    if os.path.exists(path):
        os.remove(path)
        written.append(name + ' (removed)')

new_modules = [n for n, _ in parts]

build = os.path.join(ROOT, 'build.py')
with open(build, encoding='utf-8') as f:
    src = f.read()
new_list = 'MODULES = [\n' + ''.join(f"    '{n}',\n" for n in new_modules) + ']'
src2, n = re.subn(r'MODULES = \[[^\]]*\]', new_list, src, count=1)
if n != 1:
    sys.exit('error: MODULES block not replaced in build.py')
with open(build, 'w', encoding='utf-8') as f:
    f.write(src2)

print('split into', len(parts), 'modules:')
for name in written:
    print(' ', name)
print('build.py MODULES updated')
