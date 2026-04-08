CREATE OR REPLACE FUNCTION public.insert_pickup_record(
  p_picker_name text,
  p_quantity integer,
  p_group_id uuid,
  p_type_id uuid,
  p_pickup_date timestamptz DEFAULT NOW()
)
RETURNS SETOF public.pickup_records
LANGUAGE plpgsql
AS $function$
DECLARE
    v_current_stock INTEGER;
BEGIN
    -- 鎖定球種列，讓並發請求排隊，防止超額領取
    PERFORM id FROM public.shuttlecock_types
    WHERE id = p_type_id AND group_id = p_group_id
    FOR UPDATE;

    -- 鎖定後重新計算庫存
    SELECT
        COALESCE((SELECT SUM(quantity) FROM public.restock_records
                  WHERE shuttlecock_type_id = p_type_id AND group_id = p_group_id), 0) -
        COALESCE((SELECT SUM(quantity) FROM public.pickup_records
                  WHERE shuttlecock_type_id = p_type_id AND group_id = p_group_id), 0)
    INTO v_current_stock;

    IF p_quantity > v_current_stock THEN
        RAISE EXCEPTION '庫存不足，目前僅剩 % 桶', v_current_stock;
    END IF;

    RETURN QUERY
    INSERT INTO public.pickup_records (picker_name, quantity, group_id, shuttlecock_type_id, created_at)
    VALUES (p_picker_name, p_quantity, p_group_id, p_type_id, p_pickup_date)
    RETURNING *;
END;
$function$;
