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
        type="button"
        aria-label="Remonter en haut de la page"
        title="Remonter en haut de la page"
        onClick={scrollToTop}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        className="min-h-12 min-w-12 rounded-full shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronUp className="w-5 h-5" aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        type="button"
        aria-label="Descendre en bas de la page"
        title="Descendre en bas de la page"
        onClick={scrollToBottom}
        tabIndex={visible ? 0 : -1}
        aria-hidden={!visible}
        className="min-h-12 min-w-12 rounded-full shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ChevronDown className="w-5 h-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
