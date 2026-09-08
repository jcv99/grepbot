# Plan: llegar a 2000 puntos de combate

Generado por Claude al fijar `/goal` el 2026-08-14. El plan asume Grepolis
vanilla (sin mods de unidad) y estadísticas estándar de la wiki
(`attack + defense` = puntos de combate de una unidad, sin bonus de
liderazgo).

## Cómo Grepolis calcula los puntos de combate

Por la wiki oficial: **puntos de combate de un jugador = suma de ataque +
defensa** de todas las unidades militares propias (incluyendo soporte,
míticas y navales). El bot **no los calcula** — los calcula el servidor.
Cualquier movimiento que sume unidades propias se refleja al instante en
el total del perfil.

Por tanto la palanca única es **producir unidades**, y el acelerador
indirecto es **capturar** unidades enemigas (militia loot, ataques de
saqueo) — el ranking sube sin gastar recursos propios.

## Tabla de unidades vanilla (ordenada por ratio pts/recurso)

Los costes aproximados son los del juego base. Un parche de balance puede
ajustarlos; `gbGameDataLookup("units", id)` en la consola del juego da los
valores reales en tu mundo.

| unidad | atk | def | pts/u | pop | ratio pts/pop | coste típico |
|-------------|-----|-----|-------|-----|---------------|-----------------------|
| slinger | 40 | 30 | 70 | 1 | 70 | barato |
| archer | 45 | 15 | 60 | 1 | 60 | barato |
| hoplite | 50 | 45 | 95 | 1 | 95 | medio |
| swordsman | 30 | 25 | 55 | 1 | 55 | muy barato |
| charioteer | 100 | 80 | 180 | 4 | 45 | caro (cuarentena) |
| horseman | 150 | 30 | 180 | 6 | 30 | muy caro |

**Mejor ratio pts/pop = hoplita**. **Mejor ratio pts/unidad-de-tiempo =
slínger** (cuartel nivel 1 ya lo desbloquea). **Más barato de construir =
espadachín**, mejor ratio pts/recurso-construido.

Recomendación: **hoplita si el cuartel y la academia están avanzados;
slínger si solo tienes cuartel nivel bajo**. El espadachín es el "plan C"
cuando no hay recursos.

## Camino realista a 2000

| desde | hasta | gap | unidades a producir |
|-------|-------|--------|--------------------------------------------|
| 0 | 500 | +500 | ~9 hoplitas / ~10 slíngers / 16 espad. |
| 500 | 1000 | +500 | otros 9 hoplitas (~9h de cola) |
| 1000 | 1500 | +500 | 9 hoplitas + bonus de templo |
| 1500 | 2000 | +500 | batch grande o capturas |

Con barracks nivel 12-15 y 5 ciudades activas, 50 hoplitas por noche es
plausible. Plan de 3-7 días **sin templo**, 1-2 días **con templo Ares
(Entrenamiento espartano)** que duplica la cola de hoplitas por 12h.

## Cinco pasos en GrepBot (panel en español)

1. **Activar recoleccion y aldeas**.
 `Config > Recolección` → `autoFarm` ON, `autoCollectResources` ON.
Coste cero, financia la siguiente fase (plata).

2. **Subir el cuartel si está bajo**.
 `Construcción` → marcar `Cuartel` con nivel objetivo ≥ 10 (hoplita lo
requiere en algunas versiones, siempre desbloquea slinger).
Usar `Construir cola automática` o el FIFO del Queue Center.

3. **Activar auto-recruit (HIGH-RISK, esta es la palanca principal)**.
 `Config > Construcción` → `auto-recruit` ON. Lee el tooltip: pone la
mano en el teclado para resolver captcha si Grepolis lo lanza (la
primera vez suele pedirlo).

4. **Definir las unidades objetivo por ciudad**.
 `Goals > [ciudad]` → sección `units`. Ejemplo mínimo viable para un
mundo temprano:
 ```
     slinger: 60
     hoplite: 0     # hasta tener cuartel 10
     ```
Para mundo medio con cuartel 12+:
 ```
     hoplite: 80
   ```
GrepBot solo reclutará si `población libre` y `recursos` lo permiten;
un valor muy alto queda en cola cuando llega la plata, no es un error.

5. **(Opcional, multiplica x2) Templo + hechizo de Ares**.
Si la ciudad es de Ares, `Config > Premium/defensa > hechizo
   entrenamiento` activo (`recruit-spells`) y `favorCfg.recruitPower =
   spartan_training`. El hechizo dobla la velocidad de reclutamiento de
hoplitas durante 12h. **Irreversible** — primero gastar plata en
aldeas antes de tirarlo en favor.

## Captcha y pausa (no te atrape el servidor)

- Si el bot anuncia `⏸farm,bandit,…` o `⏸srv:30s`, **NO** metas más
toggles. Esperar el cooldown. La barra de status del pie (footer)
muestra el motivo exacto.
- Si salta captcha en `Settings`, GrepBot pausa la feature 5min y
reintenta. El toggle NO se desactiva solo.
- En `Stats > journal decisions` ves el último fallo; cuando dice
 `ok` tres veces seguidas para la misma feature, la cadena está sana.

## Validar antes de dejar el bot solo

Con la pestaña abierta en un mundo:

1. `Acciones > Preflight` → coste-research, warehouses, recruit-controller
por ciudad. Si algo marca `fail`, NO actives el toggle, arregla el
prerequisite primero.
2. `Stats > journal > recruit` después de 5min → debe haber al menos
una entrada `ok`. Si solo hay `skip:queue` o `skip:resources`, sube
el slider de recruit o dales tiempo (la cola real del juego va a su
ritmo).

## Capturas gratis (no requieren recursos)

- **Militia loot** sobre aldeas bárbaras o polis pequeñas: las unidades
que quedan en la aldea tras saquear suman a tus puntos. GrepBot tiene
 `autoBandit` → activarlo si tienes héroes de sobra.
- **Ataques de saqueo** sobre aldeas agrícolas inactivas de vecinos.
ToS riesgo alto; el bot solo lanza si pulsas `Enviar ataque` en el
panel `Ataque`. **Confirmar a mano siempre**.

## Riesgos conocidos

- **Recruit es irreversible**. Si la cola está mal apuntada (p.ej. poner
 `hoplite: 99999` sin cuartel), el bot reintenta cada 20s hasta que
reciba `no-prerequisite` del servidor y desactiva solo esa ciudad —
pero el daño de plata ya está hecho. Por eso el **paso 4 importa**:
empieza con números conservadores.
- **`recruitSpells` mal sincronizado** con el dios de la ciudad = server
rechaza cada intento, la feature entra en skip window. La validación
interna (`recruitSpellGateOk` en `src/recruit.js`) lo bloquea antes de
postear; si ves `skip:god-mismatch:<g>!=<need>`, desactiva el hechizo
para esa ciudad.
- **Población**: una cola parada a las 02:00 porque dormiste se
convierte en 200 hoplitas a las 18:00 si el cuartel da. La paciencia
es parte del plan.

## Resumen — copiar y pegar en el panel

```
[Config > Recolección]
autoFarm ON
autoCollectResources ON

[Config > Construcción]
auto-recruit ON (HIGH-RISK, mantener pestaña abierta)
recruit-spells OFF (activar solo si ciudad de Ares)

[Goals > cada ciudad]
units:
slinger: 60 (mundo temprano)
hoplite: 80 (cuartel 12+)

[Construcción]
Cuartel → nivel 10 mínimo (hoplita) / 12 recomendado
```

Con auto-farm ON, la plata llega sola; con auto-recruit ON y targets
modestos, los 2000 puntos llegan en 3-7 días. Si Ares está en el mapa,
hechizo opcional dobla la cuenta en 24h.
