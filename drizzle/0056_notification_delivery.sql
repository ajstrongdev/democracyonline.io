CREATE TABLE notification_preferences (
  user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  in_app_mentions boolean NOT NULL DEFAULT true,
  push_mentions boolean NOT NULL DEFAULT false,
  push_preview boolean NOT NULL DEFAULT false,
  quiet_start integer,
  quiet_end integer,
  time_zone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_quiet_hours_pair CHECK ((quiet_start IS NULL) = (quiet_end IS NULL)),
  CONSTRAINT notification_quiet_start_range CHECK (quiet_start IS NULL OR quiet_start BETWEEN 0 AND 1439),
  CONSTRAINT notification_quiet_end_range CHECK (quiet_end IS NULL OR quiet_end BETWEEN 0 AND 1439)
);
--> statement-breakpoint
CREATE TABLE notification_push_subscriptions (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX notification_push_subscriptions_user_idx ON notification_push_subscriptions(user_id);
--> statement-breakpoint
CREATE TABLE notification_outbox (
  id bigserial PRIMARY KEY,
  source_type text NOT NULL CHECK (source_type IN ('post', 'comment')),
  source_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  processed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  UNIQUE (source_type, source_id)
);
--> statement-breakpoint
CREATE INDEX notification_outbox_pending_idx ON notification_outbox(available_at, id) WHERE processed_at IS NULL;
--> statement-breakpoint
CREATE FUNCTION oscana_queue_mention_push() RETURNS trigger AS $$
BEGIN
  INSERT INTO notification_outbox (source_type, source_id) VALUES (TG_ARGV[0], NEW.id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER oscana_queue_post_push AFTER INSERT ON social_posts FOR EACH ROW EXECUTE FUNCTION oscana_queue_mention_push('post');
--> statement-breakpoint
CREATE TRIGGER oscana_queue_comment_push AFTER INSERT ON social_comments FOR EACH ROW EXECUTE FUNCTION oscana_queue_mention_push('comment');
