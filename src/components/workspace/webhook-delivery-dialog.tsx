'use client';

// ============================================================
// MODUL 44.2: Webhook Delivery History Dialog
// Table: timestamp, event type, HTTP status, attempt count, status badge
// Status badges: pending=yellow, success=green, failed=red, dead_letter=gray
// Retry info: "Attempt 3/5, next retry at [time]"
// Filter by status (dropdown)
// ============================================================

import { useState, useCallback } from 'react';
import {
  Loader2,
  Activity,
  RefreshCw,
  Clock,
  Filter,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useWebhookDeliveries } from '@/hooks/use-webhooks';
import type { WebhookDeliveryStatus, WebhookDeliveryInfo } from '@/types';

// --- Delivery status badge mapping ---
function getDeliveryStatusBadge(status: WebhookDeliveryStatus): { label: string; className: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', className: 'bg-yellow-600 text-white' };
    case 'success':
      return { label: 'Success', className: 'bg-green-600 text-white' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-600 text-white' };
    case 'dead_letter':
      return { label: 'Dead Letter', className: 'bg-gray-500 text-white' };
    default:
      return { label: status, className: '' };
  }
}

interface WebhookDeliveryDialogProps {
  subscriptionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebhookDeliveryDialog({ subscriptionId, open, onOpenChange }: WebhookDeliveryDialogProps) {
  const [statusFilter, setStatusFilter] = useState<WebhookDeliveryStatus | 'all'>('all');
  const { data: deliveryData, isLoading, refetch } = useWebhookDeliveries(
    subscriptionId,
    statusFilter === 'all' ? undefined : statusFilter,
  );

  const handleRefetch = useCallback(() => {
    refetch();
    toast.info('Refreshed delivery history');
  }, [refetch]);

  const deliveries = deliveryData?.deliveries || [];
  const pagination = deliveryData?.pagination;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Webhook Delivery History
          </DialogTitle>
          <DialogDescription>
            View the delivery audit trail for this webhook subscription. Each row represents an attempt to deliver an event to your endpoint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filter controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as WebhookDeliveryStatus | 'all')}
              >
                <SelectTrigger className="w-[140px] min-h-[44px]">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="dead_letter">Dead Letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="min-h-[44px]"
              onClick={handleRefetch}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            {pagination && (
              <span className="text-sm text-muted-foreground">
                {pagination.total} deliveries
              </span>
            )}
          </div>

          {/* Delivery table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Activity className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium text-muted-foreground">No deliveries found</p>
              <p className="text-sm text-muted-foreground">
                {statusFilter !== 'all' ? 'No deliveries with the selected status.' : 'No events have been delivered to this webhook yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>HTTP Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Next Retry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery: WebhookDeliveryInfo) => {
                    const statusBadge = getDeliveryStatusBadge(delivery.status);
                    return (
                      <TableRow key={delivery.id}>
                        <TableCell className="text-sm">
                          {new Date(delivery.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {delivery.eventType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {delivery.responseStatus != null ? (
                            <span className={delivery.responseStatus >= 200 && delivery.responseStatus < 300 ? 'text-green-600' : 'text-red-600'}>
                              {delivery.responseStatus}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {delivery.attemptCount > 1 ? (
                            <span className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3 text-muted-foreground" />
                              {delivery.attemptCount}/5
                            </span>
                          ) : (
                            <span>1</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {delivery.nextAttemptAt ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {new Date(delivery.nextAttemptAt).toLocaleString()}
                            </span>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination info */}
          {pagination && pagination.hasMore && (
            <p className="text-xs text-muted-foreground text-center">
              Showing first {deliveries.length} of {pagination.total} deliveries.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
