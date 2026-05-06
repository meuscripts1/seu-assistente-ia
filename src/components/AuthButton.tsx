import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AuthDialog } from "./AuthDialog";
import { ProfileDialog } from "./ProfileDialog";
import { LogIn } from "lucide-react";

export function AuthButton() {
  const { user, profile, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  if (loading) return null;

  return (
    <div className="fixed top-4 left-4 z-50">
      {user ? (
        <button
          onClick={() => setProfileOpen(true)}
          className="w-full flex items-center gap-2 rounded-lg bg-card border border-border px-2 py-2 hover:bg-accent transition"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{(profile?.nickname || profile?.name || user.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium flex-1 text-left truncate">
            {profile?.nickname || profile?.name || user.email?.split("@")[0]}
          </span>
        </button>
      ) : (
        <Button onClick={() => setAuthOpen(true)} size="sm" className="w-full gap-2">
          <LogIn className="h-4 w-4" /> Entrar com Google
        </Button>
      )}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
