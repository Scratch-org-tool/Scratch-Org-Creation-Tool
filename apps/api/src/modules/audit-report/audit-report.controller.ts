import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/auth.guard';
import { RequireRole, RoleGuard } from '../../common/role.guard';
import { AuditReportService } from './audit-report.service';

@Controller('admin/audit-report')
@UseGuards(AuthGuard, RoleGuard)
@RequireRole('admin')
export class AuditReportController {
  constructor(private readonly service: AuditReportService) {}

  @Get()
  report(@Query() query: Record<string, unknown>) {
    return this.service.report(query);
  }

  @Get('export')
  @Header('content-type', 'text/csv; charset=utf-8')
  @Header('content-disposition', 'attachment; filename="audit-report.csv"')
  export(@Query() query: Record<string, unknown>) {
    return this.service.exportCsv(query);
  }
}
