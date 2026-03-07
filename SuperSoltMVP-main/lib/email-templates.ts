export const inviteTemplate = (link: string) =>
  `<p>You've been invited to SuperSolt.</p><p><a href="${link}">Accept your invitation</a> (valid 7 days)</p>`;

export const resetTemplate = (link: string) =>
  `<p>Reset your SuperSolt password:</p><p><a href="${link}">Choose a new password</a> (valid 1 hour)</p>`;
