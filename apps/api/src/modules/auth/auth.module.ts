import { Module, Global } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseIdentityService } from './firebase-identity.service';
import { AuthSecurityService } from './auth-security.service';
import { AuthGuard } from '../../common/auth.guard';
import { ModuleGuard } from '../../common/module.guard';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, FirebaseIdentityService, AuthSecurityService, AuthGuard, ModuleGuard],
  exports: [AuthService, AuthGuard, ModuleGuard, AuthSecurityService],
})
export class AuthModule {}
