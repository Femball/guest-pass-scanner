import { useState, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ScrollButtons() {
  const [showUp, setShowUp] = useState(false);
  const [showDown, setShowDown] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      // Pas de boutons si la page ne défile pas
      if (maxScroll <= 50) {
        setShowUp(false);
        setShowDown(false);
        return;
      }
      setShowUp(scrollTop > 200);
      setShowDown(scrollTop < maxScroll - 200);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () =>
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });

  const buttonClass =
    'h-14 w-14 rounded-full shadow-lg bg-background/90 backdrop-blur border-border/60 ' +
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
    'transition-all duration-300 active:scale-95 touch-manipulation';

  return (
    <div
      className="fixed z-50 flex flex-col gap-3 right-4 sm:right-6"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)',
        right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
      }}
    >
      <Button
        variant="outline"
        size="icon"
        type="button"
        aria-label="Remonter en haut de la page"
        title="Remonter en haut de la page"
        onClick={scrollToTop}
        tabIndex={showUp ? 0 : -1}
        aria-hidden={!showUp}
        className={cn(
          buttonClass,
          showUp ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        )}
      >
        <ChevronUp className="w-6 h-6" aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        type="button"
        aria-label="Descendre en bas de la page"
        title="Descendre en bas de la page"
        onClick={scrollToBottom}
        tabIndex={showDown ? 0 : -1}
        aria-hidden={!showDown}
        className={cn(
          buttonClass,
          showDown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
        )}
      >
        <ChevronDown className="w-6 h-6" aria-hidden="true" />
      </Button>
    </div>
  );
}
