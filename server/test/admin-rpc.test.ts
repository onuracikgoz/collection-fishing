// admin_* and get_content / get_item_art against a fake Nakama.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  pngSize,
  rpcAdminArtPut,
  rpcAdminContent,
  rpcAdminImport,
  rpcAdminItemDelete,
  rpcAdminItemPurge,
  rpcAdminItemSave,
  rpcAdminSetSave,
  rpcAdminSettingsSave,
} from '../src/admin/rpc';
import { getContent, invalidateContent } from '../src/match/content';
import { rpcGetContent, rpcGetItemArt } from '../src/rpc/getContent';

/** A real 2x2 PNG header is enough: the server only reads the signature and IHDR. */
function png(w: number, h: number): string {
  const b = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b.toString('base64');
}

function fake() {
  const store = new Map<string, { value: any; version: number }>();
  const key = (c: string, k: string, u: string) => `${c}/${k}/${u}`;
  const signals: string[] = [];
  let version = 0;
  const nk: any = {
    storageRead: (reqs: any[]) =>
      reqs
        .filter((r) => store.has(key(r.collection, r.key, r.userId)))
        .map((r) => ({ ...r, value: JSON.parse(JSON.stringify(store.get(key(r.collection, r.key, r.userId))!.value)), version: String(store.get(key(r.collection, r.key, r.userId))!.version) })),
    storageWrite: (writes: any[]) =>
      writes.map((w) => {
        const k = key(w.collection, w.key, w.userId);
        const cur = store.get(k);
        if (w.version === '*' && cur) throw new Error('exists');
        if (w.version && w.version !== '*' && (!cur || String(cur.version) !== w.version)) throw new Error('version');
        store.set(k, { value: JSON.parse(JSON.stringify(w.value)), version: ++version });
        return { collection: w.collection, key: w.key, userId: w.userId, version: String(version) };
      }),
    storageDelete: (dels: any[]) => dels.forEach((d) => store.delete(key(d.collection, d.key, d.userId))),
    base64Decode: (s: string) => {
      const b = Buffer.from(s, 'base64');
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
    sha256Hash: (s: string) => createHash('sha256').update(s).digest('hex'),
    // Only the two queries admin_item_purge makes.
    sqlQuery: (q: string, params: any[]) => {
      const rows = [...store.entries()].map(([k, v]) => {
        const [c, kk, u] = k.split('/');
        return { c, key: kk, user_id: u, value: v.value };
      });
      if (q.includes('FROM users')) return [...new Set(rows.map((r) => r.user_id))].filter((u) => u !== '00000000-0000-0000-0000-000000000000').map((id) => ({ id }));
      return rows.filter((r) => r.c === 'items' && r.value.defId === params[0]).map((r) => ({ user_id: r.user_id, key: r.key }));
    },
    matchList: () => [{ matchId: 'm1', label: JSON.stringify({ kind: 'world', serverId: 'mercan' }), size: 0 }],
    matchSignal: (_id: string, data: string) => {
      signals.push(data);
      return '{}';
    },
  };
  const logger: any = { warn: () => undefined, error: () => undefined, info: () => undefined };
  const admin: any = { userId: '' };
  const player: any = { userId: '11111111-1111-1111-1111-111111111111' };
  const call = (fn: any, body: object, ctx = admin) => JSON.parse(fn(ctx, logger, nk, JSON.stringify(body)));
  const content = () => call(rpcAdminContent, {});
  return { nk, logger, admin, player, call, content, signals };
}

const errOf = (fn: () => unknown): { code: string; message: string } => {
  try {
    fn();
  } catch (e: any) {
    return JSON.parse(e.message);
  }
  return { code: 'none', message: '' };
};

describe('admin RPCs', () => {
  it('refuse player sessions', () => {
    const w = fake();
    expect(errOf(() => w.call(rpcAdminContent, {}, w.player)).code).toBe('NOT_ALLOWED');
    expect(errOf(() => w.call(rpcAdminItemSave, { item: { id: 'x1' } }, w.player)).code).toBe('NOT_ALLOWED');
  });

  it('start from the seed until the first save', () => {
    const w = fake();
    const c = w.content();
    expect(c.stored).toBe(false);
    expect(c.version).toBe('');
    expect(c.errors).toEqual([]);
    expect(c.waters).toEqual(['buyuk_gol']);
  });

  it('runs the ZIP flow: image makes a draft, approve puts it in the game and on a new page', () => {
    const w = fake();
    let v = w.call(rpcAdminSetSave, { version: '', set: { id: 'lost_captain', name: 'Lost Captain' } }).version;
    const put = w.call(rpcAdminArtPut, { version: v, id: 'sextant', png: png(128, 128), setId: 'lost_captain', tier: 'epic' });
    expect(put.created).toBe(true);
    expect(put.item).toMatchObject({ id: 'sextant', name: 'Sextant', status: 'draft', setId: 'lost_captain', tier: 'epic', art: { w: 128, h: 128 } });
    v = put.version;

    // A draft is not in the game.
    invalidateContent();
    expect(getContent(w.nk, w.logger, Date.now()).known.sextant).toBeUndefined();

    const saved = w.call(rpcAdminItemSave, { version: v, item: { ...put.item, book: true, drop: { bands: ['deep'], weight: 2 }, status: 'live' } });
    expect(saved.item.status).toBe('live');
    expect(w.signals.some((s) => JSON.parse(s).type === 'content_reload')).toBe(true);

    invalidateContent();
    const rt = getContent(w.nk, w.logger, Date.now());
    expect(rt.pages[rt.pages.length - 1]).toEqual({ id: 'lost_captain', items: ['sextant'] });
    expect(rt.pool.filter((d) => d.id === 'sextant')[0]).toEqual({ id: 'sextant', category: 'epic', bands: ['deep'], weight: 2 });

    // The client sees it with its image.
    const list = w.call(rpcGetContent, {}, w.player);
    const row = list.items.filter((x: any) => x.id === 'sextant')[0];
    expect(row).toMatchObject({ name: 'Sextant', tier: 'epic', setId: 'lost_captain', art: put.item.art.hash });
    expect(list.pages).toEqual(['lake_fish', 'deep_water', 'treasures', 'crafts', 'lost_captain']);
    const art = w.call(rpcGetItemArt, { ids: ['sextant', 'lake.fish.carp'] }, w.player);
    expect(art.art).toEqual([{ id: 'sextant', hash: put.item.art.hash, png: png(128, 128) }]);

    // A 32x32 icon rides along; the hash changes so clients fetch it again.
    const withIcon = w.call(rpcAdminArtPut, { version: saved.version, id: 'sextant', png: png(128, 128), icon: png(32, 32) });
    expect(withIcon.item.art.hash).not.toBe(put.item.art.hash);
    invalidateContent();
    const art2 = w.call(rpcGetItemArt, { ids: ['sextant'] }, w.player);
    expect(art2.art).toEqual([{ id: 'sextant', hash: withIcon.item.art.hash, png: png(128, 128), icon: png(32, 32) }]);

    // A new image without an icon drops the old icon.
    const plain = w.call(rpcAdminArtPut, { version: withIcon.version, id: 'sextant', png: png(128, 128) });
    expect(plain.item.art.hash).toBe(put.item.art.hash);
    invalidateContent();
    expect(w.call(rpcGetItemArt, { ids: ['sextant'] }, w.player).art[0].icon).toBeUndefined();
  });

  it('makes a recipe for a craftable item and keeps its id', () => {
    const w = fake();
    const recipe = { grade: 'good', stacks: [{ defId: 'lake.mat.scale', count: 2 }], items: [{ defId: 'craft.moss_wreath', count: 1 }], drop: { bands: ['mid'] }, starter: 0 };
    const a = w.call(rpcAdminItemSave, { version: '', item: { id: 'scale_crown', name: 'Scale Crown', tier: 'rare', setId: 'crafts', book: true, recipe, status: 'live' } });
    expect(a.item.recipe.id).toBe('recipe.scale_crown');
    const b = w.call(rpcAdminItemSave, { version: a.version, item: { ...a.item, recipe: { ...a.item.recipe, id: 'recipe.other', grade: 'master' } } });
    expect(b.item.recipe).toMatchObject({ id: 'recipe.scale_crown', grade: 'master' });
    invalidateContent();
    const rt = getContent(w.nk, w.logger, Date.now());
    expect(rt.recipes.filter((r) => r.id === 'recipe.scale_crown')[0].output).toEqual({ defId: 'scale_crown', tier: 'rare' });
    expect(rt.pool.some((d) => d.id === 'recipe.scale_crown' && d.category === 'recipe')).toBe(true);
  });

  it('refuses invalid content and changes that break owned copies', () => {
    const w = fake();
    expect(errOf(() => w.call(rpcAdminItemSave, { version: '', item: { id: 'bad_one', type: 'item', tier: null } })).message).toMatch(/needs a Tier/);
    const live = w.content().doc.items.filter((x: any) => x.id === 'lake.fish.carp')[0];
    expect(errOf(() => w.call(rpcAdminItemSave, { version: '', item: { ...live, type: 'material' } })).message).toMatch(/Float item and stack/);
    expect(errOf(() => w.call(rpcAdminItemDelete, { version: '', id: 'lake.fish.carp' })).code).toBe('NOT_ALLOWED');
  });

  it('notices a stale version', () => {
    const w = fake();
    w.call(rpcAdminSetSave, { version: '', set: { id: 'one', name: 'One' } });
    expect(errOf(() => w.call(rpcAdminSetSave, { version: '', set: { id: 'two', name: 'Two' } })).code).toBe('CONTENT_CHANGED');
  });

  it('imports a JSON list as drafts and skips live items', () => {
    const w = fake();
    const r = w.call(rpcAdminImport, {
      version: '',
      sets: [{ id: 'lost_captain', name: 'Lost Captain' }],
      items: [
        { id: 'mat_driftwood', name: 'Driftwood', type: 'material', setId: 'lost_captain', drop: { bands: ['shore', 'mid'] } },
        { id: 'sextant', tier: 'epic', setId: 'lost_captain', book: true },
        { id: 'lake.fish.carp', name: 'Changed' },
      ],
    });
    expect(r).toMatchObject({ added: 2, updated: 0, skipped: ['lake.fish.carp'] });
    const doc = w.content().doc;
    const wood = doc.items.filter((x: any) => x.id === 'mat_driftwood')[0];
    expect(wood).toMatchObject({ status: 'draft', type: 'material', tier: null, name: 'Driftwood' });
    expect(doc.items.filter((x: any) => x.id === 'lake.fish.carp')[0].name).toBe('Carp');
    // Drafts can be deleted.
    w.call(rpcAdminItemDelete, { version: r.version, id: 'sextant' });
    expect(w.content().doc.items.some((x: any) => x.id === 'sextant')).toBe(false);
  });

  it('purges a live item from every player, only with DEV_TOOLS', () => {
    const w = fake();
    const v = w.call(rpcAdminArtPut, { version: '', id: 'image', png: png(128, 128) }).version;
    const saved = w.call(rpcAdminItemSave, { version: v, item: { ...w.content().doc.items.filter((x: any) => x.id === 'image')[0], tier: 'common', status: 'live' } });
    const u = '22222222-2222-2222-2222-222222222222';
    w.nk.storageWrite([
      { collection: 'items', key: 'c1', userId: u, value: { instanceId: 'c1', defId: 'image', float: 0.5 } },
      { collection: 'items', key: 'c2', userId: u, value: { instanceId: 'c2', defId: 'lake.fish.carp', float: 0.5 } },
      { collection: 'book', key: 'entries', userId: u, value: { entries: { image: { foundAt: 1 }, 'lake.fish.carp': { foundAt: 1 } } } },
      { collection: 'profile', key: 'card', userId: u, value: { showcase: ['image'] } },
    ]);
    expect(errOf(() => w.call(rpcAdminItemPurge, { version: saved.version, id: 'image' })).code).toBe('DEV_TOOLS_OFF');

    const dev: any = { userId: '', env: { DEV_TOOLS: 'true' } };
    const r = w.call(rpcAdminItemPurge, { version: saved.version, id: 'image' }, dev);
    expect(r).toMatchObject({ ok: true, players: 1, copies: 1 });
    expect(w.content().doc.items.some((x: any) => x.id === 'image')).toBe(false);
    const read = (c: string, k: string) => w.nk.storageRead([{ collection: c, key: k, userId: u }])[0]?.value;
    expect(read('items', 'c1')).toBeUndefined();
    expect(read('items', 'c2')).toBeDefined();
    expect(Object.keys(read('book', 'entries').entries)).toEqual(['lake.fish.carp']);
    expect(read('profile', 'card').showcase).toEqual([]);
    expect(w.nk.storageRead([{ collection: 'content_art', key: 'image', userId: '00000000-0000-0000-0000-000000000000' }])).toEqual([]);
    expect(w.signals.some((s) => JSON.parse(s).type === 'dev_reload' && JSON.parse(s).userId === u)).toBe(true);
  });

  it('saves the general drop rates, chests and quests', () => {
    const w = fake();
    const c = w.content();
    const table = { ...c.doc.catchTable, fish: 3805, common: 1200 };
    w.call(rpcAdminSettingsSave, { version: c.version, catchTable: table });
    invalidateContent();
    expect(getContent(w.nk, w.logger, Date.now()).catchTable.fish).toBe(3805);
    expect(errOf(() => w.call(rpcAdminSettingsSave, { catchTable: { gold: 5 } })).message).toMatch(/not a category/);
  });

  it('checks the image', () => {
    const w = fake();
    expect(pngSize(new Uint8Array(Buffer.from(png(16, 32), 'base64')))).toEqual({ w: 16, h: 32 });
    expect(errOf(() => w.call(rpcAdminArtPut, { id: 'x_item', png: Buffer.from('hello').toString('base64') })).message).toMatch(/not a PNG/);
    expect(errOf(() => w.call(rpcAdminArtPut, { id: 'x_item', png: png(2048, 16) })).message).toMatch(/larger than 512/);
    expect(errOf(() => w.call(rpcAdminArtPut, { id: 'x_item', png: png(128, 128), icon: png(64, 64) })).message).toMatch(/icon must be 32x32/);
  });
});
