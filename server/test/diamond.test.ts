// Diamonds: the drop chance, the fishing catch that pays them, and the wallet reads.
import { describe, expect, it, vi } from 'vitest';
import { DIAMOND, ENERGY, WATER } from '../src/config';
import { LAKE_MAP } from '../src/data/lake-map';
import { LAKE_POOL } from '../src/data/lake-pool';
import { Fisher, give } from '../src/match/fishing';
import { readWallet } from '../src/match/playerData';
import { dropChance, rollDiamond } from '../src/rules/diamond';
import { buildWaterMap } from '../src/rules/water';

describe('diamond drop rule', () => {
  it('the chance gives about 5 diamonds a day over a normal day of catches', () => {
    expect(dropChance(DIAMOND) * DIAMOND.catchesPerDay * DIAMOND.amount).toBeCloseTo(DIAMOND.perDay, 6);
    expect(dropChance({ perDay: 5, catchesPerDay: 90, amount: 1 })).toBeCloseTo(0.0556, 3);
    // A bigger drop is rarer so the daily average stays the same.
    expect(dropChance({ perDay: 5, catchesPerDay: 100, amount: 5 })).toBeCloseTo(0.01, 6);
    expect(dropChance({ perDay: 500, catchesPerDay: 10, amount: 1 })).toBe(1);
  });

  it('never drops without energy, and drops exactly when the roll is under the chance', () => {
    const c = dropChance(DIAMOND);
    expect(rollDiamond(DIAMOND, false, () => 0)).toBe(0);
    expect(rollDiamond(DIAMOND, true, () => c - 1e-9)).toBe(DIAMOND.amount);
    expect(rollDiamond(DIAMOND, true, () => c)).toBe(0);
  });

  it('simulated days average about perDay', () => {
    let seed = 12345;
    const random = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const days = 2000;
    let total = 0;
    for (let d = 0; d < days; d++) for (let i = 0; i < DIAMOND.catchesPerDay; i++) total += rollDiamond(DIAMOND, true, random);
    expect(total / days).toBeGreaterThan(DIAMOND.perDay * 0.95);
    expect(total / days).toBeLessThan(DIAMOND.perDay * 1.05);
  });
});

function setup(wallet: { [k: string]: number } = {}) {
  const calls: { writes: any[]; deletes: any[]; wallets: any[] }[] = [];
  const stored: any[] = [];
  const sent: { op: number; body: any }[] = [];
  const nk: any = {
    uuidv4: () => 'i1',
    storageWrite: (w: any[]) => stored.push(...w),
    multiUpdate: (_u: any, writes: any[], deletes: any[], wallets: any[]) => {
      calls.push({ writes, deletes, wallets });
      stored.push(...writes);
      wallet.diamond = (wallet.diamond || 0) + (wallets[0]?.changeset.diamond || 0);
      return { walletUpdateAcks: [{ userId: 'u1', updated: { ...wallet } }] };
    },
    accountGetId: () => ({ wallet }),
  };
  const ctx: any = {
    nk,
    logger: { error: () => undefined, warn: () => undefined },
    dispatcher: { broadcastMessage: (op: number, data: string) => sent.push({ op, body: JSON.parse(data) }) },
    water: buildWaterMap(LAKE_MAP, WATER),
    audience: (f: Fisher) => [f.presence],
    everyone: () => [],
  };
  const junk = LAKE_POOL.find((d) => d.category === 'junk')!;
  const f: Fisher = {
    presence: { userId: 'u1', sessionId: 's1', username: 'u1', node: 'n' } as any,
    move: { x: 84.5, y: 47.5 },
    energy: ENERGY.max,
    bag: { items: 0, stacks: {} },
    book: {},
    rod: { level: 1, durability: 100 } as any,
    xp: 0,
    fish: { phase: 'reeling', x: 88.5, y: 47.5, band: 'mid', hasEnergy: true, biteAt: 0, twitches: [], hookDeadline: 0, roll: { def: junk, tier: null } } as any,
  };
  return { ctx, f, calls, stored, sent, wallet };
}

describe('fishing pays diamonds with the catch', () => {
  it('a drop goes through the same transaction as the catch and is told to the fisher', () => {
    const w = setup({ diamond: 7 });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      give(w.ctx, w.f);
    } finally {
      spy.mockRestore();
    }
    expect(w.calls.length).toBe(1);
    expect(w.calls[0].wallets).toEqual([{ userId: 'u1', changeset: { diamond: 1 }, metadata: expect.objectContaining({ action: 'fishing' }) }]);
    expect(w.calls[0].writes.some((x) => x.collection === 'bag')).toBe(true);
    const end = w.sent.filter((m) => m.body.outcome === 'caught').pop()!;
    expect(end.body.diamond).toEqual({ gained: 1, total: 8 });
    expect(w.wallet.diamond).toBe(8);
  });

  it('no drop: a plain storage write and no diamond field', () => {
    const w = setup();
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    try {
      give(w.ctx, w.f);
    } finally {
      spy.mockRestore();
    }
    expect(w.calls.length).toBe(0);
    expect(w.stored.some((x) => x.collection === 'bag')).toBe(true);
    expect(w.sent.filter((m) => m.body.outcome === 'caught').pop()!.body.diamond).toBeUndefined();
  });

  it('a cast without energy never drops a diamond', () => {
    const w = setup();
    w.f.fish!.hasEnergy = false;
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      give(w.ctx, w.f);
    } finally {
      spy.mockRestore();
    }
    expect(w.calls.length).toBe(0);
  });
});

describe('wallet', () => {
  it('reads diamonds next to Coin and dust', () => {
    const nk: any = { accountGetId: () => ({ wallet: { coin: 5, diamond: 3 } }) };
    expect(readWallet(nk, 'u')).toEqual({ coin: 5, dust: 0, diamond: 3 });
    expect(readWallet({ accountGetId: () => ({}) } as any, 'u')).toEqual({ coin: 0, dust: 0, diamond: 0 });
  });
});
