import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface SumUpPaymentWidgetProps {
  checkoutId: string;
  onComplete: () => void;
  onClose: () => void;
}

/** Mounts the hosted SumUp card form and reports a successful payment. */
const SumUpPaymentWidget = ({ checkoutId, onComplete, onClose }: SumUpPaymentWidgetProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;

    const loadWidget = async () => {
      if (!(window as any).SumUpCard) {
        const script = document.createElement('script');
        script.src = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';
        script.async = true;
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load SumUp SDK'));
          document.head.appendChild(script);
        });
      }

      if (!mounted || !containerRef.current) return;

      const SumUpCard = (window as any).SumUpCard;
      if (SumUpCard) {
        SumUpCard.mount({
          id: 'sumup-card-container',
          checkoutId,
          onResponse: (_type: string, body: any) => {
            if (body?.status === 'PAID') onComplete();
          },
        });
      }
    };

    loadWidget().catch((err) => {
      console.error('SumUp widget error:', err);
      toast.error('Impossible de charger le formulaire de paiement');
    });

    return () => {
      mounted = false;
    };
  }, [checkoutId]);

  return (
    <div className="space-y-4">
      <div id="sumup-card-container" ref={containerRef} className="min-h-[300px]" />
      <p className="text-xs text-muted-foreground text-center">Paiement sécurisé traité par SumUp</p>
      <Button variant="outline" className="w-full" onClick={onClose}>
        Fermer et vérifier plus tard
      </Button>
    </div>
  );
};

export default SumUpPaymentWidget;
