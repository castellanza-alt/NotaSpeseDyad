-- Aggiunge la colonna per il soft delete
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Aggiorna le policy RLS se necessario (solitamente non serve se la policy è su ALL o UPDATE)
-- Ma per sicurezza, assicuriamoci che l'utente possa vedere le proprie note cancellate per recuperarle
-- Le policy esistenti dovrebbero già coprire "auth.uid() = user_id"