import { useState } from 'react'
import type { Admin } from '../state'
import { Cosmetics } from './Cosmetics'
import { Items } from './Items'
import { Materials } from './Materials'
import { PlayerWardrobe } from './Wardrobe'

const SECTIONS = [
  ['collection', 'Collection items'],
  ['cosmetic', 'Kozmetik items'],
  ['materials', 'Crafting malzemeleri'],
  ['other', 'Diğer'],
] as const
type Section = (typeof SECTIONS)[number][0]

/** Items: collection items, wardrobe cosmetics, every craft material, and the rest (fish, junk, bait, a player's wardrobe). */
export function ItemsHub({ admin }: { admin: Admin }) {
  const [section, setSection] = useState<Section>('collection')
  const [open, setOpen] = useState<Record<Section, string | null>>({ collection: null, cosmetic: null, materials: null, other: null })
  const openIn = (s: Section) => (id: string | null) => {
    setOpen((o) => ({ ...o, [s]: id }))
    setSection(s)
  }
  const openItem = (id: string) => {
    const it = admin.itemById(id)
    openIn(it?.type === 'item' ? 'collection' : it?.type === 'material' ? 'materials' : 'other')(id)
  }

  return (
    <div className="hub">
      <div className="subtabs">
        {SECTIONS.map(([id, label]) => (
          <button key={id} className={section === id ? 'on' : ''} onClick={() => (section === id ? setOpen((o) => ({ ...o, [id]: null })) : setSection(id))}>
            {label}
          </button>
        ))}
      </div>
      {section === 'collection' ? <Items admin={admin} types={['item']} openId={open.collection} onOpen={openIn('collection')} onOpenMaterial={openIn('materials')} /> : null}
      {section === 'cosmetic' ? <Cosmetics admin={admin} openId={open.cosmetic} onOpen={openIn('cosmetic')} onOpenMaterial={openIn('materials')} /> : null}
      {section === 'materials' ? <Materials admin={admin} openId={open.materials} onOpen={openIn('materials')} onOpenItem={openItem} onOpenPart={openIn('cosmetic')} /> : null}
      {section === 'other' ? (
        <>
          <Items admin={admin} types={['fish', 'junk', 'bait']} openId={open.other} onOpen={openIn('other')} onOpenMaterial={openIn('materials')} />
          <div className="sets" style={{ marginTop: 16 }}>
            <PlayerWardrobe admin={admin} />
          </div>
        </>
      ) : null}
    </div>
  )
}
