import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { 
  BarChart3, 
  CalendarPlus, 
  MapPin, 
  Tag, 
  LogOut, 
  Menu, 
  X,
  Users,
  UserPlus,
  Shield,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const AdminHeader = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  };

  const closeSheet = () => setIsSheetOpen(false);

  const isActive = (path: string) => location.pathname === path;

  const navigationItems = [
    {
      path: "/dashboard",
      label: "Dashboard",
      icon: BarChart3,
    },
    {
      path: "/admin/events",
      label: "Events",
      icon: CalendarPlus,
    },
    {
      path: "/admin/venues",
      label: "Venues",
      icon: MapPin,
    },
    {
      path: "/admin/coupons",
      label: "Coupons",
      icon: Tag,
    },
    {
      path: "/admin/attendees",
      label: "Attendees",
      icon: Users,
    },
    {
      path: "/admin/attendees/add",
      label: "Add Attendee",
      icon: UserPlus,
    },
    {
      path: "/admin/ticket-sales",
      label: "Sales Analytics",
      icon: BarChart3,
    },
    {
      path: "/admin/cleanup-duplicates",
      label: "Cleanup Duplicates",
      icon: AlertTriangle,
    },
    {
      path: "/admin/manage-admins",
      label: "Manage Admins",
      icon: Shield,
    },
  ];

  if (isMobile) {
    return (
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto h-14 flex items-center justify-between px-4">
          <h1 className="text-lg font-semibold">Admin Panel</h1>
          
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Admin Menu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.path}
                      variant={isActive(item.path) ? "default" : "ghost"}
                      className="justify-start"
                      asChild
                      onClick={closeSheet}
                    >
                      <Link to={item.path}>
                        <Icon className="w-4 h-4 mr-2" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}
                <div className="border-t pt-2 mt-4">
                  <Button
                    variant="destructive"
                    className="justify-start w-full"
                    onClick={() => {
                      closeSheet();
                      logout();
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto h-16 flex items-center justify-between px-4">
        <div>
          <h1 className="text-xl font-bold">Admin Panel</h1>
        </div>
        
        <nav className="flex items-center gap-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.path}
                variant={isActive(item.path) ? "default" : "outline"}
                size="sm"
                asChild
              >
                <Link to={item.path}>
                  <Icon className="w-4 h-4 mr-2" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
          
          <Button 
            variant="destructive" 
            size="sm"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
};

export default AdminHeader;