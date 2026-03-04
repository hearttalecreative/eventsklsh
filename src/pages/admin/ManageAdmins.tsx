import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminHeader from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Key, Trash2, Shield } from "lucide-react";

interface Admin {
  id: string;
  email: string;
  is_primary: boolean;
  created_at: string;
}

const ManageAdmins = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // New admin form
  const [newAdminOpen, setNewAdminOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  // Update password form
  const [updatePasswordOpen, setUpdatePasswordOpen] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [newPasswordForAdmin, setNewPasswordForAdmin] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadAdmins();
    checkIfPrimaryAdmin();
  }, []);

  const checkIfPrimaryAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCurrentUserId(user.id);

    const { data, error } = await supabase.rpc('is_primary_admin', { _user_id: user.id });
    if (!error && data) {
      setIsPrimaryAdmin(true);
    }
  };

  const loadAdmins = async () => {
    setLoading(true);
    try {
      // 1) Get all admin roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select(`user_id, is_primary, created_at`)
        .eq("role", "admin")
        .order("created_at", { ascending: true });

      if (rolesError) throw rolesError;
      const userIds = (roles ?? []).map((r: any) => r.user_id);

      // 2) Fetch emails from profiles for those user ids
      let profilesById: Record<string, { email: string }> = {};
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", userIds);
        if (profilesError) throw profilesError;
        profilesById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, { email: p.email }]));
      }

      const adminsData = (roles ?? []).map((item: any) => ({
        id: item.user_id,
        email: profilesById[item.user_id]?.email ?? "(sin email)",
        is_primary: item.is_primary,
        created_at: item.created_at,
      }));

      setAdmins(adminsData);
    } catch (error: any) {
      toast({
        title: "Error loading admins",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    if (!newEmail || !newPassword) {
      toast({
        title: "Missing fields",
        description: "Please provide both email and password",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-admin", {
        body: { email: newEmail, password: newPassword },
      });

      if (error) throw error;

      toast({
        title: "Admin created",
        description: `New admin ${newEmail} has been created successfully`,
      });

      setNewEmail("");
      setNewPassword("");
      setNewAdminOpen(false);
      loadAdmins();
    } catch (error: any) {
      toast({
        title: "Error creating admin",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!selectedAdminId || !newPasswordForAdmin) {
      toast({
        title: "Missing fields",
        description: "Please provide a new password",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke("update-admin-password", {
        body: { userId: selectedAdminId, newPassword: newPasswordForAdmin },
      });

      if (error) throw error;

      toast({
        title: "Password updated",
        description: "Admin password has been updated successfully",
      });

      setNewPasswordForAdmin("");
      setSelectedAdminId(null);
      setUpdatePasswordOpen(false);
    } catch (error: any) {
      toast({
        title: "Error updating password",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    try {
      const { error } = await supabase.functions.invoke("delete-admin", {
        body: { userId: adminId },
      });

      if (error) throw error;

      toast({
        title: "Admin deleted",
        description: "Admin has been deleted successfully",
      });

      loadAdmins();
    } catch (error: any) {
      toast({
        title: "Error deleting admin",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 space-y-6 overflow-x-clip">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Manage Administrators</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Create, update, and manage administrator accounts
            </p>
          </div>
          {isPrimaryAdmin && (
            <Dialog open={newAdminOpen} onOpenChange={setNewAdminOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto min-h-10">
                  <UserPlus className="mr-2 h-4 w-4" />
                  New Admin
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Administrator</DialogTitle>
                  <DialogDescription>
                    Add a new administrator account. They will receive admin privileges immediately.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter a secure password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => setNewAdminOpen(false)}>
                    Cancel
                  </Button>
                  <Button className="w-full sm:w-auto" onClick={handleCreateAdmin} disabled={creating}>
                    {creating ? "Creating..." : "Create Admin"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8">Loading administrators...</div>
        ) : (
          <div className="grid gap-4">
            {admins.map((admin) => (
              <Card key={admin.id}>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <CardTitle className="text-base sm:text-xl break-all">{admin.email}</CardTitle>
                      {admin.is_primary && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                          <Shield className="h-3 w-3" />
                          Primary Admin
                        </span>
                      )}
                      {admin.id === currentUserId && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-muted text-xs font-medium">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex w-full sm:w-auto gap-2 justify-end">
                      <Dialog open={updatePasswordOpen && selectedAdminId === admin.id} onOpenChange={(open) => {
                        setUpdatePasswordOpen(open);
                        if (open) setSelectedAdminId(admin.id);
                        else setSelectedAdminId(null);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size={isMobile ? "icon" : "sm"} className={isMobile ? "h-9 w-9" : ""} aria-label="Change Password" title="Change Password">
                            <Key className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                            {!isMobile && "Change Password"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Update Password</DialogTitle>
                            <DialogDescription>
                              Change the password for {admin.email}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="new-password">New Password</Label>
                              <Input
                                id="new-password"
                                type="password"
                                placeholder="Enter new password"
                                value={newPasswordForAdmin}
                                onChange={(e) => setNewPasswordForAdmin(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
                            <Button className="w-full sm:w-auto" variant="outline" onClick={() => {
                              setUpdatePasswordOpen(false);
                              setSelectedAdminId(null);
                            }}>
                              Cancel
                            </Button>
                            <Button className="w-full sm:w-auto" onClick={handleUpdatePassword} disabled={updating}>
                              {updating ? "Updating..." : "Update Password"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      {isPrimaryAdmin && !admin.is_primary && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size={isMobile ? "icon" : "sm"} className={isMobile ? "h-9 w-9" : ""} aria-label="Delete" title="Delete">
                              <Trash2 className={isMobile ? "h-4 w-4" : "mr-2 h-4 w-4"} />
                              {!isMobile && "Delete"}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Administrator</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete the administrator account for {admin.email}? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteAdmin(admin.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  <CardDescription className="text-xs sm:text-sm">
                    Administrator since {new Date(admin.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default ManageAdmins;
