-- CreateTable
CREATE TABLE "UserPortalGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "portal" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "UserPortalGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPortalGrant_userId_idx" ON "UserPortalGrant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPortalGrant_userId_portal_key" ON "UserPortalGrant"("userId", "portal");

-- AddForeignKey
ALTER TABLE "UserPortalGrant" ADD CONSTRAINT "UserPortalGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPortalGrant" ADD CONSTRAINT "UserPortalGrant_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
