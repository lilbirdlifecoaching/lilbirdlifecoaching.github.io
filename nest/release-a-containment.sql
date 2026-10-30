-- Temporary containment only. Use this if nest/release-a-hotfix.sql cannot be
-- pasted in this session. Do not run it after the hotfix. Doing so would block
-- a claim that the checked function would allow.
--
-- Revokes client execution of the current function. Does not replace the
-- function, does not grant any new permission, and does not delete or update
-- member rows or entitlements.

revoke execute on function public.link_deep_profile_to_user(text) from public, anon, authenticated;
