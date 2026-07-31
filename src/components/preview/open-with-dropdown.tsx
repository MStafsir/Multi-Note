'use client';

import { Download, MoreVertical, FileText, FileSpreadsheet, Presentation } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface OpenWithDropdownProps {
  nodeId: string;
  mimeType: string;
  fileName?: string;
}

/**
 * Determine which MS Office URI schemes are applicable for the given MIME type.
 */
function getOfficeUriScheme(mimeType: string): { scheme: string; label: string; icon: React.ReactNode } | null {
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
    return { scheme: 'ms-word:of:u|', label: 'Open in Microsoft Word', icon: <FileText className="h-4 w-4" /> };
  }
  if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel')) {
    return { scheme: 'ms-excel:of:u|', label: 'Open in Microsoft Excel', icon: <FileSpreadsheet className="h-4 w-4" /> };
  }
  if (mimeType.includes('presentationml') || mimeType.includes('ms-powerpoint')) {
    return { scheme: 'ms-powerpoint:of:u|', label: 'Open in Microsoft PowerPoint', icon: <Presentation className="h-4 w-4" /> };
  }
  return null;
}

export function OpenWithDropdown({ nodeId, mimeType, fileName }: OpenWithDropdownProps) {
  const downloadUrl = `/api/files/${nodeId}/content?download=true`;
  const officeUri = getOfficeUriScheme(mimeType);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Open with…">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Open with…</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Download option — always available */}
        <DropdownMenuItem asChild>
          <a href={downloadUrl} download={fileName || true}>
            <Download className="h-4 w-4" />
            Download
          </a>
        </DropdownMenuItem>

        {/* Conditional MS Office URI — shown as disabled with tooltip */}
        {officeUri && (
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuItem
                disabled
                className="opacity-50 cursor-not-allowed"
              >
                {officeUri.icon}
                {officeUri.label}
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              Requires desktop Microsoft Office
            </TooltipContent>
          </Tooltip>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
