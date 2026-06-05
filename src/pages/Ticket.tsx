import { useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { Calendar, Clock, MapPin, User } from "lucide-react";

const Ticket = () => {
  const { code: pathCode, "*": splatCode } = useParams<{ code?: string; "*"?: string }>();
  const location = useLocation();
  const [params] = useSearchParams();
  const fallbackPathCode = decodeURIComponent(location.pathname).match(
    /^\/ticket(?:\/|\?code=|\?ticket=)([^&?#/]+)/i
  )?.[1];
  const rawCode = pathCode ?? splatCode ?? params.get("code") ?? params.get("ticket") ?? fallbackPathCode ?? "";
  const code = rawCode ? decodeURIComponent(rawCode) : "";
  const name = params.get("name") ?? "";
  const date = params.get("date") ?? "";
  const place = params.get("place") ?? "";
  const time = params.get("time") ?? "";
  const [dataUrl, setDataUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!code) {
      setError("Code manquant");
      return;
    }
    QRCode.toDataURL(code, { width: 800, margin: 2, errorCorrectionLevel: "H" })
      .then(setDataUrl)
      .catch(() => setError("Impossible de générer le QR code"));
  }, [code]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1 text-center">L'Access — Votre ticket</h1>
        <p className="text-sm text-muted-foreground mb-4 text-center">
          Présentez ce QR code à l'entrée
        </p>

        {error && <p className="text-destructive text-center">{error}</p>}

        {dataUrl && (
          <img
            src={dataUrl}
            alt="QR code ticket"
            className="w-full rounded-lg shadow-lg bg-white p-4"
          />
        )}

        {(name || date || time || place) && (
          <div className="mt-6 rounded-lg border bg-card text-card-foreground p-4 space-y-2 text-sm">
            {name && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{name}</span>
              </div>
            )}
            {date && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="capitalize">{date}</span>
              </div>
            )}
            {time && (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{time}</span>
              </div>
            )}
            {place && (
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{place}</span>
              </div>
            )}
          </div>
        )}

        {code && (
          <p className="mt-4 text-xs text-muted-foreground break-all text-center">
            Code : {code}
          </p>
        )}
      </div>
    </div>
  );
};

export default Ticket;