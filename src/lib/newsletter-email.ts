import {
  NewsletterCustomModule,
  NewsletterDividerModule,
  NewsletterEventItem,
  NewsletterEventsModule,
  NewsletterHighlightButtonModule,
  NewsletterModule,
} from "@/types/newsletter";

const BRAND = {
  bg: "#ece9e4",
  paper: "#f8f6f2",
  dark: "#2f3443",
  copper: "#b27a40",
  copperDark: "#8d5e30",
  text: "#2c2723",
  muted: "#72665b",
  border: "#ddd6ce",
};

const HEADER_LOGO_URL =
  "https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-2logo-horizontal-color.svg";

const FOOTER_LOGO_URL =
  "https://kylelamsoundhealing.com/wp-content/uploads/2024/12/Recurso-3logo-horizontal-blanco.svg";

const SOCIAL_LINKS = [
  {
    name: "Instagram",
    href: "http://www.instagram.com/kylelamsoundhealing",
    iconUrl: "https://img.icons8.com/ios-filled/50/ffffff/instagram-new.png",
  },
  {
    name: "Facebook",
    href: "http://www.facebook.com/kylelamsoundhealing",
    iconUrl: "https://img.icons8.com/ios-filled/50/ffffff/facebook-new.png",
  },
  {
    name: "YouTube",
    href: "https://www.youtube.com/@kylelamsoundhealing",
    iconUrl: "https://img.icons8.com/ios-filled/50/ffffff/youtube-play.png",
  },
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@kylelamsoundhealing",
    iconUrl: "https://img.icons8.com/ios-filled/50/ffffff/tiktok--v1.png",
  },
  {
    name: "Spotify",
    href: "https://open.spotify.com/artist/4uXnIdQTkFkoT7TiHuSsl6?si=vmjmSZY6QPq6lBAC5fBbDA",
    iconUrl: "https://img.icons8.com/ios-filled/50/ffffff/spotify.png",
  },
  {
    name: "Apple Music",
    href: "https://music.apple.com/us/artist/kyle-lam-sound-healing/1779560355",
    iconUrl: "https://img.icons8.com/ios-filled/50/ffffff/apple-music.png",
  },
];

const ALLOWED_RICH_TAGS = new Set(["P", "BR", "STRONG", "B", "EM", "I", "U", "A", "H3", "H4", "UL", "OL", "LI"]);

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeUrl(url?: string | null) {
  if (!url) return false;
  const trimmed = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed);
}

function sanitizeAnchorHref(href?: string | null) {
  if (!isSafeUrl(href)) return "#";
  return href!.trim();
}

export function sanitizeNewsletterRichHtml(rawHtml: string) {
  if (!rawHtml) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${rawHtml}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      node.parentNode?.removeChild(node);
      return;
    }

    const element = node as HTMLElement;
    const tagName = element.tagName;

    if (!ALLOWED_RICH_TAGS.has(tagName)) {
      const parent = element.parentNode;
      if (!parent) return;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      return;
    }

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (tagName === "A" && attrName === "href") continue;
      element.removeAttribute(attr.name);
    }

    if (tagName === "A") {
      const href = sanitizeAnchorHref(element.getAttribute("href"));
      element.setAttribute("href", href);
      element.setAttribute("target", "_blank");
      element.setAttribute("rel", "noopener noreferrer");
    }

    Array.from(element.childNodes).forEach(sanitizeNode);
  };

  Array.from(root.childNodes).forEach(sanitizeNode);
  return root.innerHTML.trim();
}

function styleNewsletterRichHtml(rawHtml: string) {
  const sanitized = sanitizeNewsletterRichHtml(rawHtml);
  if (!sanitized) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${sanitized}</div>`, "text/html");
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root) return "";

  root.querySelectorAll("p").forEach((el) => {
    el.setAttribute("style", `margin:0 0 14px 0;color:${BRAND.text};font-size:15px;line-height:1.7;`);
  });

  root.querySelectorAll("h3").forEach((el) => {
    el.setAttribute(
      "style",
      `margin:0 0 10px 0;color:${BRAND.dark};font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.25;font-weight:600;letter-spacing:0.3px;`,
    );
  });

  root.querySelectorAll("h4").forEach((el) => {
    el.setAttribute(
      "style",
      `margin:0 0 10px 0;color:${BRAND.dark};font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.3;font-weight:600;`,
    );
  });

  root.querySelectorAll("ul,ol").forEach((el) => {
    el.setAttribute("style", `margin:0 0 14px 24px;padding:0;color:${BRAND.text};font-size:15px;line-height:1.7;`);
  });

  root.querySelectorAll("li").forEach((el) => {
    el.setAttribute("style", "margin:0 0 8px 0;");
  });

  root.querySelectorAll("a").forEach((el) => {
    const href = sanitizeAnchorHref(el.getAttribute("href"));
    el.setAttribute("href", href);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener noreferrer");
    el.setAttribute("style", `color:${BRAND.dark};text-decoration:underline;font-weight:600;`);
  });

  return root.innerHTML;
}

function formatEventDateLabel(isoDate: string, timezone?: string | null) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone || "America/Los_Angeles",
  }).format(date);
}

function formatEventTimeLine(isoDate: string, timezone?: string | null) {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone || "America/Los_Angeles",
  }).format(date);
}

function resolveEventPurchaseLink(event: NewsletterEventItem, siteUrl: string) {
  if (isSafeUrl(event.external_ticket_url)) {
    return event.external_ticket_url!.trim();
  }

  if (event.slug) {
    return `${siteUrl.replace(/\/$/, "")}/event/${event.slug}`;
  }

  return `${siteUrl.replace(/\/$/, "")}/event/${event.id}`;
}

function renderButton(buttonText: string, buttonUrl: string) {
  if (!buttonText || !isSafeUrl(buttonUrl)) return "";

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="left" style="margin:0;">
      <tr>
        <td style="border-radius:6px;background:${BRAND.dark};">
          <a href="${escapeHtml(buttonUrl.trim())}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 18px;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;letter-spacing:0.35px;">
            ${escapeHtml(buttonText)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function renderEventButton(buttonText: string, buttonUrl: string) {
  if (!buttonText || !isSafeUrl(buttonUrl)) return "";

  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="left" style="margin:0 0 2px 0;">
      <tr>
        <td style="border-radius:4px;background:${BRAND.dark};">
          <a class="event-cta" href="${escapeHtml(buttonUrl.trim())}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:8px 14px;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.3px;">
            ${escapeHtml(buttonText)}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function renderCustomModule(module: NewsletterCustomModule) {
  const buttonHtml = renderButton(module.buttonText, module.buttonUrl);
  const bodyHtml = styleNewsletterRichHtml(module.bodyHtml);

  return `
    <tr>
      <td style="padding:34px 38px 10px 38px;background:${BRAND.paper};">
        ${
          module.title
            ? `<h2 style="margin:0 0 16px 0;color:${BRAND.dark};font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:500;letter-spacing:0.2px;">${escapeHtml(module.title)}</h2>`
            : ""
        }

        ${
          module.imageUrl
            ? `<img src="${escapeHtml(module.imageUrl)}" alt="Newsletter section image" width="564" style="display:block;width:100%;max-width:564px;height:auto;border:0;border-radius:18px;margin:0 0 18px 0;"/>`
            : ""
        }

        ${bodyHtml ? `<div style="margin:0 0 18px 0;">${bodyHtml}</div>` : ""}
        ${buttonHtml}
      </td>
    </tr>
  `;
}

function renderEventsModule(module: NewsletterEventsModule, eventsById: Map<string, NewsletterEventItem>, siteUrl: string) {
  const selectedEvents = module.eventIds
    .map((eventId) => eventsById.get(eventId))
    .filter(Boolean) as NewsletterEventItem[];

  const title = module.title || "Upcoming Events";

  const rows = selectedEvents
    .map((event) => {
      const purchaseLink = resolveEventPurchaseLink(event, siteUrl);
      const buttonText = event.external_ticket_button_text || module.buttonText || "Get Tickets";
      const eventDate = formatEventDateLabel(event.starts_at, event.timezone);
      const eventTime = formatEventTimeLine(event.starts_at, event.timezone);
      const venueLine = [event.venue_name, event.venue_address].filter(Boolean).join(" | ");
      const safeVenueLine = escapeHtml(venueLine || "Venue TBA");

      return `
        <table class="event-card" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #dfd7cf;border-radius:8px;background:#ffffff;margin:0 0 12px 0;">
          <tr>
            <td class="event-image-col" width="208" style="padding:0;vertical-align:top;">
              ${
                event.image_url
                  ? `<a href="${escapeHtml(purchaseLink)}" target="_blank" rel="noopener noreferrer" style="display:block;text-decoration:none;"><img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.title)}" width="208" style="display:block;width:208px;max-width:208px;height:auto;border:0;border-radius:8px 0 0 8px;"/></a>`
                  : `<div style="width:208px;background:${BRAND.bg};height:100%;min-height:154px;"></div>`
              }
            </td>
            <td class="event-copy-col" style="padding:14px 16px 20px 18px;vertical-align:top;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;font-weight:600;color:${BRAND.copperDark};margin:0 0 6px 0;letter-spacing:0.2px;">${escapeHtml(eventDate)}</div>
              <a class="event-title event-title-link" href="${escapeHtml(purchaseLink)}" target="_blank" rel="noopener noreferrer" style="display:block;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.23;color:${BRAND.dark};margin:0 0 7px 0;text-decoration:none;">${escapeHtml(event.title)}</a>
              <div class="event-meta" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:${BRAND.muted};margin:0 0 10px 0;">${escapeHtml(eventTime)}<br/>${safeVenueLine}</div>
              ${renderEventButton(buttonText, purchaseLink)}
            </td>
          </tr>
        </table>
      `;
    })
    .join("");

  const emptyState = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px dashed ${BRAND.border};border-radius:10px;background:#ffffff;">
      <tr>
        <td style="padding:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.muted};">
          Select at least one event in this module to render event cards.
        </td>
      </tr>
    </table>
  `;

  return `
    <tr>
      <td style="padding:26px 30px 8px 30px;background:${BRAND.paper};">
        <h2 style="margin:0 0 12px 0;color:${BRAND.dark};font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.16;font-weight:500;letter-spacing:0.16px;">
          ${escapeHtml(title)}
        </h2>
        ${rows || emptyState}
      </td>
    </tr>
  `;
}

function renderDividerModule(module: NewsletterDividerModule) {
  if (module.dividerStyle === "spacer") {
    return `
      <tr>
        <td style="padding:0 34px;background:${BRAND.paper};height:18px;line-height:18px;font-size:0;">&nbsp;</td>
      </tr>
    `;
  }

  return `
    <tr>
      <td style="padding:18px 34px 8px 34px;background:${BRAND.paper};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr>
            <td style="height:1px;background:${BRAND.border};font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderHighlightButtonModule(module: NewsletterHighlightButtonModule) {
  const buttonText = module.buttonText.trim();
  const buttonUrl = module.buttonUrl.trim();
  const styleVariant =
    module.styleVariant === "outline" || module.styleVariant === "dark" || module.styleVariant === "solid"
      ? module.styleVariant
      : "solid";

  if (!buttonText || !isSafeUrl(buttonUrl)) {
    return `
      <tr>
        <td style="padding:8px 30px 16px 30px;background:${BRAND.paper};">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px dashed ${BRAND.border};border-radius:10px;background:#ffffff;">
            <tr>
              <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${BRAND.muted};text-align:center;">
                Add button text and a valid URL to render this highlighted CTA block.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }

  const cellStylesByVariant = {
    solid: `border-radius:999px;background:${BRAND.copper};border:1px solid ${BRAND.copperDark};box-shadow:0 8px 20px rgba(141,94,48,0.26);`,
    outline: `border-radius:999px;background:#f4efe7;border:2px solid ${BRAND.copper};box-shadow:0 6px 16px rgba(141,94,48,0.14);`,
    dark: `border-radius:999px;background:${BRAND.dark};border:1px solid ${BRAND.copper};box-shadow:0 8px 22px rgba(47,52,67,0.28);`,
  } as const;

  const linkStylesByVariant = {
    solid: "display:block;width:100%;box-sizing:border-box;padding:12px 22px;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.2;letter-spacing:0.35px;text-align:center;",
    outline: `display:block;width:100%;box-sizing:border-box;padding:12px 22px;color:${BRAND.dark};text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.2;letter-spacing:0.3px;text-align:center;`,
    dark: "display:block;width:100%;box-sizing:border-box;padding:12px 22px;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:1.2;letter-spacing:0.35px;text-align:center;",
  } as const;

  return `
    <tr>
      <td style="padding:12px 30px 18px 30px;background:${BRAND.paper};text-align:center;">
        <table class="highlight-cta-wrap" role="presentation" width="50%" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;width:50%;max-width:100%;">
          <tr>
            <td style="${cellStylesByVariant[styleVariant]}">
              <a class="highlight-cta" href="${escapeHtml(buttonUrl)}" target="_blank" rel="noopener noreferrer" style="${linkStylesByVariant[styleVariant]}">
                ${escapeHtml(buttonText)}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function renderModule(module: NewsletterModule, eventsById: Map<string, NewsletterEventItem>, siteUrl: string) {
  if (module.type === "custom") {
    return renderCustomModule(module);
  }

  if (module.type === "events") {
    return renderEventsModule(module, eventsById, siteUrl);
  }

  if (module.type === "highlight_button") {
    return renderHighlightButtonModule(module);
  }

  return renderDividerModule(module);
}

export function buildNewsletterHtml({
  title,
  modules,
  events,
  siteUrl,
}: {
  title: string;
  modules: NewsletterModule[];
  events: NewsletterEventItem[];
  siteUrl?: string;
}) {
  const resolvedSiteUrl = siteUrl || "https://kylelamsoundhealing.com";
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const contentRows = modules.map((module) => renderModule(module, eventsById, resolvedSiteUrl)).join("");

  const socialIcons = SOCIAL_LINKS.map(
    (social) => `
      <a href="${escapeHtml(social.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 4px 8px 4px;text-decoration:none;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.28);border-radius:999px;padding:8px;line-height:1;">
        <img src="${escapeHtml(social.iconUrl)}" alt="${escapeHtml(social.name)}" width="16" height="16" style="display:block;width:16px;height:16px;border:0;" />
      </a>
    `,
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(title || "Kyle Lam Sound Healing Newsletter")}</title>
  <style>
    body { margin: 0; padding: 0; background: ${BRAND.bg}; }
    table, td { border-collapse: collapse; }
    img { border: 0; line-height: 100%; outline: none; text-decoration: none; }

    @media screen and (max-width: 620px) {
      .newsletter-shell { width: 100% !important; }
      .newsletter-pad { padding-left: 18px !important; padding-right: 18px !important; }
      .event-card { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
      .event-image-col,
      .event-copy-col { display: block !important; width: 100% !important; max-width: 100% !important; }
      .event-copy-col { padding: 12px 14px 20px 14px !important; box-sizing: border-box !important; }
      .event-image-col img { width: 100% !important; max-width: 100% !important; border-radius: 8px 8px 0 0 !important; }
      .event-title { font-size: 17px !important; line-height: 1.24 !important; overflow-wrap: anywhere !important; word-break: break-word !important; }
      .event-meta { overflow-wrap: anywhere !important; word-break: break-word !important; }
      .event-cta { max-width: 100% !important; box-sizing: border-box !important; }
      .highlight-cta-wrap { width: 100% !important; }
      .highlight-cta { width: 100% !important; box-sizing: border-box !important; font-size: 14px !important; padding: 12px 18px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:22px 10px;">
        <table role="presentation" class="newsletter-shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px;background:${BRAND.paper};border-radius:24px;overflow:hidden;box-shadow:0 8px 24px rgba(59,48,38,0.07);">
          <tr>
            <td class="newsletter-pad" style="padding:38px 34px 34px 34px;background:${BRAND.paper};text-align:center;border-bottom:1px solid #e5ded6;">
              <img src="${HEADER_LOGO_URL}" alt="Kyle Lam Sound Healing" width="220" style="display:inline-block;width:220px;max-width:100%;height:auto;margin:0 auto;" />
            </td>
          </tr>

          ${contentRows}

          <tr>
            <td style="background:${BRAND.paper};height:40px;line-height:40px;font-size:0;">&nbsp;</td>
          </tr>

          <tr>
            <td class="newsletter-pad" style="padding:34px 34px;background:${BRAND.dark};text-align:center;">
              <img src="${FOOTER_LOGO_URL}" alt="Kyle Lam Sound Healing" width="230" style="display:inline-block;width:230px;max-width:100%;height:auto;margin:0 auto 16px auto;opacity:0.95;" />

              <div style="font-family:Arial,Helvetica,sans-serif;color:#f4efe7;font-size:14px;line-height:1.78;margin:0 0 16px 0;">
                <a href="mailto:info@kylelamsoundhealing.com" style="color:#f5f2ed;text-decoration:none;">info@kylelamsoundhealing.com</a><br/>
                (949) 342-4076<br/>
                <a href="https://www.kylelamsoundhealing.com" target="_blank" rel="noopener noreferrer" style="color:#f5f2ed;text-decoration:none;">www.kylelamsoundhealing.com</a>
              </div>

              <div style="margin:0 0 10px 0;">${socialIcons}</div>

              <div style="font-family:Arial,Helvetica,sans-serif;color:#d7cab9;font-size:11px;line-height:1.6;letter-spacing:0.25px;">
                You are receiving this message from Kyle Lam Sound Healing.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
