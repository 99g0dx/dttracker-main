import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "./ui/card";
import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMediaQuery } from "../../hooks/useMediaQuery";

export interface ChartDataPoint {
  date: string;
  dateValue?: Date;
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export type ChartRange = "7d" | "14d" | "30d" | "all";

export interface CampaignPerformanceChartProps {
  chartData: ChartDataPoint[];
  chartRange: ChartRange;
  onChartRangeChange: (range: ChartRange) => void;
}

export function CampaignPerformanceChart({
  chartData,
  chartRange,
  onChartRangeChange,
}: CampaignPerformanceChartProps) {
  const [activeMetric, setActiveMetric] = useState<
    "views" | "likes" | "comments" | "shares"
  >("views");
  const isMobile = useMediaQuery("(max-width: 640px)");

  const chartRangeLabel = useMemo(() => {
    switch (chartRange) {
      case "7d":
        return "Last 7 days";
      case "14d":
        return "Last 14 days";
      case "30d":
        return "Last 30 days";
      default:
        return "All time";
    }
  }, [chartRange]);

  const chartXAxisProps = useMemo(
    () => ({
      stroke: "hsl(var(--muted-foreground))",
      fontSize: 11,
      tickLine: false,
      axisLine: { stroke: "hsl(var(--border))" },
      minTickGap: isMobile ? 18 : 8,
      interval: isMobile ? ("preserveStartEnd" as const) : ("preserveEnd" as const),
    }),
    [isMobile]
  );

  const chartTooltipStyle = useMemo(
    () => ({
      backgroundColor: "hsl(var(--card))",
      border: "1px solid hsl(var(--border))",
      borderRadius: "12px",
      fontSize: "12px",
      padding: "10px 12px",
    }),
    []
  );

  const yAxisTickFormatter = useCallback((value: number) => {
    const numericValue = Number(value) || 0;
    if (numericValue >= 1_000_000) {
      const formatted = (numericValue / 1_000_000).toFixed(
        numericValue % 1_000_000 === 0 ? 0 : 1
      );
      return `${formatted}M`;
    }
    if (numericValue >= 1_000) {
      const formatted = (numericValue / 1_000).toFixed(
        numericValue % 1_000 === 0 ? 0 : 1
      );
      return `${formatted}K`;
    }
    return numericValue.toString();
  }, []);

  const chartTooltipFormatter = useCallback((value: number | string) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return value;
    }
    return numericValue.toLocaleString();
  }, []);

  const renderChart = (
    dataKey: "views" | "likes" | "comments" | "shares",
    strokeColor: string,
    height: number
  ) => (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" {...chartXAxisProps} />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={yAxisTickFormatter}
        />
        <Tooltip
          contentStyle={chartTooltipStyle}
          formatter={chartTooltipFormatter}
        />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={strokeColor}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );

  return (
    <>
      {/* Chart Range Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Timeframe
        </span>
        <div className="flex flex-wrap gap-2">
          {[
            { value: "7d" as const, label: "7D" },
            { value: "14d" as const, label: "14D" },
            { value: "30d" as const, label: "30D" },
            { value: "all" as const, label: "All" },
          ].map((range) => (
            <button
              key={range.value}
              onClick={() => onChartRangeChange(range.value)}
              aria-pressed={chartRange === range.value}
              className={`h-10 px-3 rounded-full border text-xs font-semibold tracking-wide transition-colors ${
                chartRange === range.value
                  ? "bg-primary text-black border-primary"
                  : "bg-muted/40 border-border text-foreground hover:bg-muted/60"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile: Tabbed Interface */}
      <Tabs
        value={activeMetric}
        onValueChange={(value) =>
          setActiveMetric(value as typeof activeMetric)
        }
        className="lg:hidden"
      >
        <TabsList className="grid w-full max-w-[360px] sm:max-w-none grid-cols-4 gap-1 h-11 bg-muted/40 border border-border p-1 mx-auto sm:mx-0 overflow-y-hidden">
          <TabsTrigger
            value="views"
            className="flex items-center gap-1.5 data-[state=active]:bg-muted h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Views</span>
          </TabsTrigger>
          <TabsTrigger
            value="likes"
            className="flex items-center gap-1.5 data-[state=active]:bg-muted h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
          >
            <Heart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Likes</span>
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            className="flex items-center gap-1.5 data-[state=active]:bg-muted h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Comments</span>
          </TabsTrigger>
          <TabsTrigger
            value="shares"
            className="flex items-center gap-1.5 data-[state=active]:bg-muted h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Shares</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="views" className="mt-4 animate-in fade-in-50 duration-200">
          <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Views Over Time
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
              </div>
              {renderChart("views", "#0ea5e9", 280)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="likes" className="mt-4 animate-in fade-in-50 duration-200">
          <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Heart className="w-4 h-4 text-pink-400" />
                  Likes Over Time
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
              </div>
              {renderChart("likes", "#ec4899", 280)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comments" className="mt-4 animate-in fade-in-50 duration-200">
          <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-red-600 dark:text-cyan-400" />
                  Comments Over Time
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
              </div>
              {renderChart("comments", "#06b6d4", 280)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shares" className="mt-4 animate-in fade-in-50 duration-200">
          <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-purple-400" />
                  Shares Over Time
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
              </div>
              {renderChart("shares", "#a855f7", 280)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Desktop: 2x2 Grid */}
      <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Views Over Time */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Views Over Time</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
            </div>
            {renderChart("views", "#0ea5e9", 220)}
          </CardContent>
        </Card>

        {/* Likes Over Time */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Likes Over Time</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
            </div>
            {renderChart("likes", "#ec4899", 220)}
          </CardContent>
        </Card>

        {/* Comments Over Time */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Comments Over Time</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
            </div>
            {renderChart("comments", "#06b6d4", 220)}
          </CardContent>
        </Card>

        {/* Shares Over Time */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-foreground">Shares Over Time</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{chartRangeLabel}</p>
            </div>
            {renderChart("shares", "#a855f7", 220)}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
