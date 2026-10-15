-- Optional larger text and buttons, saved with the player's other interface choices.
ALTER TABLE ui_preferences ADD COLUMN text_size TEXT NOT NULL DEFAULT 'standard' CHECK(text_size IN ('standard','large'));
