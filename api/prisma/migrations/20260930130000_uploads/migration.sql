-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "url" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "attachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Upload_url_key" ON "Upload"("url");

-- CreateIndex
CREATE INDEX "Upload_userId_createdAt_idx" ON "Upload"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Upload_attachedAt_createdAt_idx" ON "Upload"("attachedAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
