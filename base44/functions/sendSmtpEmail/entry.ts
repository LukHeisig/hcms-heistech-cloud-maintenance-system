import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isAppAdmin } from '../../shared/access.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Pouze interní volání (alarmy) nebo správci — nikdy anonymní relay
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isAppAdmin(user)) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return Response.json({ error: 'Missing required fields: to, subject, html' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

    // Encode subject for non-ASCII characters (RFC 2047)
    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

    // Build RFC 2822 message
    const messageParts = [
      `To: ${to}`,
      `Subject: ${encodedSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      html,
    ];
    const rawMessage = messageParts.join('\r\n');

    // Base64URL encode
    const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodedMessage }),
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: `Gmail API error: ${err}` }, { status: response.status });
    }

    const result = await response.json();
    return Response.json({ success: true, messageId: result.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}