import { EventItem } from "@/types/events";

const nowIso = new Date().toISOString();
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

export const events: EventItem[] = [
  {
    id: "ev-1",
    title: "Sunset Acoustic Session",
    shortDescription: "Intimate music evening with warm vibes.",
    description:
      "Join us for a cozy acoustic night. Limited seats, handcrafted cocktails, and a laid-back atmosphere.",
    imageUrl:
      "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1600&auto=format&fit=crop",
    startsAt: plusDays(7),
    endsAt: plusDays(7) /* same day, sample */,
    venue: {
      name: "La Casa del Sol",
      address: "Av. Córdoba 1234, Buenos Aires",
      lat: -34.6037,
      lng: -58.3816,
    },
    category: "Music",
    sku: "EV-SSN-0001",
    status: "published",
    tickets: [
      {
        id: "t1",
        name: "General",
        unitAmountCents: 2500,
        currency: "usd",
        capacityTotal: 60,
        zone: "General Floor",
        participantsPerTicket: 1,
        earlyBirdAmountCents: 2000,
        earlyBirdStart: nowIso,
        earlyBirdEnd: plusDays(3),
      },
      {
        id: "t2",
        name: "VIP Front Row",
        unitAmountCents: 4500,
        currency: "usd",
        capacityTotal: 20,
        zone: "Front Row",
        participantsPerTicket: 1,
      },
      {
        id: "t3",
        name: "Duo Pack",
        unitAmountCents: 4200,
        currency: "usd",
        capacityTotal: 15,
        zone: "Side Boxes",
        participantsPerTicket: 2,
      },
    ],
    addons: [
      { id: "a1", name: "Welcome Drink", unitAmountCents: 600 },
      { id: "a2", name: "Merch Pack", unitAmountCents: 1500 },
    ],
    capacityTotal: 100,
    couponCode: "SAVE10",
  },
  {
    id: "ev-2",
    title: "Coffee Tasting Workshop",
    shortDescription: "Explore origins, aromas and brewing secrets.",
    description:
      "Taste unique beans, learn proper extraction and enjoy pastries in a friendly hands-on session.",
    imageUrl:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=1600&auto=format&fit=crop",
    startsAt: plusDays(14),
    endsAt: plusDays(14),
    venue: {
      name: "Roasters Lab",
      address: "Calle Mayor 45, Madrid",
      lat: 40.4168,
      lng: -3.7038,
    },
    category: "Workshop",
    sku: "EV-CFW-0002",
    status: "published",
    tickets: [
      {
        id: "t1",
        name: "General",
        unitAmountCents: 3000,
        currency: "usd",
        capacityTotal: 25,
        participantsPerTicket: 1,
        earlyBirdAmountCents: 2500,
        earlyBirdStart: nowIso,
        earlyBirdEnd: plusDays(5),
      },
    ],
    addons: [{ id: "a1", name: "Premium Beans (250g)", unitAmountCents: 1200 }],
    capacityTotal: 30,
    couponCode: "COFFEE5",
  },
];
