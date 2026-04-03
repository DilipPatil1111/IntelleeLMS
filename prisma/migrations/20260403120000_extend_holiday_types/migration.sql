-- Extend HolidayType for breaks and exam prep (principal-configured alongside public/college/custom).
ALTER TYPE "HolidayType" ADD VALUE 'SUMMER_BREAK';
ALTER TYPE "HolidayType" ADD VALUE 'WINTER_BREAK';
ALTER TYPE "HolidayType" ADD VALUE 'EXAM_PREPARATION_LEAVE';
