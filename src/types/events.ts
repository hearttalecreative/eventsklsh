export type Currency = 'usd' | 'eur' | 'ars' | 'mxn';

export interface Venue {
  name: string;
  address: string;
}


export interface TicketType {
  id: string;
  name: string; // e.g., General, Early Bird 1, Early Bird 2, Regular
  unitAmountCents: number;
  currency: Currency;
  capacityTotal: number; // seats/standing spots available for this ticket
  zone?: string; // location/sector in venue
  participantsPerTicket: number; // 1 for single, 2 for 2-Pack
  /** ISO timestamp — ticket becomes visible/purchasable on or after this time. Null = no start restriction. */
  saleStartAt?: string;
  /** ISO timestamp — ticket stops being visible/purchasable after this time. Null = no end restriction. */
  saleEndAt?: string;
  /** @deprecated Use saleStartAt/saleEndAt on a separate ticket instead of early-bird pricing. */
  earlyBirdAmountCents?: number;
  /** @deprecated Use saleStartAt/saleEndAt on a separate ticket instead. */
  earlyBirdStart?: string;
  /** @deprecated Use saleStartAt/saleEndAt on a separate ticket instead. */
  earlyBirdEnd?: string;
  description?: string; // optional description shown under each ticket
}

export interface Addon {
  id: string;
  name: string;
  unitAmountCents: number;
  description?: string;
}

export interface EventItem {
  id: string;
  title: string;
  slug?: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  venue: Venue;
  category?: string;
  sku: string;
  status: 'draft' | 'published' | 'archived' | 'sold_out' | 'paused';
  tickets: TicketType[];
  addons: Addon[];
  capacityTotal?: number; // optional overall capacity
  couponCode?: string; // optional code for demo UI
  instructions?: string; // internal, not shown on frontend
  recurrenceRule?: string; // optional iCal RRULE
  recurrenceText?: string; // human-readable recurrence
  timezone?: string; // IANA timezone, e.g., America/Los_Angeles
  externalTicketSales?: boolean; // when true, use external platform instead of internal Stripe system
  externalTicketUrl?: string; // URL to external ticketing platform
  externalTicketButtonText?: string; // text for the purchase button
}
