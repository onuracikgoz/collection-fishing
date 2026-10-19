// Developer tools are on only when the Nakama runtime env has DEV_TOOLS=true
// (server/local.yml). Test and live servers leave it out, so no dev_* RPC exists there.
export function isDevEnabled(ctx: nkruntime.Context): boolean {
  return !!ctx.env && ctx.env['DEV_TOOLS'] === 'true';
}
