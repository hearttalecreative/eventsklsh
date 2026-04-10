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
  Users,
  UserPlus,
  UserCheck,
  Shield,
  Home,
  FileWarning,
  GraduationCap
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

  // Navigation items grouped logically
  const mainNavItems = [
    { path: "/dashboard", label: "Dashboard", icon: Home },
    { path: "/admin/events", label: "Events", icon: CalendarPlus },
    { path: "/admin/venues", label: "Venues", icon: MapPin },
    { path: "/admin/coupons", label: "Coupons", icon: Tag },
  ];

  const peopleNavItems = [
    { path: "/admin/people", label: "People", icon: Users },
    { path: "/admin/attendees", label: "Event Attendees", icon: UserCheck },
    { path: "/admin/attendees/add", label: "Add Attendee", icon: UserPlus },
  ];

  const systemNavItems = [
    { path: "/admin/ticket-sales", label: "Sales", icon: BarChart3 },
    { path: "/admin/system-logs", label: "Logs", icon: FileWarning },
    { path: "/admin/training-programs", label: "Trainings", icon: GraduationCap },
    { path: "/admin/manage-admins", label: "Admins", icon: Shield },
  ];

  if (isMobile) {
    return (
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-sm">
        <div className="container mx-auto h-14 flex items-center justify-between px-4">
          <span className="text-base font-semibold tracking-tight">Admin Panel</span>

          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 flex h-full flex-col">
              <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                <SheetTitle className="text-left">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 mt-5 px-4 pb-8 flex-1 min-h-0 overflow-y-auto">
                {/* Main */}
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-1">Main</p>
                {mainNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Button
                      key={item.path}
                      variant={active ? "secondary" : "ghost"}
                      className={`justify-start h-10 font-normal border ${active ? 'text-primary border-primary/30 bg-primary/10 font-medium' : 'text-muted-foreground border-transparent'}`}
                      asChild
                      onClick={closeSheet}
                    >
                      <Link to={item.path}>
                        <Icon className="w-4 h-4 mr-3 shrink-0" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}

                {/* People */}
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mt-4 mb-1">People</p>
                {peopleNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Button
                      key={item.path}
                      variant={active ? "secondary" : "ghost"}
                      className={`justify-start h-10 font-normal border ${active ? 'text-primary border-primary/30 bg-primary/10 font-medium' : 'text-muted-foreground border-transparent'}`}
                      asChild
                      onClick={closeSheet}
                    >
                      <Link to={item.path}>
                        <Icon className="w-4 h-4 mr-3 shrink-0" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}

                {/* System */}
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mt-4 mb-1">System</p>
                {systemNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <Button
                      key={item.path}
                      variant={active ? "secondary" : "ghost"}
                      className={`justify-start h-10 font-normal border ${active ? 'text-primary border-primary/30 bg-primary/10 font-medium' : 'text-muted-foreground border-transparent'}`}
                      asChild
                      onClick={closeSheet}
                    >
                      <Link to={item.path}>
                        <Icon className="w-4 h-4 mr-3 shrink-0" />
                        {item.label}
                      </Link>
                    </Button>
                  );
                })}

                <div className="border-t pt-4 mt-6 mb-1">
                  <Button
                    variant="ghost"
                    className="justify-start w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      closeSheet();
                      logout();
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-3 shrink-0" />
                    Sign Out
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
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 shadow-sm">
      <div className="container mx-auto px-4 py-2.5 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold tracking-tight text-foreground/80 shrink-0">Admin</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={logout}
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            <span>Sign Out</span>
          </Button>
        </div>

        <nav className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/20 p-1 shrink-0">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className={`h-8 px-3 text-xs font-medium transition-all ${active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground'}`}
                  asChild
                  title={item.label}
                >
                  <Link to={item.path}>
                    <Icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/20 p-1 shrink-0">
            {peopleNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className={`h-8 px-3 text-xs font-medium transition-all ${active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground'}`}
                  asChild
                  title={item.label}
                >
                  <Link to={item.path}>
                    <Icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border/70 bg-muted/20 p-1 shrink-0">
            {systemNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  size="sm"
                  className={`h-8 px-3 text-xs font-medium transition-all ${active ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground'}`}
                  asChild
                  title={item.label}
                >
                  <Link to={item.path}>
                    <Icon className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
};

export default AdminHeader;
