import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, LogOut } from "lucide-react";

const NAME_MAX = 20;
const NICK_MAX = 15;
const MAX_BYTES = 1024 * 1024;

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setName(profile.name ?? "");
      setNickname(profile.nickname ?? "");
      setAvatarUrl(profile.avatar_url ?? null);
    }
  }, [open, profile]);

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > MAX_BYTES) return toast.error("Imagem muito grande (máx 1MB)");
    if (!file.type.startsWith("image/")) return toast.error("Envie um arquivo de imagem");
    setBusy(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Falha ao enviar imagem"); setBusy(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setBusy(false);
    toast.success("Foto carregada — salve para confirmar");
  };

  const handleSave = async () => {
    if (!user) return;
    if (name.length > NAME_MAX) return toast.error(`Nome máx ${NAME_MAX} caracteres`);
    if (nickname.length > NICK_MAX) return toast.error(`Apelido máx ${NICK_MAX} caracteres`);
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name || null, nickname: nickname || null, avatar_url: avatarUrl })
      .eq("id", user.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil salvo!");
    await refreshProfile();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Seu perfil</DialogTitle>
          <DialogDescription>Atualize sua foto, nome e apelido.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback>{(name || user?.email || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Upload className="h-4 w-4" /> Trocar foto (máx 1MB)
            </span>
          </label>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="name">Nome <span className="text-xs text-muted-foreground">({name.length}/{NAME_MAX})</span></Label>
            <Input id="name" value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nick">Apelido <span className="text-xs text-muted-foreground">({nickname.length}/{NICK_MAX})</span></Label>
            <Input id="nick" value={nickname} maxLength={NICK_MAX} onChange={(e) => setNickname(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="ghost" onClick={() => signOut()} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
          <Button onClick={handleSave} disabled={busy}>Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
