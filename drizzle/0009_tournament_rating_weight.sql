ALTER TABLE tournaments ADD rating_weight integer NOT NULL DEFAULT 2 CHECK (rating_weight IN (2,3));
