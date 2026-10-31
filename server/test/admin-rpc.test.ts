// admin_* and get_content / get_item_art against a fake Nakama.
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import {
  pngSize,
  rpcAdminArtPut,
  rpcAdminContent,
  rpcAdminImport,
  rpcAdminItemDelete,
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
    const art = w.call(rpcGetItemArt, { ids: ['sextant', 'lake.fish.carp'] }, w.player);
    expect(art.art).toEqual([{ id: 'sextant', hash: put.item.art.hash, png: png(128, 128) }]);
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
  });
});
