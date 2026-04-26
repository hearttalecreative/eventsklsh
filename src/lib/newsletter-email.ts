import {
  NewsletterCustomModule,
  NewsletterDividerModule,
  NewsletterEventItem,
  NewsletterEventsModule,
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
  { label: "IG", name: "Instagram", href: "http://www.instagram.com/kylelamsoundhealing" },
  { label: "FB", name: "Facebook", href: "http://www.facebook.com/kylelamsoundhealing" },
  { label: "YT", name: "YouTube", href: "https://www.youtube.com/@kylelamsoundhealing" },
  { label: "TT", name: "TikTok", href: "https://www.tiktok.com/@kylelamsoundhealing" },
  {
    label: "SP",
    name: "Spotify",
    href: "https://open.spotify.com/artist/4uXnIdQTkFkoT7TiHuSsl6?si=vmjmSZY6QPq6lBAC5fBbDA",
  },
  { label: "AM", name: "Apple Music", href: "https://music.apple.com/us/artist/kyle-lam-sound-healing/1779560355" },
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
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e3dcd4;border-radius:14px;background:#ffffff;margin:0 0 16px 0;">
          <tr>
            <td class="event-image-col" width="244" style="padding:0;vertical-align:top;">
              ${
                event.image_url
                  ? `<img src="${escapeHtml(event.image_url)}" alt="${escapeHtml(event.title)}" width="244" style="display:block;width:244px;max-width:244px;height:auto;min-height:206px;border:0;border-radius:14px 0 0 14px;object-fit:cover;"/>`
                  : `<div style="width:244px;background:${BRAND.bg};height:100%;min-height:206px;"></div>`
              }
            </td>
            <td class="event-copy-col" style="padding:20px 22px 20px 24px;vertical-align:top;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;font-weight:600;color:${BRAND.copperDark};margin:0 0 10px 0;letter-spacing:0.25px;">${escapeHtml(eventDate)}</div>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.24;color:${BRAND.dark};margin:0 0 11px 0;">${escapeHtml(event.title)}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${BRAND.muted};margin:0 0 15px 0;">${escapeHtml(eventTime)}<br/>${safeVenueLine}</div>
              ${renderButton(buttonText, purchaseLink)}
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
      <td style="padding:34px 38px 10px 38px;background:${BRAND.paper};">
        <h2 style="margin:0 0 16px 0;color:${BRAND.dark};font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:500;letter-spacing:0.2px;">
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

function renderModule(module: NewsletterModule, eventsById: Map<string, NewsletterEventItem>, siteUrl: string) {
  if (module.type === "custom") {
    return renderCustomModule(module);
  }

  if (module.type === "events") {
    return renderEventsModule(module, eventsById, siteUrl);
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

  const socialBadges = SOCIAL_LINKS.map(
    (social) => `
      <a href="${escapeHtml(social.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 4px 8px 4px;text-decoration:none;">
        <span style="display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.28);color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;line-height:1;padding:8px 10px;border-radius:999px;letter-spacing:0.4px;">${social.label}</span>
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
      .event-image-col,
      .event-copy-col { display: block !important; width: 100% !important; max-width: 100% !important; }
      .event-image-col img { width: 100% !important; max-width: 100% !important; border-radius: 14px 14px 0 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
    <tr>
      <td align="center" style="padding:22px 10px;">
        <table role="presentation" class="newsletter-shell" width="640" cellspacing="0" cellpadding="0" border="0" style="width:640px;max-width:640px;background:${BRAND.paper};border-radius:24px;overflow:hidden;box-shadow:0 8px 24px rgba(59,48,38,0.07);">
          <tr>
            <td class="newsletter-pad" style="padding:28px 34px 22px 34px;background:${BRAND.paper};text-align:center;border-bottom:1px solid #e5ded6;">
              <img src="${HEADER_LOGO_URL}" alt="Kyle Lam Sound Healing" width="290" style="display:inline-block;width:290px;max-width:100%;height:auto;margin:0 auto;" />
            </td>
          </tr>

          ${contentRows}

          <tr>
            <td class="newsletter-pad" style="padding:34px 34px;background:${BRAND.dark};text-align:center;">
              <img src="${FOOTER_LOGO_URL}" alt="Kyle Lam Sound Healing" width="230" style="display:inline-block;width:230px;max-width:100%;height:auto;margin:0 auto 16px auto;opacity:0.95;" />

              <div style="font-family:Arial,Helvetica,sans-serif;color:#f4efe7;font-size:14px;line-height:1.78;margin:0 0 16px 0;">
                <a href="mailto:info@kylelamsoundhealing.com" style="color:#f5f2ed;text-decoration:none;">info@kylelamsoundhealing.com</a><br/>
                (949) 342-4076<br/>
                <a href="https://www.kylelamsoundhealing.com" target="_blank" rel="noopener noreferrer" style="color:#f5f2ed;text-decoration:none;">www.kylelamsoundhealing.com</a>
              </div>

              <div style="margin:0 0 10px 0;">${socialBadges}</div>

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
