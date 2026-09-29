-- A recipient/action key is remembered after delivery (or a quiet-hours skip)
-- so the scheduler does not repeatedly notify about the same pending decision.
CREATE TABLE notification_next_move_receipts (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  handled_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, action_key)
);
