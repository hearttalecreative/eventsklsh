import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CalendarDays, MapPin, User, Package, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AttendeeData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  checked_in_at?: string;
  confirmation_code: string;
  qr_code: string;
  event: {
    id: string;
    title: string;
    starts_at: string;
    venue?: {
      name: string;
      address: string;
    };
  };
  order_item: {
    order: {
      id: string;
      total_amount_cents: number;
      currency: string;
    };
    ticket: {
      name: string;
      unit_amount_cents: number;
    };
    quantity: number;
  };
  addons?: Array<{
    name: string;
    quantity: number;
    unit_amount_cents: number;
  }>;
}

const QRCheckIn = () => {
  const { qrCode } = useParams();
  const navigate = useNavigate();
  const [attendee, setAttendee] = useState<AttendeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (qrCode) {
      fetchAttendeeData();
    } else {
      setError("No QR code provided");
      setLoading(false);
    }
  }, [qrCode]);

  const fetchAttendeeData = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("attendees")
        .select(`
          id,
          name,
          email,
          phone,
          checked_in_at,
          confirmation_code,
          qr_code,
          event:event_id (
            id,
            title,
            starts_at,
            venue:venue_id (
              name,
              address
            )
          ),
          order_item:order_item_id (
            quantity,
            order:order_id (
              id,
              total_amount_cents,
              currency
            ),
            ticket:ticket_id (
              name,
              unit_amount_cents
            )
          )
        `)
        .eq("qr_code", qrCode)
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw new Error(`QR code not found: ${error.message}`);
      }

      // Fetch addons for this order
      const { data: addonsData } = await supabase
        .from("order_items")
        .select(`
          quantity,
          addon:addon_id (
            name,
            unit_amount_cents
          )
        `)
        .eq("order_id", data.order_item.order.id)
        .not("addon_id", "is", null);

      setAttendee({
        ...data,
        addons: addonsData?.map(item => ({
          name: item.addon.name,
          quantity: item.quantity,
          unit_amount_cents: item.addon.unit_amount_cents
        })) || []
      });

    } catch (err) {
      console.error("Error fetching attendee:", err);
      setError(err instanceof Error ? err.message : "Failed to load attendee data");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!attendee) return;

    try {
      setChecking(true);
      
      const { error } = await supabase
        .from("attendees")
        .update({ checked_in_at: new Date().toISOString() })
        .eq("id", attendee.id);

      if (error) throw error;

      // Update local state
      setAttendee({ ...attendee, checked_in_at: new Date().toISOString() });
      toast.success("Check-in successful!");

    } catch (err) {
      console.error("Error checking in:", err);
      toast.error("Failed to check in attendee");
    } finally {
      setChecking(false);
    }
  };

  const formatCurrency = (cents: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(cents / 100);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
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
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p>Loading attendee information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !attendee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">QR Code Invalid</h2>
            <p className="text-muted-foreground mb-4">
              {error || "This QR code could not be found or is invalid."}
            </p>
            <Button onClick={() => navigate("/admin")} variant="outline">
              Back to Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isCheckedIn = !!attendee.checked_in_at;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {isCheckedIn ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <User className="w-6 h-6 text-primary" />
              )}
              <CardTitle className="text-2xl">
                {isCheckedIn ? "Already Checked In" : "Event Check-In"}
              </CardTitle>
            </div>
            <p className="text-muted-foreground">
              QR Code: {attendee.qr_code}
            </p>
          </CardHeader>
        </Card>

        {/* Event Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{attendee.event.title}</h3>
              <p className="text-muted-foreground">{formatDate(attendee.event.starts_at)}</p>
            </div>
            
            {attendee.event.venue && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">{attendee.event.venue.name}</p>
                  <p className="text-sm text-muted-foreground">{attendee.event.venue.address}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendee Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Attendee Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-lg">{attendee.name}</p>
              <p className="text-muted-foreground">{attendee.email}</p>
              {attendee.phone && (
                <p className="text-muted-foreground">{attendee.phone}</p>
              )}
            </div>
            
            <div>
              <p className="text-sm font-medium">Confirmation Code</p>
              <p className="font-mono text-lg bg-muted p-2 rounded">{attendee.confirmation_code}</p>
            </div>

            {isCheckedIn && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-medium text-green-800">
                  ✓ Checked in: {formatDate(attendee.checked_in_at!)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Purchase Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Purchase Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Order ID</p>
              <p className="font-mono text-sm">{attendee.order_item.order.id}</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">{attendee.order_item.ticket.name}</span>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">x{attendee.order_item.quantity}</span>
                  <p className="font-medium">
                    {formatCurrency(
                      attendee.order_item.ticket.unit_amount_cents * attendee.order_item.quantity,
                      attendee.order_item.order.currency
                    )}
                  </p>
                </div>
              </div>

              {attendee.addons?.map((addon, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-sm">{addon.name}</span>
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">x{addon.quantity}</span>
                    <p className="text-sm">
                      {formatCurrency(
                        addon.unit_amount_cents * addon.quantity,
                        attendee.order_item.order.currency
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="flex justify-between items-center font-semibold">
              <span>Total</span>
              <span className="text-lg">
                {formatCurrency(attendee.order_item.order.total_amount_cents, attendee.order_item.order.currency)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          {!isCheckedIn && (
            <Button
              onClick={handleCheckIn}
              disabled={checking}
              className="w-full"
              size="lg"
            >
              {checking ? "Checking In..." : "Check In Attendee"}
            </Button>
          )}

          <Button
            onClick={() => navigate(`/admin/events/${attendee.event.id}/attendees`)}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View All Event Attendees
          </Button>

          <Button
            onClick={() => navigate("/admin")}
            variant="ghost"
            className="w-full"
          >
            Back to Admin Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QRCheckIn;