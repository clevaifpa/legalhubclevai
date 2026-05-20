REVOKE EXECUTE ON FUNCTION public.can_view_review_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_review_request(uuid, uuid) TO authenticated;