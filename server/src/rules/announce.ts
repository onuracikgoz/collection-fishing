// Which catches are announced to the whole server (docs/protokol.md, Duyurular). Pure function.
import { Tier } from '../protocol';

const ORDER: Tier[] = ['common', 'rare', 'epic', 'legendary', 'mythic'];

export function shouldAnnounce(tier: Tier, minTier: Tier): boolean {
  return ORDER.indexOf(tier) >= ORDER.indexOf(minTier);
}
