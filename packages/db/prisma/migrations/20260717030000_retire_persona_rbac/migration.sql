-- Retire the legacy persona-based RBAC model. Authorization is unified on
-- AppUser role + module grants (AuthGuard + ModuleGuard + RoleGuard); the
-- AutomationRun.persona column and Persona enum were never used for
-- authorization decisions.

ALTER TABLE "AutomationRun" DROP COLUMN IF EXISTS "persona";

DROP TYPE IF EXISTS "Persona";
