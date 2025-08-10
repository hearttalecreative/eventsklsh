import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Already logged in; if admin, go to /dashboard
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).eq("role","admin");
        if (data && data.length) navigate("/dashboard", { replace: true });
      }
    });
  }, [navigate]);

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    navigate("/dashboard");
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      alert(error.message);
      return;
    }
    alert("Account created. You can now log in.");
  };

  return (
    <main className="container mx-auto py-10">
      <Helmet>
        <title>Admin Login | Events</title>
        <meta name="description" content="Access the admin dashboard to manage events." />
        <link rel="canonical" href={`${baseUrl}/admin/login`} />
      </Helmet>
      <div className="max-w-md mx-auto">
        <Card className="bg-card">
          <CardHeader>
            <CardTitle>Admin access</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onLogin}>
              <Input type="email" placeholder="Email" value={email} onChange={(e)=>setEmail(e.target.value)} required />
              <Input type="password" placeholder="Password" value={password} onChange={(e)=>setPassword(e.target.value)} required />
              <div className="flex gap-2">
                <Button type="submit" disabled={loading} className="flex-1">Log in</Button>
                <Button type="button" variant="secondary" onClick={onSignUp} disabled={loading}>Sign up</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default AdminLogin;
