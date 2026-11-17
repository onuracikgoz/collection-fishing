import { describe, expect, it } from 'vitest'
import { seedContent } from '../../../server/src/data/seed-content'
import { newItem } from '../src/content'
import { itemTree, itemUsedInTree, ladderRecipe, materialUsedInTree, partTree } from '../src/craftGraph'

describe('craft trees', () => {
  const doc = seedContent()
  const cat = doc.wardrobe!

  it('a wardrobe part: pattern, materials, colours', () => {
    const t = partTree(cat, 'wrists_cuffs')
    expect(t.children.map((c) => c.ref.kind)).toEqual(['pattern', 'wmat', 'wmat', 'wmat', 'color'])
    expect(t.children[2]).toMatchObject({ label: 'Mussel Button', count: 2, index: 1 })
  })

  it('a material opens up to the parts that use it, Mythic copies too', () => {
    const t = materialUsedInTree(cat, 'wmat_nacre_button')
    expect(t.children.some((c) => c.ref.kind === 'part' && c.ref.fx)).toBe(true)
  })

  it('collection recipes nest and point back up', () => {
    const mat = newItem('mat_a', 0, { type: 'material', status: 'live' })
    const mid = newItem('mid', 0, { type: 'item', tier: 'rare', status: 'live', recipe: { id: 'r_mid', grade: 'normal', stacks: [{ defId: 'mat_a', count: 3 }], items: [], drop: null, starter: 0 } })
    const top = newItem('top', 0, { type: 'item', tier: 'epic', status: 'live', recipe: { id: 'r_top', grade: 'normal', stacks: [], items: [{ defId: 'mid', count: 1 }], drop: null, starter: 0 } })
    const d = { ...doc, items: [...doc.items, mat, mid, top] }
    expect(itemTree(d, 'top').children[0].children[0]).toMatchObject({ ref: { kind: 'item', id: 'mat_a' }, count: 3 })
    expect(itemUsedInTree(d, 'mat_a').children[0].children[0].ref).toEqual({ kind: 'item', id: 'top' })
  })

  it('the family ladder recipe follows the craft table rule', () => {
    const p = cat.parts.find((x) => x.id === 'wrists_cuffs')!
    expect(ladderRecipe(cat, { ...p, tier: 'rare' })!.mats).toEqual([
      { mat: 'wmat_seaweed_fibre', count: 4 },
      { mat: 'wmat_sea_silk', count: 2 },
      { mat: 'wmat_mussel_button', count: 2 },
    ])
  })
})
