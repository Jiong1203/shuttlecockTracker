drop extension if exists "pg_net";


  create table "public"."groups" (
    "id" uuid not null default gen_random_uuid(),
    "name" text not null,
    "created_by" uuid,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "contact_email" text,
    "restock_password" text
      );


alter table "public"."groups" enable row level security;


  create table "public"."pickup_records" (
    "id" uuid not null default gen_random_uuid(),
    "picker_name" text not null,
    "quantity" integer not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "group_id" uuid not null,
    "shuttlecock_type_id" uuid not null
      );


alter table "public"."pickup_records" enable row level security;


  create table "public"."profiles" (
    "id" uuid not null,
    "group_id" uuid,
    "full_name" text,
    "updated_at" timestamp with time zone not null default timezone('utc'::text, now())
      );


alter table "public"."profiles" enable row level security;


  create table "public"."restock_records" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "shuttlecock_type_id" uuid not null,
    "quantity" integer not null,
    "unit_price" integer not null default 0,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "created_by" uuid
      );


alter table "public"."restock_records" enable row level security;


  create table "public"."shuttlecock_types" (
    "id" uuid not null default gen_random_uuid(),
    "group_id" uuid not null,
    "brand" text not null,
    "name" text not null,
    "is_active" boolean default true,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "created_by" uuid
      );


alter table "public"."shuttlecock_types" enable row level security;

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);

CREATE INDEX idx_pickup_records_group_created ON public.pickup_records USING btree (group_id, created_at DESC);

CREATE INDEX idx_pickup_records_type_group ON public.pickup_records USING btree (shuttlecock_type_id, group_id);

CREATE INDEX idx_restock_records_group_created ON public.restock_records USING btree (group_id, created_at);

CREATE INDEX idx_restock_records_type_group ON public.restock_records USING btree (shuttlecock_type_id, group_id);

CREATE INDEX idx_shuttlecock_types_group ON public.shuttlecock_types USING btree (group_id);

CREATE UNIQUE INDEX pickup_records_pkey ON public.pickup_records USING btree (id);

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);

CREATE UNIQUE INDEX restock_records_pkey ON public.restock_records USING btree (id);

CREATE UNIQUE INDEX shuttlecock_types_pkey ON public.shuttlecock_types USING btree (id);

alter table "public"."groups" add constraint "groups_pkey" PRIMARY KEY using index "groups_pkey";

alter table "public"."pickup_records" add constraint "pickup_records_pkey" PRIMARY KEY using index "pickup_records_pkey";

alter table "public"."profiles" add constraint "profiles_pkey" PRIMARY KEY using index "profiles_pkey";

alter table "public"."restock_records" add constraint "restock_records_pkey" PRIMARY KEY using index "restock_records_pkey";

alter table "public"."shuttlecock_types" add constraint "shuttlecock_types_pkey" PRIMARY KEY using index "shuttlecock_types_pkey";

alter table "public"."groups" add constraint "groups_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."groups" validate constraint "groups_created_by_fkey";

alter table "public"."pickup_records" add constraint "pickup_records_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) not valid;

alter table "public"."pickup_records" validate constraint "pickup_records_group_id_fkey";

alter table "public"."pickup_records" add constraint "pickup_records_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."pickup_records" validate constraint "pickup_records_quantity_check";

alter table "public"."pickup_records" add constraint "pickup_records_shuttlecock_type_id_fkey" FOREIGN KEY (shuttlecock_type_id) REFERENCES public.shuttlecock_types(id) not valid;

alter table "public"."pickup_records" validate constraint "pickup_records_shuttlecock_type_id_fkey";

alter table "public"."profiles" add constraint "profiles_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) not valid;

alter table "public"."profiles" validate constraint "profiles_group_id_fkey";

alter table "public"."profiles" add constraint "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."profiles" validate constraint "profiles_id_fkey";

alter table "public"."restock_records" add constraint "restock_records_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."restock_records" validate constraint "restock_records_created_by_fkey";

alter table "public"."restock_records" add constraint "restock_records_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) not valid;

alter table "public"."restock_records" validate constraint "restock_records_group_id_fkey";

alter table "public"."restock_records" add constraint "restock_records_quantity_check" CHECK ((quantity > 0)) not valid;

alter table "public"."restock_records" validate constraint "restock_records_quantity_check";

alter table "public"."restock_records" add constraint "restock_records_shuttlecock_type_id_fkey" FOREIGN KEY (shuttlecock_type_id) REFERENCES public.shuttlecock_types(id) not valid;

alter table "public"."restock_records" validate constraint "restock_records_shuttlecock_type_id_fkey";

alter table "public"."shuttlecock_types" add constraint "shuttlecock_types_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) not valid;

alter table "public"."shuttlecock_types" validate constraint "shuttlecock_types_created_by_fkey";

alter table "public"."shuttlecock_types" add constraint "shuttlecock_types_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) not valid;

alter table "public"."shuttlecock_types" validate constraint "shuttlecock_types_group_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.insert_pickup_record(p_picker_name text, p_quantity integer, p_group_id uuid, p_type_id uuid)
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
    INSERT INTO public.pickup_records (picker_name, quantity, group_id, shuttlecock_type_id)
    VALUES (p_picker_name, p_quantity, p_group_id, p_type_id)
    RETURNING *;
END;
$function$
;

create or replace view "public"."inventory_summary" as  WITH restock_stats AS (
         SELECT restock_records.shuttlecock_type_id,
            sum(restock_records.quantity) AS total_qty
           FROM public.restock_records
          GROUP BY restock_records.shuttlecock_type_id
        ), pickup_stats AS (
         SELECT pickup_records.shuttlecock_type_id,
            sum(pickup_records.quantity) AS total_qty
           FROM public.pickup_records
          GROUP BY pickup_records.shuttlecock_type_id
        )
 SELECT g.id AS group_id,
    st.id AS shuttlecock_type_id,
    st.brand,
    st.name,
    st.is_active,
    COALESCE(rs.total_qty, (0)::bigint) AS total_restocked,
    COALESCE(ps.total_qty, (0)::bigint) AS total_picked,
    (COALESCE(rs.total_qty, (0)::bigint) - COALESCE(ps.total_qty, (0)::bigint)) AS current_stock
   FROM (((public.groups g
     JOIN public.shuttlecock_types st ON ((g.id = st.group_id)))
     LEFT JOIN restock_stats rs ON ((st.id = rs.shuttlecock_type_id)))
     LEFT JOIN pickup_stats ps ON ((st.id = ps.shuttlecock_type_id)));


grant delete on table "public"."groups" to "anon";

grant insert on table "public"."groups" to "anon";

grant references on table "public"."groups" to "anon";

grant select on table "public"."groups" to "anon";

grant trigger on table "public"."groups" to "anon";

grant truncate on table "public"."groups" to "anon";

grant update on table "public"."groups" to "anon";

grant delete on table "public"."groups" to "authenticated";

grant insert on table "public"."groups" to "authenticated";

grant references on table "public"."groups" to "authenticated";

grant select on table "public"."groups" to "authenticated";

grant trigger on table "public"."groups" to "authenticated";

grant truncate on table "public"."groups" to "authenticated";

grant update on table "public"."groups" to "authenticated";

grant delete on table "public"."groups" to "service_role";

grant insert on table "public"."groups" to "service_role";

grant references on table "public"."groups" to "service_role";

grant select on table "public"."groups" to "service_role";

grant trigger on table "public"."groups" to "service_role";

grant truncate on table "public"."groups" to "service_role";

grant update on table "public"."groups" to "service_role";

grant delete on table "public"."pickup_records" to "anon";

grant insert on table "public"."pickup_records" to "anon";

grant references on table "public"."pickup_records" to "anon";

grant select on table "public"."pickup_records" to "anon";

grant trigger on table "public"."pickup_records" to "anon";

grant truncate on table "public"."pickup_records" to "anon";

grant update on table "public"."pickup_records" to "anon";

grant delete on table "public"."pickup_records" to "authenticated";

grant insert on table "public"."pickup_records" to "authenticated";

grant references on table "public"."pickup_records" to "authenticated";

grant select on table "public"."pickup_records" to "authenticated";

grant trigger on table "public"."pickup_records" to "authenticated";

grant truncate on table "public"."pickup_records" to "authenticated";

grant update on table "public"."pickup_records" to "authenticated";

grant delete on table "public"."pickup_records" to "service_role";

grant insert on table "public"."pickup_records" to "service_role";

grant references on table "public"."pickup_records" to "service_role";

grant select on table "public"."pickup_records" to "service_role";

grant trigger on table "public"."pickup_records" to "service_role";

grant truncate on table "public"."pickup_records" to "service_role";

grant update on table "public"."pickup_records" to "service_role";

grant delete on table "public"."profiles" to "anon";

grant insert on table "public"."profiles" to "anon";

grant references on table "public"."profiles" to "anon";

grant select on table "public"."profiles" to "anon";

grant trigger on table "public"."profiles" to "anon";

grant truncate on table "public"."profiles" to "anon";

grant update on table "public"."profiles" to "anon";

grant delete on table "public"."profiles" to "authenticated";

grant insert on table "public"."profiles" to "authenticated";

grant references on table "public"."profiles" to "authenticated";

grant select on table "public"."profiles" to "authenticated";

grant trigger on table "public"."profiles" to "authenticated";

grant truncate on table "public"."profiles" to "authenticated";

grant update on table "public"."profiles" to "authenticated";

grant delete on table "public"."profiles" to "service_role";

grant insert on table "public"."profiles" to "service_role";

grant references on table "public"."profiles" to "service_role";

grant select on table "public"."profiles" to "service_role";

grant trigger on table "public"."profiles" to "service_role";

grant truncate on table "public"."profiles" to "service_role";

grant update on table "public"."profiles" to "service_role";

grant delete on table "public"."restock_records" to "anon";

grant insert on table "public"."restock_records" to "anon";

grant references on table "public"."restock_records" to "anon";

grant select on table "public"."restock_records" to "anon";

grant trigger on table "public"."restock_records" to "anon";

grant truncate on table "public"."restock_records" to "anon";

grant update on table "public"."restock_records" to "anon";

grant delete on table "public"."restock_records" to "authenticated";

grant insert on table "public"."restock_records" to "authenticated";

grant references on table "public"."restock_records" to "authenticated";

grant select on table "public"."restock_records" to "authenticated";

grant trigger on table "public"."restock_records" to "authenticated";

grant truncate on table "public"."restock_records" to "authenticated";

grant update on table "public"."restock_records" to "authenticated";

grant delete on table "public"."restock_records" to "service_role";

grant insert on table "public"."restock_records" to "service_role";

grant references on table "public"."restock_records" to "service_role";

grant select on table "public"."restock_records" to "service_role";

grant trigger on table "public"."restock_records" to "service_role";

grant truncate on table "public"."restock_records" to "service_role";

grant update on table "public"."restock_records" to "service_role";

grant delete on table "public"."shuttlecock_types" to "anon";

grant insert on table "public"."shuttlecock_types" to "anon";

grant references on table "public"."shuttlecock_types" to "anon";

grant select on table "public"."shuttlecock_types" to "anon";

grant trigger on table "public"."shuttlecock_types" to "anon";

grant truncate on table "public"."shuttlecock_types" to "anon";

grant update on table "public"."shuttlecock_types" to "anon";

grant delete on table "public"."shuttlecock_types" to "authenticated";

grant insert on table "public"."shuttlecock_types" to "authenticated";

grant references on table "public"."shuttlecock_types" to "authenticated";

grant select on table "public"."shuttlecock_types" to "authenticated";

grant trigger on table "public"."shuttlecock_types" to "authenticated";

grant truncate on table "public"."shuttlecock_types" to "authenticated";

grant update on table "public"."shuttlecock_types" to "authenticated";

grant delete on table "public"."shuttlecock_types" to "service_role";

grant insert on table "public"."shuttlecock_types" to "service_role";

grant references on table "public"."shuttlecock_types" to "service_role";

grant select on table "public"."shuttlecock_types" to "service_role";

grant trigger on table "public"."shuttlecock_types" to "service_role";

grant truncate on table "public"."shuttlecock_types" to "service_role";

grant update on table "public"."shuttlecock_types" to "service_role";


  create policy "Users can create groups"
  on "public"."groups"
  as permissive
  for insert
  to public
with check (((auth.role() = 'authenticated'::text) AND (created_by = auth.uid())));



  create policy "Users can update their own group"
  on "public"."groups"
  as permissive
  for update
  to public
using (((id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (created_by = auth.uid())));



  create policy "Users can view their own group"
  on "public"."groups"
  as permissive
  for select
  to public
using (((id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (created_by = auth.uid())));



  create policy "Group members can access pickup_records"
  on "public"."pickup_records"
  as permissive
  for all
  to public
using ((group_id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "Users can create own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((auth.uid() = id));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((auth.uid() = id));



  create policy "Group members can create restock"
  on "public"."restock_records"
  as permissive
  for insert
  to public
with check ((group_id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "Group members can delete restock"
  on "public"."restock_records"
  as permissive
  for delete
  to public
using ((group_id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "Group members can update restock"
  on "public"."restock_records"
  as permissive
  for update
  to public
using ((group_id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "Group members can view restock"
  on "public"."restock_records"
  as permissive
  for select
  to public
using ((group_id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



  create policy "Group admins can manage types"
  on "public"."shuttlecock_types"
  as permissive
  for all
  to public
using (((group_id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.groups
  WHERE ((groups.id = shuttlecock_types.group_id) AND (groups.created_by = auth.uid()))))));



  create policy "Group members can view types"
  on "public"."shuttlecock_types"
  as permissive
  for select
  to public
using ((group_id = ( SELECT profiles.group_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))));



