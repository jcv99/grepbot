#!/usr/bin/env python3
"""Focused guards for the 2026-09-16 deep-audit repairs.

These checks intentionally inspect authoritative ``src/`` rather than the
generated userscript.  They protect small cross-module contracts that are easy
to omit when adding a feature or restoring code from history.  The normal build
and artifact-surface checks separately prove source/artifact assembly.

Pure stdlib; run directly with::

    python3 tests/audit_regressions.py
"""

from __future__ import annotations

import ast
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


class CheckFailure(AssertionError):
    """One audit invariant failed."""


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _balanced_block(text: str, open_at: int) -> str:
    """Return one JS brace block, ignoring braces in strings/comments."""
    if open_at < 0 or text[open_at] != "{":
        raise CheckFailure("internal test error: block does not start at '{'")

    depth = 0
    quote: str | None = None
    escaped = False
    line_comment = False
    block_comment = False
    i = open_at
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if line_comment:
            if ch == "\n":
                line_comment = False
        elif block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 1
        elif quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
        elif ch == "/" and nxt == "/":
            line_comment = True
            i += 1
        elif ch == "/" and nxt == "*":
            block_comment = True
            i += 1
        elif ch in ("'", '"', "`"):
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[open_at : i + 1]
        i += 1
    raise CheckFailure("unterminated JavaScript block")


def _function_body(text: str, name: str) -> str:
    match = re.search(rf"\bfunction\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", text)
    if not match:
        raise CheckFailure(f"function {name} not found")
    return _balanced_block(text, match.end() - 1)


def _const_expression(text: str, name: str) -> str:
    match = re.search(rf"\bconst\s+{re.escape(name)}\s*=", text)
    if not match:
        raise CheckFailure(f"const {name} not found")
    start = match.end()
    quote: str | None = None
    escaped = False
    depths = {"(": 0, "[": 0, "{": 0}
    closes = {")": "(", "]": "[", "}": "{"}
    i = start
    while i < len(text):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = None
        elif ch in ("'", '"', "`"):
            quote = ch
        elif ch in depths:
            depths[ch] += 1
        elif ch in closes:
            depths[closes[ch]] -= 1
        elif ch == ";" and not any(depths.values()):
            return text[start:i]
        i += 1
    raise CheckFailure(f"unterminated const expression for {name}")


def _python_function_source(text: str, name: str) -> str:
    tree = ast.parse(text)
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            segment = ast.get_source_segment(text, node)
            if segment is None:
                break
            return segment
    raise CheckFailure(f"function {name} not found")


def _string_literals(expression: str) -> list[str]:
    return [value for _, value in re.findall(r"(['\"])([A-Za-z0-9_-]+)\1", expression)]


def _object_keys(expression: str) -> set[str]:
    return set(re.findall(r"(?m)^\s{4}([A-Za-z_$][\w$]*)\s*:", expression))


def _expect(condition: bool, message: str) -> None:
    if not condition:
        raise CheckFailure(message)


def check_broadcast_channel_disposal() -> None:
    core = _read(SRC / "core.js")
    dispose = _function_body(core, "grepbotDispose")
    _expect(
        re.search(r"\b_gbEvents\s*\.\s*close\s*\(", dispose) is not None,
        "grepbotDispose must close the lazy captcha BroadcastChannel",
    )
    _expect(
        re.search(r"\b_gbEvents\s*=\s*null\b", dispose) is not None,
        "grepbotDispose must clear _gbEvents after closing it",
    )


def check_registry_sections_survive_truncation() -> None:
    stats = _read(SRC / "stats.js")
    registry = _function_body(stats, "gbRegistryJson")
    required = {
        "meta", "toggles", "scheduler", "schedulerCapacity", "templates", "captcha", "server",
        "locks", "budget", "counts", "recentByFeature", "lastOk",
        "lastSkip", "decisionSkips", "scrapes", "wake", "tplHealth",
        "decisions", "log", "findings", "config", "nativeQueue", "bridge",
        "preflight",
    }
    missing = sorted(key for key in required if not re.search(rf"\b{key}\s*:", registry))
    _expect(not missing, f"gbRegistryJson lost required top-level sections: {missing}")
    unbounded = sorted(
        key for key in required
        if not re.search(rf"\b{key}\s*:\s*section\s*\(", registry)
    )
    _expect(
        not unbounded,
        f"gbRegistryJson sections must use independent bounded redaction: {unbounded}",
    )
    _expect(
        re.search(r"\breturn\s+gbRedact\s*\(\s*\{", registry) is None,
        "gbRegistryJson must not share one gbRedact entry budget across the root object",
    )
    _expect(
        "maxEntries" in registry,
        "gbRegistryJson must keep explicit bounded redaction for exported sections",
    )


def check_orchestrator_registry_parity() -> None:
    core = _read(SRC / "core.js")
    orchestrate = _read(SRC / "orchestrate.js")
    order = _string_literals(_const_expression(core, "ORCH_ORDER_DEFAULT"))
    handlers = _object_keys(_const_expression(orchestrate, "ORCH_HANDLERS"))
    _expect("gold" in order, "ORCH_ORDER_DEFAULT must include gold")
    _expect(len(order) == len(set(order)), "ORCH_ORDER_DEFAULT contains duplicate keys")
    _expect(
        set(order) == handlers,
        "ORCH_ORDER_DEFAULT and ORCH_HANDLERS differ: "
        f"order-only={sorted(set(order) - handlers)}, "
        f"handler-only={sorted(handlers - set(order))}",
    )


def check_orchestrator_capacity_contract() -> None:
    qol = _read(SRC / "qol.js")
    orchestrate = _read(SRC / "orchestrate.js")
    stats = _read(SRC / "stats.js")
    max_expr = _const_expression(qol, "ORCH_MAX_PER_TICK").strip()
    pressure_expr = _const_expression(qol, "ORCH_PRESSURE_MAX_PER_TICK").strip()
    _expect(max_expr.isdigit(), "ORCH_MAX_PER_TICK must remain an auditable integer literal")
    _expect(
        int(max_expr) >= 6,
        "normal scheduler capacity must dispatch at least six due features per tick",
    )
    _expect(
        pressure_expr.isdigit() and 0 < int(pressure_expr) <= int(max_expr),
        "pressure scheduler cap must be positive and no greater than the normal cap",
    )
    status = _function_body(orchestrate, "orchCapacityStatus")
    for field in ("saturatedTicks", "saturationPct", "lastDeferred", "maxOverdueMs", "maxPerTick"):
        _expect(field in status, f"orchCapacityStatus must export {field}")
    evidence = _function_body(stats, "gbEvidence")
    registry = _function_body(stats, "gbRegistryJson")
    _expect(
        re.search(r"\bschedulerCapacity\s*:\s*[^\n]*orchCapacityStatus", evidence) is not None,
        "gbEvidence must export orchCapacityStatus telemetry",
    )
    _expect(
        re.search(r"\bschedulerCapacity\s*:\s*section\s*\(", registry) is not None,
        "registry export must retain bounded scheduler-capacity telemetry",
    )


def check_removed_tx_dead_code() -> None:
    tx = _read(SRC / "tx.js")
    core = _read(SRC / "core.js")
    for symbol in ("TX_MANUAL_REVIEW_TTL_MS", "txManualReviewPermanent"):
        _expect(symbol not in tx, f"unused TX symbol still present: {symbol}")
    _expect(re.search(r"^\s*merchant\s*:\s*\d+", core, re.M) is None,
            "obsolete merchant lock TTL still duplicates the shared pt-trade lock")


def check_phoenician_transaction_contract() -> None:
    merchant = _read(SRC / "merchant.js")
    phoenician = _read(SRC / "phoenician.js")
    planner = _read(SRC / "planner.js")
    tx = _read(SRC / "tx.js")
    scan = _function_body(merchant, "merchantScan") + _function_body(merchant, "merchantBuy")
    post = _function_body(phoenician, "ptTradePost")
    effect = _function_body(planner, "plannerEffect")
    intent = _function_body(tx, "txIntent")
    reconcile = _function_body(tx, "txReconcileNow")
    _expect(re.search(r"gbLock\s*\(\s*['\"]pt-trade['\"]", scan) is not None
            and re.search(r"gbLock\s*\(\s*['\"]merchant['\"]", scan) is None,
            "merchant and pttrade must share the pt-trade lock")
    _expect("txSetLocalHint" in post,
            "ptTradePost must attach local evidence without changing wire payload fields")
    _expect("feature === 'merchant' || feature === 'pttrade'" in effect and "payResource" in effect,
            "plannerEffect must reserve the Phoenician payment resource")
    _expect("return `pttrade:" in intent,
            "merchant and pttrade must share one stable transaction intent namespace")
    _expect("s.kind === 'merchant' || s.kind === 'pttrade'" in reconcile
            and "paid && received" in reconcile,
            "Phoenician reconciliation must require direct offer/resource evidence")


def check_remote_config_changes() -> None:
    header = _read(SRC / "header.js")
    source = "\n".join(_read(path) for path in SRC.glob("*.js") if path.name != "header.js")
    has_value_listener = "GM_addValueChangeListener" in source
    has_config_channel = bool(
        re.search(r"BroadcastChannel\s*\([^\n)]*(?:config|settings)", source, re.I)
    )
    _expect(
        has_value_listener or has_config_channel,
        "no cross-tab config change listener/channel is installed",
    )
    if has_value_listener:
        start = _function_body(source, "gbConfigSyncStart")
        publish = _function_body(source, "gbConfigSyncPublish")
        dispose = _function_body(source, "gbConfigSyncDispose")
        save = _function_body(source, "save")
        lifecycle_dispose = _function_body(source, "grepbotDispose")
        shared_fields = _const_expression(source, "GB_SHARED_CONFIG_FIELDS")
        _expect(
            re.search(r"^//\s*@grant\s+GM_addValueChangeListener\s*$", header, re.M)
            is not None,
            "header must grant GM_addValueChangeListener",
        )
        _expect(
            re.search(r"^//\s*@grant\s+GM_removeValueChangeListener\s*$", header, re.M)
            is not None,
            "header must grant GM_removeValueChangeListener",
        )
        _expect(
            re.search(r"\bremote\b", start) is not None
            and "gbReloadSharedConfigState" in start,
            "value-change callback must distinguish remote changes",
        )
        _expect(
            "CONFIG_REV" in publish,
            "config mutations must publish a world-scoped revision",
        )
        _expect("gbConfigSyncPublish" in save,
                "successful storage writes must publish relevant config revisions")
        _expect(
            "GM_removeValueChangeListener" in dispose,
            "registered GM value-change listeners must be removed on disposal",
        )
        _expect("gbConfigSyncDispose" in lifecycle_dispose,
                "instance disposal must remove the config listener")
        for critical in ("DRY_RUN", "SAFE_MODE", "FIRST_POST_CONFIRM", "ENABLED_HOSTS", "PRIORITY_ORDER"):
            _expect(f"STORE.{critical}" in shared_fields,
                    f"shared config reload must cover safety-critical {critical}")
        _expect("STORE.PREDICT_CFG" in shared_fields,
                "shared config reload must cover automated threat prediction settings")
        _expect("gbReloadSharedConfigState('subscribe')" in start,
                "config listener must subscribe before its initial reload")
        _expect(
            source.count("gbConfigSyncStart(") >= 2,
            "gbConfigSyncStart is declared but never called during boot",
        )


def check_follower_queue_rollback() -> None:
    native = _read(SRC / "native-ui.js")
    qol = _read(SRC / "qol.js")
    bridge = _read(SRC / "bridge.js")
    restore = _function_body(native, "nativeQueueFollowerRestore")
    save_now = _function_body(native, "nativeQueueSaveNow")
    _expect("gbStorageReadFailed" in restore and re.search(r":\s*\{version:1,seq:0,towns:\{\}\}", restore) is not None,
            "follower queue rejection must clear runtime work when authoritative storage is unreadable")
    _expect("nativeQueueFollowerRestore" in save_now,
            "follower queue saves must route through fail-closed rollback")
    config_import = _function_body(qol, "qolImportConfig")
    _expect(re.search(r"k\s*===\s*['\"]nativeQueue['\"]\s*&&\s*!gbTabLeader", config_import) is not None,
            "config import/undo must not mutate nativeQueue from a follower tab")
    leader_reload = _function_body(bridge, "gbReloadSharedRuntimeState")
    _expect("leader-reload-nq-failed" in leader_reload and "storage unreadable; runtime queue disabled" in leader_reload,
            "leader promotion must disable cached queue work after a storage read failure")


def check_native_recruit_unknown_reconciliation() -> None:
    native = _read(SRC / "native-ui.js")
    recruit = _read(SRC / "recruit.js")
    reconcile = _function_body(native, "nativeQueueReconcileRecruit")
    normalize = _function_body(native, "nativeQueueNormalizeRecruitLane")
    recover = _function_body(native, "nativeQueueRecruitUnknownTx")
    scan = _function_body(recruit, "recruitScan")
    _expect("txUnitStatus" in reconcile and "totalBefore" in reconcile,
            "native recruit reconciliation must include trained units after the real queue drains")
    _expect("TX_UNKNOWN_MAX_MS" in reconcile and "manualReview=true" in reconcile,
            "native recruit uncertainty must have a bounded automatic reconciliation window")
    _expect("totalBefore:unitBefore&&gbNum(unitBefore.total)" in scan,
            "native recruit inflight evidence must capture total units before posting")
    _expect("err === 'unknown'" in scan,
            "native recruit callback must classify txRun's canonical unknown result as ambiguous")
    _expect("head.inflight&&!head.reconcile" in scan and "head.manualReview=!!" in scan,
            "pending recruit reconciliation must preserve its original age without blocking retries immediately")
    _expect("state.txState" in recover and "snapshot" in recover and "TX_UNKNOWN_MAX_MS" in recover,
            "persisted recruit unknowns must recover only from the matching bounded transaction evidence")
    _expect("nativeQueueRecruitUnknownTx" in normalize and "totalBefore" in normalize,
            "v6.0.92 manual-review rows must restore their original pre-send total when possible")
    _expect("sin evidencia suficiente" in normalize and "manualReview=false" in normalize,
            "legacy rows without transaction evidence must open a bounded reconcile window instead of staying wedged")


def check_focused_build_gate_is_fatal() -> None:
    build = _read(ROOT / "build.py")
    gate = _python_function_source(build, "audit_regression_gate")
    _expect(
        "tests', 'audit_regressions.py" in gate,
        "audit_regression_gate must execute the focused contract suite",
    )
    _expect(
        "--warn-only" not in gate,
        "audit_regression_gate must fail the build instead of warning only",
    )
    build_fn = _python_function_source(build, "build")
    _expect(
        "audit_regression_gate()" in build_fn,
        "build() must invoke the focused regression gate",
    )


CHECKS = (
    ("BroadcastChannel disposal", check_broadcast_channel_disposal),
    ("registry section preservation", check_registry_sections_survive_truncation),
    ("orchestrator registry parity", check_orchestrator_registry_parity),
    ("orchestrator capacity", check_orchestrator_capacity_contract),
    ("TX dead-code removal", check_removed_tx_dead_code),
    ("Phoenician transaction safety", check_phoenician_transaction_contract),
    ("remote config propagation", check_remote_config_changes),
    ("follower queue rollback", check_follower_queue_rollback),
    ("native recruit unknown reconciliation", check_native_recruit_unknown_reconciliation),
    ("focused build gate", check_focused_build_gate_is_fatal),
)


def main() -> int:
    failures: list[str] = []
    for label, check in CHECKS:
        try:
            check()
        except (CheckFailure, OSError) as exc:
            failures.append(f"{label}: {exc}")
            print(f"[FAIL] {label}: {exc}")
        else:
            print(f"[OK] {label}")
    if failures:
        print(f"\nFAIL - {len(failures)} audit regression check(s) failed")
        return 1
    print("\nPASS - audit regression contracts hold")
    return 0


if __name__ == "__main__":
    sys.exit(main())
