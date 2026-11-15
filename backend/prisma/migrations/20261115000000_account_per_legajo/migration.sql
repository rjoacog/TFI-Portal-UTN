-- Una cuenta por legajo, con un solo rol (P-01, #15). No convierte datos existentes:
-- hay que correr `npx prisma migrate reset` y volver a cargar los seeds.

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_roles" DROP CONSTRAINT "user_roles_role_id_fkey";

-- DropTable
DROP TABLE "user_roles";

-- DropTable
DROP TABLE "roles";

-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "role" "role_name" NOT NULL,
ADD COLUMN "dni" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "users_dni_role_key" ON "users"("dni", "role");
