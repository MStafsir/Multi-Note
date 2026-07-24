'use client';

// ============================================================
// MODUL 42.4: Invoice History Panel — Owner-only
// Table of invoices: date, amount, currency, status badge, PDF download
// Pagination for long invoice lists
// ============================================================

import { useState, useCallback } from 'react';
import {
  Receipt,
  Download,
  Loader2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useWorkspaceInvoices } from '@/hooks/use-billing';
import type { InvoiceInfo, InvoiceStatus } from '@/types';

// --- Invoice status badge mapping ---
function getInvoiceStatusBadge(status: InvoiceStatus): { label: string; className: string } {
  switch (status) {
    case 'paid':
      return { label: 'Paid', className: 'bg-green-600 text-white' };
    case 'pending':
      return { label: 'Pending', className: 'bg-yellow-600 text-white' };
    case 'failed':
      return { label: 'Failed', className: 'bg-red-600 text-white' };
    case 'refunded':
      return { label: 'Refunded', className: 'bg-gray-500 text-white' };
    default:
      return { label: status, className: '' };
  }
}

// Format amount with currency
function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

interface WorkspaceInvoiceHistoryProps {
  workspaceId: string;
}

const PAGE_SIZE = 10;

export function WorkspaceInvoiceHistory({ workspaceId }: WorkspaceInvoiceHistoryProps) {
  const { data: invoices, isLoading } = useWorkspaceInvoices(workspaceId);
  const [currentPage, setCurrentPage] = useState(0);

  // Paginate invoices
  const allInvoices = invoices || [];
  const totalPages = Math.ceil(allInvoices.length / PAGE_SIZE);
  const paginatedInvoices = allInvoices.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );

  const handleDownloadPdf = useCallback((invoice: InvoiceInfo) => {
    if (invoice.pdfUrl) {
      window.open(invoice.pdfUrl, '_blank');
    } else {
      toast.info('PDF not available for this invoice. In production, this downloads the provider-generated PDF.');
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Invoice History
        </CardTitle>
        <CardDescription>
          View and download invoices for this workspace. Only the workspace owner can access this data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : allInvoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="font-medium text-muted-foreground">No invoices yet</p>
            <p className="text-sm text-muted-foreground">
              Invoices will appear here once you subscribe to a paid plan.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Invoice table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.map((invoice) => {
                    const statusBadge = getInvoiceStatusBadge(invoice.status);
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="text-sm">
                          {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString() : '—'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatAmount(invoice.amount, invoice.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusBadge.className}>
                            {statusBadge.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => handleDownloadPdf(invoice)}
                            aria-label={`Download PDF for invoice ${invoice.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, allInvoices.length)} of {allInvoices.length} invoices
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] min-w-[44px]"
                    onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-[44px] min-w-[44px]"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
