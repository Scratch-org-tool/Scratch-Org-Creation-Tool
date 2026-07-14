import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MetadataBrowseService } from './metadata-browse.service';
import { MetadataCompareService } from './metadata-compare.service';
import { MetadataPipelineService } from './metadata-pipeline.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';

@Controller('metadata')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('deployment')
export class MetadataController {
  constructor(
    private readonly browseService: MetadataBrowseService,
    private readonly compareService: MetadataCompareService,
    private readonly pipelineService: MetadataPipelineService,
  ) {}

  @Get('org/:orgId/types')
  listTypes(
    @Param('orgId') orgId: string,
    @CurrentUser() userId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.browseService.listTypes(
      orgId,
      userId,
      search,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 100,
    );
  }

  @Get('org/:orgId/components')
  listComponents(
    @Param('orgId') orgId: string,
    @CurrentUser() userId: string,
    @Query('type') metadataType: string,
    @Query('search') search?: string,
    @Query('folder') folder?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.browseService.listComponents(orgId, userId, metadataType, {
      search,
      folder,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 200,
    });
  }

  @Get('org/:orgId/folders')
  listFolders(
    @Param('orgId') orgId: string,
    @CurrentUser() userId: string,
    @Query('type') metadataType: string,
  ) {
    return this.browseService.listFolders(orgId, userId, metadataType);
  }

  @Get('org/:orgId/objects/:objectName/fields')
  listObjectFields(
    @Param('orgId') orgId: string,
    @Param('objectName') objectName: string,
    @CurrentUser() userId: string,
  ) {
    return this.browseService.listObjectFields(orgId, userId, objectName);
  }

  @Get('compare')
  compare(
    @CurrentUser() userId: string,
    @Query('sourceOrgId') sourceOrgId: string,
    @Query('targetOrgId') targetOrgId: string,
    @Query('type') metadataType: string,
  ) {
    return this.browseService.compareOrgs(sourceOrgId, targetOrgId, userId, metadataType);
  }

  @Post('org-to-org/preview-manifest')
  previewManifest(@Body() body: unknown) {
    return this.browseService.previewManifest(body);
  }

  @Post('org-to-org/pipeline')
  startPipeline(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.pipelineService.startPipeline(body, userId);
  }

  @Post('compare/start')
  startComparison(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.compareService.startComparison(body, userId);
  }

  @Get('compare/preview-counts')
  previewCounts(
    @CurrentUser() userId: string,
    @Query('sourceOrgId') sourceOrgId: string,
    @Query('targetOrgId') targetOrgId: string,
  ) {
    return this.compareService.getOrgCounts(sourceOrgId, targetOrgId, userId);
  }

  @Get('compare/:id')
  getComparison(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Query('type') type?: string,
    @Query('diffType') diffType?: 'new' | 'changed' | 'deleted' | 'same',
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.compareService.getSession(id, userId, {
      type,
      diffType,
      search,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 100,
    });
  }

  @Get('compare/:id/diff')
  getItemDiff(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Query('type') metadataType: string,
    @Query('name') fullName: string,
  ) {
    return this.compareService.getItemDiff(id, userId, metadataType, fullName);
  }

  @Get('compare/:id/children')
  getObjectChildren(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Query('objectName') objectName: string,
  ) {
    return this.compareService.getObjectChildren(id, userId, objectName);
  }

  @Post('compare/:id/analyze')
  analyzeComparison(
    @Param('id') id: string,
    @Body() body: unknown,
    @CurrentUser() userId: string,
  ) {
    return this.compareService.analyzeProblems(id, userId, body);
  }
}
