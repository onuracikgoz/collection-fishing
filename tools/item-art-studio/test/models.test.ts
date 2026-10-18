import { describe, expect, it } from 'vitest'
import { itemFileName, parseCollectionSet } from '../src/models/collectionSet'
import { approveImage, createImage, groupByItem, toSnakeId } from '../src/models/project'
import { parseStudioFile, toStudioFile } from '../src/models/studioFile'
import { solid } from './helpers'

const SET = JSON.stringify({
  set_id: 'lake',
  name: 'Göl',
  items: [
    { id: 'bottle_green', name: 'Yeşil Şişe', tier: 'Common', image: 'bottle_green.png' },
    { id: 'bottle_blue', name: 'Mavi Şişe', tier: 'Rare', image: null },
  ],
})

const img = (name: string) => createImage(name, solid(2, 2, [1, 2, 3]))

describe('collection set', () => {
  it('parses set.json and names files', () => {
    const set = parseCollectionSet(SET)
    expect(set.items.map((i) => i.id)).toEqual(['bottle_green', 'bottle_blue'])
    expect(itemFileName(set.items[0], 'bottle_green')).toBe('bottle_green.png')
    expect(itemFileName(set.items[1], 'bottle_blue')).toBe('bottle_blue.png')
    expect(itemFileName(null, 'boot')).toBe('boot.png')
  })

  it('rejects broken files with a readable error', () => {
    expect(() => parseCollectionSet('{')).toThrow(/JSON/)
    expect(() => parseCollectionSet('{"set_id":"x","items":[{}]}')).toThrow(/id/)
  })
})

describe('project', () => {
  it('derives item ids from file names, including downloaded copies', () => {
    expect(toSnakeId('Bottle Blue.png')).toBe('bottle_blue')
    expect(toSnakeId('bottle_blue (2).png')).toBe('bottle_blue')
    expect(toSnakeId('glassBottle.PNG')).toBe('glass_bottle')
  })

  it('groups candidates by item, lists missing set items, and keeps one approval per item', () => {
    const set = parseCollectionSet(SET)
    const a = img('bottle_green.png')
    const b = img('bottle_green (1).png')
    const c = img('boot.png')
    let images = [a, b, c]
    const groups = groupByItem(images, set)
    expect(groups.map((g) => [g.itemId, g.images.length, g.inSet])).toEqual([
      ['bottle_green', 2, true],
      ['bottle_blue', 0, true],
      ['boot', 1, false],
    ])
    images = approveImage(images, a.key)
    images = approveImage(images, b.key)
    expect(images.map((i) => i.status)).toEqual(['pending', 'approved', 'pending'])
    expect(groupByItem(images, set)[0].approved?.key).toBe(b.key)
  })
})

describe('studio file', () => {
  it('round-trips prepare settings', () => {
    const image = img('shell_pink.png')
    image.prepare = { ...image.prepare, erasePoints: [{ x: 3, y: 4 }], padding: 2 }
    const parsed = parseStudioFile(JSON.stringify(toStudioFile(image, 'sea', 'Resurrect 64')))
    expect(parsed.item_id).toBe('shell_pink')
    expect(parsed.source_image).toBe('shell_pink.png')
    expect(parsed.prepare).toEqual(image.prepare)
  })

  it('rejects other JSON files', () => {
    expect(() => parseStudioFile('{"set_id":"x"}')).toThrow(/Item Art Studio/)
  })
})
