# ownership_rls_001_v1.1 — complete proposal for approval

**REVIEW ONLY. Production execution is not authorized.** This is a review document, not an automatically applied migration file. The supported database workflow can generate migration artifacts after separately authorized execution; no file under `supabase/migrations/` has been manually created.

Source: complete `ownership_rls_001_v1` SQL from this conversation. The only functional substitution is the exact `crm_add_lead_activity` definition supplied by the user, using merchant SHARE locking followed by lead UPDATE locking with relationship/ownership rechecks. All other original SQL, including the original outer dollar-quote label and drift fingerprints, is retained. No Shared Feed, history, architecture redesign, ownership backfill or business-record deletion is included.

## Consolidated syntax/dependency review

- Completed one static review of the consolidated SQL: dollar-quote boundaries, statement termination, PL/pgSQL control flow, DDL order, trigger ordering, function signatures, policy references and the supplied two-statement locking form. No additional syntax or missing-dependency error was identified by inspection.
- Read-only live schema inspection confirmed the referenced columns, existing policies, existing constraints and trigger relationships.
- One consolidated read-only catalog query confirmed all 13 referenced existing function signatures and all five named roles are present. The proposed owner column, helper, guard, index, FK constraint and ownership triggers do not already exist.
- Current policy fingerprint: `956503116da5b5383b79358c6c53f898`, matching the original guard.
- Current CRM function-definition/ACL fingerprint: `509145c394fe66e4ad3a2d2ecee4a6eb`, matching the original guard.
- The ownership column is created before the access helper; that helper is created before the replacement RPCs and policies that reference it.
- **Not performed:** PostgreSQL parser/compiler execution of the proposed DO block or its function bodies, migration execution, transaction rehearsal, account-isolation tests, concurrency tests, build, deployment or push. Static review and catalog checks are not proof of runtime success. No PostgreSQL process/parser runner is available in this session, and applying even rolled-back DDL to production is not authorized.
- No unresolved syntax/dependency errors were identified in this review. Runtime compilation, behavior and concurrency remain unverified. Drift guards must still pass at any future approved execution; a matching snapshot is not a guarantee against later changes.
- The reported `merchantiq-schema.sql` export is schema-only, not a full business-data backup. Backup/recovery readiness has not been verified here. Final production approval is still required.

## Complete proposed migration

```sql
DO $ownership_rls_001_v1$
DECLARE
  actual_policies text;
  actual_functions text;
  entity text;
BEGIN
  PERFORM pg_catalog.set_config('lock_timeout', '5s', true);

  LOCK TABLE
    public.merchants,
    public.contacts,
    public.leads,
    public.lead_activities,
    public.lead_quality_scores
  IN SHARE ROW EXCLUSIVE MODE;

  -- Refuse unexpected policy/function drift.
  SELECT md5(string_agg(
    format(
      '%s|%s|%s|%s|%s|%s|%s|%s',
      schemaname, tablename, policyname, cmd,
      permissive, roles::text,
      coalesce(qual, ''), coalesce(with_check, '')
    ),
    E'\n' ORDER BY tablename, policyname
  ))
  INTO actual_policies
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'merchants', 'contacts', 'leads',
      'lead_activities', 'lead_quality_scores'
    );

  SELECT md5(string_agg(
    pg_catalog.pg_get_functiondef(p.oid)
      || coalesce(p.proacl::text, ''),
    E'\n' ORDER BY p.oid::regprocedure::text
  ))
  INTO actual_functions
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n
    ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname LIKE 'crm_%'
    AND p.prokind = 'f';

  IF actual_policies IS DISTINCT FROM
       '956503116da5b5383b79358c6c53f898'
     OR actual_functions IS DISTINCT FROM
       '509145c394fe66e4ad3a2d2ecee4a6eb'
  THEN
    RAISE EXCEPTION
      'CRM security definitions changed; re-review migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'merchants'
      AND column_name = 'ownerId'
  ) THEN
    RAISE EXCEPTION 'Ownership migration is already present';
  END IF;

  IF to_regprocedure(
       'public.crm_can_access_merchant(uuid)'
     ) IS NOT NULL
     OR to_regprocedure(
       'public.crm_ownership_guard()'
     ) IS NOT NULL
  THEN
    RAISE EXCEPTION 'Ownership function name collision';
  END IF;

  -- No default or ownership inference for existing rows.
  ALTER TABLE public.merchants
    ADD COLUMN "ownerId" uuid,
    ADD CONSTRAINT merchants_owner_profile_fk
      FOREIGN KEY ("ownerId")
      REFERENCES public.profiles(id)
      ON DELETE SET NULL;

  CREATE INDEX merchants_owner_record_idx
    ON public.merchants ("ownerId", id);

  CREATE FUNCTION public.crm_can_access_merchant(
    p_merchant_id uuid
  )
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $function$
    SELECT public.crm_access()
      AND EXISTS (
        SELECT 1
        FROM public.merchants m
        WHERE m.id = p_merchant_id
          AND (
            public.crm_access(true)
            OR m."ownerId" = auth.uid()
          )
      );
  $function$;

  REVOKE ALL ON FUNCTION
    public.crm_can_access_merchant(uuid)
    FROM PUBLIC, anon, authenticated, service_role;

  GRANT EXECUTE ON FUNCTION
    public.crm_can_access_merchant(uuid)
    TO authenticated;

  -- Invoker security preserves the distinction between
  -- authenticated clients and trusted backend/DB writers.
  CREATE FUNCTION public.crm_ownership_guard()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
  AS $function$
  DECLARE
    is_admin boolean;
  BEGIN
    -- These principals already have trusted database/backend
    -- privileges. No browser receives these credentials.
    IF current_user IN (
      'postgres', 'supabase_admin', 'service_role'
    ) THEN
      RETURN NEW;
    END IF;

    IF NOT public.crm_access() THEN
      RAISE EXCEPTION 'Record unavailable'
        USING ERRCODE = '42501';
    END IF;

    is_admin := public.crm_access(true);

    IF TG_TABLE_NAME = 'merchants' THEN
      IF TG_OP = 'INSERT' AND NOT is_admin THEN
        IF NEW."ownerId" IS NOT NULL
           AND NEW."ownerId" IS DISTINCT FROM auth.uid()
        THEN
          RAISE EXCEPTION 'Record unavailable'
            USING ERRCODE = '42501';
        END IF;

        NEW."ownerId" := auth.uid();

      ELSIF TG_OP = 'UPDATE' AND NOT is_admin THEN
        IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
          RAISE EXCEPTION 'Record unavailable'
            USING ERRCODE = '42501';
        END IF;
      END IF;

      IF NEW."ownerId" IS NOT NULL THEN
        IF TG_OP = 'INSERT'
           OR NEW."ownerId" IS DISTINCT FROM OLD."ownerId"
        THEN
          IF NOT EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = NEW."ownerId"
              AND p.status = 'approved'
          ) THEN
            RAISE EXCEPTION
              'Owner must be an approved account'
              USING ERRCODE = '23514';
          END IF;
        END IF;
      END IF;

      IF NEW."primaryContactId" IS NOT NULL
         AND NOT EXISTS (
           SELECT 1
           FROM public.contacts c
           WHERE c.id = NEW."primaryContactId"
             AND c."merchantId" = NEW.id
         )
      THEN
        RAISE EXCEPTION 'Record unavailable'
          USING ERRCODE = '42501';
      END IF;

    ELSE
      -- Check and stabilize access to the destination merchant
      -- before existing contact-move side effects can execute.
      PERFORM m.id
      FROM public.merchants m
      WHERE m.id = NEW."merchantId"
      FOR SHARE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Record unavailable'
          USING ERRCODE = '42501';
      END IF;

      IF TG_TABLE_NAME = 'leads' THEN
        IF NEW."contactId" IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM public.contacts c
             WHERE c.id = NEW."contactId"
               AND c."merchantId" = NEW."merchantId"
           )
        THEN
          RAISE EXCEPTION 'Record unavailable'
            USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;

    RETURN NEW;
  END;
  $function$;

  REVOKE ALL ON FUNCTION public.crm_ownership_guard()
    FROM PUBLIC, anon, authenticated, service_role;

  -- Runs before contacts_move and the timestamp triggers.
  CREATE TRIGGER aa_crm_ownership_guard
    BEFORE INSERT OR UPDATE ON public.merchants
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_ownership_guard();

  CREATE TRIGGER aa_crm_ownership_guard
    BEFORE INSERT OR UPDATE ON public.contacts
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_ownership_guard();

  CREATE TRIGGER aa_crm_ownership_guard
    BEFORE INSERT OR UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.crm_ownership_guard();

  CREATE OR REPLACE FUNCTION
    public.crm_validate_assignment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = ''
  AS $function$
  BEGIN
    IF NEW."assignedUser" IS NOT NULL
       AND (
         TG_OP = 'INSERT'
         OR NEW."assignedUser"
              IS DISTINCT FROM OLD."assignedUser"
       )
    THEN
      IF current_user NOT IN (
           'postgres', 'supabase_admin', 'service_role'
         )
         AND NOT public.crm_access(true)
         AND NEW."assignedUser" IS DISTINCT FROM auth.uid()
      THEN
        RAISE EXCEPTION 'Record unavailable'
          USING ERRCODE = '42501';
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = NEW."assignedUser"
          AND p.status = 'approved'
      ) THEN
        RAISE EXCEPTION
          'Lead assignee must be an approved user'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    RETURN NEW;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.crm_user_directory()
  RETURNS TABLE(id uuid, name text)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $function$
  BEGIN
    IF NOT public.crm_access() THEN
      RAISE EXCEPTION 'Approved account required'
        USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
      p.id,
      coalesce(nullif(p.name, ''), p.email)
    FROM public.profiles p
    WHERE p.status = 'approved'
      AND (
        public.crm_access(true)
        OR p.id = auth.uid()
      )
    ORDER BY p.name, p.id;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.crm_add_lead_activity(
    p_lead_id uuid, p_kind text, p_body text
  ) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
  AS $function$
  DECLARE
    result uuid;
    locked_merchant_id uuid;
  BEGIN
    IF NOT public.crm_access() THEN
      RAISE EXCEPTION 'Record unavailable' USING ERRCODE='42501';
    END IF;

    SELECT m.id INTO locked_merchant_id
    FROM public.merchants m
    JOIN public.leads l ON l."merchantId" = m.id
    WHERE l.id = p_lead_id
      AND public.crm_can_access_merchant(m.id)
    FOR SHARE OF m;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Record unavailable' USING ERRCODE='42501';
    END IF;

    PERFORM l.id
    FROM public.leads l
    WHERE l.id = p_lead_id
      AND l."merchantId" = locked_merchant_id
      AND public.crm_can_access_merchant(l."merchantId")
    FOR UPDATE OF l;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Record unavailable' USING ERRCODE='42501';
    END IF;

    IF p_kind IS NULL OR p_kind NOT IN ('note','call') THEN
      RAISE EXCEPTION 'Only notes and call logs may be added manually';
    END IF;

    INSERT INTO public.lead_activities("leadId","actorId",kind,body)
    VALUES(p_lead_id,auth.uid(),p_kind,trim(p_body))
    RETURNING id INTO result;

    IF p_kind='call' THEN
      UPDATE public.leads
      SET "lastContact"=(now() AT TIME ZONE 'UTC')::date
      WHERE id=p_lead_id;
    END IF;

    RETURN result;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.crm_merchant_provenance(
    p_merchant_id uuid
  )
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
  AS $function$
  BEGIN
    IF NOT public.crm_access() THEN
      RAISE EXCEPTION 'Approved account required'
        USING ERRCODE = '42501';
    END IF;

    -- Same response for hidden and nonexistent merchants.
    IF NOT public.crm_can_access_merchant(p_merchant_id) THEN
      RETURN NULL;
    END IF;

    RETURN (
      SELECT jsonb_build_object(
        'source', i.source,
        'sourceRecordId', i."sourceRecordId",
        'stage', i.stage,
        'collectedAt', i."collectedAt",
        'ingestedAt', i."ingestedAt"
      )
      FROM public.imported_businesses i
      WHERE i."merchantId" = p_merchant_id
      ORDER BY i."ingestedAt" DESC, i.id DESC
      LIMIT 1
    );
  END;
  $function$;

  -- Keep existing search, counts, facets, exports and
  -- dashboard contracts, but explicitly enforce invoker RLS.
  ALTER FUNCTION public.crm_list(
    text, text, jsonb, text, boolean, integer, integer
  ) SECURITY INVOKER;

  ALTER FUNCTION public.crm_dashboard()
    SECURITY INVOKER;

  ALTER FUNCTION public.crm_filter_options(text)
    SECURITY INVOKER;

  ALTER FUNCTION public.crm_explore_leads(
    text, jsonb, text, text, boolean, integer, integer
  ) SECURITY INVOKER;

  ALTER FUNCTION public.crm_import_merchants(jsonb)
    SECURITY INVOKER;

  ALTER FUNCTION public.crm_pipeline_summary()
    SECURITY INVOKER;

  -- Contact-move side effects must obey the caller's RLS.
  ALTER FUNCTION public.crm_contact_move()
    SECURITY INVOKER;

  -- Replacements preserve existing EXECUTE grants.
  -- Explicitly maintain the anonymous/PUBLIC boundary.
  REVOKE ALL ON FUNCTION
    public.crm_user_directory(),
    public.crm_add_lead_activity(uuid, text, text),
    public.crm_merchant_provenance(uuid)
  FROM PUBLIC, anon;

  ALTER POLICY business_read ON public.merchants
    USING (
      public.crm_access(true)
      OR (
        public.crm_access()
        AND "ownerId" = auth.uid()
      )
    );

  ALTER POLICY business_insert ON public.merchants
    WITH CHECK (
      public.crm_access(true)
      OR (
        public.crm_access()
        AND "ownerId" = auth.uid()
      )
    );

  ALTER POLICY business_update ON public.merchants
    USING (
      public.crm_access(true)
      OR (
        public.crm_access()
        AND "ownerId" = auth.uid()
      )
    )
    WITH CHECK (
      public.crm_access(true)
      OR (
        public.crm_access()
        AND "ownerId" = auth.uid()
      )
    );

  FOREACH entity IN ARRAY ARRAY['contacts', 'leads']
  LOOP
    EXECUTE format(
      'ALTER POLICY business_read ON public.%I
       USING (
         public.crm_can_access_merchant("merchantId")
       )',
      entity
    );

    EXECUTE format(
      'ALTER POLICY business_insert ON public.%I
       WITH CHECK (
         public.crm_can_access_merchant("merchantId")
       )',
      entity
    );

    EXECUTE format(
      'ALTER POLICY business_update ON public.%I
       USING (
         public.crm_can_access_merchant("merchantId")
       )
       WITH CHECK (
         public.crm_can_access_merchant("merchantId")
       )',
      entity
    );
  END LOOP;

  ALTER POLICY approved_read ON public.lead_activities
    USING (
      public.crm_access(true)
      OR EXISTS (
        SELECT 1
        FROM public.leads l
        WHERE l.id = lead_activities."leadId"
      )
    );

  ALTER POLICY approved_read ON public.lead_quality_scores
    USING (
      public.crm_can_access_merchant("merchantId")
    );

  -- Existing admin_delete policies, profile security,
  -- signup/approval and scraper/raw-import policies stay intact.
  NOTIFY pgrst, 'reload schema';
END;
$ownership_rls_001_v1$;
```

## Approval boundary

This document contains the complete proposed SQL, not merely a function patch. It has not been applied and no runtime test has passed. Separate explicit approval of **ownership_rls_001_v1.1 as contained in this document** is required before production execution. The prior fail-closed rollback proposal is unchanged and is not part of the forward migration above. Any rollback or verification-fixture writes also require separate approval.
