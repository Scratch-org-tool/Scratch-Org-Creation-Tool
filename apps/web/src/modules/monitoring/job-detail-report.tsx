'use client';

import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function JobDetailReportButton() {
  const handleDownload = () => {
    window.print();
  };

  return (
    <Button type="button" variant="outline" size="sm" className="gap-2 no-print" onClick={handleDownload}>
      <Download className="w-4 h-4" />
      Download Report
    </Button>
  );
}
