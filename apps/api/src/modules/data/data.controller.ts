import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { prisma } from '@sfcc/db';
import { DataService } from './data.service';
import { QuerySetService } from './query-set.service';
import { RecordTypeMapperService } from './record-type-mapper.service';
import { ConaSeedService } from './cona-seed.service';
import { AccountPartnerImportService } from './account-partner-import.service';
import { OrgToOrgCompareService } from './org-to-org-compare.service';
import { OrgToOrgBrowseService } from './org-to-org-browse.service';
import { DataPreflightService } from './data-preflight.service';
import { QuerySectionRuntimeService } from './query-section-runtime.service';
import { AuthGuard } from '../../common/auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { ModuleGuard, RequireModule } from '../../common/module.guard';
import { assertOrgOwned } from '../../common/user-tenancy.util';
import {
  accountSeedPreviewSchema,
  conaSeedRunSchema,
  partnerImportLoadSchema,
  partnerImportProcessSchema,
  partnerTransferSchema,
  querySetCompileSchema,
  recordTypeMappingsSchema,
} from '@sfcc/shared';

@Controller('data')
@UseGuards(AuthGuard, ModuleGuard)
@RequireModule('data')
export class DataController {
  constructor(
    private readonly dataService: DataService,
    private readonly querySetService: QuerySetService,
    private readonly recordTypeMapper: RecordTypeMapperService,
    private readonly conaSeedService: ConaSeedService,
    private readonly partnerImportService: AccountPartnerImportService,
    private readonly orgToOrgCompareService: OrgToOrgCompareService,
    private readonly orgToOrgBrowseService: OrgToOrgBrowseService,
    private readonly dataPreflightService: DataPreflightService,
    private readonly querySectionRuntime: QuerySectionRuntimeService,
  ) {}

  @Get('custom-settings/template')
  getCustomSettingsTemplate() {
    return this.dataService.getBundledCustomSettingsTemplate();
  }

  @Get('custom-settings/preflight')
  getCustomSettingsPreflight() {
    return this.dataService.getCustomSettingsPreflight();
  }

  @Post('custom-settings/validate')
  validateCustomSettings(@Body() body: unknown) {
    return this.dataService.validateCustomSettingsExport(body);
  }

  @Post('custom-settings/run')
  runCustomSettings(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.dataService.runCustomSettingsLoad(body, userId);
  }

  @Get('movements/:id')
  getMovement(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.dataService.getMovement(id, userId);
  }

  @Get('movements')
  listMovements(
    @CurrentUser() userId: string,
    @Query('movementType') movementType?: string,
  ) {
    return this.dataService.listMovements(userId, movementType);
  }

  @Get('templates')
  getQueryTemplates() {
    return this.querySetService.getTemplates();
  }

  @Get('query-templates')
  getQueryTemplatesAlias() {
    return this.querySetService.getTemplates();
  }

  @Get('bottlers')
  async listBottlers(
    @Query('sourceOrgId') sourceOrgId: string,
    @CurrentUser() userId: string,
  ) {
    await assertOrgOwned(sourceOrgId, userId, prisma);
    return this.querySetService.listBottlers(sourceOrgId);
  }

  @Get('record-types')
  async discoverRecordTypes(
    @Query('orgId') orgId: string,
    @Query('object') object: string,
    @CurrentUser() userId: string,
  ) {
    await assertOrgOwned(orgId, userId, prisma);
    return this.recordTypeMapper.discoverRecordTypes(orgId, object);
  }

  @Get('preview')
  previewData(
    @Query('sourceOrgId') sourceOrgId: string,
    @Query('soql') soql: string,
    @Query('recordLimit') recordLimitRaw: string | undefined,
    @CurrentUser() userId: string,
  ) {
    const recordLimit = recordLimitRaw ? parseInt(recordLimitRaw, 10) : undefined;
    return this.dataService.previewData(sourceOrgId, soql, userId, recordLimit);
  }

  @Get('batches/:id')
  getDeployBatch(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.dataService.getDeployBatch(id, userId);
  }

  @Post('batches/:id/chunks/:chunkId/retry')
  retryChunk(
    @Param('id') id: string,
    @Param('chunkId') chunkId: string,
    @CurrentUser() userId: string,
  ) {
    return this.dataService.retryChunk(id, chunkId, userId);
  }

  @Post('batches/:id/retry-failed')
  retryFailedChunks(@Param('id') id: string, @CurrentUser() userId: string) {
    return this.dataService.retryFailedChunks(id, userId);
  }

  @Get('batch-groups/:groupId')
  getBatchGroup(@Param('groupId') groupId: string, @CurrentUser() userId: string) {
    return this.dataService.getBatchGroup(groupId, userId);
  }

  @Post('deploy/preflight')
  runDeployPreflight(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.dataPreflightService.runPreflight(body, userId);
  }

  @Post('query-set/validate')
  validateQuerySet(@Body() body: unknown) {
    return this.querySetService.validateQuerySet(body);
  }

  @Post('query-section/validate')
  validateQuerySection(@Body() body: { section?: unknown }) {
    return this.querySectionRuntime.validate(body?.section ?? body);
  }

  @Post('query-section/preview')
  previewQuerySection(
    @Body() body: {
      sourceOrgId: string;
      targetOrgId?: string;
      section: unknown;
      variables?: Record<string, string>;
      salesOffices?: string[];
      salesOfficesByBottler?: Record<string, string[]>;
    },
    @CurrentUser() userId: string,
  ) {
    return this.querySectionRuntime.preview(body, userId);
  }

  @Post('query-set/compile')
  compileQuerySet(@Body() body: unknown) {
    const input = querySetCompileSchema.parse(body);
    return this.querySetService.compileFromBuilder(input);
  }

  @Post('query-set/preview')
  async previewQuerySet(
    @Body() body: { sourceOrgId: string; querySet: unknown },
    @CurrentUser() userId: string,
  ) {
    await assertOrgOwned(body.sourceOrgId, userId, prisma);
    const querySet = this.querySetService.validateQuerySet(body.querySet);
    return this.querySetService.previewQuerySet(body.sourceOrgId, querySet);
  }

  @Post('record-type-mappings')
  async previewRecordTypeMappings(@Body() body: unknown, @CurrentUser() userId: string) {
    const input = recordTypeMappingsSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);
    return this.querySetService.previewRecordTypeMappings(
      input.sourceOrgId,
      input.targetOrgId,
      input.querySet,
      input.objectName,
      input.manualMappings,
    );
  }

  @Post('org-to-org/compare')
  compareOrgToOrg(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.orgToOrgCompareService.compare(body, userId);
  }

  @Get('org-to-org/objects')
  listOrgToOrgObjects(
    @Query('orgId') orgId: string,
    @Query('search') search: string | undefined,
    @CurrentUser() userId: string,
  ) {
    return this.orgToOrgBrowseService.listObjects(orgId, userId, search);
  }

  @Get('org-to-org/object-meta')
  getOrgToOrgObjectMeta(
    @Query('orgId') orgId: string,
    @Query('objectName') objectName: string,
    @CurrentUser() userId: string,
  ) {
    return this.orgToOrgBrowseService.getObjectMeta(orgId, objectName, userId);
  }

  @Get('org-to-org/records')
  listOrgToOrgRecords(
    @Query('sourceOrgId') sourceOrgId: string,
    @Query('objectName') objectName: string,
    @Query('limit') limit: string | undefined,
    @Query('page') page: string | undefined,
    @CurrentUser() userId: string,
  ) {
    return this.orgToOrgBrowseService.listRecords(
      sourceOrgId,
      objectName,
      userId,
      limit ? Number(limit) : 50,
      page ? Number(page) : 1,
    );
  }

  @Post('org-to-org/deploy')
  deployOrgToOrg(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.dataService.deployOrgToOrg(body, userId);
  }

  @Post('org-to-org/preview-filter')
  previewOrgToOrgFilter(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.orgToOrgBrowseService.previewFilter(body, userId);
  }

  @Post('org-to-org/deploy-batch')
  deployOrgToOrgBatch(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.dataService.deployOrgToOrgBatch(body, userId);
  }

  @Post('deploy')
  deployData(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.dataService.deployData(body, userId);
  }

  @Post('replicate')
  replicateData(@Body() body: unknown, @CurrentUser() userId: string) {
    return this.dataService.replicateData(body, userId);
  }

  @Post('account-seed/preview')
  async previewAccountSeed(@Body() body: unknown, @CurrentUser() userId: string) {
    const input = accountSeedPreviewSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    return this.conaSeedService.previewAccountSeed(input.sourceOrgId, input.rows);
  }

  @Post('seed/preview')
  async previewSeed(@Body() body: unknown, @CurrentUser() userId: string) {
    const input = conaSeedRunSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    return this.conaSeedService.validate(input.sourceOrgId, input.datasets, input.accountSeedRows);
  }

  @Post('seed/run')
  async runSeed(@Body() body: unknown, @CurrentUser() userId: string) {
    const input = conaSeedRunSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);
    return this.dataService.enqueueConaSeed(input, userId);
  }

  @Post('account-partners/process')
  processPartners(@Body() body: unknown) {
    const input = partnerImportProcessSchema.parse(body);
    return this.partnerImportService.processExcel(input);
  }

  @Post('account-partners/load')
  async loadPartners(@Body() body: unknown, @CurrentUser() userId: string) {
    const input = partnerImportLoadSchema.parse(body);
    await assertOrgOwned(input.targetOrgId, userId, prisma);
    return this.partnerImportService.loadFromArtifacts(input.bottler, input.targetOrgId, input.dryRun);
  }

  @Post('account-partners/transfer')
  async transferPartners(@Body() body: unknown, @CurrentUser() userId: string) {
    const input = partnerTransferSchema.parse(body);
    await assertOrgOwned(input.sourceOrgId, userId, prisma);
    await assertOrgOwned(input.targetOrgId, userId, prisma);
    return this.partnerImportService.transferOrgToOrg(input.sourceOrgId, input.targetOrgId, input.bottler);
  }

  @Post('account-partners/preview')
  previewPartners(@Body() body: unknown) {
    const input = partnerImportProcessSchema.parse(body);
    return this.partnerImportService.preview(input);
  }
}
