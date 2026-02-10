import React, { useEffect, useState } from 'react';
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { LayoutDashboard, Megaphone, Users, Settings, Plus, RefreshCw, Trophy, Wallet } from 'lucide-react';
import { useCanWrite } from '../../hooks/useBilling';

interface CommandPaletteProps {
  onNavigate: (path: string) => void;
  onClose: () => void;
  open: boolean;
}

export function CommandPalette({ onNavigate, onClose, open }: CommandPaletteProps) {
  const [mounted, setMounted] = useState(false);
  const { canWrite } = useCanWrite();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [onClose]);

  if (!mounted) return null;

  const handleSelect = (callback: () => void) => {
    callback();
    onClose();
  };

  return (
    <CommandDialog open={open} onOpenChange={onClose}>
      <div className="relative bg-card/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-[0_20px_80px_rgba(0,0,0,0.4)] overflow-hidden">
        {/* Top gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
        
        <CommandInput 
          placeholder="Type a command or search..." 
          className="border-0 border-b border-border/50 focus:ring-0"
        />
        <CommandList className="max-h-[400px] p-2">
          <CommandEmpty className="py-8 text-center text-muted-foreground">
            No results found.
          </CommandEmpty>
          
          <CommandGroup heading="Navigation">
            <CommandItem
              onSelect={() => handleSelect(() => onNavigate('/dashboard'))}
              className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-red-400/20 dark:to-cyan-400/20">
                <LayoutDashboard className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Dashboard</div>
                <div className="text-xs text-muted-foreground">View your overview</div>
              </div>
              <kbd className="px-2 py-1 text-xs rounded bg-secondary/50 border border-border/50">⌘D</kbd>
            </CommandItem>
            
            <CommandItem
              onSelect={() => handleSelect(() => onNavigate('/campaigns'))}
              className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <Megaphone className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Campaigns</div>
                <div className="text-xs text-muted-foreground">Manage campaigns</div>
              </div>
              <kbd className="px-2 py-1 text-xs rounded bg-secondary/50 border border-border/50">⌘C</kbd>
            </CommandItem>
            
            <CommandItem
              onSelect={() => handleSelect(() => onNavigate('/activations'))}
              className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Activations</div>
                <div className="text-xs text-muted-foreground">Contests and SM panels</div>
              </div>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => onNavigate('/creators'))}
              className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <Users className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Creators</div>
                <div className="text-xs text-muted-foreground">View creator network</div>
              </div>
              <kbd className="px-2 py-1 text-xs rounded bg-secondary/50 border border-border/50">⌘U</kbd>
            </CommandItem>
            <CommandItem
              onSelect={() => handleSelect(() => onNavigate('/wallet'))}
              className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-red-500/20 dark:to-cyan-500/20">
                <Wallet className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Wallet</div>
                <div className="text-xs text-muted-foreground">Balance and funding</div>
              </div>
            </CommandItem>
            
            <CommandItem
              onSelect={() => handleSelect(() => onNavigate('/settings'))}
              className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-slate-500/20 to-zinc-500/20">
                <Settings className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Settings</div>
                <div className="text-xs text-muted-foreground">Configure preferences</div>
              </div>
              <kbd className="px-2 py-1 text-xs rounded bg-secondary/50 border border-border/50">⌘S</kbd>
            </CommandItem>
          </CommandGroup>
          
          <CommandGroup heading="Actions">
            {canWrite && (
              <>
                <CommandItem
                  onSelect={() => handleSelect(() => onNavigate('/activations/create'))}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
                >
                  <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <Trophy className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">Create Activation</div>
                    <div className="text-xs text-muted-foreground">Contest or SM panel</div>
                  </div>
                </CommandItem>
                <CommandItem
                  onSelect={() => handleSelect(() => onNavigate('/campaigns/new'))}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
                >
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-red-400/20 dark:to-cyan-400/20">
                    <Plus className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">New Campaign</div>
                    <div className="text-xs text-muted-foreground">Create a new campaign</div>
                  </div>
                  <kbd className="px-2 py-1 text-xs rounded bg-secondary/50 border border-border/50">⌘N</kbd>
                </CommandItem>
              </>
            )}
            
            {canWrite && (
            <CommandItem
              onSelect={() => handleSelect(() => console.log('Refresh data'))}
              className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-all"
            >
              <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500/20 to-red-500/20 dark:to-cyan-500/20">
                <RefreshCw className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <div className="font-medium">Refresh Data</div>
                <div className="text-xs text-muted-foreground">Scrape latest metrics</div>
              </div>
              <kbd className="px-2 py-1 text-xs rounded bg-secondary/50 border border-border/50">⌘R</kbd>
            </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
        
        {/* Bottom hint */}
        <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-secondary/50 border border-border/50">↑↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-secondary/50 border border-border/50">↵</kbd>
              to select
            </span>
            <span className="flex items-center gap-2">
              <kbd className="px-2 py-1 rounded bg-secondary/50 border border-border/50">ESC</kbd>
              to close
            </span>
          </div>
        </div>
      </div>
    </CommandDialog>
  );
}
