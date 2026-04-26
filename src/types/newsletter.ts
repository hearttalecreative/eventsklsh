export type NewsletterModuleType = "custom" | "events" | "divider";

export interface NewsletterBaseModule {
  id: string;
  type: NewsletterModuleType;
  label: string;
}

export interface NewsletterCustomModule extends NewsletterBaseModule {
  type: "custom";
  title: string;
  imageUrl: string;
  bodyHtml: string;
  buttonText: string;
  buttonUrl: string;
}

export interface NewsletterEventsModule extends NewsletterBaseModule {
  type: "events";
  title: string;
  eventIds: string[];
  buttonText: string;
}

export interface NewsletterDividerModule extends NewsletterBaseModule {
  type: "divider";
  dividerStyle: "line" | "spacer";
}

export type NewsletterModule =
  | NewsletterCustomModule
  | NewsletterEventsModule
  | NewsletterDividerModule;

export interface NewsletterRecord {
  id: string;
  title: string;
  subject: string | null;
  status: "draft" | "ready";
  content: NewsletterModule[];
  generated_html: string | null;
  updated_at: string;
}

export interface NewsletterEventItem {
  id: string;
  title: string;
  slug: string | null;
  image_url: string | null;
  starts_at: string;
  timezone: string | null;
  external_ticket_url: string | null;
  external_ticket_button_text: string | null;
  venue_name: string;
  venue_address: string;
}
