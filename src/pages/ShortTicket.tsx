import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, Clock, MapPin, User, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import Seo from "@/components/Seo";

const VENUE_ADDRESS = "Le Français, Place Napoléon, 31800 Saint-Gaudens";

type PublicTicket = {
  qr_code: string;
  guest_name: string;
  event_date: string;
  event_time: string | null;
  seats: string | null;
};

const ShortTicket = () => {
  const { short } = useParams<{ short: string }>();
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!short) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }
      const { data, error: rpcError } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: PublicTicket[] | null; error: unknown }>)("get_public_ticket", {
        p_short: short,
      });
      if (!active) return;
      const row = data?.[0];
      if (rpcError || !row) {
        setError("Ticket introuvable");
        setLoading(false);
        return;
      }
      setTicket(row);
      try {
        setDataUrl(
          await QRCode.toDataURL(row.qr_code, { width: 800, margin: 2, errorCorrectionLevel: "H" }),
        );
      } catch {
        setError("Impossible de générer le QR code");
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [short]);

  const dateLabel = ticket?.event_date
    ? format(new Date(`${ticket.event_date}T00:00:00`), "EEEE d MMMM yyyy", { locale: fr })
    : "";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <Seo
        title="Votre ticket d'entrée — L'Access"
        description="Affichez le QR code de votre ticket L'Access et présentez-le à l'entrée."
        noindex
      />
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1 text-center">L'Access — Votre ticket</h1>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Présentez ce QR code à l'entrée
        </p>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {error && <p className="text-destructive text-center">{error}</p>}

        {dataUrl && (
          <img
            src={dataUrl}
            alt="QR code du ticket d'entrée L'Access à présenter à l'accueil"
            className="w-full rounded-lg shadow-lg bg-white p-4"
          />
        )}

        {ticket && (
          <div className="mt-6 rounded-lg border bg-card text-card-foreground p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{ticket.guest_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="capitalize">{dateLabel}</span>
            </div>
            {ticket.event_time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>à partir de {ticket.event_time}</span>
              </div>
            )}
            {ticket.seats && (
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{ticket.seats}</span>
              </div>
            )}
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>{VENUE_ADDRESS}</span>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default ShortTicket;
