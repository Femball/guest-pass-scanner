import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import QRCode from "qrcode";

const QrView = () => {
  const { code } = useParams<{ code: string }>();
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
      <h1 className="text-2xl font-bold mb-2">L'Access — Votre ticket</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Présentez ce QR code à l'entrée
      </p>
      {error && <p className="text-destructive">{error}</p>}
      {dataUrl && (
        <img
          src={dataUrl}
          alt="QR code ticket"
          className="w-full max-w-sm rounded-lg shadow-lg bg-white p-4"
        />
      )}
      {code && (
        <p className="mt-6 text-xs text-muted-foreground break-all text-center">
          Code : {code}
        </p>
      )}
    </div>
  );
};

export default QrView;