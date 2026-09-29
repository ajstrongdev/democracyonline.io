-- PostgreSQL delivers NOTIFY only when the transaction commits. The payload
-- contains a public domain name, never user IDs, row IDs or private content.
CREATE FUNCTION oscana_notify_public_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('oscana_public_changes', TG_ARGV[0]);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER oscana_social_posts_change AFTER INSERT OR UPDATE OR DELETE ON social_posts FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('social');
--> statement-breakpoint
CREATE TRIGGER oscana_social_comments_change AFTER INSERT OR UPDATE OR DELETE ON social_comments FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('social');
--> statement-breakpoint
CREATE TRIGGER oscana_social_reposts_change AFTER INSERT OR DELETE ON social_reposts FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('social');
--> statement-breakpoint
CREATE TRIGGER oscana_social_likes_change AFTER INSERT OR DELETE ON social_likes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('social');
--> statement-breakpoint
CREATE TRIGGER oscana_social_dislikes_change AFTER INSERT OR DELETE ON social_dislikes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('social');
--> statement-breakpoint
CREATE TRIGGER oscana_social_comment_likes_change AFTER INSERT OR DELETE ON social_comment_likes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('social');
--> statement-breakpoint
CREATE TRIGGER oscana_social_comment_dislikes_change AFTER INSERT OR DELETE ON social_comment_dislikes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('social');
--> statement-breakpoint
CREATE TRIGGER oscana_feed_change AFTER INSERT OR UPDATE OR DELETE ON feed FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('dashboard');
--> statement-breakpoint
CREATE TRIGGER oscana_bills_change AFTER INSERT OR UPDATE OR DELETE ON bills FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('dashboard');
--> statement-breakpoint
CREATE TRIGGER oscana_elections_change AFTER INSERT OR UPDATE OR DELETE ON elections FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('dashboard');
--> statement-breakpoint
CREATE TRIGGER oscana_candidates_change AFTER INSERT OR UPDATE OR DELETE ON candidates FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('dashboard');
--> statement-breakpoint
CREATE TRIGGER oscana_parties_change AFTER INSERT OR UPDATE OR DELETE ON parties FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('dashboard');
--> statement-breakpoint
CREATE TRIGGER oscana_nations_change AFTER INSERT OR UPDATE OR DELETE ON nations FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('dashboard');
