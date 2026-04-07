-- Add notes column to items for free-form per-item notes (inline editable, no modal needed).
ALTER TABLE items ADD COLUMN notes TEXT NOT NULL DEFAULT '';
