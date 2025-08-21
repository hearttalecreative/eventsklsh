import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { CheckCircle, XCircle, ArrowLeft, Calendar, MapPin, User, Mail, Phone, Package } from "lucide-react";
import { toast } from "sonner";

interface Attendee {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  confirmation_code: string;
  checked_in_at: string | null;
  event_id: string;
}

interface Event {
  id: string;
  title: string;
  short_description: string | null;
  starts_at: string;
  ends_at: string | null;
  venue?: { name: string; address: string | null };
}

interface OrderItem {
  id: string;
  quantity: number;
  addon?: {
    name: string;
    unit_amount_cents: number;
  } | null;
  ticket?: {
    name: string;
    unit_amount_cents: number;
  } | null;
}

interface Order {
  id: string;
  total_amount_cents: number;
  currency: string;
  items: OrderItem[];
}

const QRCheckInPage = () => {
  const { qrCode } = useParams<{ qrCode: string }>();
  const isMobile = useIsMobile();
  const [attendee, setAttendee] = useState<Attendee | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!qrCode) {
      setError("No QR code provided");
      setLoading(false);
      return;
    }

    const loadAttendeeData = async () => {
      try {
        // Find attendee by QR code
        const { data: attendeeData, error: attendeeError } = await supabase
          .from("attendees")
          .select("id, name, email, phone, confirmation_code, checked_in_at, event_id, order_item_id")
          .eq("qr_code", qrCode)
          .maybeSingle();

        if (attendeeError) throw attendeeError;
        if (!attendeeData) {
          setError("Invalid QR code - attendee not found");
          setLoading(false);
          return;
        }

        setAttendee(attendeeData);

        // Load event details
        const { data: eventData, error: eventError } = await supabase
          .from("events")
          .select("id, title, short_description, starts_at, ends_at, venues:venue_id(name, address)")
          .eq("id", attendeeData.event_id)
          .single();

        if (eventError) throw eventError;
        setEvent(eventData);

        // Load order details if order_item_id exists
        if (attendeeData.order_item_id) {
          const { data: orderItemData, error: orderItemError } = await supabase
            .from("order_items")
            .select(`
              id,
              order_id,
              quantity,
              tickets:ticket_id(name, unit_amount_cents),
              addons:addon_id(name, unit_amount_cents)
            `)
            .eq("id", attendeeData.order_item_id)
            .single();

          if (orderItemError) throw orderItemError;

          // Load order and all its items
          const { data: orderData, error: orderError } = await supabase
            .from("orders")
            .select(`
              id,
              total_amount_cents,
              currency,
              order_items(
                id,
                quantity,
                tickets:ticket_id(name, unit_amount_cents),
                addons:addon_id(name, unit_amount_cents)
              )
            `)
            .eq("id", orderItemData.order_id)
            .single();

          if (orderError) throw orderError;
          setOrder({
            id: orderData.id,
            total_amount_cents: orderData.total_amount_cents,
            currency: orderData.currency,
            items: orderData.order_items.map((item: any) => ({
              id: item.id,
              quantity: item.quantity,
              ticket: item.tickets,
              addon: item.addons
            }))
          });
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error loading attendee data:", err);
        setError(err.message || "Failed to load attendee data");
        setLoading(false);
      }
    };

    loadAttendeeData();
  }, [qrCode]);

  const handleCheckIn = async () => {
    if (!attendee || attendee.checked_in_at) return;

    setCheckingIn(true);
    try {
      const { error } = await supabase
        .from("attendees")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", attendee.id);

      if (error) throw error;

      setAttendee({ ...attendee, checked_in_at: new Date().toISOString() });
      toast.success("Check-in successful!");
    } catch (err: any) {
      console.error("Check-in error:", err);
      toast.error("Failed to check in: " + err.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const formatCurrency = (cents: number, currency: string = "usd") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Helmet>
          <title>QR Check-in Error</title>
          <meta name="description" content="QR code check-in error" />
        </Helmet>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-muted-foreground mb-4">{error}</div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/admin/events">Go to Events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!attendee || !event) {
    return null;
  }

  const isAlreadyCheckedIn = attendee.checked_in_at !== null;

  return (
    <div className="min-h-screen bg-background p-4">
      <Helmet>
        <title>QR Check-in | {event.title}</title>
        <meta name="description" content={`Check-in for ${event.title}`} />
        <link rel="canonical" href={`${baseUrl}/admin/qr/${qrCode}`} />
      </Helmet>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/admin/events">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Link>
          </Button>
        </div>

        {/* Check-in Status */}
        <Card className={`border-2 ${isAlreadyCheckedIn ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                {isAlreadyCheckedIn ? (
                  <CheckCircle className="h-16 w-16 text-green-600" />
                ) : (
                  <XCircle className="h-16 w-16 text-orange-600" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">
                  {isAlreadyCheckedIn ? "Already Checked In" : "Ready to Check In"}
                </h1>
                <Badge variant={isAlreadyCheckedIn ? "default" : "secondary"} className="text-sm">
                  {isAlreadyCheckedIn 
                    ? `Checked in: ${new Date(attendee.checked_in_at!).toLocaleString()}`
                    : "Pending Check-in"
                  }
                </Badge>
              </div>
              {!isAlreadyCheckedIn && (
                <Button 
                  onClick={handleCheckIn} 
                  disabled={checkingIn}
                  size="lg"
                  className="w-full max-w-xs"
                >
                  {checkingIn ? "Checking In..." : "Check In Now"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Attendee Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Attendee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <div className="text-lg">{attendee.name || "No name provided"}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Confirmation Code</label>
                <div className="font-mono text-lg bg-muted px-2 py-1 rounded inline-block">
                  {attendee.confirmation_code}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  Email
                </label>
                <div>{attendee.email || "No email provided"}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  Phone
                </label>
                <div>{attendee.phone || "No phone provided"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Event Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Event Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <h3 className="text-xl font-semibold">{event.title}</h3>
              {event.short_description && (
                <p className="text-muted-foreground mt-1">{event.short_description}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Date & Time</label>
                <div>{formatDate(event.starts_at)}</div>
                {event.ends_at && (
                  <div className="text-sm text-muted-foreground">
                    Ends: {formatDate(event.ends_at)}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  Venue
                </label>
                <div>
                  {event.venue?.name || "Venue TBD"}
                  {event.venue?.address && (
                    <div className="text-sm text-muted-foreground">{event.venue.address}</div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Details */}
        {order && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Order ID: {order.id}</div>
                
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
                      <div>
                        <div className="font-medium">
                          {item.ticket?.name || item.addon?.name || "Unknown Item"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Quantity: {item.quantity}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {formatCurrency((item.ticket?.unit_amount_cents || item.addon?.unit_amount_cents || 0) * item.quantity, order.currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(order.total_amount_cents, order.currency)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Link to Event Attendees */}
        <Card>
          <CardContent className="pt-6">
            <Button variant="outline" className="w-full" asChild>
              <Link to={`/admin/events/${event.id}/attendees`}>
                View All Attendees for This Event
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default QRCheckInPage;