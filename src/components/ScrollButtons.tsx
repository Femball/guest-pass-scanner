import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ScrollButtons() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 200);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-50 flex flex-col gap-2 transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      <Button
        variant="outline"
        size="icon"
        aria-label="Haut de page"
        onClick={scrollToTop}
      >
        <ChevronUp className="w-5 h-5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Bas de page"
        onClick={scrollToBottom}
      >
        <ChevronDown className="w-5 h-5" />
      </Button>
    </div>
  );
}
