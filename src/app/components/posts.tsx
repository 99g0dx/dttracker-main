import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, ExternalLink, RefreshCw, FileText as FileTextIcon } from 'lucide-react';
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from './ui/PlatformIcon';
import { StatusBadge } from './status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { motion } from 'motion/react';

const mockPosts = [
  {
    id: 1,
    creator: 'Sarah Johnson',
    campaign: 'Summer Launch 2024',
    platform: 'tiktok' as const,
    postUrl: 'https://tiktok.com/video/123',
    status: 'scraped' as const,
    views: 125000,
    likes: 8500,
    comments: 450,
    shares: 320,
    engagement: 7.3,
    postedDate: '2024-02-15',
    lastScraped: '2024-02-20',
  },
  {
    id: 2,
    creator: 'Emily Rodriguez',
    campaign: 'Summer Launch 2024',
    platform: 'youtube' as const,
    postUrl: 'https://youtube.com/watch?v=xyz',
    status: 'scraped' as const,
    views: 450000,
    likes: 32000,
    comments: 1200,
    shares: 890,
    engagement: 7.6,
    postedDate: '2024-02-18',
    lastScraped: '2024-02-21',
  },
  {
    id: 3,
    creator: 'Mike Chen',
    campaign: 'Brand Awareness Q1',
    platform: 'instagram' as const,
    postUrl: 'https://instagram.com/p/abc123',
    status: 'link-added' as const,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    engagement: 0,
    postedDate: '2024-02-19',
    lastScraped: '',
  },
  {
    id: 4,
    creator: 'Jessica Wang',
    campaign: 'Brand Awareness Q1',
    platform: 'instagram' as const,
    postUrl: 'https://instagram.com/p/def456',
    status: 'scraped' as const,
    views: 89000,
    likes: 7200,
    comments: 340,
    shares: 180,
    engagement: 8.7,
    postedDate: '2024-02-17',
    lastScraped: '2024-02-21',
  },
];

export function Posts() {
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredPosts = mockPosts.filter(post => {
    const matchesSearch = 
      post.creator.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.campaign.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlatform = platformFilter === 'all' || post.platform === platformFilter;
    const matchesStatus = statusFilter === 'all' || post.status === statusFilter;
    return matchesSearch && matchesPlatform && matchesStatus;
  });

  return (
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Posts
          </motion.h1>
          <motion.p 
            className="text-muted-foreground mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            Track all creator posts and their performance
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button className="relative overflow-hidden bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 shadow-[0_0_30px_rgba(14,165,233,0.3)] hover:shadow-[0_0_40px_rgba(14,165,233,0.5)] transition-all duration-300 group">
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <RefreshCw className="w-4 h-4 mr-2 relative z-10" />
            <span className="relative z-10">Scrape All</span>
          </Button>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div 
        className="flex gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
          <Input
            placeholder="Search by creator or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card/50 border-border/50 backdrop-blur-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all h-12 shadow-lg"
          />
        </div>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px] bg-card/50 border-border/50 backdrop-blur-xl shadow-lg hover:border-primary/30 transition-all h-12">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="twitter">X</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-card/50 border-border/50 backdrop-blur-xl shadow-lg hover:border-primary/30 transition-all h-12">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scraped">Scraped</SelectItem>
            <SelectItem value="link-added">Link Added</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Update delayed</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Posts Table */}
      {filteredPosts.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="group relative"
        >
          <div className="absolute -inset-[1px] bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl"></div>
          
          <Card className="relative bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_20px_60px_rgba(14,165,233,0.1)] transition-all duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead>Creator</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Likes</TableHead>
                    <TableHead className="text-right">Comments</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Engagement</TableHead>
                    <TableHead>Posted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPosts.map((post, index) => (
                    <motion.tr
                      key={post.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.05 }}
                      className="border-border/50 hover:bg-gradient-to-r hover:from-secondary/40 hover:to-secondary/20 transition-all group/row"
                    >
                      <TableCell>
                        <div className="group-hover/row:text-primary transition-colors">{post.creator}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {post.campaign}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const platformIcon = normalizePlatform(post.platform);
                          if (!platformIcon) return null;
                          return (
                            <>
                              <PlatformIcon
                                platform={platformIcon}
                                size="sm"
                                className="sm:hidden"
                                aria-label={`${getPlatformLabel(platformIcon)} post`}
                              />
                              <PlatformIcon
                                platform={platformIcon}
                                size="md"
                                className="hidden sm:flex"
                                aria-label={`${getPlatformLabel(platformIcon)} post`}
                              />
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={post.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {post.views > 0 ? (
                          <span className="bg-gradient-to-br from-primary to-cyan-400 bg-clip-text text-transparent">
                            {post.views.toLocaleString()}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {post.likes > 0 ? post.likes.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {post.comments > 0 ? post.comments.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {post.shares > 0 ? post.shares.toLocaleString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {post.engagement > 0 ? (
                          <span className="text-emerald-400 font-medium">{post.engagement}%</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(post.postedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-primary hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover/row:opacity-100"
                          onClick={() => window.open(post.postUrl, '_blank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <Card className="bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
            
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl"></div>
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-primary/30">
                  <FileTextIcon className="w-10 h-10 text-primary" />
                </div>
              </div>
              <h3 className="mb-2">No posts found</h3>
              <p className="text-muted-foreground text-center mb-6 max-w-md">
                {searchQuery || platformFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Posts will appear here once creators add their content'}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
