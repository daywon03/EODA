-- Texte extrait (Markdown) au dépôt d'une version de la bibliothèque de modèles —
-- gabarit ou document de référence, indépendamment de l'indexation dans la base de
-- connaissances (réservée aux références). Permet de consulter le contenu d'un
-- fichier directement dans la plateforme, sans téléchargement.
ALTER TABLE "template_versions" ADD COLUMN "extracted_text" TEXT;
