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

      {/* Mobile: Sun + Switch + Moon (same as desktop) */}
      <div className="lg:hidden flex items-center justify-center gap-3 px-3 h-8 w-[140px] rounded-lg text-sidebar-foreground transition-colors duration-300 ease-in-out">
        <Sun className={`w-4 h-4 shrink-0 transition-colors duration-300 ease-in-out ${isDark ? 'text-muted-foreground' : 'text-foreground'}`} />
        <Switch
          checked={isDark}
          onCheckedChange={handleToggle}
          aria-label="Toggle theme"
          className="dark:data-[state=checked]:bg-red-500 dark:data-[state=checked]:border-red-500"
        />
        <Moon className={`w-4 h-4 shrink-0 transition-colors duration-300 ease-in-out ${isDark ? 'text-foreground' : 'text-muted-foreground'}`} />
      </div>
    </>
  );
}
