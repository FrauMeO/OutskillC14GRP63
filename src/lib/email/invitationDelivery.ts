import type { EmailResult } from './client';
export function invitationDeliveryText(email: string, result: EmailResult): string {
  const handoff = `They can sign in or create an account at https://buildyourpillars.com with exactly ${email}, then open Following to accept.`;
  return result.sent
    ? `Invitation saved. The email service accepted the invitation; inbox delivery is not confirmed. ${handoff}`
    : `Invitation saved, but we could not confirm a new email was sent. You can try the invitation email button below or tell them yourself. ${handoff}`;
}
