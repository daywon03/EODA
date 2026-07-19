-- AlterTable
ALTER TABLE "evaluation_elements" ADD COLUMN     "source_question_id" TEXT;

-- AlterTable
ALTER TABLE "themes" ADD COLUMN     "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_elements_source_question_id_key" ON "evaluation_elements"("source_question_id");

-- CreateIndex
CREATE UNIQUE INDEX "objectives_theme_id_code_key" ON "objectives"("theme_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "themes_chapter_id_code_key" ON "themes"("chapter_id", "code");

