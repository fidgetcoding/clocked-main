ALTER TABLE profiles ADD COLUMN equipped_glove TEXT DEFAULT 'default';
ALTER TABLE profiles ADD COLUMN unlocked_gloves JSONB DEFAULT '["default"]';