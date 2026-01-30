import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { MetricCard } from './metric-card';
import { Eye, Heart, MessageCircle, Share2, TrendingUp, Users, ArrowUpRight } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from './ui/PlatformIcon';
import { motion } from 'motion/react';

const performanceData = [
  { month: 'Jan', views: 1200000, engagement: 52000, posts: 45 },
  { month: 'Feb', views: 1450000, engagement: 61000, posts: 52 },
  { month: 'Mar', views: 1680000, engagement: 72000, posts: 58 },
  { month: 'Apr', views: 1520000, engagement: 65000, posts: 50 },
  { month: 'May', views: 1890000, engagement: 84000, posts: 62 },
  { month: 'Jun', views: 2100000, engagement: 95000, posts: 68 },
];

const platformData = [
  { name: 'TikTok', value: 35, color: '#ec4899' },
  { name: 'Instagram', value: 30, color: '#8b5cf6' },
  { name: 'YouTube', value: 25, color: '#ef4444' },
  { name: 'X', value: 7, color: '#0ea5e9' },
  { name: 'Facebook', value: 3, color: '#3b82f6' },
];

const topPerformers = [
  { creator: 'Emily Rodriguez', platform: 'youtube' as const, views: 2100000, engagement: 8.2 },
  { creator: 'Sarah Johnson', platform: 'tiktok' as const, views: 1850000, engagement: 7.8 },
  { creator: 'Jessica Wang', platform: 'instagram' as const, views: 1620000, engagement: 7.5 },
  { creator: 'Mike Chen', platform: 'instagram' as const, views: 1450000, engagement: 6.9 },
  { creator: 'Alex Turner', platform: 'youtube' as const, views: 980000, engagement: 5.4 },
];

export function Analytics() {
  return (
    <motion.div 
      className="space-y-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div>
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Analytics
        </motion.h1>
        <motion.p 
          className="text-muted-foreground mt-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          Detailed insights and performance metrics
        </motion.p>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Reach"
          value="8.2M"
          change={18.5}
          icon={<Eye className="w-5 h-5" />}
        />
        <MetricCard
          title="Total Engagement"
          value="425K"
          change={12.3}
          icon={<Heart className="w-5 h-5" />}
        />
        <MetricCard
          title="Avg. Engagement Rate"
          value="5.2%"
          change={6.7}
          icon={<TrendingUp className="w-5 h-5" />}
        />
        <MetricCard
          title="Active Creators"
          value="42"
          change={-3.2}
          icon={<Users className="w-5 h-5" />}
        />
      </div>

      {/* Performance Over Time */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="group relative"
      >
        {/* Gradient glow effect */}
        <div className="absolute -inset-[1px] bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
        
        <Card className="relative bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(14,165,233,0.1)] transition-all duration-500 overflow-hidden">
          {/* Top gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
          
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Performance Trends</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">6-month performance overview</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <span>View Details</span>
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={performanceData}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="engagementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94a3b8"
                  style={{ fontSize: '12px' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(21, 27, 46, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '12px',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  }}
                  labelStyle={{ color: '#f1f5f9', fontWeight: 500 }}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  dot={{ fill: '#0ea5e9', r: 5, strokeWidth: 2, stroke: '#0a0e1a' }}
                  activeDot={{ r: 7, strokeWidth: 3, stroke: '#0ea5e9', fill: '#0ea5e9' }}
                  fill="url(#viewsGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="engagement"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', r: 5, strokeWidth: 2, stroke: '#0a0e1a' }}
                  activeDot={{ r: 7, strokeWidth: 3, stroke: '#8b5cf6', fill: '#8b5cf6' }}
                  fill="url(#engagementGradient)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {/* Platform Distribution */}
        <div className="group relative">
          <div className="absolute -inset-[1px] bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
          
          <Card className="relative bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(139,92,246,0.1)] transition-all duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
            
            <CardHeader>
              <CardTitle>Platform Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">Content breakdown by platform</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={platformData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {platformData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        style={{
                          filter: 'drop-shadow(0 0 8px rgba(14, 165, 233, 0.3))',
                          transition: 'all 0.3s ease',
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        return (
                          <div className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-3 backdrop-blur-xl">
                            <div className="flex items-center gap-2 mb-1">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: data.payload.color }}
                              />
                              <p className="text-sm font-medium text-white">{data.name}</p>
                            </div>
                            <p className="text-lg font-semibold text-white">{data.value.toLocaleString()}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              {((data.value / platformData.reduce((acc, curr) => acc + curr.value, 0)) * 100).toFixed(1)}% of total
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    content={({ payload }) => (
                      <div className="flex justify-center gap-4 mt-4 flex-wrap">
                        {payload?.map((entry, index) => (
                          <div key={`legend-${index}`} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-sm text-slate-300">{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Posts by Month */}
        <div className="group relative">
          <div className="absolute -inset-[1px] bg-gradient-to-br from-primary/10 via-cyan-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
          
          <Card className="relative bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(14,165,233,0.1)] transition-all duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            
            <CardHeader>
              <CardTitle>Content Production</CardTitle>
              <p className="text-sm text-muted-foreground">Posts published per month</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={performanceData}>
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={1} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#94a3b8"
                    style={{ fontSize: '12px' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    style={{ fontSize: '12px' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(21, 27, 46, 0.95)',
                      border: '1px solid rgba(148, 163, 184, 0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(12px)',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    }}
                    labelStyle={{ color: '#f1f5f9', fontWeight: 500 }}
                  />
                  <Bar dataKey="posts" fill="url(#barGradient)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Top Performers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="group relative"
      >
        <div className="absolute -inset-[1px] bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
        
        <Card className="relative bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(14,165,233,0.1)] transition-all duration-500 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
          
          <CardHeader>
            <CardTitle>Top Performing Creators</CardTitle>
            <p className="text-sm text-muted-foreground">Highest reach and engagement rates</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topPerformers.map((performer, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ x: 4, transition: { duration: 0.2 } }}
                  className="group/item relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity rounded-lg"></div>
                  
                  <div className="relative flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-secondary/40 to-secondary/20 hover:from-secondary/60 hover:to-secondary/30 transition-all border border-border/30 hover:border-primary/30">
                    {/* Rank badge */}
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-primary/25">
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0 ml-8">
                      <h4 className="mb-1 truncate">{performer.creator}</h4>
                      {(() => {
                        const platformIcon = normalizePlatform(performer.platform);
                        if (!platformIcon) return null;
                        return (
                          <>
                            <PlatformIcon
                              platform={platformIcon}
                              size="sm"
                              className="sm:hidden"
                              aria-label={`${getPlatformLabel(platformIcon)} creator`}
                            />
                            <PlatformIcon
                              platform={platformIcon}
                              size="md"
                              className="hidden sm:flex"
                              aria-label={`${getPlatformLabel(platformIcon)} creator`}
                            />
                          </>
                        );
                      })()}
                    </div>
                    <div className="text-right">
                      <div className="text-xl bg-gradient-to-br from-primary to-cyan-400 bg-clip-text text-transparent font-bold">
                        {(performer.views / 1000000).toFixed(1)}M
                      </div>
                      <p className="text-xs text-muted-foreground">views</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold bg-gradient-to-br from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {performer.engagement}%
                      </div>
                      <p className="text-xs text-muted-foreground">engagement</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Engagement Breakdown */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        {[
          { title: 'Total Likes', value: '1.2M', change: '+15.3%', icon: Heart, color: 'from-pink-500 to-rose-500' },
          { title: 'Total Comments', value: '68K', change: '+12.8%', icon: MessageCircle, color: 'from-blue-500 to-cyan-500' },
          { title: 'Total Shares', value: '45K', change: '+18.7%', icon: Share2, color: 'from-purple-500 to-indigo-500' }
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 + index * 0.1, type: "spring", stiffness: 200 }}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="group relative"
          >
            <div className={`absolute -inset-[1px] bg-gradient-to-br ${stat.color} rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-sm`}></div>
            
            <Card className="relative bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] group-hover:shadow-[0_20px_60px_rgba(14,165,233,0.1)] transition-all duration-300 overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${stat.color}`}></div>
              
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm">{stat.title}</CardTitle>
                <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.color} shadow-lg`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold bg-gradient-to-br ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stat.change} from last period
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
