// Static command surface. Each entry is one MCP tool that proxies a single
// `{type:'command', cmd, args}` to the in-tab GrepBot relay.
//
// Risk class drives the tool description (read / write / raw) and lets the
// MCP caller decide whether to call. The bot owns every gate
// (relayCommands / relayRaw / arm window / write rate), so a write tool here
// will still be refused if the bot is disarmed.

export type Risk = 'read' | 'write' | 'raw';

export interface CommandSpec {
  // MCP tool name (camelCase to match client-side conventions).
  name: string;
  // Relay `cmd` field -- exactly the string the bot expects.
  cmd: string;
  risk: Risk;
  // One-line plain-text summary shown in tool listing.
  summary: string;
  // JSON Schema fragment for the tool's `args`. Object schema, properties
  // listed in a stable order so the model sees the same surface on every
  // turn.
  args: Record<string, { type: string; description: string; required?: boolean }>;
}

const entries: CommandSpec[] = [
  // -- read ---------------------------------------------------------------
  { name: 'gbManifest', cmd: 'manifest', risk: 'read', summary: 'List every relay command and its risk class.', args: {} },
  { name: 'gbStatus', cmd: 'status', risk: 'read', summary: 'Bot health: gates, pauses, budget, locks, arm window, version.', args: {} },
  { name: 'gbSnapshot', cmd: 'snapshot', risk: 'read', summary: 'Force a fresh snapshot push for one section.', args: { kind: { type: 'string', description: 'farms|towns|player|queues|bp|map', required: true } } },
  { name: 'gbUnits', cmd: 'units', risk: 'read', summary: 'Live units in a town with off/def/naval class.', args: { town_id: { type: 'number', description: 'town id', required: true } } },
  { name: 'gbTown', cmd: 'town', risk: 'read', summary: 'Resources, population, coords, building levels for a town.', args: { town_id: { type: 'number', description: 'town id', required: true } } },
  { name: 'gbIncoming', cmd: 'incoming', risk: 'read', summary: 'Hostile incoming movements (attacks, colonise, revolt).', args: {} },
  { name: 'gbOutgoing', cmd: 'outgoing', risk: 'read', summary: 'Your own outgoing commands plus colony threats.', args: {} },
  { name: 'gbQueues', cmd: 'queues', risk: 'read', summary: 'GrepBot virtual queue for a town/lane.', args: { town_id: { type: 'number', description: 'town id (optional)', required: false }, lane: { type: 'string', description: 'build|recruit|recruitNaval|research (optional)', required: false } } },
  { name: 'gbPlan', cmd: 'plan', risk: 'read', summary: 'Goal planner output for one town, or every town.', args: { town_id: { type: 'number', description: 'town id (optional)', required: false } } },
  { name: 'gbSimulate', cmd: 'simulate', risk: 'read', summary: 'Forecast what the bot would do over N hours. Sends nothing.', args: { town_id: { type: 'number', description: 'town id (optional)', required: false }, hours: { type: 'number', description: 'forecast window in hours', required: false } } },
  { name: 'gbIntel', cmd: 'intel', risk: 'read', summary: 'Threat board, dossiers and ranked spy targets.', args: {} },
  { name: 'gbJournal', cmd: 'journal', risk: 'read', summary: 'Decision-journal slice, rollup stats, active skip windows.', args: { limit: { type: 'number', description: 'rows to return', required: false }, feature: { type: 'string', description: 'filter by feature key', required: false } } },
  { name: 'gbPreflight', cmd: 'preflight', risk: 'read', summary: 'Run every module read-path probe. Sends nothing.', args: {} },
  { name: 'gbSpy', cmd: 'spy', risk: 'read', summary: 'Ranked scout targets spyCycle would spy on this pass. Sends nothing.', args: {} },

  // -- write --------------------------------------------------------------
  { name: 'gbArm', cmd: 'arm', risk: 'write', summary: 'Extend an ALREADY OPEN arm window. Cannot open one from cold.', args: { minutes: { type: 'number', description: 'minutes to extend by', required: true } } },
  { name: 'gbDisarm', cmd: 'disarm', risk: 'write', summary: 'Close the arm window now.', args: {} },
  { name: 'gbAttack', cmd: 'attack', risk: 'write', summary: 'Send an attack from one of your own towns to a target.', args: { from_town_id: { type: 'number', description: 'attacker town', required: true }, target_town_id: { type: 'number', description: 'target town', required: true }, units: { type: 'object', description: '{unitId:count} (optional, default: all land units)', required: false }, mission: { type: 'string', description: 'attack (default)', required: false } } },
  { name: 'gbSupport', cmd: 'support', risk: 'write', summary: 'Send defensive units to one of your own towns.', args: { from_town_id: { type: 'number', description: 'town to send from', required: true }, to_town_id: { type: 'number', description: 'town to defend', required: true }, units: { type: 'object', description: '{unitId:count}', required: true } } },
  { name: 'gbCancel', cmd: 'cancel_command', risk: 'write', summary: 'Withdraw one of your outgoing commands.', args: { command_id: { type: 'number', description: 'command id from outgoing', required: true } } },
  { name: 'gbDodge', cmd: 'dodge', risk: 'write', summary: 'Evacuate units to a safe town, or raise militia.', args: { town_id: { type: 'number', description: 'town to act on', required: true }, mode: { type: 'string', description: 'send|militia', required: true }, units: { type: 'object', description: '{unitId:count} for send', required: false }, safe_town_id: { type: 'number', description: 'safe town for send mode', required: false } } },
  { name: 'gbClaimFarms', cmd: 'claim_farm', risk: 'write', summary: 'Claim farming villages.', args: { mode: { type: 'string', description: 'all|sleep', required: true }, duration: { type: 'number', description: 'seconds (optional, sleep only)', required: false } } },
  { name: 'gbClaimRelation', cmd: 'claim_relation', risk: 'write', summary: 'Claim ONE farming-village relation (same payload claimFarm posts, including learned claim template).', args: { relation_id: { type: 'number', description: 'relation id', required: true }, farm_town_id: { type: 'number', description: 'farm village id', required: true }, town_id: { type: 'number', description: 'own town on the same island', required: true }, option: { type: 'number', description: 'learned option index (default 1)', required: false } } },
  { name: 'gbCave', cmd: 'cave_store', risk: 'write', summary: 'Stash silver in a town cave.', args: { town_id: { type: 'number', description: 'town id', required: true }, amount: { type: 'number', description: 'amount (optional, omit for emergency plan)', required: false } } },
  { name: 'gbTrade', cmd: 'trade', risk: 'write', summary: 'Send resources between two of your towns.', args: { from_town_id: { type: 'number', description: 'source town', required: true }, to_town_id: { type: 'number', description: 'destination town', required: true }, wood: { type: 'number', description: 'amount wood', required: false }, stone: { type: 'number', description: 'amount stone', required: false }, iron: { type: 'number', description: 'amount iron', required: false } } },
  { name: 'gbRural', cmd: 'rural', risk: 'write', summary: 'Farming-village relation actions.', args: { mode: { type: 'string', description: 'trade|unlock|upgrade', required: true }, relation_id: { type: 'number', description: 'relation id', required: true }, farm_town_id: { type: 'number', description: 'farm village id', required: true }, town_id: { type: 'number', description: 'own town id on same island', required: true }, amount: { type: 'number', description: 'amount for trade', required: false } } },
  { name: 'gbQueueAdd', cmd: 'queue_add', risk: 'write', summary: 'Append to a GrepBot virtual lane. Prerequisites are inserted automatically.', args: { town_id: { type: 'number', description: 'town id', required: true }, kind: { type: 'string', description: 'build|recruit|research', required: true }, building: { type: 'string', description: 'building name (build)', required: false }, unit: { type: 'string', description: 'unit id (recruit)', required: false }, amount: { type: 'number', description: 'amount (recruit)', required: false }, tech: { type: 'string', description: 'tech id (research)', required: false } } },
  { name: 'gbQueueRemove', cmd: 'queue_remove', risk: 'write', summary: 'Remove a job from a lane.', args: { town_id: { type: 'number', description: 'town id', required: true }, lane: { type: 'string', description: 'build|recruit|recruitNaval|research', required: true }, job_id: { type: 'string', description: 'job id', required: true }, force: { type: 'boolean', description: 'skip lane-state gate (never skips prerequisite check)', required: false } } },
  { name: 'gbQueueMove', cmd: 'queue_move', risk: 'write', summary: 'Reorder a job within a lane.', args: { town_id: { type: 'number', description: 'town id', required: true }, lane: { type: 'string', description: 'build|recruit|recruitNaval|research', required: true }, job_id: { type: 'string', description: 'job id', required: true }, to_index: { type: 'number', description: '0-based target index', required: true } } },
  { name: 'gbQueueMode', cmd: 'queue_mode', risk: 'write', summary: 'Switch a lane between planner (legacy) and manual (fifo).', args: { town_id: { type: 'number', description: 'town id', required: true }, lane: { type: 'string', description: 'build|recruit|recruitNaval|research', required: true }, mode: { type: 'string', description: 'legacy|fifo', required: true } } },
  { name: 'gbResearch', cmd: 'research', risk: 'write', summary: 'Queue a research directly (falls through to queue_add).', args: { town_id: { type: 'number', description: 'town id', required: true }, tech: { type: 'string', description: 'tech id', required: true } } },
  { name: 'gbRecruit', cmd: 'recruit', risk: 'write', summary: 'Queue a recruit batch (falls through to queue_add).', args: { town_id: { type: 'number', description: 'town id', required: true }, unit: { type: 'string', description: 'unit id', required: true }, amount: { type: 'number', description: 'amount', required: true }, barracks_type: { type: 'string', description: 'barracks|docks (default barracks)', required: false } } },
  { name: 'gbCulture', cmd: 'culture', risk: 'write', summary: 'Run a culture event (festival|games|triumph|theater|olympic).', args: { town_id: { type: 'number', description: 'town id', required: true }, mode: { type: 'string', description: 'festival|games|triumph|theater|olympic', required: true } } },
  { name: 'gbSpell', cmd: 'spell', risk: 'write', summary: 'Cast a god power on a target town.', args: { from_town_id: { type: 'number', description: 'own town (power sources vary)', required: false }, power_id: { type: 'string', description: 'power id', required: true }, target_town_id: { type: 'number', description: 'target town id', required: true } } },
  { name: 'gbHero', cmd: 'hero', risk: 'write', summary: 'Run a hero action (mana regen / level / revive).', args: { mode: { type: 'string', description: 'regen|revive', required: true }, hero_id: { type: 'number', description: 'hero id', required: true }, town_id: { type: 'number', description: 'town id (optional)', required: false } } },
  { name: 'gbInstant', cmd: 'instant', risk: 'write', summary: 'Force a free instant-complete sweep on a town.', args: { town_id: { type: 'number', description: 'town id (optional -- omit for sweep all)', required: false } } },
  { name: 'gbQuest', cmd: 'quest_claim', risk: 'write', summary: 'Try to auto-claim every quest whose rewards are all safe.', args: {} },
  { name: 'gbSetTarget', cmd: 'set_target', risk: 'write', summary: 'Set an intel target (player id or town id).', args: { kind: { type: 'string', description: 'player|town', required: true }, id: { type: 'number', description: 'target id', required: true } } },
  { name: 'gbToggle', cmd: 'toggle', risk: 'write', summary: 'Flip one whitelisted toggle. Master gates (dryRun, safeMode, captchaGlobalKill, hosts) are NOT togglable here.', args: { key: { type: 'string', description: 'toggle key (e.g. autoFarm)', required: true }, value: { type: 'boolean', description: 'new value', required: true } } },
  { name: 'gbKick', cmd: 'kick', risk: 'write', summary: 'Re-run one econ scan immediately.', args: { scan: { type: 'string', description: 'orch|farm|cave|culture|trade|build|research|recruit|ruraltrade|rurallevel|merchant|pttrade|wonder|hero|godspell|dodge|support|emergency|bandit|quests|instant|queues|spy|favor', required: true } } },
  { name: 'gbPanic', cmd: 'panic', risk: 'write', summary: 'Hard pause: stop the orchestrator and lock every lock.', args: {} },
  { name: 'gbRecover', cmd: 'recover', risk: 'write', summary: 'Clear the panic state and resume after a manual review.', args: {} },
  { name: 'gbFavor', cmd: 'favor', risk: 'write', summary: 'Run the favor spend scan once. Honours every feature gate; no-op while FAVOR_AUTOMATION_ENABLED=false.', args: {} },
  { name: 'gbWonder', cmd: 'wonder', risk: 'write', summary: 'Contribute resources to one World Wonder from one of your towns. Amounts are exact, not budget-aware.', args: { town_id: { type: 'number', description: 'own town id', required: true }, wonder_id: { type: 'number', description: 'wonder id', required: true }, wood: { type: 'number', description: 'wood amount (default 0)', required: false }, stone: { type: 'number', description: 'stone amount (default 0)', required: false }, iron: { type: 'number', description: 'iron amount (default 0)', required: false } } },

  // -- raw -----------------------------------------------------------------
  { name: 'gbBridge', cmd: 'bridge', risk: 'raw', summary: 'Raw gpAjax.ajaxPost passthrough. Requires relayRaw=ON.', args: { model_url: { type: 'string', description: 'e.g. "frontend_bridge"', required: true }, action_name: { type: 'string', description: 'action id', required: true }, arguments: { type: 'object', description: 'arguments bag', required: true }, town_id: { type: 'number', description: 'town id (optional)', required: false } } },
  { name: 'gbAjax', cmd: 'ajax', risk: 'raw', summary: 'Raw ajaxPost passthrough. Requires relayRaw=ON.', args: { controller: { type: 'string', description: 'controller name', required: true }, action: { type: 'string', description: 'action name', required: true }, params: { type: 'object', description: 'params bag', required: true } } },
];

const NUMERIC = new Set(['town_id', 'target_town_id', 'from_town_id', 'to_town_id', 'safe_town_id', 'farm_town_id', 'relation_id', 'to_index', 'amount', 'duration', 'limit', 'hours', 'minutes', 'command_id', 'amount', 'hero_id', 'id', 'tribute']);
const BOOLEAN = new Set(['force', 'value']);

function buildInputSchema(spec: CommandSpec): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [k, v] of Object.entries(spec.args)) {
    let t = v.type;
    if (NUMERIC.has(k)) t = 'number';
    else if (BOOLEAN.has(k)) t = 'boolean';
    properties[k] = { type: t, description: v.description };
    if (v.required) required.push(k);
  }
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: required.length ? required : undefined,
  };
}

export function getCommandSpecs() {
  return entries.map((s) => ({
    spec: s,
    schema: buildInputSchema(s),
  }));
}

export function findSpec(toolName: string): CommandSpec | null {
  const hit = entries.find((e) => e.name === toolName);
  return hit ?? null;
}

export function commandCount() {
  return entries.length;
}
