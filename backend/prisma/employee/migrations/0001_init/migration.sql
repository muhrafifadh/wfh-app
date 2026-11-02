-- Generated from the previous single-database migrations (see git history).

CREATE TYPE "DivisionStatus" AS ENUM (
    'active',
    'inactive'
);

CREATE TYPE "EmployeeStatus" AS ENUM (
    'active',
    'inactive'
);

CREATE TYPE "UploadStatus" AS ENUM (
    'pending',
    'ready'
);

CREATE TYPE "UserTokenPurpose" AS ENUM (
    'email_verification',
    'invitation'
);

CREATE TABLE audit_logs (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    target_type text,
    target_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id text,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE divisions (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    code character varying(32) NOT NULL,
    name character varying(120) NOT NULL,
    status "DivisionStatus" DEFAULT 'active'::"DivisionStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone,
    CONSTRAINT divisions_code_format CHECK (((code)::text ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'::text))
);

CREATE TABLE employees (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid,
    division_id uuid NOT NULL,
    manager_id uuid,
    employee_number character varying(32) NOT NULL,
    full_name character varying(160) NOT NULL,
    work_email character varying(255),
    job_title character varying(120),
    status "EmployeeStatus" DEFAULT 'active'::"EmployeeStatus" NOT NULL,
    employment_start_date date NOT NULL,
    employment_end_date date,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone,
    CONSTRAINT employees_employee_number_format CHECK (((employee_number)::text ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'::text)),
    CONSTRAINT employees_employment_period CHECK (((employment_end_date IS NULL) OR (employment_end_date >= employment_start_date))),
    CONSTRAINT employees_not_own_manager CHECK ((manager_id <> id))
);

CREATE TABLE organizations (
    id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone
);

CREATE TABLE password_reset_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    used_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE refresh_tokens (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    used_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE roles (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    permissions text[],
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone
);

CREATE TABLE sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_agent text,
    ip text,
    expires_at timestamp(3) with time zone NOT NULL,
    last_used_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE uploads (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    uploaded_by_id uuid NOT NULL,
    key text NOT NULL,
    filename text NOT NULL,
    content_type text NOT NULL,
    size integer NOT NULL,
    status "UploadStatus" DEFAULT 'pending'::"UploadStatus" NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone,
    CONSTRAINT uploads_size_positive CHECK ((size > 0))
);

CREATE TABLE user_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    purpose "UserTokenPurpose" NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    used_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE users (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    role_id uuid NOT NULL,
    email text NOT NULL,
    name text NOT NULL,
    password_hash text,
    disabled_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone,
    email_verified_at timestamp(3) with time zone
);

ALTER TABLE ONLY audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY divisions
    ADD CONSTRAINT divisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY uploads
    ADD CONSTRAINT uploads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY user_tokens
    ADD CONSTRAINT user_tokens_pkey PRIMARY KEY (id);

ALTER TABLE ONLY users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

CREATE INDEX audit_logs_actor_id_idx ON audit_logs USING btree (actor_id);

CREATE INDEX audit_logs_organization_id_created_at_idx ON audit_logs USING btree (organization_id, created_at);

CREATE INDEX audit_logs_organization_id_target_id_idx ON audit_logs USING btree (organization_id, target_id);

CREATE UNIQUE INDEX divisions_organization_id_code_key ON divisions USING btree (organization_id, code);

CREATE UNIQUE INDEX divisions_organization_id_name_key ON divisions USING btree (organization_id, name);

CREATE INDEX divisions_organization_id_status_name_idx ON divisions USING btree (organization_id, status, name);

CREATE INDEX employees_division_id_idx ON employees USING btree (division_id);

CREATE INDEX employees_manager_id_idx ON employees USING btree (manager_id);

CREATE UNIQUE INDEX employees_organization_id_employee_number_key ON employees USING btree (organization_id, employee_number);

CREATE INDEX employees_organization_id_full_name_idx ON employees USING btree (organization_id, full_name);

CREATE INDEX employees_organization_id_manager_id_idx ON employees USING btree (organization_id, manager_id);

CREATE INDEX employees_organization_id_status_division_id_idx ON employees USING btree (organization_id, status, division_id);

CREATE UNIQUE INDEX employees_user_id_key ON employees USING btree (user_id);

CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON password_reset_tokens USING btree (token_hash);

CREATE INDEX password_reset_tokens_user_id_idx ON password_reset_tokens USING btree (user_id);

CREATE INDEX refresh_tokens_session_id_idx ON refresh_tokens USING btree (session_id);

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON refresh_tokens USING btree (token_hash);

CREATE UNIQUE INDEX roles_organization_id_name_key ON roles USING btree (organization_id, name);

CREATE INDEX sessions_user_id_idx ON sessions USING btree (user_id);

CREATE UNIQUE INDEX uploads_key_key ON uploads USING btree (key);

CREATE INDEX uploads_organization_id_created_at_idx ON uploads USING btree (organization_id, created_at);

CREATE INDEX uploads_uploaded_by_id_idx ON uploads USING btree (uploaded_by_id);

CREATE UNIQUE INDEX user_tokens_token_hash_key ON user_tokens USING btree (token_hash);

CREATE INDEX user_tokens_user_id_purpose_idx ON user_tokens USING btree (user_id, purpose);

CREATE UNIQUE INDEX users_email_key ON users USING btree (email);

CREATE INDEX users_organization_id_idx ON users USING btree (organization_id);

CREATE INDEX users_role_id_idx ON users USING btree (role_id);

ALTER TABLE ONLY audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY divisions
    ADD CONSTRAINT divisions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_division_id_fkey FOREIGN KEY (division_id) REFERENCES divisions(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY roles
    ADD CONSTRAINT roles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY uploads
    ADD CONSTRAINT uploads_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY uploads
    ADD CONSTRAINT uploads_uploaded_by_id_fkey FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY user_tokens
    ADD CONSTRAINT user_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;
