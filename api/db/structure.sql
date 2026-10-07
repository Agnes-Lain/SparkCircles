SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit_events_protect(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_events_protect() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_events are append-only';
  ELSIF TG_OP = 'TRUNCATE' THEN
    RAISE EXCEPTION 'audit_events cannot be truncated';
  ELSIF OLD.created_at > now() - interval '13 months' THEN
    RAISE EXCEPTION 'audit_events are kept at least 13 months';
  END IF;
  RETURN OLD;
END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: active_storage_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_storage_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    record_type character varying NOT NULL,
    record_id uuid NOT NULL,
    blob_id uuid NOT NULL,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: active_storage_blobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_storage_blobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key character varying NOT NULL,
    filename character varying NOT NULL,
    content_type character varying,
    metadata text,
    service_name character varying NOT NULL,
    byte_size bigint NOT NULL,
    checksum character varying,
    created_at timestamp(6) without time zone NOT NULL
);


--
-- Name: active_storage_variant_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.active_storage_variant_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blob_id uuid NOT NULL,
    variation_digest character varying NOT NULL
);


--
-- Name: allowlisted_jwts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allowlisted_jwts (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    jti character varying NOT NULL,
    aud character varying,
    exp timestamp(6) without time zone NOT NULL,
    last_used_at timestamp(6) without time zone NOT NULL,
    device_name character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    device_id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: ar_internal_metadata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ar_internal_metadata (
    key character varying NOT NULL,
    value character varying,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL
);


--
-- Name: audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    actor_id uuid,
    subject_user_id uuid,
    action character varying NOT NULL,
    fields character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    reason character varying,
    ip_address text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    note text
);


--
-- Name: circle_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circle_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    circle_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status character varying NOT NULL,
    role character varying DEFAULT 'member'::character varying NOT NULL,
    creator boolean DEFAULT false NOT NULL,
    requested_at timestamp(6) without time zone,
    decided_at timestamp(6) without time zone,
    joined_at timestamp(6) without time zone,
    admin_since timestamp(6) without time zone,
    seen_at timestamp(6) without time zone,
    dismissed_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT circle_memberships_admin_active_check CHECK ((((role)::text = 'member'::text) OR ((status)::text = 'active'::text))),
    CONSTRAINT circle_memberships_role_check CHECK (((role)::text = ANY ((ARRAY['member'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT circle_memberships_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying, 'declined'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'left'::character varying, 'removed'::character varying])::text[])))
);


--
-- Name: circle_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circle_reports (
    id uuid DEFAULT uuidv7() NOT NULL,
    circle_id uuid NOT NULL,
    reporter_id uuid,
    reported_user_id uuid,
    reason character varying NOT NULL,
    details text,
    resolved_at timestamp(6) without time zone,
    resolved_by_id uuid,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT circle_reports_reason_check CHECK (((reason)::text = ANY ((ARRAY['unsafe'::character varying, 'not_real_group'::character varying, 'inappropriate_behaviour'::character varying, 'child_safety'::character varying, 'fake_identity'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: circles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    area character varying NOT NULL,
    visibility character varying DEFAULT 'public'::character varying NOT NULL,
    premium_entitlement character varying,
    visibility_changed_at timestamp(6) without time zone,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    closes_on date,
    suspended_at timestamp(6) without time zone,
    closed_at timestamp(6) without time zone,
    created_by_id uuid,
    invite_token text,
    invite_token_digest character varying NOT NULL,
    invite_code text,
    invite_code_digest character varying NOT NULL,
    invite_enabled boolean DEFAULT true NOT NULL,
    invite_renewed_at timestamp(6) without time zone NOT NULL,
    last_request_email_at timestamp(6) without time zone,
    request_digest_due_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT circles_description_length_check CHECK (((description IS NULL) OR (char_length(description) <= 200))),
    CONSTRAINT circles_name_length_check CHECK (((char_length((name)::text) >= 3) AND (char_length((name)::text) <= 50))),
    CONSTRAINT circles_premium_entitlement_check CHECK (((premium_entitlement IS NULL) OR ((premium_entitlement)::text = 'test_phase_free'::text))),
    CONSTRAINT circles_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'suspended'::character varying, 'closed'::character varying])::text[]))),
    CONSTRAINT circles_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['public'::character varying, 'private'::character varying])::text[])))
);


--
-- Name: closed_account_statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.closed_account_statistics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    signup_month date NOT NULL,
    closure_month date NOT NULL,
    was_verified boolean NOT NULL
);


--
-- Name: data_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_exports (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    requested_at timestamp(6) without time zone NOT NULL,
    delivered_at timestamp(6) without time zone,
    expires_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT data_exports_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('ready'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: email_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_changes (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    previous_email text NOT NULL,
    new_email text NOT NULL,
    changed_at timestamp(6) without time zone NOT NULL,
    reported_at timestamp(6) without time zone,
    restored_at timestamp(6) without time zone,
    restored_by_id uuid,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    closed_at timestamp(6) without time zone,
    closed_by_id uuid
);


--
-- Name: event_circles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_circles (
    event_id uuid NOT NULL,
    circle_id uuid NOT NULL,
    created_at timestamp(6) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: event_participations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_participations (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    adults integer DEFAULT 1 NOT NULL,
    children integer DEFAULT 0 NOT NULL,
    places integer GENERATED ALWAYS AS ((adults + children)) STORED,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    status character varying DEFAULT 'accepted'::character varying NOT NULL,
    closed_reason character varying,
    requested_at timestamp(6) without time zone,
    decided_at timestamp(6) without time zone,
    pending_adults integer,
    pending_children integer,
    emergency_phone text,
    responsibility_acknowledged_at timestamp(6) without time zone,
    CONSTRAINT event_participations_closed_reason_check CHECK (((closed_reason IS NULL) OR ((closed_reason)::text = ANY ((ARRAY['full'::character varying, 'cancelled'::character varying, 'verification'::character varying])::text[])))),
    CONSTRAINT event_participations_counts_check CHECK (((adults >= 0) AND (children >= 0) AND (((adults + children) >= 1) AND ((adults + children) <= 100)))),
    CONSTRAINT event_participations_pending_counts_check CHECK ((((pending_adults IS NULL) = (pending_children IS NULL)) AND ((pending_adults IS NULL) OR ((pending_adults >= 0) AND (pending_children >= 0) AND (((pending_adults + pending_children) >= 1) AND ((pending_adults + pending_children) <= 100)))))),
    CONSTRAINT event_participations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'accepted'::character varying, 'declined'::character varying, 'withdrawn'::character varying, 'expired'::character varying, 'closed'::character varying])::text[])))
);


--
-- Name: event_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_reports (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_id uuid NOT NULL,
    reporter_id uuid,
    reason character varying NOT NULL,
    details text,
    resolved_at timestamp(6) without time zone,
    resolved_by_id uuid,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT event_reports_reason_check CHECK (((reason)::text = ANY ((ARRAY['dangerous_place'::character varying, 'suspicious_host'::character varying, 'inappropriate_content'::character varying, 'inappropriate_tag'::character varying, 'other'::character varying])::text[])))
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    host_id uuid,
    source character varying DEFAULT 'hosted'::character varying NOT NULL,
    external_id character varying,
    source_url character varying,
    series_id uuid,
    status character varying DEFAULT 'draft'::character varying NOT NULL,
    suspension_reason character varying,
    visibility character varying DEFAULT 'searchable'::character varying NOT NULL,
    join_rule character varying DEFAULT 'anyone'::character varying NOT NULL,
    title character varying(80),
    description text,
    category character varying,
    tags character varying[] DEFAULT '{}'::character varying[] NOT NULL,
    starts_at timestamp(6) without time zone,
    ends_at timestamp(6) without time zone,
    time_zone character varying DEFAULT 'Europe/Paris'::character varying NOT NULL,
    area character varying,
    exact_address text,
    places_total integer,
    places_taken integer DEFAULT 0 NOT NULL,
    age_min integer,
    age_max integer,
    published_at timestamp(6) without time zone,
    suspended_at timestamp(6) without time zone,
    cancelled_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    language character varying DEFAULT 'fr'::character varying NOT NULL,
    adult_required boolean DEFAULT true NOT NULL,
    approval_required boolean DEFAULT false NOT NULL,
    host_phone text,
    CONSTRAINT events_age_range_check CHECK ((((age_min IS NULL) OR ((age_min >= 0) AND (age_min <= 17))) AND ((age_max IS NULL) OR ((age_max >= 0) AND (age_max <= 17))) AND ((age_min IS NULL) OR (age_max IS NULL) OR (age_min <= age_max)))),
    CONSTRAINT events_category_check CHECK (((category)::text = ANY ((ARRAY['sport'::character varying, 'outdoors'::character varying, 'board_games'::character varying, 'video_games'::character varying, 'crafts'::character varying, 'music'::character varying, 'shows'::character varying, 'books'::character varying, 'workshops'::character varying, 'playdates'::character varying, 'other'::character varying])::text[]))),
    CONSTRAINT events_description_length_check CHECK (((description IS NULL) OR (char_length(description) <= 1000))),
    CONSTRAINT events_dropoff_join_rule_check CHECK ((adult_required OR ((join_rule)::text = 'verified_only'::text))),
    CONSTRAINT events_join_rule_check CHECK (((join_rule)::text = ANY ((ARRAY['anyone'::character varying, 'verified_only'::character varying])::text[]))),
    CONSTRAINT events_language_check CHECK (((language)::text = ANY ((ARRAY['fr'::character varying, 'en'::character varying])::text[]))),
    CONSTRAINT events_places_taken_check CHECK (((places_taken >= 0) AND ((places_total IS NULL) OR (places_taken <= places_total)))),
    CONSTRAINT events_places_total_check CHECK (((places_total IS NULL) OR ((places_total >= 1) AND (places_total <= 100)))),
    CONSTRAINT events_required_unless_draft_check CHECK ((((status)::text = 'draft'::text) OR ((title IS NOT NULL) AND (category IS NOT NULL) AND (starts_at IS NOT NULL) AND (ends_at IS NOT NULL) AND (area IS NOT NULL)))),
    CONSTRAINT events_source_check CHECK (((source)::text = ANY ((ARRAY['hosted'::character varying, 'open_data'::character varying])::text[]))),
    CONSTRAINT events_source_fields_check CHECK (((((source)::text = 'hosted'::text) AND (host_id IS NOT NULL) AND (((status)::text = 'draft'::text) OR ((exact_address IS NOT NULL) AND (places_total IS NOT NULL)))) OR (((source)::text = 'open_data'::text) AND (external_id IS NOT NULL) AND (source_url IS NOT NULL)))),
    CONSTRAINT events_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'suspended'::character varying, 'cancelled'::character varying, 'past'::character varying])::text[]))),
    CONSTRAINT events_suspension_reason_check CHECK (((suspension_reason IS NULL) OR ((suspension_reason)::text = ANY ((ARRAY['host_unverified'::character varying, 'admin'::character varying])::text[])))),
    CONSTRAINT events_tags_count_check CHECK ((cardinality(tags) <= 5)),
    CONSTRAINT events_time_order_check CHECK ((ends_at > starts_at)),
    CONSTRAINT events_title_length_check CHECK (((char_length((title)::text) >= 1) AND (char_length((title)::text) <= 80))),
    CONSTRAINT events_visibility_check CHECK (((visibility)::text = ANY ((ARRAY['searchable'::character varying, 'circles'::character varying])::text[])))
);


--
-- Name: guest_access_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_access_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    kind character varying NOT NULL,
    ip_hash character varying(32) NOT NULL,
    endpoint character varying(100) NOT NULL,
    created_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT guest_access_events_kind_check CHECK (((kind)::text = ANY ((ARRAY['rate_limited'::character varying, 'blocked'::character varying, 'client_refused'::character varying])::text[])))
);


--
-- Name: pending_event_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pending_event_notifications (
    id uuid DEFAULT uuidv7() NOT NULL,
    kind character varying NOT NULL,
    event_id uuid,
    host_id uuid,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    deliver_at timestamp(6) without time zone,
    throttle_until timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT pending_event_notifications_kind_check CHECK (((kind)::text = ANY ((ARRAY['host_activity'::character varying, 'event_changed'::character varying, 'host_status'::character varying])::text[]))),
    CONSTRAINT pending_event_notifications_subject_check CHECK (((event_id IS NULL) <> (host_id IS NULL)))
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    granted_by_id uuid,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    CONSTRAINT roles_name_check CHECK (((name)::text = ANY (ARRAY[('parent'::character varying)::text, ('admin'::character varying)::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT uuidv7() NOT NULL,
    first_name character varying NOT NULL,
    last_name text NOT NULL,
    email character varying NOT NULL,
    encrypted_password character varying DEFAULT ''::character varying NOT NULL,
    locale character varying DEFAULT 'fr'::character varying NOT NULL,
    reset_password_token character varying,
    reset_password_sent_at timestamp(6) without time zone,
    confirmation_token character varying,
    confirmed_at timestamp(6) without time zone,
    confirmation_sent_at timestamp(6) without time zone,
    unconfirmed_email character varying,
    failed_attempts integer DEFAULT 0 NOT NULL,
    last_failed_attempt_at timestamp(6) without time zone,
    unlock_token character varying,
    locked_at timestamp(6) without time zone,
    otp_secret character varying,
    consumed_timestep integer,
    otp_required_for_login boolean DEFAULT false NOT NULL,
    otp_backup_codes character varying[],
    city_shown text,
    date_of_birth text,
    verification_status character varying DEFAULT 'not_verified'::character varying NOT NULL,
    verification_expires_on text,
    verification_reminder_30_sent_at timestamp(6) without time zone,
    verification_reminder_7_sent_at timestamp(6) without time zone,
    adult_confirmed_at timestamp(6) without time zone,
    terms_version character varying,
    terms_accepted_at timestamp(6) without time zone,
    privacy_version character varying,
    privacy_accepted_at timestamp(6) without time zone,
    marketing_opt_in boolean DEFAULT false NOT NULL,
    marketing_opt_in_changed_at timestamp(6) without time zone,
    security_locked_at timestamp(6) without time zone,
    closed_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    admin_session_digest character varying,
    otp_failed_attempts integer DEFAULT 0 NOT NULL,
    otp_locked_until timestamp(6) without time zone,
    admin_pending_digest character varying,
    CONSTRAINT users_locale_check CHECK (((locale)::text = ANY (ARRAY[('fr'::character varying)::text, ('en'::character varying)::text]))),
    CONSTRAINT users_verification_status_check CHECK (((verification_status)::text = ANY (ARRAY[('not_verified'::character varying)::text, ('pending'::character varying)::text, ('verified'::character varying)::text, ('rejected'::character varying)::text, ('expired'::character varying)::text])))
);


--
-- Name: verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verifications (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id uuid NOT NULL,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    document_type character varying NOT NULL,
    submitted_at timestamp(6) without time zone NOT NULL,
    front_content_type character varying,
    back_content_type character varying,
    selfie_content_type character varying,
    decided_at timestamp(6) without time zone,
    reviewer_id uuid,
    document_expires_on text,
    rejection_reason character varying,
    note text,
    revoked_at timestamp(6) without time zone,
    revoked_by_id uuid,
    revocation_reason character varying,
    revocation_note text,
    files_purged_at timestamp(6) without time zone,
    created_at timestamp(6) without time zone NOT NULL,
    updated_at timestamp(6) without time zone NOT NULL,
    renewal boolean DEFAULT false NOT NULL,
    CONSTRAINT verifications_document_type_check CHECK (((document_type)::text = ANY (ARRAY[('passport'::character varying)::text, ('national_id_card'::character varying)::text, ('driving_licence'::character varying)::text, ('residence_permit'::character varying)::text, ('other_residence_card'::character varying)::text]))),
    CONSTRAINT verifications_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('approved'::character varying)::text, ('rejected'::character varying)::text])))
);


--
-- Name: active_storage_attachments active_storage_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_attachments
    ADD CONSTRAINT active_storage_attachments_pkey PRIMARY KEY (id);


--
-- Name: active_storage_blobs active_storage_blobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_blobs
    ADD CONSTRAINT active_storage_blobs_pkey PRIMARY KEY (id);


--
-- Name: active_storage_variant_records active_storage_variant_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_variant_records
    ADD CONSTRAINT active_storage_variant_records_pkey PRIMARY KEY (id);


--
-- Name: allowlisted_jwts allowlisted_jwts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowlisted_jwts
    ADD CONSTRAINT allowlisted_jwts_pkey PRIMARY KEY (id);


--
-- Name: ar_internal_metadata ar_internal_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ar_internal_metadata
    ADD CONSTRAINT ar_internal_metadata_pkey PRIMARY KEY (key);


--
-- Name: audit_events audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_events
    ADD CONSTRAINT audit_events_pkey PRIMARY KEY (id);


--
-- Name: circle_memberships circle_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_memberships
    ADD CONSTRAINT circle_memberships_pkey PRIMARY KEY (id);


--
-- Name: circle_reports circle_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_reports
    ADD CONSTRAINT circle_reports_pkey PRIMARY KEY (id);


--
-- Name: circles circles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circles
    ADD CONSTRAINT circles_pkey PRIMARY KEY (id);


--
-- Name: closed_account_statistics closed_account_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.closed_account_statistics
    ADD CONSTRAINT closed_account_statistics_pkey PRIMARY KEY (id);


--
-- Name: data_exports data_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_exports
    ADD CONSTRAINT data_exports_pkey PRIMARY KEY (id);


--
-- Name: email_changes email_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_changes
    ADD CONSTRAINT email_changes_pkey PRIMARY KEY (id);


--
-- Name: event_circles event_circles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_circles
    ADD CONSTRAINT event_circles_pkey PRIMARY KEY (event_id, circle_id);


--
-- Name: event_participations event_participations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_participations
    ADD CONSTRAINT event_participations_pkey PRIMARY KEY (id);


--
-- Name: event_reports event_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reports
    ADD CONSTRAINT event_reports_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: guest_access_events guest_access_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_access_events
    ADD CONSTRAINT guest_access_events_pkey PRIMARY KEY (id);


--
-- Name: pending_event_notifications pending_event_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_event_notifications
    ADD CONSTRAINT pending_event_notifications_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: verifications verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT verifications_pkey PRIMARY KEY (id);


--
-- Name: idx_on_event_id_status_requested_at_7ab2fcabe9; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_on_event_id_status_requested_at_7ab2fcabe9 ON public.event_participations USING btree (event_id, status, requested_at);


--
-- Name: index_active_storage_attachments_on_blob_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_active_storage_attachments_on_blob_id ON public.active_storage_attachments USING btree (blob_id);


--
-- Name: index_active_storage_attachments_uniqueness; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_active_storage_attachments_uniqueness ON public.active_storage_attachments USING btree (record_type, record_id, name, blob_id);


--
-- Name: index_active_storage_blobs_on_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_active_storage_blobs_on_key ON public.active_storage_blobs USING btree (key);


--
-- Name: index_active_storage_variant_records_uniqueness; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_active_storage_variant_records_uniqueness ON public.active_storage_variant_records USING btree (blob_id, variation_digest);


--
-- Name: index_allowlisted_jwts_on_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_allowlisted_jwts_on_jti ON public.allowlisted_jwts USING btree (jti);


--
-- Name: index_allowlisted_jwts_on_last_used_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_allowlisted_jwts_on_last_used_at ON public.allowlisted_jwts USING btree (last_used_at);


--
-- Name: index_allowlisted_jwts_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_allowlisted_jwts_on_user_id ON public.allowlisted_jwts USING btree (user_id);


--
-- Name: index_allowlisted_jwts_on_user_id_and_device_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_allowlisted_jwts_on_user_id_and_device_id ON public.allowlisted_jwts USING btree (user_id, device_id);


--
-- Name: index_audit_events_on_actor_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_audit_events_on_actor_id ON public.audit_events USING btree (actor_id);


--
-- Name: index_audit_events_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_audit_events_on_created_at ON public.audit_events USING btree (created_at);


--
-- Name: index_audit_events_on_subject_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_audit_events_on_subject_user_id ON public.audit_events USING btree (subject_user_id);


--
-- Name: index_circle_memberships_on_circle_id_and_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circle_memberships_on_circle_id_and_status ON public.circle_memberships USING btree (circle_id, status);


--
-- Name: index_circle_memberships_on_circle_id_and_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_circle_memberships_on_circle_id_and_user_id ON public.circle_memberships USING btree (circle_id, user_id);


--
-- Name: index_circle_memberships_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circle_memberships_on_user_id ON public.circle_memberships USING btree (user_id);


--
-- Name: index_circle_reports_on_circle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circle_reports_on_circle_id ON public.circle_reports USING btree (circle_id);


--
-- Name: index_circle_reports_on_reported_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circle_reports_on_reported_user_id ON public.circle_reports USING btree (reported_user_id);


--
-- Name: index_circle_reports_on_reporter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circle_reports_on_reporter_id ON public.circle_reports USING btree (reporter_id);


--
-- Name: index_circle_reports_on_resolved_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circle_reports_on_resolved_at ON public.circle_reports USING btree (resolved_at);


--
-- Name: index_circles_on_created_by_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circles_on_created_by_id ON public.circles USING btree (created_by_id);


--
-- Name: index_circles_on_invite_code_digest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_circles_on_invite_code_digest ON public.circles USING btree (invite_code_digest);


--
-- Name: index_circles_on_invite_token_digest; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_circles_on_invite_token_digest ON public.circles USING btree (invite_token_digest);


--
-- Name: index_circles_on_visibility_and_status_and_area; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_circles_on_visibility_and_status_and_area ON public.circles USING btree (visibility, status, area);


--
-- Name: index_data_exports_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_data_exports_on_user_id ON public.data_exports USING btree (user_id);


--
-- Name: index_email_changes_on_reported_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_email_changes_on_reported_at ON public.email_changes USING btree (reported_at);


--
-- Name: index_email_changes_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_email_changes_on_user_id ON public.email_changes USING btree (user_id);


--
-- Name: index_event_circles_on_circle_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_event_circles_on_circle_id ON public.event_circles USING btree (circle_id);


--
-- Name: index_event_participations_on_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_event_participations_on_event_id ON public.event_participations USING btree (event_id);


--
-- Name: index_event_participations_on_event_id_and_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_event_participations_on_event_id_and_user_id ON public.event_participations USING btree (event_id, user_id);


--
-- Name: index_event_participations_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_event_participations_on_user_id ON public.event_participations USING btree (user_id);


--
-- Name: index_event_reports_on_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_event_reports_on_event_id ON public.event_reports USING btree (event_id);


--
-- Name: index_event_reports_on_event_id_and_reporter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_event_reports_on_event_id_and_reporter_id ON public.event_reports USING btree (event_id, reporter_id);


--
-- Name: index_event_reports_on_reporter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_event_reports_on_reporter_id ON public.event_reports USING btree (reporter_id);


--
-- Name: index_event_reports_on_resolved_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_event_reports_on_resolved_at ON public.event_reports USING btree (resolved_at);


--
-- Name: index_events_on_area_and_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_events_on_area_and_starts_at ON public.events USING btree (area, starts_at);


--
-- Name: index_events_on_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_events_on_ends_at ON public.events USING btree (ends_at);


--
-- Name: index_events_on_host_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_events_on_host_id ON public.events USING btree (host_id);


--
-- Name: index_events_on_series_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_events_on_series_id ON public.events USING btree (series_id);


--
-- Name: index_events_on_source_and_external_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_events_on_source_and_external_id ON public.events USING btree (source, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: index_events_on_status_and_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_events_on_status_and_starts_at ON public.events USING btree (status, starts_at);


--
-- Name: index_events_on_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_events_on_tags ON public.events USING gin (tags);


--
-- Name: index_guest_access_events_on_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_guest_access_events_on_created_at ON public.guest_access_events USING btree (created_at);


--
-- Name: index_pending_event_notifications_on_kind_and_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_pending_event_notifications_on_kind_and_event_id ON public.pending_event_notifications USING btree (kind, event_id) WHERE (event_id IS NOT NULL);


--
-- Name: index_pending_event_notifications_on_kind_and_host_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_pending_event_notifications_on_kind_and_host_id ON public.pending_event_notifications USING btree (kind, host_id) WHERE (host_id IS NOT NULL);


--
-- Name: index_roles_on_user_id_and_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_roles_on_user_id_and_name ON public.roles USING btree (user_id, name);


--
-- Name: index_users_on_closed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_users_on_closed_at ON public.users USING btree (closed_at);


--
-- Name: index_users_on_confirmation_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_confirmation_token ON public.users USING btree (confirmation_token);


--
-- Name: index_users_on_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_email ON public.users USING btree (email);


--
-- Name: index_users_on_reset_password_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_reset_password_token ON public.users USING btree (reset_password_token);


--
-- Name: index_users_on_unlock_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_users_on_unlock_token ON public.users USING btree (unlock_token);


--
-- Name: index_users_on_verification_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_users_on_verification_status ON public.users USING btree (verification_status);


--
-- Name: index_verifications_on_decided_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_verifications_on_decided_at ON public.verifications USING btree (decided_at);


--
-- Name: index_verifications_on_status_and_submitted_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_verifications_on_status_and_submitted_at ON public.verifications USING btree (status, submitted_at);


--
-- Name: index_verifications_on_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX index_verifications_on_user_id ON public.verifications USING btree (user_id);


--
-- Name: index_verifications_one_pending_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX index_verifications_one_pending_per_user ON public.verifications USING btree (user_id) WHERE ((status)::text = 'pending'::text);


--
-- Name: audit_events audit_events_protect_rows; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_events_protect_rows BEFORE DELETE OR UPDATE ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.audit_events_protect();


--
-- Name: audit_events audit_events_protect_truncate; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_events_protect_truncate BEFORE TRUNCATE ON public.audit_events FOR EACH STATEMENT EXECUTE FUNCTION public.audit_events_protect();


--
-- Name: event_reports fk_rails_04ea0dec09; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reports
    ADD CONSTRAINT fk_rails_04ea0dec09 FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: circle_memberships fk_rails_1cb3a082eb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_memberships
    ADD CONSTRAINT fk_rails_1cb3a082eb FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: event_participations fk_rails_4cdd99d0ec; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_participations
    ADD CONSTRAINT fk_rails_4cdd99d0ec FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_exports fk_rails_5408e45594; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_exports
    ADD CONSTRAINT fk_rails_5408e45594 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: allowlisted_jwts fk_rails_77afa78cd5; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowlisted_jwts
    ADD CONSTRAINT fk_rails_77afa78cd5 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_circles fk_rails_85858795b2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_circles
    ADD CONSTRAINT fk_rails_85858795b2 FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: circle_reports fk_rails_85ca54828f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_reports
    ADD CONSTRAINT fk_rails_85ca54828f FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: active_storage_variant_records fk_rails_993965df05; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_variant_records
    ADD CONSTRAINT fk_rails_993965df05 FOREIGN KEY (blob_id) REFERENCES public.active_storage_blobs(id);


--
-- Name: roles fk_rails_ab35d699f0; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT fk_rails_ab35d699f0 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pending_event_notifications fk_rails_b090365f71; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_event_notifications
    ADD CONSTRAINT fk_rails_b090365f71 FOREIGN KEY (host_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: event_participations fk_rails_b0b78337cd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_participations
    ADD CONSTRAINT fk_rails_b0b78337cd FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_circles fk_rails_b1889e72a6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_circles
    ADD CONSTRAINT fk_rails_b1889e72a6 FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: circle_reports fk_rails_b1a3394781; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_reports
    ADD CONSTRAINT fk_rails_b1a3394781 FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: circle_memberships fk_rails_c039ff3c03; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_memberships
    ADD CONSTRAINT fk_rails_c039ff3c03 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: active_storage_attachments fk_rails_c3b3935057; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_attachments
    ADD CONSTRAINT fk_rails_c3b3935057 FOREIGN KEY (blob_id) REFERENCES public.active_storage_blobs(id);


--
-- Name: events fk_rails_d56a268962; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT fk_rails_d56a268962 FOREIGN KEY (host_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pending_event_notifications fk_rails_e3b0d44c91; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pending_event_notifications
    ADD CONSTRAINT fk_rails_e3b0d44c91 FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: email_changes fk_rails_ea8150c232; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_changes
    ADD CONSTRAINT fk_rails_ea8150c232 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: verifications fk_rails_f184078eb4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verifications
    ADD CONSTRAINT fk_rails_f184078eb4 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: circles fk_rails_f7bd788044; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circles
    ADD CONSTRAINT fk_rails_f7bd788044 FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: circle_reports fk_rails_fc28992d00; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circle_reports
    ADD CONSTRAINT fk_rails_fc28992d00 FOREIGN KEY (circle_id) REFERENCES public.circles(id) ON DELETE CASCADE;


--
-- Name: event_reports fk_rails_fc5bb17976; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_reports
    ADD CONSTRAINT fk_rails_fc5bb17976 FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
('20261008090000'),
('20261007090000'),
('20261006180000'),
('20261006150000'),
('20261006120000'),
('20261006090300'),
('20261006090200'),
('20261006090100'),
('20261006090000'),
('20261003150000'),
('20261003090300'),
('20261003090200'),
('20261003090100'),
('20261003090000'),
('20261002140700'),
('20261002140600'),
('20261002140500'),
('20261002140400'),
('20261002140300'),
('20261002140200'),
('20261002140100'),
('20261002140000'),
('20261002131527');

