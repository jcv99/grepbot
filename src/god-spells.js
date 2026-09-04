  function godSpellCooldownStamp(townId, powerId, ms) {
    return recruitSpellCooldownStamp(townId, powerId, ms || GODSPELL_DEFAULT_COOLDOWN_MS);
  }
  function godSpellHasCast(townId, powerId) {
    return recruitHasSpell(townId, powerId);
  }

  function godSpellGateOk(townId, powerId) {
    if (!powerId) return { ok: false, blind: false, why: 'no-power' };
    if (!RECRUIT_SPELLS.includes(powerId)) return { ok: false, blind: false, why: 'power-not-allowlisted' };
    const academy = gbBuildingLevel(townId, 'academy');
    if (academy != null && academy < 1) return { ok: false, blind: false, why: 'no-academy' };
    const need = RECRUIT_SPELL_GODS[powerId];
    if (!need) return { ok: false, blind: true, why: 'power-god-unmapped' };
    const god = recruitTownGod(townId);
    if (god == null) return { ok: true, blind: true, why: 'god-unreadable' };
    if (god !== need) return { ok: false, blind: false, why: `god-mismatch:${god}!=${need}` };
    return { ok: true, blind: false, why: null };
  }
  function godSpellCast(townId, powerId, onDone) {
    if (!powerId) return onDone && onDone('bad-power');

    spellCastPost(townId, powerId, (err, data) => {

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

  function godSpellFavorMax(god) {
    const f = favorCurrent() || {};
    for (const k of ['max_' + god, god + '_max', 'max_favor', 'favor_max']) {
      const v = gbNum(f[k]);
      if (v != null && v > 0) return v;
    }
    return null;
  }
  function godSpellFavorFor(god) {
    const f = favorCurrent() || {};
    const v = gbNum(f[god] != null ? f[god] : f['favor_' + god]);
    return v;
  }
  function godSpellScan(reason) {

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

        if (have == null) {
          gbLogT('godspell-favor-blind-' + townId, 600000, `godspell: ${need} favor unreadable - not casting`);
          continue;
        }
        const cost = gbNum(cfg.spellCost);
        if (cost != null && cost > 0) {

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
      return;
    }
    gbLogT('godspell-idle', 600000, `godspell: nothing to cast (${scanReason(reason)})`);
  }
  function wonderLoadSpent() {
    const day = gbServerDay();
    const saved = load(STORE.WONDER_SPENT, null);
    if (saved && saved.day === day) return { day, amount: +saved.amount || 0 };
    return { day, amount: 0 };
  }
  function wonderSaveSpent(spent) {
    save(STORE.WONDER_SPENT, { day: spent.day, amount: spent.amount });
  }
