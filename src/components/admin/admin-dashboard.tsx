'use client';

// ============================================================
// MODUL 36: Admin Dashboard UI Component
// Overview cards, time-series charts, user drill-down,
// CSV export, snapshot refresh, activity logs
// ============================================================

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Users,
  Activity,
  HardDrive,
  FileText,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { useAuthStore } from '@/store/auth';
import { useFileTreeStore } from '@/store/file-tree';

// ============================================================
// Chart Configurations
// ============================================================

const dauChartConfig: ChartConfig = {
  dau: {
    label: 'DAU',
    color: 'hsl(var(--chart-1))',
  },
  mau: {
    label: 'MAU',
    color: 'hsl(var(--chart-2))',
  },
};

const storageChartConfig: ChartConfig = {
  totalStorageMB: {
    label: 'Storage (MB)',
    color: 'hsl(var(--chart-3))',
  },
};

const uploadsNotesChartConfig: ChartConfig = {
  uploads: {
    label: 'Uploads',
    color: 'hsl(var(--chart-4))',
  },
  notesCreated: {
    label: 'Notes Created',
    color: 'hsl(var(--chart-5))',
  },
};

// ============================================================
// API Fetch Functions
// ============================================================

async function fetchMetrics(range: string) {
  const res = await fetch(`/api/admin/metrics?range=${range}`);
  if (!res.ok) throw new Error('Failed to fetch metrics');
  const json = await res.json();
  return json.data;
}

async function fetchUsers() {
  const res = await fetch('/api/admin/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  const json = await res.json();
  return json.data;
}

async function fetchUserDrilldown(userId: string) {
  const res = await fetch(`/api/admin/users?user_id=${userId}`);
  if (!res.ok) throw new Error('Failed to fetch user details');
  const json = await res.json();
  return json.data;
}

async function fetchLogs(filters?: { level?: string; action?: string }) {
  const params = new URLSearchParams();
  params.set('limit', '50');
  if (filters?.level) params.set('level', filters.level);
  if (filters?.action) params.set('action', filters.action);
  const res = await fetch(`/api/admin/logs?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch logs');
  const json = await res.json();
  return json.data;
}

async function refreshSnapshot() {
  const res = await fetch('/api/admin/snapshot', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to refresh snapshot');
  const json = await res.json();
  return json.data;
}

async function exportCsv(type: string) {
  const res = await fetch(`/api/admin/export?type=${type}&format=csv`);
  if (!res.ok) throw new Error('Failed to export CSV');
  // Trigger browser download
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${type}-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ============================================================
// Metric Card Component
// ============================================================

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: string;
  color?: string;
}

function MetricCard({ title, value, description, icon, trend, color }: MetricCardProps) {
  return (
    <Card className="gap-4">
      <CardHeader className="pb-0">
        <CardDescription className="flex items-center gap-2">
          <span className={`flex items-center justify-center h-5 w-5 rounded-md ${color || 'bg-muted'}`}>
            {icon}
          </span>
          {title}
        </CardDescription>
        <CardTitle className="text-2xl font-bold tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      {description && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">
            {trend && <span className="font-medium text-emerald-600 dark:text-emerald-400">{trend}</span>}
            {trend && description ? ' · ' : ''}
            {description}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================
// User Drill-Down Row
// ============================================================

interface UserRowData {
  id: string;
  email: string;
  name: string | null;
  role: string;
  storageUsedMB: number;
  nodeCount: number;
  fileCount: number;
  noteCount: number;
  folderCount: number;
  lastActive: string | null;
  createdAt: string;
}

function UserRow({ user, onExpand, isExpanded, drilldownData }: {
  user: UserRowData;
  onExpand: () => void;
  isExpanded: boolean;
  drilldownData: any | null;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onExpand}>
        <TableCell className="font-medium max-w-[180px] truncate">
          <div className="flex items-center gap-2 min-h-[44px]">
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            <span className="truncate">{user.name || user.email}</span>
          </div>
        </TableCell>
        <TableCell className="max-w-[200px] truncate hidden sm:table-cell">{user.email}</TableCell>
        <TableCell>
          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
            {user.role}
          </Badge>
        </TableCell>
        <TableCell className="tabular-nums">{user.nodeCount}</TableCell>
        <TableCell className="tabular-nums hidden md:table-cell">{user.storageUsedMB} MB</TableCell>
        <TableCell className="text-muted-foreground text-xs hidden lg:table-cell">
          {user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never'}
        </TableCell>
      </TableRow>
      {isExpanded && drilldownData && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Files</p>
                <p className="text-sm font-medium tabular-nums">{drilldownData.nodes?.filter((n: any) => n.type === 'file').length ?? user.fileCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm font-medium tabular-nums">{drilldownData.nodes?.filter((n: any) => n.type === 'note').length ?? user.noteCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Folders</p>
                <p className="text-sm font-medium tabular-nums">{drilldownData.nodes?.filter((n: any) => n.type === 'folder').length ?? user.folderCount}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Storage Limit</p>
                <p className="text-sm font-medium tabular-nums">{drilldownData.storageLimitMB ?? '—'} MB</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Action</p>
                <p className="text-sm font-medium">{drilldownData.lastAction ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">{new Date(drilldownData.createdAt).toLocaleDateString()}</p>
              </div>
              {drilldownData.nodes && drilldownData.nodes.length > 0 && (
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-muted-foreground mb-1">Recent Nodes</p>
                  <ScrollArea className="max-h-32">
                    <div className="space-y-1">
                      {drilldownData.nodes.slice(0, 10).map((node: any) => (
                        <div key={node.id} className="flex items-center gap-2 text-xs">
                          {node.type === 'file' ? <HardDrive className="h-3 w-3 text-muted-foreground" /> :
                            node.type === 'note' ? <FileText className="h-3 w-3 text-muted-foreground" /> :
                            <Activity className="h-3 w-3 text-muted-foreground" />}
                          <span className="truncate">{node.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1">{node.type}</Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================================
// Admin Dashboard Main Component
// ============================================================

export function AdminDashboard() {
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<{ level?: string; action?: string }>({});
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { setActiveView } = useFileTreeStore();

  // Data queries
  const metricsQuery = useQuery({
    queryKey: ['admin-metrics', range],
    queryFn: () => fetchMetrics(range),
    refetchInterval: 60000, // Refresh every minute
  });

  const usersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
  });

  const logsQuery = useQuery({
    queryKey: ['admin-logs', logFilter],
    queryFn: () => fetchLogs(logFilter),
  });

  const drilldownQuery = useQuery({
    queryKey: ['admin-user-drilldown', expandedUserId],
    queryFn: () => fetchUserDrilldown(expandedUserId!),
    enabled: !!expandedUserId,
  });

  // Snapshot refresh mutation
  const snapshotMutation = useMutation({
    mutationFn: refreshSnapshot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  // CSV export mutations
  const exportMetricsMutation = useMutation({
    mutationFn: () => exportCsv('metrics'),
  });
  const exportUsersMutation = useMutation({
    mutationFn: () => exportCsv('users'),
  });
  const exportActivityMutation = useMutation({
    mutationFn: () => exportCsv('activity'),
  });

  const handleExpandUser = useCallback((userId: string) => {
    setExpandedUserId(prev => prev === userId ? null : userId);
  }, []);

  const metrics = metricsQuery.data;
  const timeSeries = metrics?.timeSeries || [];
  const userList = usersQuery.data?.users || [];
  const logs = logsQuery.data?.logs || [];

  // Loading state
  if (metricsQuery.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading admin dashboard...</p>
      </div>
    );
  }

  // Error state
  if (metricsQuery.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">Failed to load metrics: {metricsQuery.error.message}</p>
        <Button variant="outline" onClick={() => metricsQuery.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Platform analytics & user management</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => snapshotMutation.mutate()}
            disabled={snapshotMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${snapshotMutation.isPending ? 'animate-spin' : ''}`} />
            {snapshotMutation.isPending ? 'Refreshing...' : 'Refresh Snapshot'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            onClick={() => setActiveView('workspace')}
          >
            Back to Workspace
          </Button>
        </div>
      </div>

      {/* Snapshot refresh feedback */}
      {snapshotMutation.isSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm">
          <TrendingUp className="h-4 w-4" />
          Snapshot refreshed successfully for {snapshotMutation.data?.snapshotDate}
        </div>
      )}

      {/* ===== Overview Metric Cards ===== */}
      <section aria-label="Overview metrics">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            title="DAU"
            value={metrics?.dauCount ?? 0}
            description="Daily active users"
            icon={<Users className="h-3 w-3" />}
            color="bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300"
          />
          <MetricCard
            title="MAU"
            value={metrics?.mauCount ?? 0}
            description="Monthly active users"
            icon={<Users className="h-3 w-3" />}
            color="bg-teal-100 dark:bg-teal-900 text-teal-600 dark:text-teal-300"
          />
          <MetricCard
            title="Total Users"
            value={metrics?.totalUsers ?? 0}
            description="Registered accounts"
            icon={<Users className="h-3 w-3" />}
            color="bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
          />
          <MetricCard
            title="Total Nodes"
            value={metrics?.totalNodes ?? 0}
            description="Files, folders, notes"
            icon={<FileText className="h-3 w-3" />}
            color="bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300"
          />
          <MetricCard
            title="Storage"
            value={`${metrics?.totalStorageUsedMB ?? 0} MB`}
            description="Platform-wide"
            icon={<HardDrive className="h-3 w-3" />}
            color="bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-300"
          />
          <MetricCard
            title="Error Rate"
            value={`${((metrics?.errorRate ?? 0) * 100).toFixed(1)}%`}
            description={`${metrics?.errorCount ?? 0} errors in 5min`}
            icon={<AlertTriangle className="h-3 w-3" />}
            color={(metrics?.errorRate ?? 0) > 0.05 ? 'bg-destructive/10 text-destructive' : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300'}
          />
        </div>
      </section>

      {/* ===== Latency summary bar ===== */}
      <Card className="gap-3">
        <CardContent className="flex items-center gap-4 py-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Latency:</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline" className="text-xs tabular-nums">p50: {metrics?.p50LatencyMs ?? 0}ms</Badge>
            <Badge variant="outline" className="text-xs tabular-nums">avg: {metrics?.avgLatencyMs ?? 0}ms</Badge>
            <Badge variant={(metrics?.p99LatencyMs ?? 0) > 500 ? 'destructive' : 'outline'} className="text-xs tabular-nums">
              p99: {metrics?.p99LatencyMs ?? 0}ms
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm ml-auto">
            <span className="text-muted-foreground">Requests (5min):</span>
            <span className="font-medium tabular-nums">{metrics?.requestCount5min ?? 0}</span>
          </div>
        </CardContent>
      </Card>

      {/* ===== DAU Time-Series Chart ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Active Users Trend
          </CardTitle>
          <CardAction>
            <Tabs value={range} onValueChange={(v) => setRange(v as '7d' | '30d' | '90d')}>
              <TabsList className="h-8">
                <TabsTrigger value="7d" className="text-xs">7d</TabsTrigger>
                <TabsTrigger value="30d" className="text-xs">30d</TabsTrigger>
                <TabsTrigger value="90d" className="text-xs">90d</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ChartContainer config={dauChartConfig} className="h-[250px] w-full aspect-auto">
            <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                tickLine={false}
                axisLine={false}
                minTickGap={32}
              />
              <YAxis tickLine={false} axisLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="dau"
                stroke="var(--color-dau)"
                fill="var(--color-dau)"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="mau"
                stroke="var(--color-mau)"
                fill="var(--color-mau)"
                fillOpacity={0.1}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ===== Storage & Uploads/Notes Charts (side by side on desktop) ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Storage Trend
            </CardTitle>
            <CardDescription>Daily storage usage in MB</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={storageChartConfig} className="h-[200px] w-full aspect-auto">
              <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="totalStorageMB"
                  fill="var(--color-totalStorageMB)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Uploads & Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploads & Notes
            </CardTitle>
            <CardDescription>Daily file uploads and notes created</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={uploadsNotesChartConfig} className="h-[200px] w-full aspect-auto">
              <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={32}
                />
                <YAxis tickLine={false} axisLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="uploads"
                  fill="var(--color-uploads)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="notesCreated"
                  fill="var(--color-notesCreated)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ===== CSV Export Buttons ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Reports
          </CardTitle>
          <CardDescription>Download CSV reports for offline analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={() => exportMetricsMutation.mutate()}
              disabled={exportMetricsMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              {exportMetricsMutation.isPending ? 'Exporting...' : 'Export Metrics'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={() => exportUsersMutation.mutate()}
              disabled={exportUsersMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              {exportUsersMutation.isPending ? 'Exporting...' : 'Export Users'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={() => exportActivityMutation.mutate()}
              disabled={exportActivityMutation.isPending}
            >
              <Download className="h-4 w-4 mr-1" />
              {exportActivityMutation.isPending ? 'Exporting...' : 'Export Activity'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ===== User List Table ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            {usersQuery.data?.total ?? 0} registered users — click to drill down
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Nodes</TableHead>
                    <TableHead className="hidden md:table-cell">Storage</TableHead>
                    <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userList.map((u: UserRowData) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onExpand={() => handleExpandUser(u.id)}
                      isExpanded={expandedUserId === u.id}
                      drilldownData={expandedUserId === u.id ? drilldownQuery.data : null}
                    />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ===== Activity Logs Viewer ===== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Activity Logs
          </CardTitle>
          <CardDescription>
            Recent structured logs — {logsQuery.data?.total ?? 0} total entries
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={logFilter.level || ''}
                onChange={(e) => setLogFilter(prev => ({ ...prev, level: e.target.value || undefined }))}
                aria-label="Filter by log level"
              >
                <option value="">All Levels</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
                <option value="debug">Debug</option>
              </select>
              <select
                className="h-8 rounded-md border bg-background px-2 text-xs"
                value={logFilter.action || ''}
                onChange={(e) => setLogFilter(prev => ({ ...prev, action: e.target.value || undefined }))}
                aria-label="Filter by action type"
              >
                <option value="">All Actions</option>
                <option value="file_upload">Upload</option>
                <option value="note_create">Note Create</option>
                <option value="note_update">Note Update</option>
                <option value="node_delete">Delete</option>
                <option value="admin_metrics_viewed">Admin Metrics</option>
                <option value="admin_access_denied">Access Denied</option>
              </select>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {logsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No logs found for selected filters</p>
                ) : (
                  logs.map((log: any, idx: number) => (
                    <div key={log.id || idx} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Badge
                        variant={
                          log.level === 'error' ? 'destructive' :
                          log.level === 'warn' ? 'outline' :
                          'secondary'
                        }
                        className="text-[10px] shrink-0 mt-0.5"
                      >
                        {log.level}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium">{log.action}</span>
                          {log.userId && (
                            <span className="text-[10px] text-muted-foreground">
                              by {log.userId.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                        {log.metadata && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {typeof log.metadata === 'string' ? log.metadata : JSON.stringify(log.metadata).slice(0, 100)}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
