import { describe, expect, it } from 'vitest';
import { discardFromStacks, parseDiscard } from '../src/rules/discard';

describe('parseDiscard', () => {
  it('takes one item by instanceId or a count of a stack', () => {
    expect(parseDiscard({ instanceId: 'abc' })).toEqual({ instanceId: 'abc' });
    expect(parseDiscard({ defId: 'lake.junk.boot', count: 3 })).toEqual({ defId: 'lake.junk.boot', count: 3 });
  });

  it('refuses bad bodies', () => {
    expect(parseDiscard(null)).toBeNull();
    expect(parseDiscard({})).toBeNull();
    expect(parseDiscard({ instanceId: 'x'.repeat(65) })).toBeNull();
    expect(parseDiscard({ defId: 'a', count: 0 })).toBeNull();
    expect(parseDiscard({ defId: 'a', count: 1.5 })).toBeNull();
    expect(parseDiscard({ defId: 'a', count: -2 })).toBeNull();
    expect(parseDiscard({ defId: '', count: 1 })).toBeNull();
  });
});

describe('discardFromStacks', () => {
  it('lowers the stack and drops it at zero', () => {
    expect(discardFromStacks({ a: 5, b: 1 }, 'a', 2)).toEqual({ ok: true, stacks: { a: 3, b: 1 } });
    expect(discardFromStacks({ a: 5, b: 1 }, 'a', 5)).toEqual({ ok: true, stacks: { b: 1 } });
  });

  it('never throws away more than the bag has', () => {
    expect(discardFromStacks({ a: 2 }, 'a', 3)).toEqual({ ok: false, reason: 'NOT_OWNED' });
    expect(discardFromStacks({}, 'a', 1)).toEqual({ ok: false, reason: 'NOT_OWNED' });
  });
});
