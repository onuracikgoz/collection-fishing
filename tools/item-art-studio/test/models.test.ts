import { describe, expect, it } from 'vitest'
import { createVariant } from '../src/engine/variant'
import { itemFileName, parseCollectionSet } from '../src/models/collectionSet'
import { createBase, syncSetVariants, toSnakeId } from '../src/models/project'
import { parseStudioFile, toStudioFile } from '../src/models/studioFile'
import { solid } from './helpers'

const SET = JSON.stringify({
  set_id: 'crystal',
  name: 'Kristal Seti',
  base_designs: [{ base_id: 'crystal_shard' }],
  items: [
    { id: 'crystal_shard_gray', name: 'Gri', tier: 'Common', base_id: 'crystal_shard', variant_color: '#8A8F99', image: 'crystal_shard_gray.png' },
    { id: 'crystal_shard_gold', name: 'Altın', tier: 'Legendary', base_id: 'crystal_shard', variant_color: '#F9C22B', image: null },
    { id: 'crystal_crown', name: 'Taç', tier: 'Mythic', base_id: 'crystal_crown', variant_color: null, image: null },
  ],
})

describe('collection set', () => {
  it('parses set.json and adds base designs only referenced by items', () => {
    const set = parseCollectionSet(SET)
    expect(set.base_designs.map((d) => d.base_id)).toEqual(['crystal_shard', 'crystal_crown'])
    expect(itemFileName(set.items[0])).toBe('crystal_shard_gray.png')
    expect(itemFileName(set.items[1])).toBe('crystal_shard_gold.png')
  })

  it('rejects broken files with a readable error', () => {
    expect(() => parseCollectionSet('{')).toThrow(/JSON/)
    expect(() => parseCollectionSet('{"set_id":"x","items":[{"id":"a"}]}')).toThrow(/base_id/)
  })

  it('matches PNG file names to base_id and creates set variants once', () => {
    const set = parseCollectionSet(SET)
    expect(toSnakeId('Crystal Shard.png')).toBe('crystal_shard')
    const base = syncSetVariants(createBase('crystal_shard.png', solid(2, 2, [1, 2, 3])), set)
    expect(base.variants.map((v) => [v.id, v.tint, v.origin])).toEqual([
      ['crystal_shard_gray', '#8A8F99', 'set'],
      ['crystal_shard_gold', '#F9C22B', 'set'],
    ])
    expect(syncSetVariants(base, set)).toBe(base)
    const loose = syncSetVariants(createBase('boot.png', solid(2, 2, [1, 2, 3])), set)
    expect(loose.variants.map((v) => v.id)).toEqual(['boot'])
  })
})

describe('studio file', () => {
  it('round-trips prepare settings and variants', () => {
    const base = createBase('shell.png', solid(2, 2, [1, 2, 3]))
    base.variants = [{ ...createVariant('shell_blue', 'Blue', 'random', '#4D9BE6'), material: 'glossy', status: 'approved' }]
    base.prepare.erasePoints = [{ x: 3, y: 4 }]
    const text = JSON.stringify(toStudioFile(base, 'sea', 'Resurrect 64'))
    const parsed = parseStudioFile(text)
    expect(parsed.base_id).toBe('shell')
    expect(parsed.prepare.erasePoints).toEqual([{ x: 3, y: 4 }])
    expect(parsed.variants[0]).toEqual(base.variants[0])
  })

  it('rejects other JSON files', () => {
    expect(() => parseStudioFile('{"set_id":"x"}')).toThrow(/Item Art Studio/)
  })
})
