// Single source of truth for DTTracker transactional emails (Edge Functions).
// Mobile-first, responsive, light/dark theme compatible.
// Logo: use LOGO_URL only. Do not use /static/logo-black.png or other paths.

export const LOGO_URL = "https://dttracker.app/logo.png";
const BRAND_COLOR = "#E8153A";

// Light theme (default inline fallback — works in all clients)
const LIGHT = {
  BG: "#F8FAFC",
  CARD: "#FFFFFF",
  INFO_BOX: "#F1F5F9",
  TEXT_PRIMARY: "#0F172A",
  TEXT_SECONDARY: "#475569",
  TEXT_MUTED: "#64748B",
  BORDER: "#E2E8F0",
};

// Dark theme (applied via @media (prefers-color-scheme: dark) where supported)
const DARK = {
  BG: "#0A0A0A",
  CARD: "#111111",
  INFO_BOX: "#1A1A1A",
  TEXT_PRIMARY: "#FFFFFF",
  TEXT_SECONDARY: "#94A3B8",
  TEXT_MUTED: "#64748B",
  BORDER: "rgba(255,255,255,0.08)",
};

export const emailStyles = {
  BRAND_COLOR,
  ...LIGHT,
  // Expose for any code that expects these names
  BG_COLOR: LIGHT.BG,
  CARD_COLOR: LIGHT.CARD,
  INFO_BOX_COLOR: LIGHT.INFO_BOX,
  TEXT_PRIMARY: LIGHT.TEXT_PRIMARY,
  TEXT_SECONDARY: LIGHT.TEXT_SECONDARY,
  TEXT_MUTED: LIGHT.TEXT_MUTED,
  BORDER_COLOR: LIGHT.BORDER,
};

const SITE_URL = "https://dttracker.app";
const PRODUCT_NAME = "DTTracker";

const MOBILE_PADDING = "16px";
const DESKTOP_PADDING = "28px";
const LOGO_WIDTH_MOBILE = 88;
const LOGO_WIDTH_DESKTOP = 108;

function emailStylesBlock(): string {
  return `
  <style type="text/css">
    /* Reset and base */
    .email-root { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    .email-wrapper { width: 100%; min-height: 100vh; }
    /* Light (default) already in inline styles */

    /* Dark theme */
    @media (prefers-color-scheme: dark) {
      .email-wrapper { background-color: ${DARK.BG} !important; }
      .email-header-inner { border-bottom-color: ${DARK.BORDER} !important; }
      .email-logo { opacity: 1; }
      .email-body-inner { background-color: transparent !important; color: ${DARK.TEXT_PRIMARY} !important; }
      .email-body-inner h1 { color: ${DARK.TEXT_PRIMARY} !important; }
      .email-body-inner p { color: ${DARK.TEXT_SECONDARY} !important; }
      .email-body-inner .text-secondary { color: ${DARK.TEXT_SECONDARY} !important; }
      .email-body-inner .text-muted { color: ${DARK.TEXT_MUTED} !important; }
      .email-body-inner a:not(.email-cta) { color: ${BRAND_COLOR} !important; }
      .email-footer-inner { border-top-color: ${DARK.BORDER} !important; }
      .email-footer-inner p, .email-footer-inner a { color: ${DARK.TEXT_MUTED} !important; }
      .email-cta { background-color: ${BRAND_COLOR} !important; color: #FFFFFF !important; }
      .email-info-box { background-color: ${DARK.INFO_BOX} !important; border-color: ${DARK.BORDER} !important; }
      .email-card { background-color: ${DARK.CARD} !important; border-color: ${DARK.BORDER} !important; }
    }

    /* Mobile-first: small logo, compact padding */
    .email-header-inner { padding: 20px ${MOBILE_PADDING} 16px !important; }
    .email-logo { max-width: ${LOGO_WIDTH_MOBILE}px !important; height: auto !important; display: block !important; }
    .email-body-inner { padding: 24px ${MOBILE_PADDING} 32px !important; }
    .email-footer-inner { padding: 20px ${MOBILE_PADDING} !important; }
    .email-heading { font-size: 20px !important; line-height: 1.3 !important; }
    .email-subtext { font-size: 14px !important; line-height: 1.55 !important; }
    .email-cta { min-height: 48px !important; padding: 14px 20px !important; font-size: 15px !important; box-sizing: border-box !important; width: 100% !important; max-width: 100% !important; }
    .email-cta-wrap { width: 100% !important; padding: 0 !important; }

    /* Tablet and up */
    @media screen and (min-width: 481px) {
      .email-header-inner { padding: 24px ${DESKTOP_PADDING} 20px !important; }
      .email-logo { max-width: ${LOGO_WIDTH_DESKTOP}px !important; }
      .email-body-inner { padding: 32px ${DESKTOP_PADDING} 40px !important; }
      .email-footer-inner { padding: 24px ${DESKTOP_PADDING} !important; }
      .email-heading { font-size: 24px !important; }
      .email-subtext { font-size: 15px !important; }
      .email-cta { width: auto !important; max-width: 280px !important; min-width: 160px !important; }
      .email-cta-wrap { width: auto !important; }
    }
  </style>`;
}

export function emailHeader(): string {
  return `<!DOCTYPE html>
<html lang="en" class="email-root">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  ${emailStylesBlock()}
</head>
<body class="email-root" style="margin: 0; padding: 0; background-color: ${LIGHT.BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div class="email-wrapper" style="background-color: ${LIGHT.BG}; width: 100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
      <tr>
        <td style="padding: 0;">
          <!-- Header: smaller logo, responsive -->
          <div class="email-header-inner" style="padding: 20px ${MOBILE_PADDING} 16px; text-align: center; border-bottom: 1px solid ${LIGHT.BORDER};">
            <a href="${SITE_URL}" style="text-decoration: none; display: inline-block;" target="_blank" rel="noopener">
              <img class="email-logo" src="${LOGO_URL}" alt="${PRODUCT_NAME}" width="${LOGO_WIDTH_DESKTOP}" height="${Math.round(LOGO_WIDTH_DESKTOP * 0.4)}" border="0" style="display: block; margin: 0 auto; max-width: ${LOGO_WIDTH_MOBILE}px; height: auto;" />
            </a>
          </div>
          <!-- Content -->
          <div class="email-body-inner" style="padding: 24px ${MOBILE_PADDING} 32px; background-color: ${LIGHT.BG}; color: ${LIGHT.TEXT_PRIMARY};">`;
}

export function emailFooter(): string {
  return `          </div>
          <!-- Footer -->
          <div class="email-footer-inner" style="padding: 20px ${MOBILE_PADDING}; text-align: center; border-top: 1px solid ${LIGHT.BORDER};">
            <p style="margin: 0 0 4px 0; font-size: 12px; color: ${LIGHT.TEXT_MUTED};">
              &copy; ${new Date().getFullYear()} ${PRODUCT_NAME}
            </p>
            <a href="${SITE_URL}" style="font-size: 12px; color: ${LIGHT.TEXT_MUTED}; text-decoration: none;" target="_blank" rel="noopener">dttracker.app</a>
          </div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

export function emailButton(text: string, url: string): string {
  return `<div class="email-cta-wrap" style="text-align: center; margin: 28px 0;">
  <a class="email-cta" href="${url}" target="_blank" rel="noopener" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #FFFFFF; text-decoration: none; padding: 14px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; min-height: 48px; line-height: 20px; box-sizing: border-box;">${text}</a>
</div>`;
}

export function emailInfoBox(content: string): string {
  return `<div class="email-info-box" style="background-color: ${LIGHT.INFO_BOX}; border: 1px solid ${LIGHT.BORDER}; border-radius: 10px; padding: 18px 16px; margin: 20px 0;">
  ${content}
</div>`;
}

export function emailCard(content: string): string {
  return `<div class="email-card" style="background-color: ${LIGHT.CARD}; border: 1px solid ${LIGHT.BORDER}; border-radius: 10px; padding: 20px 16px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
  ${content}
</div>`;
}

export function emailLabel(text: string): string {
  return `<p style="color: ${LIGHT.TEXT_SECONDARY}; margin: 0 0 6px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">${text}</p>`;
}

export function emailValue(text: string): string {
  return `<p style="color: ${LIGHT.TEXT_PRIMARY}; margin: 0; font-size: 15px; font-weight: 500;">${text}</p>`;
}

export function emailHeading(text: string): string {
  return `<h1 class="email-heading" style="color: ${LIGHT.TEXT_PRIMARY}; margin: 0 0 12px 0; font-size: 20px; font-weight: 700; text-align: center;">${text}</h1>`;
}

export function emailSubtext(text: string): string {
  return `<p class="email-subtext text-secondary" style="color: ${LIGHT.TEXT_SECONDARY}; margin: 0; font-size: 14px; line-height: 1.55; text-align: center;">${text}</p>`;
}

export function emailSectionTitle(text: string): string {
  return `<h3 style="color: ${LIGHT.TEXT_PRIMARY}; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;">${text}</h3>`;
}

export function emailDivider(): string {
  return `<hr style="border: none; border-top: 1px solid ${LIGHT.BORDER}; margin: 24px 0;" />`;
}

export function emailLinkText(text: string, url: string): string {
  return `<p class="text-muted" style="color: ${LIGHT.TEXT_MUTED}; font-size: 13px; margin-top: 16px; text-align: center; word-break: break-all;">
  ${text}: <a href="${url}" style="color: ${BRAND_COLOR}; text-decoration: none;" target="_blank" rel="noopener">${url}</a>
</p>`;
}

/**
 * Renders a "copy this link" section for auth emails.
 * hrefUrl   — the intermediary copy-link page URL (dobbletap.com/auth/copy-link?url=...)
 * friendlyUrl — the clean display text shown to the user
 * Clicking the link navigates to the copy-link page which copies the real
 * Supabase verify URL to clipboard and shows an "Open link" button.
 */
export function emailCopyLinkBox(hrefUrl: string, friendlyUrl: string): string {
  return `<p class="text-muted" style="color: ${LIGHT.TEXT_MUTED}; font-size: 13px; margin-top: 16px; text-align: center;">
  Or copy this link: <a href="${hrefUrl}" style="color: ${BRAND_COLOR}; text-decoration: none; font-weight: 500;" target="_blank" rel="noopener">${friendlyUrl}</a>
</p>`;
}

export function emailRow(label: string, value: string): string {
  return `<tr>
  <td style="padding: 8px 0; color: ${LIGHT.TEXT_SECONDARY}; font-size: 14px; vertical-align: top; width: 120px;">${label}</td>
  <td style="padding: 8px 0; color: ${LIGHT.TEXT_PRIMARY}; font-size: 14px; vertical-align: top;">${value}</td>
</tr>`;
}

export function emailTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
  ${rows}
</table>`;
}
