import { type ReactNode } from 'react'
import { refKey, type Ref, type TreeNode } from '../craftGraph'
import { TIER_LABEL } from './bits'

export interface TreeEdit {
  onCount: (index: number, count: number) => void
  onRemove: (index: number) => void
  /** The add row under the root's inputs. */
  adder: ReactNode
}

/**
 * A recipe as a left-to-right flowchart: the root, then its inputs, each with its own inputs.
 * `up` draws a "used in" tree (the root is a material, children are what it goes into).
 */
export function CraftTree({ root, onOpen, selected, edit, up }: { root: TreeNode; onOpen: (r: Ref) => void; selected?: string; edit?: TreeEdit; up?: boolean }) {
  return (
    <div className={`ctree ${up ? 'up' : ''}`}>
      <Sub node={root} depth={0} onOpen={onOpen} selected={selected} edit={edit} up={up} />
    </div>
  )
}

function Sub({ node, depth, onOpen, selected, edit, up }: { node: TreeNode; depth: number; onOpen: (r: Ref) => void; selected?: string; edit?: TreeEdit; up?: boolean }) {
  const kids = node.children
  const showAdder = depth === 0 && edit
  return (
    <div className="ct-sub">
      <Node node={node} depth={depth} onOpen={onOpen} selected={selected} edit={depth === 1 ? edit : undefined} up={up} />
      {kids.length || showAdder ? (
        <div className="ct-kids">
          {kids.map((k) => (
            <Sub key={k.key} node={k} depth={depth + 1} onOpen={onOpen} selected={selected} edit={edit} up={up} />
          ))}
          {showAdder ? <div className="ct-sub ct-add">{edit.adder}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

function Node({ node, depth, onOpen, selected, edit, up }: { node: TreeNode; depth: number; onOpen: (r: Ref) => void; selected?: string; edit?: TreeEdit; up?: boolean }) {
  const r = node.ref
  const clickable = r.kind === 'item' || r.kind === 'part' || r.kind === 'wmat'
  const on = selected !== undefined && selected === refKey(r)
  const editable = edit && node.index !== undefined
  return (
    <div className={`ct-node kind-${r.kind} ${node.tier ? 'tier-' + node.tier : ''} ${on ? 'on' : ''} ${depth === 0 ? 'root' : ''}`}>
      <button
        className="ct-label"
        disabled={!clickable}
        onClick={() => clickable && onOpen(r)}
        title={clickable ? (r.kind === 'wmat' || (r.kind === 'item' && !up) ? 'Aç / nerelerde kullanıldığını gör' : 'Aç') : undefined}
      >
        <span className="ct-name">{node.label}</span>
        <span className="ct-meta">
          {node.tier ? <span className={`tiertext tier-${node.tier}`}>{TIER_LABEL[node.tier]}</span> : null}
          {node.sub ? <span className="muted"> {node.sub}</span> : null}
          {node.loop ? <span className="muted"> (yukarıda var)</span> : null}
        </span>
      </button>
      {editable ? (
        <span className="ct-edit">
          ×<input type="number" min={1} max={99} value={node.count} onChange={(e) => edit.onCount(node.index!, Math.min(99, Math.max(1, Number(e.target.value) || 1)))} />
          <button className="ghost" title="Tariften çıkar" onClick={() => edit.onRemove(node.index!)}>
            ✕
          </button>
        </span>
      ) : node.count !== undefined ? (
        <span className="ct-count">×{node.count}</span>
      ) : null}
    </div>
  )
}
