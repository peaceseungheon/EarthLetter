-- DropForeignKey
ALTER TABLE "Article" DROP CONSTRAINT "Article_sourceId_fkey";

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "contentHtml" TEXT;

-- AlterTable
ALTER TABLE "Source" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "disabledAt" TIMESTAMP(3),
ADD COLUMN     "failCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastFailedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Source_enabled_disabledAt_idx" ON "Source"("enabled", "disabledAt");

-- AddForeignKey
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
