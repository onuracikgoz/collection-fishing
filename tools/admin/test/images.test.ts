import { describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { idFromFileName, readZip } from '../src/images'

describe('zip import', () => {
  it('turns file names into item ids', () => {
    expect(idFromFileName('glass_bottle_blue.png')).toBe('glass_bottle_blue')
    expect(idFromFileName('png/Sextant (1).png')).toBe('sextant')
    expect(idFromFileName('lake.fish.carp.png')).toBe('lake.fish.carp')
    expect(idFromFileName('.hidden.png')).toBe(null)
    expect(idFromFileName('notes.txt')).toBe(null)
    expect(idFromFileName('ç.png')).toBe(null)
  })

  it('reads every PNG once, from any folder', () => {
    const zip = zipSync({
      'aa.png': new Uint8Array([1, 2, 3]),
      'png/bb.png': new Uint8Array([4]),
      'png/aa (1).png': new Uint8Array([9]),
      '__MACOSX/._aa.png': new Uint8Array([0]),
      'items.json': new Uint8Array([0]),
      'ğ.png': new Uint8Array([0]),
    })
    const r = readZip(zip)
    expect(r.images.map((i) => i.id)).toEqual(['aa', 'bb'])
    expect(r.images[0].png).toBe('AQID')
    expect(r.bad).toEqual(['ğ.png'])
  })
})
