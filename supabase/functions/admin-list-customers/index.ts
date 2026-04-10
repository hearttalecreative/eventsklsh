import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RecordType = "event" | "training";

interface RequestBody {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  productType?: RecordType;
  productId?: string;
  source?: "all" | RecordType;
  limit?: number;
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
  meta: CombinedRecordMeta;
}

interface EventSummary {
  id: string;
  title: string | null;
  starts_at: string | null;
  status: string | null;
}

interface TrainingSummary {
  id: string;
  name: string | null;
  active: boolean | null;
}

const MAX_LIMIT = 500;

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
      limit = 250,
    } = body || {};

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

    if (eventsResp.error) {
      console.error("[admin-list-customers] events error", eventsResp.error);
      throw eventsResp.error;
    }

    if (trainingsResp.error) {
      console.error("[admin-list-customers] trainings error", trainingsResp.error);
      throw trainingsResp.error;
    }

    const eventMap = new Map<string, EventSummary>();
    const eventRows = (eventsResp.data || []) as EventSummary[];
    eventRows.forEach((event) => {
      if (event?.id) {
        eventMap.set(event.id, event);
      }
    });

    const trainingMap = new Map<string, TrainingSummary>();
    const trainingRows = (trainingsResp.data || []) as TrainingSummary[];
    trainingRows.forEach((program) => {
      if (program?.id) {
        trainingMap.set(program.id, program);
      }
    });

    const results: CombinedRecord[] = [];

    const shouldIncludeEvents = source === "all" || source === "event";
    const shouldIncludeTrainings = source === "all" || source === "training";

    if (shouldIncludeEvents) {
      const { data: attendeesData, error: attendeesError } = await serviceClient
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
                total_amount_cents,
                created_at
              )
            )
          `,
        )
        .eq("is_comped", false)
        .order("created_at", { ascending: false })
        .limit(1200);

      if (attendeesError) {
        console.error("[admin-list-customers] attendees error", attendeesError);
        throw attendeesError;
      }

      for (const attendee of attendeesData || []) {
        const orderItem = attendee.order_item;
        const ticket = orderItem?.ticket;
        const order = orderItem?.order;
        const quantity = orderItem?.quantity || 1;
        const participantsPerTicket = ticket?.participants_per_ticket || 1;
        const divisor = Math.max(1, quantity * participantsPerTicket);
        const perSeatAmount = orderItem?.total_amount_cents
          ? Math.round(orderItem.total_amount_cents / divisor)
          : orderItem?.unit_amount_cents || 0;

        const eventMeta = attendee.event_id ? eventMap.get(attendee.event_id) : null;
        const productName = eventMeta?.title || ticket?.name || attendee.ticket_label || "Evento";

        results.push({
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
          meta: {
            eventTitle: productName,
            eventDate: eventMeta?.starts_at || null,
          },
        });
      }
    }

    if (shouldIncludeTrainings) {
      const { data: trainingData, error: trainingError } = await serviceClient
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
            preferred_dates,
            training_program:program_id (
              id,
              name
            )
          `,
        )
        .order("created_at", { ascending: false })
        .limit(1200);

      if (trainingError) {
        console.error("[admin-list-customers] training error", trainingError);
        throw trainingError;
      }

      for (const purchase of trainingData || []) {
        const program = purchase.training_program || trainingMap.get(purchase.program_id);
        results.push({
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
          meta: {
            preferredDates: purchase.preferred_dates || null,
          },
        });
      }
    }

    const searchTerm = (search || "").trim().toLowerCase();
    const fromTime = dateFrom ? Date.parse(dateFrom) : null;
    const toTime = dateTo ? Date.parse(dateTo) : null;

    let filtered = results;

    if (productId && productType) {
      filtered = filtered.filter(
        (record) => record.recordType === productType && record.productId === productId,
      );
    }

    if (searchTerm) {
      filtered = filtered.filter((record) => {
        const haystacks = [
          record.fullName || "",
          record.email || "",
          record.phone || "",
          record.confirmationCode || "",
          record.stripeSessionId || "",
        ];
        return haystacks.some((value) => value.toLowerCase().includes(searchTerm));
      });
    }

    if (fromTime) {
      filtered = filtered.filter((record) => {
        const refDate = record.paidAt || record.createdAt;
        return refDate ? Date.parse(refDate) >= fromTime : true;
      });
    }

    if (toTime) {
      filtered = filtered.filter((record) => {
        const refDate = record.paidAt || record.createdAt;
        return refDate ? Date.parse(refDate) <= toTime : true;
      });
    }

    filtered.sort((a, b) => {
      const aDate = Date.parse(a.paidAt || a.createdAt || "1970-01-01");
      const bDate = Date.parse(b.paidAt || b.createdAt || "1970-01-01");
      return bDate - aDate;
    });

    const limited = filtered.slice(0, Math.min(MAX_LIMIT, Math.max(1, limit)));

    const summary = {
      totalRecords: filtered.length,
      eventRecords: filtered.filter((r) => r.recordType === "event").length,
      trainingRecords: filtered.filter((r) => r.recordType === "training").length,
      paidCount: filtered.filter((r) => (r.status || "").toLowerCase() === "paid").length,
      pendingCount: filtered.filter((r) => (r.status || "").toLowerCase() !== "paid").length,
      revenueCents: filtered
        .filter((r) => (r.status || "").toLowerCase() === "paid")
        .reduce((sum, record) => sum + (record.amountCents || 0), 0),
    };

    return new Response(
      JSON.stringify({
        ok: true,
        records: limited,
        summary,
        products: {
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
        },
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
