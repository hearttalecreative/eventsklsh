import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, UserCheck } from "lucide-react";

interface Attendee {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  confirmation_code: string;
}

interface EditAttendeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendee: Attendee | null;
  onSuccess: () => void;
}

export const EditAttendeeDialog = ({ 
  open, 
  onOpenChange, 
  attendee, 
  onSuccess 
}: EditAttendeeDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  
  const [formData, setFormData] = useState({
    name: attendee?.name || "",
    email: attendee?.email || "",
    phone: attendee?.phone || "",
  });

  // Update form data when attendee changes
  useEffect(() => {
    if (attendee) {
      setFormData({
        name: attendee.name || "",
        email: attendee.email || "",
        phone: attendee.phone || "",
      });
    }
  }, [attendee]);

  const handleSave = async () => {
    if (!attendee) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-attendee', {
        body: {
          attendeeId: attendee.id,
          name: formData.name.trim() || null,
          email: formData.email.trim() || null,
          phone: formData.phone.trim() || null,
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Success",
        description: "Attendee information has been updated successfully.",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating attendee:', error);
      toast({
        title: "Error",
        description: error.message || "Could not update attendee information.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!attendee || !attendee.email) {
      toast({
        title: "Error",
        description: "Attendee does not have a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setResendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-ticket-email', {
        body: {
          attendeeId: attendee.id,
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Email Sent",
        description: `Ticket has been resent to ${data.attendee?.email || attendee.email}`,
      });
    } catch (error: any) {
      console.error('Error resending email:', error);
      toast({
        title: "Error",
        description: error.message || "Could not resend ticket email.",
        variant: "destructive",
      });
    } finally {
      setResendingEmail(false);
    }
  };

  const hasChanges = attendee && (
    formData.name !== (attendee.name || "") ||
    formData.email !== (attendee.email || "") ||
    formData.phone !== (attendee.phone || "")
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Attendee Information</DialogTitle>
          <DialogDescription>
            Modify the attendee's information. Changes will be saved to the system.
          </DialogDescription>
        </DialogHeader>

        {attendee && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                placeholder="Full name"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="col-span-3"
                placeholder="email@example.com"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="col-span-3"
                placeholder="+1234567890"
              />
            </div>

            <div className="border-t pt-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right text-sm text-muted-foreground">
                  Code
                </Label>
                <div className="col-span-3">
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                    {attendee.confirmation_code}
                  </code>
                </div>
              </div>
            </div>

            {formData.email && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Resend Ticket</Label>
                    <p className="text-sm text-muted-foreground">
                      Send the ticket email again to the current address
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResendEmail}
                    disabled={resendingEmail}
                  >
                    {resendingEmail ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                         Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                         Resend Ticket
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
             Cancel
          </Button>
          <Button 
            type="button" 
            onClick={handleSave} 
            disabled={loading || !hasChanges}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                 Saving...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                 Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};