-- AlterTable
ALTER TABLE "QRToken" ADD COLUMN     "tokenCiphertext" TEXT;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "websiteUrl" TEXT;
