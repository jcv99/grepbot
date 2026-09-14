  };

  const __gbBoot = () => {
    try { __gbStart(); }
    catch (e) { try { console.error('[grepbot] deferred startup failed', e); } catch (_) {} }
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(__gbBoot, { timeout: 2200 });
  else setTimeout(__gbBoot, 600);
})();
