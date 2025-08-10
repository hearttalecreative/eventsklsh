import { EventItem } from "@/types/events";

const nowIso = new Date().toISOString();
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

export const events: EventItem[] = [
  {
    id: "ev-1",
    title: "Sunset Acoustic Session",
    shortDescription: "Intimate music evening with warm vibes.",
    description:
      "At golden hour we gather for a slow, intimate acoustic session designed to help you disconnect from the rush of the week. Expect warm textures, soft percussion and storytelling between songs. Our team curates a cozy lounge setting with dim lights, handcrafted cocktails and seating that invites conversation. The performance moves through familiar classics and original pieces, focusing on presence and connection rather than volume. Between sets you can meet the artists, take photos and enjoy small bites. Whether you come alone or with friends, this is an evening to unwind, breathe and let the music hold you. We recommend arriving early to settle in and pick your favorite spot. Dress comfortably, bring a light jacket for our open-air patio, and be ready to sing along to a chorus or two. This event is perfect for date nights, small celebrations and anyone seeking a calm, inspiring night out.",
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
      { id: "a1", name: "Welcome Drink", unitAmountCents: 600, description: "A refreshing welcome cocktail or mocktail to start the night." },
      { id: "a2", name: "Merch Pack", unitAmountCents: 1500, description: "Sticker set, tote bag and enamel pin from the event." },
    ],
    capacityTotal: 100,
    couponCode: "HALFOFF50",
    instructions: "Please arrive 15 minutes early. Bring ID. No outside food or drinks.",
   },
  {
    id: "ev-2",
    title: "Coffee Tasting Workshop",
    shortDescription: "Explore origins, aromas and brewing secrets.",
    description:
      "This hands-on workshop is a playful dive into the world of specialty coffee. We begin with an approachable overview of origins and processing methods, then move into aroma recognition and tasting techniques used by professionals. You will learn how grind size, water temperature and brew ratio shape flavor, and you’ll practice dialing-in a pour-over to your taste. Our roaster will share practical tips for buying beans, storing them at home and choosing gear without overspending. Expect a friendly environment where questions are welcome and mistakes are part of the learning. We finish with a mini pairing: pastries designed to highlight acidity, sweetness and body in different coffees. You’ll leave with a brewing guide, a tasting sheet and the confidence to recreate your favorite cup at home. No prior experience is needed—curiosity and a good appetite are more than enough.",
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
    addons: [{ id: "a1", name: "Premium Beans (250g)", unitAmountCents: 1200, description: "Single-origin roasted beans to brew 10–12 delicious cups at home." }],
    capacityTotal: 30,
    couponCode: "HALFOFF50",
    recurrenceRule: "FREQ=WEEKLY;BYDAY=SA",
    recurrenceText: "Every Saturday",
    instructions: "Bring your own cup and arrive 10 minutes early.",
   },
];
