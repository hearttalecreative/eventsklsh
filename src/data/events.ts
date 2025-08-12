import { EventItem } from "@/types/events";

const nowIso = new Date().toISOString();
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

export const events: EventItem[] = [
  {
    id: "ev-sh-1",
    title: "Sound Healing Journey: Crystal Bowls Meditation",
    shortDescription:
      "A soothing 90‑minute immersion with crystal singing bowls, chimes and gentle guidance to reset your nervous system and invite deep rest.",
    description:
      "Join us for a restorative sound healing journey featuring crystal singing bowls, chimes and subtle percussion. You’ll be guided through breath and body awareness as layered frequencies help quiet the mind, release stress and support emotional balance. Please bring a yoga mat, light blanket and water. Arrive 10 minutes early to settle in.",
    imageUrl:
      "https://images.unsplash.com/photo-1544776193-352d25ca82cd?q=80&w=1600&auto=format&fit=crop",
    startsAt: plusDays(5),
    endsAt: plusDays(5),
    venue: {
      name: "Anahata Studio",
      address: "123 Serenity Ave, Los Angeles",
    },
    category: "Sound Healing",
    sku: "EV-SH-0001",
    status: "published",
    tickets: [
      {
        id: "t1",
        name: "General Admission",
        unitAmountCents: 3500,
        currency: "usd",
        capacityTotal: 30,
        participantsPerTicket: 1,
        earlyBirdAmountCents: 3000,
        earlyBirdStart: nowIso,
        earlyBirdEnd: plusDays(2),
      },
    ],
    addons: [
      { id: "a1", name: "Mat Rental", unitAmountCents: 500, description: "Clean yoga mat to use during session." },
      { id: "a2", name: "Herbal Tea", unitAmountCents: 400, description: "Warm post‑session calming blend." },
    ],
    capacityTotal: 40,
  },
  {
    id: "ev-sh-2",
    title: "Gong Bath for Deep Relaxation",
    shortDescription:
      "Let resonant gongs wash over you in waves of vibration designed to calm the mind, ease tension and support deep relaxation.",
    description:
      "Experience a traditional gong bath where long, harmonic tones create a rich soundscape that helps the body drop into parasympathetic rest. The session begins with gentle breathwork and ends with quiet integration. Bring a mat, small pillow and blanket for comfort.",
    imageUrl:
      "https://images.unsplash.com/photo-1561210488-5290f3a0c63b?q=80&w=1600&auto=format&fit=crop",
    startsAt: plusDays(12),
    endsAt: plusDays(12),
    venue: {
      name: "Lotus Hall",
      address: "456 Tranquility Rd, San Diego",
    },
    category: "Sound Healing",
    sku: "EV-SH-0002",
    status: "published",
    tickets: [
      {
        id: "t1",
        name: "General Admission",
        unitAmountCents: 3200,
        currency: "usd",
        capacityTotal: 40,
        participantsPerTicket: 1,
      },
      {
        id: "t2",
        name: "Friend Pack (2)",
        unitAmountCents: 6000,
        currency: "usd",
        capacityTotal: 20,
        participantsPerTicket: 2,
      },
    ],
    addons: [{ id: "a1", name: "Eye Pillow", unitAmountCents: 800, description: "Lavender‑scented eye pillow to take home." }],
  },
  {
    id: "ev-sh-3",
    title: "Breathwork & Sound Therapy Circle",
    shortDescription:
      "A guided group practice blending conscious breathing, live instruments and ambient soundscapes to open space for clarity and renewal.",
    description:
      "This circle combines accessible breathwork with live sound therapy using crystal bowls, koshi chimes and gentle drum. We’ll move through intention setting, guided breathing and a spacious sound bath, closing with journaling prompts. Suitable for beginners. Hydrate well and avoid heavy meals beforehand.",
    imageUrl:
      "https://images.unsplash.com/photo-1523395243481-163f8f6155d9?q=80&w=1600&auto=format&fit=crop",
    startsAt: plusDays(20),
    endsAt: plusDays(20),
    venue: {
      name: "Golden Gate Wellness Center",
      address: "101 Harmony Blvd, San Francisco",
    },
    category: "Sound Healing",
    sku: "EV-SH-0003",
    status: "published",
    tickets: [
      {
        id: "t1",
        name: "General Admission",
        unitAmountCents: 3800,
        currency: "usd",
        capacityTotal: 25,
        participantsPerTicket: 1,
      },
    ],
    addons: [
      { id: "a1", name: "Journal + Pen", unitAmountCents: 1000, description: "Simple set for integration notes." },
    ],
  },
  {
    id: "ev-sh-test",
    title: "Sound Healing Test Session (Demo)",
    shortDescription: "Demo event to test flows: a gentle 60‑minute crystal bowls session with simple example content.",
    description: "This is a test event intended for demo purposes only. It includes example copy, one ticket type and a stock image.",
    imageUrl: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=1600&auto=format&fit=crop",
    startsAt: plusDays(28),
    endsAt: plusDays(28),
    venue: { name: "Demo Studio", address: "789 Ocean Ave, Santa Monica" },
    category: "Sound Healing",
    sku: "EV-SH-TEST",
    status: "published",
    tickets: [
      { id: "t1", name: "General Admission", unitAmountCents: 3000, currency: "usd", capacityTotal: 20, participantsPerTicket: 1 },
    ],
    addons: [],
  },
];
