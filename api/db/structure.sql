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
-- Name: active_storage_attachments fk_rails_c3b3935057; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.active_storage_attachments
    ADD CONSTRAINT fk_rails_c3b3935057 FOREIGN KEY (blob_id) REFERENCES public.active_storage_blobs(id);


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
-- PostgreSQL database dump complete
--

SET search_path TO "$user", public;

INSERT INTO "schema_migrations" (version) VALUES
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

