export type Currency = 'usd' | 'eur' | 'ars' | 'mxn';

export interface Venue {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface TicketType {
  id: string;
  name: string; // e.g., General, Platea A, 2-Pack
  unitAmountCents: number;
  currency: Currency;
  capacityTotal: number; // seats/standing spots available for this ticket
  zone?: string; // location/sector in venue
  participantsPerTicket: number; // 1 for single, 2 for 2-Pack
  earlyBirdAmountCents?: number; // optional discounted price
  earlyBirdStart?: string; // ISO
  earlyBirdEnd?: string; // ISO
}

export interface Addon {
  id: string;
  name: string;
  unitAmountCents: number;
}

export interface EventItem {
  id: string;
  title: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  venue: Venue;
  category?: string;
  sku: string;
  status: 'draft' | 'published' | 'archived';
  tickets: TicketType[];
  addons: Addon[];
  capacityTotal?: number; // optional overall capacity
  couponCode?: string; // optional code for demo UI
  instructions?: string; // internal, not shown on frontend
  recurrenceRule?: string; // optional iCal RRULE
  recurrenceText?: string; // human-readable recurrence
}
