import { describe, expect, it } from 'vitest';
import { SpatialGrid, updateVisibility } from '../src/rules/proximity';

describe('SpatialGrid', () => {
  it('finds only points inside the radius, across cells', () => {
    const grid = new SpatialGrid(5, [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 3, y: 4 },
      { id: 'c', x: 9, y: 0 },
      { id: 'd', x: -4, y: -1 },
    ]);
    expect(grid.near(0, 0, 5).map((p) => p.id).sort()).toEqual(['a', 'b', 'd']);
  });
});

describe('updateVisibility', () => {
  const self = { id: 'me', x: 0, y: 0 };

  it('enters inside the view radius and skips self', () => {
    const grid = new SpatialGrid(22, [self, { id: 'near', x: 19, y: 0 }, { id: 'far', x: 21, y: 0 }]);
    const res = updateVisibility(self, {}, grid, 20, 22);
    expect(res.entered).toEqual(['near']);
    expect(Object.keys(res.visible)).toEqual(['near']);
    expect(res.left).toEqual([]);
  });

  it('keeps someone between the two radii, drops them past the outer one', () => {
    const edge = new SpatialGrid(22, [self, { id: 'x', x: 21, y: 0 }]);
    expect(updateVisibility(self, { x: true }, edge, 20, 22)).toEqual({ visible: { x: true }, entered: [], left: [] });
    const gone = new SpatialGrid(22, [self, { id: 'x', x: 23, y: 0 }]);
    expect(updateVisibility(self, { x: true }, gone, 20, 22).left).toEqual(['x']);
  });

  it('drops someone who left the server', () => {
    const grid = new SpatialGrid(22, [self]);
    expect(updateVisibility(self, { ghost: true }, grid, 20, 22).left).toEqual(['ghost']);
  });
});
