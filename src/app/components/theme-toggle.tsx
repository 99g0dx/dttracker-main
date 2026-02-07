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
    <div className="flex items-center gap-3 px-3 h-11 min-h-[44px] rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors duration-150">
      <Sun className={`w-4 h-4 ${isDark ? 'text-muted-foreground' : 'text-foreground'}`} />
      <Switch
        checked={isDark}
        onCheckedChange={handleToggle}
        aria-label="Toggle theme"
      />
      <Moon className={`w-4 h-4 ${isDark ? 'text-foreground' : 'text-muted-foreground'}`} />
    </div>
  );
}
