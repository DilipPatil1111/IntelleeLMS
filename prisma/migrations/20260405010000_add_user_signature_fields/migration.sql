-- Add email signature fields to User
-- signatureImageUrl: URL of an uploaded handwritten/scanned signature image (stored in Vercel Blob)
-- signatureTypedName: Typed name used as a text signature when no image is uploaded

ALTER TABLE "User" ADD COLUMN "signatureImageUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "signatureTypedName" TEXT;
