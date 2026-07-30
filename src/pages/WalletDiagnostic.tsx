import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CheckStatus = "ok" | "warn" | "error";

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
}

interface DiagnosticResult {
  summary: CheckStatus;
  checks: Check[];
  checked_at: string;
}

const statusMeta: Record<CheckStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: "text-primary", label: "OK" },
  warn: { icon: AlertTriangle, className: "text-muted-foreground", label: "À surveiller" },
  error: { icon: XCircle, className: "text-destructive", label: "Erreur" },
};

const WalletDiagnostic = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-wallet-diagnostic");
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult(data as DiagnosticResult);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impossible de lancer le diagnostic");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/cartes" aria-label="Retour aux cartes membres">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Diagnostic Google Wallet</h1>
            <p className="text-sm text-muted-foreground">
              Vérifie l'Issuer ID, le Class ID et les droits du compte de service.
            </p>
          </div>
        </div>

        <Button onClick={runDiagnostic} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Lancer le diagnostic
        </Button>

        {result && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dernière vérification : {new Date(result.checked_at).toLocaleString("fr-FR")}
            </p>
            {result.checks.map((check) => {
              const meta = statusMeta[check.status];
              const Icon = meta.icon;
              return (
                <Card key={check.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className={`w-5 h-5 shrink-0 ${meta.className}`} aria-hidden="true" />
                      {check.label}
                      <span className={`text-xs font-normal ${meta.className}`}>({meta.label})</span>
                    </CardTitle>
                    <CardDescription className="break-words">{check.detail}</CardDescription>
                  </CardHeader>
                  {check.hint && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                        {check.hint}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletDiagnostic;
