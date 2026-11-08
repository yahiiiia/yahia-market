# ownership_rls_001_v1.1 — approval-only SQL review

## Status

**Not applied.** The migration was originally proposed in chat and is not an existing executable repository migration file. This document records a replacement function and the review evidence; it does not introduce a second migration workflow or authorize execution. No production DDL, DML, fixture creation, account changes, frontend changes, push or deployment was performed for this review.

The proposed v1.1 release is exactly the previously shown `ownership_rls_001_v1` atomic DO block with its `crm_add_lead_activity` definition replaced by the definition below. All other migration statements and the previously shown fail-closed operational rollback remain unchanged. This remains the single-owner-per-merchant compatibility step, not the multi-workspace canonical model, Shared Feed or new history functionality.

## Locking clarification and revision

PostgreSQL 17.11 accepted a non-executing EXPLAIN of the original joined SELECT with `FOR UPDATE OF l FOR SHARE OF m`. PostgreSQL permits multiple locking clauses specifying different strengths for different tables; the original pair is not a PostgreSQL syntax error.

Nevertheless, the proposal now uses separate statements, preserving SHARE on the merchant and UPDATE on the lead instead of silently upgrading both to UPDATE. The merchant is locked first. The second statement rechecks both ownership and the captured merchant ID under the lead lock. A concurrent move to another merchant causes generic failure rather than writing while holding a lock on the wrong parent. Locks are held until the calling transaction ends.

### Exact replacement definition inside the proposed DO block

```sql
CREATE OR REPLACE FUNCTION public.crm_add_lead_activity(
  p_lead_id uuid,
  p_kind text,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result uuid;
  locked_merchant_id uuid;
BEGIN
  IF NOT public.crm_access() THEN
    RAISE EXCEPTION 'Record unavailable'
      USING ERRCODE = '42501';
  END IF;

  SELECT m.id
  INTO locked_merchant_id
  FROM public.merchants m
  JOIN public.leads l ON l."merchantId" = m.id
  WHERE l.id = p_lead_id
    AND public.crm_can_access_merchant(m.id)
  FOR SHARE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Record unavailable'
      USING ERRCODE = '42501';
  END IF;

  PERFORM l.id
  FROM public.leads l
  WHERE l.id = p_lead_id
    AND l."merchantId" = locked_merchant_id
    AND public.crm_can_access_merchant(l."merchantId")
  FOR UPDATE OF l;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Record unavailable'
      USING ERRCODE = '42501';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('note', 'call') THEN
    RAISE EXCEPTION
      'Only notes and call logs may be added manually';
  END IF;

  INSERT INTO public.lead_activities(
    "leadId", "actorId", kind, body
  )
  VALUES (p_lead_id, auth.uid(), p_kind, trim(p_body))
  RETURNING id INTO result;

  IF p_kind = 'call' THEN
    UPDATE public.leads
    SET "lastContact" = (now() AT TIME ZONE 'UTC')::date
    WHERE id = p_lead_id;
  END IF;

  RETURN result;
END;
$function$;
```

## Whole-migration review

Static review covered the original DO block, nested function definitions/dollar quotes, additive column/FK/index order, function signatures and return types, trigger creation/order, invoker/definer dependencies and privileges, dynamic ALTER POLICY statements, RLS dependency graph, NOTIFY, and the fail-closed operational rollback. No additional syntax/dependency errors were identified by that review. This is not a full PostgreSQL compilation or execution result.

### Live read-only evidence

- Server: PostgreSQL 17.11; executor role `postgres`.
- All 13 inspected existing function signatures resolve, including `auth.uid`, `crm_access`, list/dashboard/facets/Explorer/import/pipeline queries, contact move/assignment, directory, activity and provenance.
- Existing tables, referenced columns, profile UUID key, current composite relationship constraints, policy names and trigger order match the proposed dependencies.
- RLS is enabled on the relevant tables. Authenticated callers have existing SELECT/UPDATE grants on merchants/contacts/leads and SELECT on profiles; service-role SELECT on profiles is present. Activity/quality/import tables retain restricted authenticated writes.
- Required roles exist: anon, authenticated, service_role, postgres and supabase_admin.
- No collision found for `merchants.ownerId`, `merchants_owner_record_idx`, `merchants_owner_profile_fk`, `aa_crm_ownership_guard` on the three CRM tables, or the two proposed ownership helper/trigger functions.
- Policy fingerprint still equals `956503116da5b5383b79358c6c53f898`.
- Existing CRM function definition/ACL fingerprint still equals `509145c394fe66e4ad3a2d2ecee4a6eb`.
- These are pre-migration database fingerprints, so revising the proposed function body does not change their expected values. Recheck them before approved execution.
- Original combined lock grammar: non-executing EXPLAIN accepted.
- Revised merchant SHARE query and lead UPDATE query: separate non-executing EXPLAINs accepted using existing `crm_access()` in place of the not-yet-created ownership helper and fixed UUID constants in place of PL/pgSQL variables. They validate query structure and existing relation dependencies, not the final function's authorization behavior or full PL/pgSQL body.

The new ownership helper must be created after ownerId and before dependent policies/functions, as the original proposal does. Existing list/dashboard/facets/Explorer remain invoker functions, so their table queries, joins, duplicate flags and counts inherit RLS. Activity and provenance retain explicit checks despite definer privileges. Trigger-only function EXECUTE revocations do not require exposing the functions as browser RPCs; trigger creation is done by the privileged migration executor. Trusted DB/service-role writes remain privileged by design.

### Limits of this review

The complete DO block was not submitted to PostgreSQL for execution or temporary CREATE validation, even within a rolled-back transaction. Thus nested PL/pgSQL compilation, trigger execution, actual locks/races/deadlocks, SQL-role/real-session isolation, CRUD/import/export/scraper compatibility and the rollback behavior remain untested. EXPLAIN used no ANALYZE and did not execute the planned row-locking queries.

Existing count/ownership acceptance tests built for the future `merchant_workspaces` model are not suitable evidence for this narrower ownerId migration; it needs a separately reviewed test package and the two distinct salesperson accounts plus administrator verification already requested. No account or fixture writes are authorized by this document.

## Backup status

The owner reports a successful 53 KB production public-schema export named `merchantiq-schema.sql`. It was not present in the accessible workspace/attachment listing, so its contents, checksum and restorability were not independently inspected here.

A public-schema-only export is not a full database/data/Auth backup. It may assist restoration of included object definitions, but does not recover business rows, Auth accounts or post-export writes and must not be represented as verified full recovery coverage. Backup/PITR availability and restore readiness remain unverified.

## Final approval gate

Request explicit approval of **ownership_rls_001_v1.1: the original full migration with exactly the replacement function above**, acknowledging its single-owner scope, the schema-only export limitation, and the outstanding account/runtime tests. The existing rollback is fail-closed administrator-only containment, not a destructive structural down migration or restoration of shared access. No migration, rollback, fixture/account write, frontend deployment or GitHub push may be executed on the basis of this review alone.
