CREATE OR REPLACE FUNCTION public.delete_contract(_contract_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner uuid;
  _is_admin boolean;
  _is_accountant boolean;
  _is_finance boolean;
  _is_manager_chung boolean;
BEGIN
  SELECT created_by INTO _owner
  FROM public.contracts
  WHERE id = _contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Không tìm thấy hợp đồng này.';
  END IF;

  _is_admin := public.has_role(auth.uid(), 'admin');
  _is_accountant := public.has_role(auth.uid(), 'accountant');
  _is_finance := public.has_role(auth.uid(), 'finance');
  _is_manager_chung := public.has_role(auth.uid(), 'manager_chung');

  IF NOT _is_admin THEN
    IF auth.uid() != _owner THEN
      RAISE EXCEPTION 'Bạn không có quyền xóa hợp đồng của người khác.';
    END IF;
    IF NOT (_is_accountant OR _is_finance OR _is_manager_chung) THEN
      RAISE EXCEPTION 'Bạn không có quyền xóa hợp đồng.';
    END IF;
  END IF;

  DELETE FROM public.contract_payment_schedules WHERE contract_id = _contract_id;
  DELETE FROM public.edit_logs WHERE record_id = _contract_id AND table_name = 'contracts';
  DELETE FROM public.contracts WHERE id = _contract_id;
END;
$function$;