// The server's own content types and checks (server/src/rules/content.ts), so the panel shows the
// same errors before saving that the server would give.
export * from '../../../server/src/rules/content'
export type { Tier, Category, CatchTable } from '../../../server/src/rules/catch'
export type { RecipeGrade } from '../../../server/src/rules/craft'
export type { Band } from '../../../server/src/rules/water'
export type { ChestDef, QuestDef } from '../../../server/src/rules/quest'
export { BANDS } from '../../../server/src/rules/water'
