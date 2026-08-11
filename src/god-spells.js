  // ===== Divine spell automation (v4 plan 4.4) ===============================
  // HIGH-RISK. Favor is irreversible once spent, so every gate here fails
  // CLOSED and the loop is off until the operator names an explicit power id.
  //
  // NEVER DEFAULT A POWER ID. CLAUDE.md is explicit about this, and the reason
  // is concrete: defaulting to call_of_the_ocean would spend a temple's favor
  // on a recruit accelerator the user never asked for. An empty or unrecognised
  // id logs once and casts nothing.
  //
  // The non-recruit power ids (meteor and friends) are NOT known to this tree.
  // The gate reports blind for them and the server decides; nothing invents an
  // id, and godSpellScan still refuses to cast one the user did not type.
  //
  // The cooldown registry is SHARED with recruit.js (same STORE.SPELL_COOLDOWN,
  // same 30-minute window), so a recruit cast and a god cast on the same town
  // cannot double-charge the same favor pool.

  const GODSPELL_DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

  function godSpellCooldown(townId, powerId) {
    return recruitSpellCooldown(townId, powerId);
  }
  function godSpellCooldownStamp(townId, powerId, ms) {
    return recruitSpellCooldownStamp(townId, powerId, ms || GODSPELL_DEFAULT_COOLDOWN_MS);
  }
  function godSpellHasCast(townId, powerId) {
    return recruitHasSpell(townId, powerId);
  }
  // {ok, blind, why}. A power this tree has no god mapping for is BLIND, not
  // rejected: the server is the authority for ids we have never seen.
  function godSpellGateOk(townId, powerId) {
    if (!powerId) return { ok: false, blind: false, why: 'no-power' };
    const academy = gbBuildingLevel(townId, 'academy');
    if (academy != null && academy < 1) return { ok: false, blind: false, why: 'no-academy' };
    const need = RECRUIT_SPELL_GODS[powerId];
    if (!need) return { ok: true, blind: true, why: 'unknown-power-id' };
    const god = recruitTownGod(townId);
    if (god == null) return { ok: true, blind: true, why: 'god-unreadable' };
    if (god !== need) return { ok: false, blind: false, why: `god-mismatch:${god}!=${need}` };
    return { ok: true, blind: false, why: null };
  }
  function godSpellCast(townId, powerId, onDone) {
    if (!powerId) return onDone && onDone('bad-power');
    gameAjaxPost('spell', 'town_overviews', 'cast_power', {
      power_id: powerId,
      town_id: +townId,
    }, (err, data) => {
      // An unknown outcome stamps the cooldown anyway: favor may already be
      // gone, and re-casting on an unresolved post is the irreversible
      // double-spend the persisted window exists to prevent.
      if (err === 'timeout' || err === 'timeout_unknown' || err === 'pending') {
        godSpellCooldownStamp(townId, powerId);
      }
      if (onDone) onDone(err, data);
    });
  }
  function godSpellReservePct() {
    const n = +((state.favorCfg || {}).spellReserve);
    return Number.isFinite(n) ? Math.max(0, Math.min(95, n)) : 50;
  }
  // Maximum favor for a god, or null when the client does not expose it. Never
  // substituted with a constant - see the reserve comment in godSpellScan.
  function godSpellFavorMax(god) {
    const f = favorCurrent() || {};
    for (const k of ['max_' + god, god + '_max', 'max_favor', 'favor_max']) {
      const v = +f[k];
      if (Number.isFinite(v) && v > 0) return v;
    }
    return null;
  }
  function godSpellFavorFor(god) {
    const f = favorCurrent() || {};
    const v = +(f[god] != null ? f[god] : f['favor_' + god]);
    return Number.isFinite(v) ? v : null;
  }
  function godSpellScan(reason) {
    // autoFavor is the user's mental model for "let the bot spend favor".
    if (!state.autoFavor) return;
    if (!hostEnabled() || automationPaused({})) return;
    if (captchaPaused('godspell')) return;
    if (gbLocked('godspell')) return;
    const cfg = state.favorCfg || {};
    const power = cfg.spellPower ? String(cfg.spellPower) : '';
    if (!power) {
      gbLogT('godspell-nopower', 300000, 'godspell: no power id set - nothing is cast without an explicit id');
      return;
    }
    if (!/^[a-z0-9_]{2,48}$/i.test(power)) {
      gbLogT('godspell-badpower', 600000, `godspell: power id "${power.slice(0, 24)}" is not a plausible id - refusing`);
      return;
    }
    // THE TARGETED-CAST PAYLOAD IS UNKNOWN. The only cast shape proven in this
    // tree is the recruit self-buff, {power_id, town_id}, which addresses the
    // CASTING town and carries no target field. Sending that for a spell that
    // needs a target would land it on the wrong town or be rejected outright,
    // and inventing a target field is exactly what CLAUDE.md forbids.
    //
    // So: if the operator has configured a target, refuse and say why. Casting
    // resumes only for self-shaped powers, or once a hand-cast teaches the
    // targeted payload.
    if (cfg.targetId) {
      gbLogT('godspell-target-unknown', 600000,
        'godspell: a target is configured but the targeted-cast payload is not known on this client - refusing rather than casting at the wrong town');
      return;
    }
    let ids = [];
    try { ids = (townsFromGame() || []).map(t => String(t.id)); } catch (_) {}
    if (!ids.length) return;
    for (const townId of ids) {
      if (!favorHasTemplePlunder(townId)) continue;
      if (godSpellHasCast(townId, power)) continue;
      if (godSpellCooldown(townId, power) > 0) continue;
      const gate = godSpellGateOk(townId, power);
      if (!gate.ok) {
        gbLogT('godspell-gate-' + townId, 300000, `godspell: town ${townId} blocked (${gate.why})`);
        continue;
      }
      if (gate.blind) gbLogT('godspell-blind-' + townId, 600000, `godspell: town ${townId} ${gate.why} - server is the authority`);
      const need = RECRUIT_SPELL_GODS[power];
      if (need) {
        const have = godSpellFavorFor(need);
        // Unreadable favor is UNKNOWN, not zero, and not "plenty": refuse
        // rather than spend a pool we could not measure.
        if (have == null) {
          gbLogT('godspell-favor-blind-' + townId, 600000, `godspell: ${need} favor unreadable - not casting`);
          continue;
        }
        const cost = +cfg.spellCost;
        if (Number.isFinite(cost) && cost > 0) {
          // The reserve is a percentage of the READ maximum, never of a guessed
          // pool size. The temple cap varies with level and research, so a
          // hardcoded 500 would either block safe casts or permit an overspend.
          // Unreadable maximum falls back to an absolute floor the operator can
          // reason about: keep at least one more cast in the bank.
          const max = godSpellFavorMax(need);
          const reserve = max != null
            ? Math.ceil(max * godSpellReservePct() / 100)
            : cost;
          if (have - cost < reserve) {
            gbLogT('godspell-reserve-' + townId, 300000,
              `godspell: ${need} ${have} would drop below the reserve (${reserve}${max == null ? ', maximo no legible' : ''})`);
            continue;
          }
        }
      }
      const lockToken = gbLock('godspell');
      if (!lockToken) return;
      godSpellCooldownStamp(townId, power);
      godSpellCast(townId, power, (err) => {
        gbUnlock('godspell', lockToken);
        if (!err) gbLog(`godspell: cast ${power} from town ${townId}`);
        else gbLogT('godspell-err', 60000, `godspell: ${power} town ${townId} err ${err}`);
      });
      return; // one cast per scan
    }
    gbLogT('godspell-idle', 600000, `godspell: nothing to cast (${reason || 'scan'})`);
  }
