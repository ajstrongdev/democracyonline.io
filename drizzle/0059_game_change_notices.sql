-- The payload is only a domain signal. Authenticated clients reload their own
-- route data; no row IDs, user IDs, or private values leave PostgreSQL.
CREATE TRIGGER oscana_live_user_create_delete AFTER INSERT OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_user_profile_update AFTER UPDATE OF username, role, party_id, photo_url, is_active ON users FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_stances_change AFTER INSERT OR UPDATE OR DELETE ON party_stances FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_merge_requests_change AFTER INSERT OR UPDATE OR DELETE ON merge_request FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_merge_request_stances_change AFTER INSERT OR UPDATE OR DELETE ON merge_request_stances FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_notifications_change AFTER INSERT OR UPDATE OR DELETE ON party_notifications FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coalitions_change AFTER INSERT OR UPDATE OR DELETE ON coalitions FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coalition_members_change AFTER INSERT OR UPDATE OR DELETE ON coalition_members FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coalition_former_members_change AFTER INSERT OR UPDATE OR DELETE ON coalition_former_members FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_join_requests_change AFTER INSERT OR UPDATE OR DELETE ON join_requests FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coalition_proposals_change AFTER INSERT OR UPDATE OR DELETE ON coalition_proposals FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coalition_votes_change AFTER INSERT OR UPDATE OR DELETE ON coalition_votes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_nation_stat_values_change AFTER INSERT OR UPDATE OR DELETE ON nation_stat_values FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_nation_policy_values_change AFTER INSERT OR UPDATE OR DELETE ON nation_policy_values FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_nation_changes_change AFTER INSERT OR UPDATE OR DELETE ON nation_changes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_committee_assessments_change AFTER INSERT OR UPDATE OR DELETE ON committee_assessments FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_committee_stat_assessments_change AFTER INSERT OR UPDATE OR DELETE ON committee_stat_assessments FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_committee_policy_assessments_change AFTER INSERT OR UPDATE OR DELETE ON committee_policy_assessments FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_bill_votes_house_change AFTER INSERT OR UPDATE OR DELETE ON bill_votes_house FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_bill_votes_senate_change AFTER INSERT OR UPDATE OR DELETE ON bill_votes_senate FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_bill_votes_presidential_change AFTER INSERT OR UPDATE OR DELETE ON bill_votes_presidential FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_election_night_updates_change AFTER INSERT OR UPDATE OR DELETE ON election_night_updates FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_election_history_change AFTER INSERT OR UPDATE OR DELETE ON election_history FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_election_candidate_history_change AFTER INSERT OR UPDATE OR DELETE ON election_candidate_history FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_election_officeholder_history_change AFTER INSERT OR UPDATE OR DELETE ON election_officeholder_history FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coup_history_change AFTER INSERT OR UPDATE OR DELETE ON coup_history FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coup_officeholder_history_change AFTER INSERT OR UPDATE OR DELETE ON coup_officeholder_history FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_coup_role_changes_change AFTER INSERT OR UPDATE OR DELETE ON coup_role_changes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_archived_parties_change AFTER INSERT OR UPDATE OR DELETE ON archived_parties FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_party_membership_events_change AFTER INSERT OR UPDATE OR DELETE ON party_membership_events FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_wiki_articles_change AFTER INSERT OR UPDATE OR DELETE ON wiki_articles FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_wiki_article_revisions_change AFTER INSERT OR UPDATE OR DELETE ON wiki_article_revisions FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_primary_candidates_change AFTER INSERT OR UPDATE OR DELETE ON primary_candidates FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_primary_votes_change AFTER INSERT OR UPDATE OR DELETE ON primary_votes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_votes_change AFTER INSERT OR UPDATE OR DELETE ON votes FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_chats_change AFTER INSERT OR UPDATE OR DELETE ON chats FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_bill_comments_change AFTER INSERT OR UPDATE OR DELETE ON bill_comments FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_bill_party_whips_change AFTER INSERT OR UPDATE OR DELETE ON bill_party_whips FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_organization_lifecycle_change AFTER INSERT OR UPDATE OR DELETE ON organization_lifecycle_events FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_player_invitations_change AFTER INSERT OR UPDATE OR DELETE ON player_invitations FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_player_reports_change AFTER INSERT OR UPDATE OR DELETE ON player_reports FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_moderation_flags_change AFTER INSERT OR UPDATE OR DELETE ON moderation_flags FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_moderation_audit_log_change AFTER INSERT OR UPDATE OR DELETE ON moderation_audit_log FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
--> statement-breakpoint
CREATE TRIGGER oscana_live_game_settings_change AFTER INSERT OR UPDATE OR DELETE ON game_settings FOR EACH ROW EXECUTE FUNCTION oscana_notify_public_change('game');
