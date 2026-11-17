// Wardrobe rules (rules/wardrobe.ts) and the world match's LOOK_SET (docs/protokol.md Gardırop).
import { describe, expect, it } from 'vitest';
import { OpCode } from '../src/protocol';
import { seedWardrobe } from '../src/data/wardrobe-catalog';
import { seedContent } from '../src/data/seed-content';
import { validateContent } from '../src/rules/content';
import { contentResponse } from '../src/rpc/getContent';
import { compileContent } from '../src/rules/content';
import {
  WardrobeItem,
  applyLookSet,
  compileWardrobe,
  currentLook,
  defaultLook,
  editPart,
  itemTier,
  lookView,
  makeItem,
  nextExpiry,
  pruneExpired,
  removeItem,
  rentable,
  validateWardrobe,
} from '../src/rules/wardrobe';
import { worldInit, worldJoin, worldJoinAttempt, worldLoop, worldSignal } from '../src/match/world';

const W = compileWardrobe(seedWardrobe());
const DAY = 86400000;
const NOW = 1_800_000_000_000;

const item = (over: Partial<WardrobeItem>): WardrobeItem => ({ instanceId: 'i1', part: 'wings_pixie', color: 'dye_red', source: 'admin', obtainedAt: NOW, locked: false, ...over });

describe('wardrobe catalog', () => {
  it('the catalog built from the craft table is valid and has every family', () => {
    expect(validateWardrobe(seedWardrobe())).toEqual([]);
    const cat = seedWardrobe();
    expect(cat.parts.length).toBe(369);
    const families = new Set(cat.parts.map((p) => p.family));
    expect(families.size).toBe(17);
    expect(cat.parts.filter((p) => p.free).length).toBe(18);
    expect(cat.colors.some((c) => c.kind === 'skin') && cat.colors.some((c) => c.kind === 'eye')).toBe(true);
  });

  it('seed content carries the wardrobe and still validates', () => {
    const doc = seedContent();
    expect(doc.wardrobe!.parts.length).toBe(369);
    expect(validateContent(doc)).toEqual([]);
  });

  it('catches broken parts and colours', () => {
    const cat = seedWardrobe();
    cat.parts[0] = { ...cat.parts[0], tier: 'rare' }; // free part with a tier
    cat.parts.push({ ...cat.parts[1] }); // same id twice
    cat.colors.push({ id: 'red', kind: 'dye', tier: 'common', free: true }); // no kind prefix
    const errors = validateWardrobe(cat);
    expect(errors.some((e) => e.indexOf('free part has no tier') >= 0)).toBe(true);
    expect(errors.some((e) => e.indexOf('twice') >= 0)).toBe(true);
    expect(errors.some((e) => e.indexOf('must start with dye_') >= 0)).toBe(true);
  });

  it('get_content sends the catalog in a JsonUtility-friendly shape', () => {
    const res = contentResponse(compileContent(seedContent()));
    const free = res.wardrobe.parts.filter((p) => p.free)[0];
    expect(free.tier).toBe('');
    expect(Array.isArray(free.color2)).toBe(true);
    expect(res.wardrobe.colors.every((c) => typeof c.tier === 'string')).toBe(true);
  });
});

describe('wardrobe items', () => {
  const wings = W.parts['wings_pixie'];

  it('a wings part is known and takes a dye colour', () => {
    expect(wings).toBeDefined();
    expect(wings.slot).toBe('wings');
  });

  it('effect colour makes a Mythic; only Common-Epic can be rented', () => {
    const feathered = W.parts['wings_feathered'];
    expect(feathered.effects.length).toBeGreaterThan(0);
    expect(itemTier(W, { part: 'wings_feathered', color: feathered.effects[0] })).toBe('mythic');
    expect(rentable(W, { part: 'wings_feathered', color: feathered.effects[0] })).toBe(false);
    expect(itemTier(W, { part: 'wings_pixie', color: 'dye_red' })).toBe('rare');
    const legendary = seedWardrobe().parts.filter((p) => p.tier === 'legendary')[0];
    expect(rentable(W, { part: legendary.id, color: '' })).toBe(false);
    const common = seedWardrobe().parts.filter((p) => p.tier === 'common')[0];
    expect(rentable(W, { part: common.id, color: '' })).toBe(true);
  });

  it('makeItem checks colours; rentals expire and are always locked', () => {
    expect(makeItem(W, { part: 'wings_pixie', color: 'metal_gold', locked: false, source: 'admin' }, 'x', NOW, 365)).toMatch(/colour/);
    expect(makeItem(W, { part: 'nope', color: '', locked: false, source: 'admin' }, 'x', NOW, 365)).toMatch(/unknown/);
    const rent = makeItem(W, { part: 'wings_pixie', color: 'dye_red', days: 7, locked: false, source: 'rent_coin' }, 'x', NOW, 365);
    expect(typeof rent).toBe('object');
    expect((rent as WardrobeItem).until).toBe(NOW + 7 * DAY);
    expect((rent as WardrobeItem).locked).toBe(true);
    expect(makeItem(W, { part: 'wings_pixie', color: 'dye_red', days: 999, locked: false, source: 'admin' }, 'x', NOW, 365)).toMatch(/days/);
  });

  it('edits a catalog part: free clears the Tier, paid needs one', () => {
    const p = W.catalog.parts.filter((x) => x.free)[0];
    expect(editPart(p, { free: false })).toMatch(/needs a tier/);
    expect((editPart(p, { free: false, tier: 'rare' }) as any).tier).toBe('rare');
    expect((editPart(wings, { free: true }) as any).tier).toBeNull();
    expect(editPart(wings, { tier: 'mythic' })).toMatch(/tier/);
  });
});

describe('looks', () => {
  it('the default look is stable, free and valid', () => {
    const a = defaultLook(W, 'user-1');
    expect(defaultLook(W, 'user-1')).toEqual(a);
    expect(a.parts.length).toBeGreaterThanOrEqual(3);
    for (const p of a.parts) {
      expect(W.parts[p.part].free).toBe(true);
      expect(W.parts[p.part].bodies).toContain(a.body);
    }
    // The default look passes LOOK_SET as it is.
    expect(applyLookSet(W, a, [], NOW)).toEqual({ look: a });
  });

  it('wears an owned item with the colour of the item, not the one sent', () => {
    const base = defaultLook(W, 'u');
    const r = applyLookSet(W, { ...base, parts: [{ part: 'wings_pixie', color: 'dye_blue', instanceId: 'i1' }] }, [item({})], NOW);
    expect(r).toEqual({ look: { ...base, parts: [{ part: 'wings_pixie', color: 'dye_red', instanceId: 'i1' }] } });
  });

  it('refuses parts not owned, expired rentals and paid colours on free parts', () => {
    const base = defaultLook(W, 'u');
    expect(applyLookSet(W, { ...base, parts: [{ part: 'wings_pixie', color: 'dye_red' }] }, [], NOW)).toEqual({ reason: 'NOT_OWNED' });
    expect(applyLookSet(W, { ...base, parts: [{ part: 'wings_pixie', color: '', instanceId: 'i1' }] }, [item({ until: NOW - 1 })], NOW)).toEqual({ reason: 'NOT_OWNED' });
    const free = base.parts[0];
    const paid = W.catalog.colors.filter((c) => !c.free && c.kind === W.parts[free.part].colors[0])[0];
    expect(applyLookSet(W, { ...base, parts: [{ part: free.part, color: paid.id }] }, [], NOW)).toEqual({ reason: 'NOT_OWNED' });
  });

  it('refuses two parts in one slot, a wrong body and an unknown skin', () => {
    const base = defaultLook(W, 'u');
    const hair = W.catalog.parts.filter((p) => p.free && p.slot === 'hair' && p.bodies.indexOf(base.body) >= 0);
    const hc = W.catalog.colors.filter((c) => c.kind === 'hair' && c.free)[0].id;
    expect(applyLookSet(W, { ...base, parts: [{ part: hair[0].id, color: hc }, { part: hair[1].id, color: hc }] }, [], NOW)).toEqual({ reason: 'BAD_LOOK' });
    expect(applyLookSet(W, { ...base, skin: 'skin_nope' }, [], NOW)).toEqual({ reason: 'BAD_LOOK' });
    const oneBody = W.catalog.parts.filter((p) => p.active && p.bodies.length === 1)[0];
    if (oneBody) {
      const other = oneBody.bodies[0] === 'male' ? 'female' : 'male';
      expect(applyLookSet(W, { ...base, body: other, parts: [{ part: oneBody.id, color: '', instanceId: 'i1' }] }, [item({ part: oneBody.id })], NOW)).toEqual({ reason: 'BAD_LOOK' });
    }
  });

  it('JsonUtility empty strings count as missing', () => {
    const base = defaultLook(W, 'u');
    const parts = base.parts.map((p) => ({ ...p, instanceId: '', color2: '' }));
    expect(applyLookSet(W, { ...base, parts }, [], NOW)).toEqual({ look: base });
  });

  it('a rented worn part shows a clock, ends on time and disappears from the look', () => {
    const base = defaultLook(W, 'u');
    const rent = item({ until: NOW + DAY, locked: true, source: 'rent_coin' });
    const doc = { items: [rent], look: { ...base, parts: base.parts.concat([{ part: 'wings_pixie', color: 'dye_red', instanceId: 'i1' }]) } };
    const look = currentLook(W, doc, 'u', NOW);
    expect(lookView(look, doc).parts.filter((p) => p.part === 'wings_pixie')[0].rented).toBe(true);
    expect(nextExpiry(doc, look)).toBe(NOW + DAY);
    expect(currentLook(W, doc, 'u', NOW + DAY).parts.some((p) => p.part === 'wings_pixie')).toBe(false);
    const pruned = pruneExpired(doc, NOW + DAY)!;
    expect(pruned.items).toEqual([]);
    expect(pruned.look!.parts).toEqual(base.parts);
    expect(pruneExpired(doc, NOW)).toBeNull();
  });

  it('removing an item takes it off the saved look', () => {
    const base = defaultLook(W, 'u');
    const doc = { items: [item({})], look: { ...base, parts: [{ part: 'wings_pixie', color: 'dye_red', instanceId: 'i1' }] } };
    expect(removeItem(doc, 'i1')).toEqual({ items: [], look: { ...base, parts: [] } });
    expect(removeItem(doc, 'nope')).toBeNull();
  });
});

function setup() {
  const store = new Map<string, any>();
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const sent: { op: number; body: any; to: string[] }[] = [];
  const nk: any = {
    storageRead: (reqs: any[]) => reqs.filter((r) => store.has(key(r.collection, r.key, r.userId))).map((r) => ({ ...r, value: store.get(key(r.collection, r.key, r.userId)), version: 'v' })),
    storageWrite: (writes: any[]) => writes.forEach((w) => store.set(key(w.collection, w.key, w.userId), JSON.parse(JSON.stringify(w.value)))),
    storageList: () => ({ objects: [] }),
    accountGetId: () => ({ wallet: {} }),
    binaryToString: (d: string) => d,
    uuidv4: () => 'id',
  };
  const dispatcher: any = {
    broadcastMessage: (op: number, data: string, to: any[] | null) => sent.push({ op, body: JSON.parse(data), to: (to || []).map((p) => p.userId) }),
    matchKick: () => undefined,
  };
  const logger: any = { error: (...a: any[]) => console.log('ERR', ...a), warn: () => undefined, info: () => undefined };
  let state = worldInit({} as any, logger, nk, { serverId: 'mercan' }).state;
  let tick = 0;
  const presence = (id: string): any => ({ userId: id, sessionId: `s-${id}`, username: id, node: 'n' });
  const join = (id: string) => {
    const pr = presence(id);
    state = worldJoinAttempt({} as any, logger, nk, dispatcher, tick, state, pr, { protocolVersion: '1', characterId: 'default' }).state;
    state = worldJoin({} as any, logger, nk, dispatcher, tick, state, [pr])!.state;
  };
  const loop = (msgs: { id: string; op: number; body: unknown }[] = []) => {
    tick++;
    state = worldLoop({} as any, logger, nk, dispatcher, tick, state, msgs.map((m) => ({ sender: presence(m.id), opCode: m.op, data: JSON.stringify(m.body) })) as any)!.state;
  };
  const signal = (data: unknown) => worldSignal({} as any, logger, nk, dispatcher, tick, state, JSON.stringify(data));
  return { sent, store, key, join, loop, signal, take: (op: number) => sent.filter((m) => m.op === op) };
}

describe('world match: looks', () => {
  it('sends the look in WELCOME and PLAYER_ENTER, shows a saved look to viewers and refuses not owned', () => {
    const w = setup();
    w.join('B');
    w.join('C');
    const welcome = w.take(OpCode.WELCOME).filter((m) => m.to[0] === 'C')[0];
    expect(welcome.body.look).toEqual(lookView(defaultLook(W, 'C'), null));
    w.loop();
    w.loop();
    expect(w.take(OpCode.PLAYER_ENTER).every((m) => m.body.look && m.body.look.body)).toBe(true);

    w.store.set(w.key('player', 'wardrobe', 'C'), { items: [item({})], look: null });
    const base = defaultLook(W, 'C');
    const parts = base.parts.concat([{ part: 'wings_pixie', color: '', instanceId: 'i1' }]);
    w.loop([{ id: 'C', op: OpCode.LOOK_SET, body: { ...base, parts } }]);
    const shown = w.take(OpCode.LOOK_SHOW);
    expect(shown.length).toBe(1);
    expect(shown[0].to.sort()).toEqual(['B', 'C']);
    expect(shown[0].body.look.parts.some((p: any) => p.part === 'wings_pixie' && p.color === 'dye_red')).toBe(true);
    expect(w.store.get(w.key('player', 'wardrobe', 'C')).look.parts.length).toBe(parts.length);

    for (let i = 0; i < 12; i++) w.loop();
    w.loop([{ id: 'C', op: OpCode.LOOK_SET, body: { ...base, parts: [{ part: 'wings_pixie', color: 'dye_red', instanceId: 'other' }] } }]);
    const refused = w.take(OpCode.LOOK_SHOW).slice(-1)[0];
    expect(refused.body.reason).toBe('NOT_OWNED');
    expect(refused.to).toEqual(['C']);
    expect(refused.body.look.parts.some((p: any) => p.part === 'wings_pixie')).toBe(true);
  });

  it('wardrobe_refresh takes off an item the admin removed', () => {
    const w = setup();
    const base = defaultLook(W, 'C');
    w.store.set(w.key('player', 'wardrobe', 'C'), { items: [item({})], look: { ...base, parts: base.parts.concat([{ part: 'wings_pixie', color: 'dye_red', instanceId: 'i1' }]) } });
    w.join('C');
    expect(w.take(OpCode.WELCOME)[0].body.look.parts.some((p: any) => p.part === 'wings_pixie')).toBe(true);
    w.store.set(w.key('player', 'wardrobe', 'C'), { items: [], look: { ...base } });
    w.signal({ type: 'wardrobe_refresh', userId: 'C' });
    const shown = w.take(OpCode.LOOK_SHOW);
    expect(shown.length).toBe(1);
    expect(shown[0].body.look.parts.some((p: any) => p.part === 'wings_pixie')).toBe(false);
  });
});
