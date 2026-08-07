  // ---------- military helpers (Phase 10): defense pull ----------
  function militaryDefensePull(targetTownId, onDone) {
    if (!hostEnabled() || captchaPaused('attack') || automationPaused({})) return onDone && onDone('paused');
    if (gbLocked('defense-pull')) return onDone && onDone('busy');
    const uw = gameUw();
    const targetCoords = townCoords(targetTownId);
    const target = {
      town_id: +targetTownId,
      x: targetCoords.x,
      y: targetCoords.y,
      island: targetCoords.island,
    };
    const jobs = [];
    try {
      for (const id of Object.keys((uw.ITowns && uw.ITowns.towns) || {})) {
        if (String(id) === String(targetTownId)) continue;
        const t = uw.ITowns.towns[id];
        const u = Object.assign({}, t.units && t.units());
        delete u.militia;
        // send defensive land stack
        const send = {};
        ['sword', 'archer', 'hoplite', 'rider', 'chariot'].forEach(k => {
          if (+u[k] > 0) send[k] = +u[k];
        });
        if (!Object.keys(send).length) continue;
        const same = isSameIsland(id, target);
        if (!same) {
          // Off-island land units need transporters — add boats or skip.
          Object.keys(u).forEach(uid => {
            const m = unitMeta(uid);
            if (m && (m.capacity > 0 || m.berth > 0) && +u[uid] > 0) send[uid] = +u[uid];
          });
          const boats = boatCapacityCheck(send, false);
          if (!boats.ok) {
            gbLogT('def-pull-boats-' + id, 60000,
              `defense-pull: skip town ${id} → ${targetTownId} (${boats.reason || 'no transport'})`);
            continue;
          }
        }
        jobs.push({ from: id, units: send });
        if (jobs.length >= 5) break;
      }
    } catch (_) {}
    if (!jobs.length) return onDone && onDone('no-units');
    gbLock('defense-pull');
    let i = 0, done = 0;
    (function next() {
      if (i >= jobs.length) {
        gbUnlock('defense-pull');
        gbLog(`defense-pull: ${done}/${jobs.length} → ${targetTownId}`);
        return onDone && onDone(null, done);
      }
      const j = jobs[i++];
      sendAttackViaBridge({ town_id: +targetTownId, kind: 'town' }, j.from, j.units, 'support', (err) => {
        if (!err) done++;
        gbTimeout(next, 700 + Math.random() * 400);
      });
    })();
  }
