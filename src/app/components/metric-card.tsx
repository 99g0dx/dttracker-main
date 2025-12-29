import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'motion/react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
}

export function MetricCard({ title, value, change, icon }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative"
    >
      {/* Gradient border effect */}
      <div className="absolute -inset-[1px] bg-gradient-to-br from-primary/20 via-purple-500/10 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      
      <Card className="relative bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] group-hover:shadow-[0_8px_30px_rgba(14,165,233,0.15),0_0_60px_rgba(14,165,233,0.05)] transition-all duration-300">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm text-muted-foreground">
            {title}
          </CardTitle>
          {icon && (
            <div className="text-muted-foreground p-2 rounded-lg bg-primary/5 group-hover:bg-primary/10 transition-colors">
              {icon}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div>
              <motion.div 
                className="text-3xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text"
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              >
                {value}
              </motion.div>
              {change !== undefined && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className={`flex items-center gap-1 mt-2 text-sm ${
                    change >= 0 
                      ? 'text-emerald-400' 
                      : 'text-red-400'
                  }`}
                >
                  {change >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="font-medium">{Math.abs(change)}%</span>
                  <span className="text-xs text-muted-foreground">vs last period</span>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent rounded-xl pointer-events-none"></div>
      </Card>
    </motion.div>
  );
}