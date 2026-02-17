import React from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Switch } from './ui/switch';

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Avoid SSR mismatch
  }

  const currentTheme = theme === 'system' ? systemTheme : theme;
  const isDark = currentTheme === 'dark';

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <>
      {/* Desktop: Sun + Switch + Moon */}
      <div className="hidden lg:flex items-center justify-center gap-3 px-3 h-8 w-[140px] rounded-lg text-sidebar-foreground transition-colors duration-300 ease-in-out">
        <Sun className={`w-4 h-4 shrink-0 transition-colors duration-300 ease-in-out ${isDark ? 'text-muted-foreground' : 'text-foreground'}`} />
        <Switch
          checked={isDark}
          onCheckedChange={handleToggle}
          aria-label="Toggle theme"
          className="dark:data-[state=checked]:bg-red-500 dark:data-[state=checked]:border-red-500"
        />
        <Moon className={`w-4 h-4 shrink-0 transition-colors duration-300 ease-in-out ${isDark ? 'text-foreground' : 'text-muted-foreground'}`} />
      </div>

      {/* Mobile: Segmented pill toggle with sliding indicator */}
      <div className="lg:hidden relative flex items-center w-[140px] bg-muted rounded-lg p-0.5 border border-border transition-[background-color,border-color] duration-300 ease-in-out">
        <div
          className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc(50%-4px)] rounded-md shadow-sm transition-[transform,background-color,border-color] duration-300 ease-in-out pointer-events-none ${
            isDark
              ? 'translate-x-[calc(100%+4px)] bg-red-500 border border-red-500'
              : 'translate-x-0 bg-card border border-border'
          }`}
          aria-hidden
        />
        <button
          onClick={() => setTheme('light')}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 min-w-0 ${
            !isDark ? 'text-foreground' : 'text-muted-foreground hover:text-sidebar-foreground'
          }`}
          aria-label="Light mode"
          aria-pressed={!isDark}
        >
          <Sun className="w-3.5 h-3.5 shrink-0" />
          <span>Light</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 min-w-0 ${
            isDark ? 'text-white' : 'text-muted-foreground hover:text-sidebar-foreground'
          }`}
          aria-label="Dark mode"
          aria-pressed={isDark}
        >
          <Moon className="w-3.5 h-3.5 shrink-0" />
          <span>Dark</span>
        </button>
      </div>
    </>
  );
}
