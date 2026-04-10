import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type RecordType = "event" | "training";

interface RequestBody {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  productType?: RecordType;
  productId?: string;
  source?: "all" | RecordType;
  includeCatalog?: boolean;
  page?: number;
  pageSize?: number;
}

interface CombinedRecordMeta {
  eventTitle?: string | null;
  eventDate?: string | null;
  preferredDates?: string | null;
}

interface CombinedRecord {
  id: string;
  recordType: RecordType;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  productId: string | null;
  productName: string;
  amountCents: number;
  status: string;
  paidAt: string | null;
  createdAt: string;
  stripeSessionId: string | null;
  confirmationCode: string | null;
  internalNotes: string | null;
  notesUpdatedAt: string | null;
  meta: CombinedRecordMeta;
}

interface AttendeeRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  confirmation_code: string;
  created_at: string;
  event_id: string | null;
  event?: {
    id: string;
    title: string | null;
    starts_at: string | null;
  } | null;
  internal_notes: string | null;
  internal_notes_updated_at?: string | null;
  ticket_label: string | null;
  order_item: {
    id: string;
    quantity: number | null;
    total_amount_cents: number | null;
    unit_amount_cents: number | null;
    ticket: {
      id: string;
      name: string | null;
      event_id: string | null;
      participants_per_ticket: number | null;
    } | null;
    order: {
      id: string;
      status: string | null;
      stripe_session_id: string | null;
      created_at: string | null;
    } | null;
  } | null;
}

interface TrainingPurchaseRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  amount_cents: number | null;
  status: string | null;
  stripe_session_id: string | null;
  created_at: string;
  updated_at: string | null;
  program_id: string | null;
  internal_notes?: string | null;
  internal_notes_updated_at?: string | null;
  preferred_dates?: string | null;
  training_program?: {
    id: string;
    name: string | null;
  } | null;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_WINDOW_FETCH = 2000;

const normalizeSearch = (raw?: string) => {
  const value = (raw || "").trim();
  if (!value) return "";
  return value.replace(/[,*]/g, " ").slice(0, 80).trim();
};

const toPostgrestWildcard = (value: string) => `*${value.replace(/\*/g, "")}*`;

const getSortTimestamp = (record: CombinedRecord) => {
  return Date.parse(record.paidAt || record.createdAt || "1970-01-01T00:00:00.000Z");
};

const toEventRecord = (attendee: AttendeeRow) => {
  const orderItem = attendee.order_item;
  const ticket = orderItem?.ticket;
  const order = orderItem?.order;
  const quantity = orderItem?.quantity || 1;
  const participantsPerTicket = ticket?.participants_per_ticket || 1;
  const divisor = Math.max(1, quantity * participantsPerTicket);
  const perSeatAmount = orderItem?.total_amount_cents
    ? Math.round(orderItem.total_amount_cents / divisor)
    : orderItem?.unit_amount_cents || 0;

  const eventMeta = attendee.event || null;
  const productName = eventMeta?.title || ticket?.name || attendee.ticket_label || "Event";

  return {
    id: attendee.id,
    recordType: "event",
    fullName: attendee.name,
    email: attendee.email,
    phone: attendee.phone,
    productId: attendee.event_id,
    productName,
    amountCents: perSeatAmount || 0,
    status: order?.status || "paid",
    paidAt: order?.created_at || attendee.created_at,
    createdAt: attendee.created_at,
    stripeSessionId: order?.stripe_session_id || null,
    confirmationCode: attendee.confirmation_code,
    internalNotes: attendee.internal_notes,
    notesUpdatedAt: attendee.internal_notes_updated_at || null,
    meta: {
      eventTitle: productName,
      eventDate: eventMeta?.starts_at || null,
    },
  } as CombinedRecord;
};

const toTrainingRecord = (purchase: TrainingPurchaseRow) => {
  const program = purchase.training_program;

  return {
    id: purchase.id,
    recordType: "training",
    fullName: purchase.full_name,
    email: purchase.email,
    phone: purchase.phone,
    productId: purchase.program_id,
    productName: program?.name || "Training program",
    amountCents: purchase.amount_cents || 0,
    status: purchase.status || "pending",
    paidAt: purchase.status === "paid" ? purchase.updated_at || purchase.created_at : purchase.created_at,
    createdAt: purchase.created_at,
    stripeSessionId: purchase.stripe_session_id || null,
    confirmationCode: null,
    internalNotes: purchase.internal_notes || null,
    notesUpdatedAt: purchase.internal_notes_updated_at || purchase.updated_at || null,
    meta: {
      preferredDates: purchase.preferred_dates || null,
    },
  } as CombinedRecord;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json().catch(() => ({}));
    const {
      search,
      dateFrom,
      dateTo,
      productId,
      productType,
      source = "all",
      includeCatalog = false,
    } = body || {};

    const page = Math.max(1, Number(body?.page || 1));
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(body?.pageSize || DEFAULT_PAGE_SIZE)));
    const offset = (page - 1) * pageSize;
    const fetchWindow = offset + pageSize + 1;

    if (fetchWindow > MAX_WINDOW_FETCH) {
      return new Response(
        JSON.stringify({ error: "Pagination window too large. Narrow your filters or go to earlier pages." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedSearch = normalizeSearch(search);
    const wildcardSearch = normalizedSearch ? toPostgrestWildcard(normalizedSearch) : "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: isAdmin, error: roleError } = await serviceClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const shouldIncludeEvents = source === "all" || source === "event";
    const shouldIncludeTrainings = source === "all" || source === "training";

    let products: {
      events: Array<{ id: string; title: string | null; starts_at: string | null }>;
      trainings: Array<{ id: string; name: string | null; active: boolean | null }>;
    } | null = null;

    if (includeCatalog) {
      const [eventsResp, trainingsResp] = await Promise.all([
        serviceClient
          .from("events")
          .select("id, title, starts_at, status")
          .in("status", ["draft", "published", "sold_out", "paused", "archived"])
          .order("starts_at", { ascending: false }),
        serviceClient
          .from("training_programs")
          .select("id, name, active")
          .order("name", { ascending: true }),
      ]);

      if (eventsResp.error) throw eventsResp.error;
      if (trainingsResp.error) throw trainingsResp.error;

      products = {
        events: (eventsResp.data || []).map((event) => ({
          id: event.id,
          title: event.title,
          starts_at: event.starts_at,
        })),
        trainings: (trainingsResp.data || []).map((program) => ({
          id: program.id,
          name: program.name,
          active: program.active,
        })),
      };
    }

    const eventRows: CombinedRecord[] = [];
    const trainingRows: CombinedRecord[] = [];

    if (shouldIncludeEvents && productType !== "training") {
      let attendeeQuery = serviceClient
        .from("attendees")
        .select(
          `
            id,
            name,
            email,
            phone,
            confirmation_code,
            created_at,
            event_id,
            event:events!attendees_event_id_fkey (id, title, starts_at),
            internal_notes,
            internal_notes_updated_at,
            ticket_label,
            order_item:order_item_id (
              id,
              quantity,
              total_amount_cents,
              unit_amount_cents,
              ticket:tickets!order_items_ticket_id_fkey (
                id,
                name,
                event_id,
                participants_per_ticket
              ),
              order:orders!order_items_order_id_fkey (
                id,
                status,
                stripe_session_id,
                created_at
              )
            )
          `,
        )
        .eq("is_comped", false)
        .order("created_at", { ascending: false })
        .range(0, fetchWindow - 1);

      if (productType === "event" && productId) {
        attendeeQuery = attendeeQuery.eq("event_id", productId);
      }
      if (dateFrom) attendeeQuery = attendeeQuery.gte("created_at", dateFrom);
      if (dateTo) attendeeQuery = attendeeQuery.lte("created_at", dateTo);
      if (wildcardSearch) {
        attendeeQuery = attendeeQuery.or(
          `name.ilike.${wildcardSearch},email.ilike.${wildcardSearch},phone.ilike.${wildcardSearch},confirmation_code.ilike.${wildcardSearch}`,
        );
      }

      let { data: attendeeData, error: attendeeError } = await attendeeQuery;

      if (attendeeError && attendeeError.message?.includes("internal_notes_updated_at")) {
        let fallbackAttendeeQuery = serviceClient
          .from("attendees")
          .select(
            `
              id,
              name,
              email,
              phone,
              confirmation_code,
              created_at,
              event_id,
              event:events!attendees_event_id_fkey (id, title, starts_at),
              internal_notes,
              ticket_label,
              order_item:order_item_id (
                id,
                quantity,
                total_amount_cents,
                unit_amount_cents,
                ticket:tickets!order_items_ticket_id_fkey (
                  id,
                  name,
                  event_id,
                  participants_per_ticket
                ),
                order:orders!order_items_order_id_fkey (
                  id,
                  status,
                  stripe_session_id,
                  created_at
                )
              )
            `,
          )
          .eq("is_comped", false)
          .order("created_at", { ascending: false })
          .range(0, fetchWindow - 1);

        if (productType === "event" && productId) {
          fallbackAttendeeQuery = fallbackAttendeeQuery.eq("event_id", productId);
        }
        if (dateFrom) fallbackAttendeeQuery = fallbackAttendeeQuery.gte("created_at", dateFrom);
        if (dateTo) fallbackAttendeeQuery = fallbackAttendeeQuery.lte("created_at", dateTo);
        if (wildcardSearch) {
          fallbackAttendeeQuery = fallbackAttendeeQuery.or(
            `name.ilike.${wildcardSearch},email.ilike.${wildcardSearch},phone.ilike.${wildcardSearch},confirmation_code.ilike.${wildcardSearch}`,
          );
        }

        const fallback = await fallbackAttendeeQuery;
        attendeeData = fallback.data;
        attendeeError = fallback.error;
      }

      if (attendeeError) throw attendeeError;

      const dedupeMap = new Map<string, CombinedRecord>();
      for (const attendee of (attendeeData || []) as AttendeeRow[]) {
        dedupeMap.set(attendee.id, toEventRecord(attendee));
      }

      if (wildcardSearch) {
        const { data: matchedOrders, error: matchedOrdersError } = await serviceClient
          .from("orders")
          .select("id")
          .ilike("stripe_session_id", `%${normalizedSearch}%`)
          .limit(500);

        if (matchedOrdersError) throw matchedOrdersError;

        const orderIds = (matchedOrders || []).map((row) => row.id);
        if (orderIds.length > 0) {
          const { data: matchedItems, error: matchedItemsError } = await serviceClient
            .from("order_items")
            .select("id")
            .in("order_id", orderIds)
            .limit(2000);

          if (matchedItemsError) throw matchedItemsError;

          const orderItemIds = (matchedItems || []).map((row) => row.id);
          if (orderItemIds.length > 0) {
            let stripeAttendeeQuery = serviceClient
              .from("attendees")
              .select(
                `
                  id,
                  name,
                  email,
                  phone,
                  confirmation_code,
                  created_at,
                  event_id,
                  event:events!attendees_event_id_fkey (id, title, starts_at),
                  internal_notes,
                  internal_notes_updated_at,
                  ticket_label,
                  order_item:order_item_id (
                    id,
                    quantity,
                    total_amount_cents,
                    unit_amount_cents,
                    ticket:tickets!order_items_ticket_id_fkey (
                      id,
                      name,
                      event_id,
                      participants_per_ticket
                    ),
                    order:orders!order_items_order_id_fkey (
                      id,
                      status,
                      stripe_session_id,
                      created_at
                    )
                  )
                `,
              )
              .eq("is_comped", false)
              .in("order_item_id", orderItemIds)
              .order("created_at", { ascending: false })
              .range(0, fetchWindow - 1);

            if (productType === "event" && productId) {
              stripeAttendeeQuery = stripeAttendeeQuery.eq("event_id", productId);
            }
            if (dateFrom) stripeAttendeeQuery = stripeAttendeeQuery.gte("created_at", dateFrom);
            if (dateTo) stripeAttendeeQuery = stripeAttendeeQuery.lte("created_at", dateTo);

            let { data: stripeAttendeeData, error: stripeAttendeeError } = await stripeAttendeeQuery;

            if (stripeAttendeeError && stripeAttendeeError.message?.includes("internal_notes_updated_at")) {
              let fallbackStripeAttendeeQuery = serviceClient
                .from("attendees")
                .select(
                  `
                    id,
                    name,
                    email,
                    phone,
                    confirmation_code,
                    created_at,
                    event_id,
                    event:events!attendees_event_id_fkey (id, title, starts_at),
                    internal_notes,
                    ticket_label,
                    order_item:order_item_id (
                      id,
                      quantity,
                      total_amount_cents,
                      unit_amount_cents,
                      ticket:tickets!order_items_ticket_id_fkey (
                        id,
                        name,
                        event_id,
                        participants_per_ticket
                      ),
                      order:orders!order_items_order_id_fkey (
                        id,
                        status,
                        stripe_session_id,
                        created_at
                      )
                    )
                  `,
                )
                .eq("is_comped", false)
                .in("order_item_id", orderItemIds)
                .order("created_at", { ascending: false })
                .range(0, fetchWindow - 1);

              if (productType === "event" && productId) {
                fallbackStripeAttendeeQuery = fallbackStripeAttendeeQuery.eq("event_id", productId);
              }
              if (dateFrom) fallbackStripeAttendeeQuery = fallbackStripeAttendeeQuery.gte("created_at", dateFrom);
              if (dateTo) fallbackStripeAttendeeQuery = fallbackStripeAttendeeQuery.lte("created_at", dateTo);

              const fallback = await fallbackStripeAttendeeQuery;
              stripeAttendeeData = fallback.data;
              stripeAttendeeError = fallback.error;
            }

            if (stripeAttendeeError) throw stripeAttendeeError;

            for (const attendee of (stripeAttendeeData || []) as AttendeeRow[]) {
              dedupeMap.set(attendee.id, toEventRecord(attendee));
            }
          }
        }
      }

      eventRows.push(...dedupeMap.values());
    }

    if (shouldIncludeTrainings && productType !== "event") {
      let trainingQuery = serviceClient
        .from("training_purchases")
        .select(
          `
            id,
            full_name,
            email,
            phone,
            amount_cents,
            status,
            stripe_session_id,
            created_at,
            updated_at,
            program_id,
            internal_notes,
            internal_notes_updated_at,
            preferred_dates,
            training_program:program_id (
              id,
              name
            )
          `,
        )
        .order("created_at", { ascending: false })
        .range(0, fetchWindow - 1);

      if (productType === "training" && productId) {
        trainingQuery = trainingQuery.eq("program_id", productId);
      }
      if (dateFrom) trainingQuery = trainingQuery.gte("created_at", dateFrom);
      if (dateTo) trainingQuery = trainingQuery.lte("created_at", dateTo);
      if (wildcardSearch) {
        trainingQuery = trainingQuery.or(
          `full_name.ilike.${wildcardSearch},email.ilike.${wildcardSearch},phone.ilike.${wildcardSearch},stripe_session_id.ilike.${wildcardSearch}`,
        );
      }

      let { data: trainingData, error: trainingError } = await trainingQuery;

      if (trainingError && (
        trainingError.message?.includes("internal_notes") ||
        trainingError.message?.includes("internal_notes_updated_at")
      )) {
        let fallbackQuery = serviceClient
          .from("training_purchases")
          .select(
            `
              id,
              full_name,
              email,
              phone,
              amount_cents,
              status,
              stripe_session_id,
              created_at,
              updated_at,
              program_id,
              internal_notes_updated_at,
              preferred_dates,
              training_program:program_id (
                id,
                name
              )
            `,
          )
          .order("created_at", { ascending: false })
          .range(0, fetchWindow - 1);

        if (productType === "training" && productId) {
          fallbackQuery = fallbackQuery.eq("program_id", productId);
        }
        if (dateFrom) fallbackQuery = fallbackQuery.gte("created_at", dateFrom);
        if (dateTo) fallbackQuery = fallbackQuery.lte("created_at", dateTo);
        if (wildcardSearch) {
          fallbackQuery = fallbackQuery.or(
            `full_name.ilike.${wildcardSearch},email.ilike.${wildcardSearch},phone.ilike.${wildcardSearch},stripe_session_id.ilike.${wildcardSearch}`,
          );
        }

        const fallback = await fallbackQuery;
        trainingData = fallback.data;
        trainingError = fallback.error;
      }

      if (trainingError) throw trainingError;

      for (const purchase of (trainingData || []) as TrainingPurchaseRow[]) {
        trainingRows.push(toTrainingRecord(purchase));
      }
    }

    const combined = [...eventRows, ...trainingRows].sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
    const records = combined.slice(offset, offset + pageSize);
    const hasNextPage = combined.length > offset + pageSize;

    return new Response(
      JSON.stringify({
        ok: true,
        records,
        pagination: {
          page,
          pageSize,
          hasPrevPage: page > 1,
          hasNextPage,
        },
        products,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[admin-list-customers] unexpected error", error);
    return new Response(JSON.stringify({ error: (error as Error).message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
