-- Migration: Add despesa_fixa field to categorias table
-- This allows categorizing expenses as fixed (rent, utilities) vs variable (entertainment, dining out)

-- Add despesa_fixa column
ALTER TABLE categorias
ADD COLUMN despesa_fixa BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN categorias.despesa_fixa IS 'Indica se a categoria é de despesa fixa (aluguel, condomínio, etc.) ou variável';

-- Create index for better query performance when filtering fixed expenses
CREATE INDEX idx_categorias_despesa_fixa ON categorias(despesa_fixa) WHERE despesa_fixa = true;
