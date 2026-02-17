// Single source of truth for DTTracker transactional emails (Edge Functions).
// All functions that send HTML email should use emailHeader(), emailFooter(), and helpers from this file.
// Brand: #E8153A red, dark theme, logo header, footer.
// Logo: use LOGO_URL only. Do not use /static/logo-black.png or other paths—many clients block or 404 them.

export const LOGO_URL = 'https://dttracker.app/logo.png';
const BRAND_COLOR = '#E8153A';
const BG_COLOR = '#0A0A0A';
const CARD_COLOR = '#111111';
const INFO_BOX_COLOR = '#1A1A1A';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = '#94A3B8';
const TEXT_MUTED = '#64748B';
const BORDER_COLOR = 'rgba(255,255,255,0.08)';

export const emailStyles = {
  BRAND_COLOR,
  BG_COLOR,
  CARD_COLOR,
  INFO_BOX_COLOR,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  BORDER_COLOR,
};

export function emailHeader(): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  </head>
  <body style="margin: 0; padding: 0; background-color: ${BG_COLOR}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: ${BG_COLOR};">
      <!-- Header with Logo -->
      <div style="padding: 32px 30px 24px; text-align: center; border-bottom: 1px solid ${BORDER_COLOR};">
        <a href="https://dttracker.app" style="text-decoration: none; display: inline-block;">
          <img src="${LOGO_URL}" alt="DTTracker" width="140" height="40" border="0" style="display: block; margin: 0 auto; max-width: 140px; height: auto;" />
        </a>
      </div>
      <!-- Content -->
      <div style="padding: 40px 30px;">`;
}

export function emailFooter(): string {
  return `      </div>
      <!-- Footer -->
      <div style="padding: 24px 30px; text-align: center; border-top: 1px solid ${BORDER_COLOR};">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: ${TEXT_MUTED};">&copy; ${new Date().getFullYear()} DTTracker</p>
        <a href="https://dttracker.app" style="font-size: 12px; color: ${TEXT_MUTED}; text-decoration: none;">dttracker.app</a>
      </div>
    </div>
  </body>
</html>`;
}

export function emailButton(text: string, url: string): string {
  return `<div style="text-align: center; margin: 32px 0;">
  <a href="${url}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #FFFFFF; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">${text}</a>
</div>`;
}

export function emailInfoBox(content: string): string {
  return `<div style="background-color: ${INFO_BOX_COLOR}; border: 1px solid ${BORDER_COLOR}; border-radius: 10px; padding: 20px; margin: 24px 0;">
  ${content}
</div>`;
}

export function emailCard(content: string): string {
  return `<div style="background-color: ${CARD_COLOR}; border: 1px solid ${BORDER_COLOR}; border-radius: 10px; padding: 24px; margin: 24px 0;">
  ${content}
</div>`;
}

export function emailLabel(text: string): string {
  return `<p style="color: ${TEXT_SECONDARY}; margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">${text}</p>`;
}

export function emailValue(text: string): string {
  return `<p style="color: ${TEXT_PRIMARY}; margin: 0; font-size: 16px; font-weight: 500;">${text}</p>`;
}

export function emailHeading(text: string): string {
  return `<h1 style="color: ${TEXT_PRIMARY}; margin: 0 0 8px 0; font-size: 24px; font-weight: 700; text-align: center;">${text}</h1>`;
}

export function emailSubtext(text: string): string {
  return `<p style="color: ${TEXT_SECONDARY}; margin: 0; font-size: 15px; line-height: 1.6; text-align: center;">${text}</p>`;
}

export function emailSectionTitle(text: string): string {
  return `<h3 style="color: ${TEXT_PRIMARY}; margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">${text}</h3>`;
}

export function emailDivider(): string {
  return `<hr style="border: none; border-top: 1px solid ${BORDER_COLOR}; margin: 28px 0;" />`;
}

export function emailLinkText(text: string, url: string): string {
  return `<p style="color: ${TEXT_MUTED}; font-size: 13px; margin-top: 16px; text-align: center; word-break: break-all;">
  Or copy this link: <a href="${url}" style="color: ${BRAND_COLOR}; text-decoration: none;">${url}</a>
</p>`;
}

export function emailRow(label: string, value: string): string {
  return `<tr>
  <td style="padding: 8px 0; color: ${TEXT_SECONDARY}; font-size: 14px; vertical-align: top; width: 140px;">${label}</td>
  <td style="padding: 8px 0; color: ${TEXT_PRIMARY}; font-size: 14px; vertical-align: top;">${value}</td>
</tr>`;
}

export function emailTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
  ${rows}
</table>`;
}
