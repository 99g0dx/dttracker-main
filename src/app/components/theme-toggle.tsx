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
      <div className="hidden lg:flex items-center justify-center gap-3 px-3 h-8 w-[140px] rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-150">
        <Sun className={`w-4 h-4 ${isDark ? 'text-muted-foreground' : 'text-foreground'}`} />
        <Switch
          checked={isDark}
          onCheckedChange={handleToggle}
          aria-label="Toggle theme"
          className="dark:data-[state=checked]:bg-red-500 dark:data-[state=checked]:border-red-500"
        />
        <Moon className={`w-4 h-4 ${isDark ? 'text-foreground' : 'text-muted-foreground'}`} />
      </div>

      {/* Mobile: Segmented pill toggle */}
      <div className="lg:hidden flex items-center w-[140px] bg-muted rounded-lg p-0.5 border border-border">
        <button
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            !isDark
              ? 'bg-card text-foreground shadow-sm border border-border'
              : 'text-muted-foreground hover:text-sidebar-foreground'
          }`}
          aria-label="Light mode"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>Light</span>
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 ${
            isDark
              ? 'bg-red-500 text-white shadow-sm'
              : 'text-muted-foreground hover:text-sidebar-foreground'
          }`}
          aria-label="Dark mode"
        >
          <Moon className="w-3.5 h-3.5" />
          <span>Dark</span>
        </button>
      </div>
    </>
  );
}
