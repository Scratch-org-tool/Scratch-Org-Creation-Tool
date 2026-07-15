import { Module, Global } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { AuthSecurityService } from './auth-security.service';
import { AuthGuard } from '../../common/auth.guard';
import { ModuleGuard } from '../../common/module.guard';
import { RoleGuard } from '../../common/role.guard';
import { AuthAuditService } from './auth-audit.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    FirebaseIdentityService,
    AuthSecurityService,
    AuthAuditService,
    AuthGuard,
    ModuleGuard,
    RoleGuard,
  ],
  exports: [
    AuthService,
    AuthGuard,
    ModuleGuard,
    RoleGuard,
    AuthSecurityService,
    AuthAuditService,
  ],
})
export class AuthModule {}
