-- Generated from the previous single-database migrations (see git history).

CREATE TYPE "AttendanceCompletion" AS ENUM (
    'open',
    'complete',
    'not_applicable'
);

CREATE TYPE "AttendanceSource" AS ENUM (
    'self_service',
    'close_day_job'
);

CREATE TYPE "AttendanceStatus" AS ENUM (
    'present',
    'late',
    'absent',
    'excused'
);

CREATE TYPE "CorrectionStatus" AS ENUM (
    'pending',
    'approved',
    'rejected'
);

CREATE TYPE "DivisionStatus" AS ENUM (
    'active',
    'inactive'
);

CREATE TYPE "EmployeeStatus" AS ENUM (
    'active',
    'inactive'
);

CREATE TYPE "IdempotencyAction" AS ENUM (
    'attendance_check_in',
    'attendance_check_out'
);

CREATE TYPE "NotificationStatus" AS ENUM (
    'pending',
    'sent',
    'skipped',
    'failed'
);

CREATE TYPE "NotificationType" AS ENUM (
    'correction_submitted',
    'correction_approved',
    'correction_rejected',
    'reminder_check_in',
    'reminder_check_out'
);

CREATE TYPE "ScheduleScope" AS ENUM (
    'organization',
    'division',
    'employee'
);

CREATE TYPE "VerificationDistanceBand" AS ENUM (
    'within_1km',
    'within_10km',
    'over_10km'
);

CREATE TYPE "VerificationMethod" AS ENUM (
    'location',
    'selfie'
);

CREATE TYPE "VerificationMoment" AS ENUM (
    'check_in',
    'check_out'
);

CREATE TYPE "VerificationPhotoRequestStatus" AS ENUM (
    'open',
    'disclosed',
    'declined'
);

CREATE TYPE "VerificationResult" AS ENUM (
    'verified',
    'outside_approved_area',
    'low_accuracy',
    'not_shared',
    'no_approved_area',
    'captured'
);

CREATE TYPE "WorkLocationStatus" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'superseded'
);

CREATE TABLE attendance_verifications (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    attendance_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    work_date date NOT NULL,
    method "VerificationMethod" NOT NULL,
    result "VerificationResult" NOT NULL,
    accuracy_meters integer,
    distance_band "VerificationDistanceBand",
    captured_at timestamp(3) with time zone,
    photo_key text,
    photo_delete_after timestamp(3) with time zone,
    reviewed_at timestamp(3) with time zone,
    delete_after timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    moment "VerificationMoment" NOT NULL
);

CREATE TABLE attendances (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    work_schedule_id uuid,
    work_date date NOT NULL,
    status "AttendanceStatus" NOT NULL,
    completion "AttendanceCompletion" NOT NULL,
    source "AttendanceSource" NOT NULL,
    check_in_at timestamp(3) with time zone,
    check_out_at timestamp(3) with time zone,
    late_minutes integer DEFAULT 0 NOT NULL,
    worked_minutes integer,
    schedule_timezone character varying(64) NOT NULL,
    scheduled_start_at timestamp(3) with time zone NOT NULL,
    scheduled_end_at timestamp(3) with time zone NOT NULL,
    on_time_deadline_at timestamp(3) with time zone NOT NULL,
    check_in_opens_at timestamp(3) with time zone NOT NULL,
    check_in_closes_at timestamp(3) with time zone NOT NULL,
    check_out_closes_at timestamp(3) with time zone NOT NULL,
    close_day_run_id character varying(64),
    version integer DEFAULT 1 NOT NULL,
    corrected_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT attendances_completion_matches_timestamps CHECK ((((completion = 'open'::"AttendanceCompletion") AND (check_in_at IS NOT NULL) AND (check_out_at IS NULL) AND (worked_minutes IS NULL)) OR ((completion = 'complete'::"AttendanceCompletion") AND (check_in_at IS NOT NULL) AND (check_out_at IS NOT NULL) AND (check_out_at >= check_in_at) AND (worked_minutes IS NOT NULL)) OR ((completion = 'not_applicable'::"AttendanceCompletion") AND (check_in_at IS NULL) AND (check_out_at IS NULL) AND (status = ANY (ARRAY['absent'::"AttendanceStatus", 'excused'::"AttendanceStatus"]))))),
    CONSTRAINT attendances_counters_valid CHECK (((late_minutes >= 0) AND ((worked_minutes IS NULL) OR (worked_minutes >= 0)) AND (version >= 1))),
    CONSTRAINT attendances_snapshot_ordered CHECK (((check_in_opens_at <= scheduled_start_at) AND (scheduled_start_at < scheduled_end_at) AND (check_in_opens_at < check_in_closes_at) AND (check_in_closes_at <= check_out_closes_at))),
    CONSTRAINT attendances_status_matches_lateness CHECK ((((status = 'present'::"AttendanceStatus") AND (late_minutes = 0)) OR ((status = 'late'::"AttendanceStatus") AND (late_minutes > 0)) OR ((status = ANY (ARRAY['absent'::"AttendanceStatus", 'excused'::"AttendanceStatus"])) AND (late_minutes = 0))))
);

CREATE TABLE correction_requests (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    attendance_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    work_date date NOT NULL,
    status "CorrectionStatus" DEFAULT 'pending'::"CorrectionStatus" NOT NULL,
    pending_attendance_id uuid,
    current_check_in_at timestamp(3) with time zone,
    current_check_out_at timestamp(3) with time zone,
    requested_check_in_at timestamp(3) with time zone NOT NULL,
    requested_check_out_at timestamp(3) with time zone,
    reason character varying(1000) NOT NULL,
    requested_by_id uuid NOT NULL,
    expected_attendance_version integer NOT NULL,
    decided_by_id uuid,
    decision_note character varying(1000),
    submitted_at timestamp(3) with time zone NOT NULL,
    decided_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT correction_requests_decision_fields CHECK ((((status = 'pending'::"CorrectionStatus") AND (decided_by_id IS NULL) AND (decided_at IS NULL)) OR ((status = 'approved'::"CorrectionStatus") AND (decided_by_id IS NOT NULL) AND (decided_at IS NOT NULL)) OR ((status = 'rejected'::"CorrectionStatus") AND (decided_by_id IS NOT NULL) AND (decided_at IS NOT NULL) AND (decision_note IS NOT NULL)))),
    CONSTRAINT correction_requests_no_self_decision CHECK (((decided_by_id IS NULL) OR (decided_by_id <> requested_by_id))),
    CONSTRAINT correction_requests_pending_marker CHECK ((((status = 'pending'::"CorrectionStatus") AND (pending_attendance_id = attendance_id)) OR ((status <> 'pending'::"CorrectionStatus") AND (pending_attendance_id IS NULL)))),
    CONSTRAINT correction_requests_times_ordered CHECK (((requested_check_out_at IS NULL) OR (requested_check_out_at >= requested_check_in_at))),
    CONSTRAINT correction_requests_version_valid CHECK ((expected_attendance_version >= 1))
);

CREATE TABLE correction_snapshots (
    id uuid NOT NULL,
    correction_request_id uuid NOT NULL,
    before jsonb NOT NULL,
    after jsonb NOT NULL,
    schema_version smallint NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT correction_snapshots_schema_version_valid CHECK ((schema_version >= 1))
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

CREATE TABLE holidays (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    date date NOT NULL,
    name character varying(160) NOT NULL,
    created_by_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL
);

CREATE TABLE idempotency_records (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    key character varying(128) NOT NULL,
    action "IdempotencyAction" NOT NULL,
    request_hash character(64) NOT NULL,
    attendance_id uuid,
    response_status smallint,
    response_body jsonb,
    locked_at timestamp(3) with time zone NOT NULL,
    completed_at timestamp(3) with time zone,
    expires_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT idempotency_records_expiry_after_lock CHECK ((expires_at > locked_at))
);

CREATE TABLE notification_preferences (
    user_id uuid NOT NULL,
    review_requests_email boolean DEFAULT true NOT NULL,
    correction_updates_email boolean DEFAULT true NOT NULL,
    check_in_reminder_email boolean DEFAULT true NOT NULL,
    check_out_reminder_email boolean DEFAULT true NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);

CREATE TABLE notifications (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    recipient_id uuid NOT NULL,
    type "NotificationType" NOT NULL,
    subject_id uuid NOT NULL,
    dedupe_key character varying(200) NOT NULL,
    status "NotificationStatus" DEFAULT 'pending'::"NotificationStatus" NOT NULL,
    failure_code character varying(80),
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sent_at timestamp(3) with time zone,
    read_at timestamp(3) with time zone,
    expires_at timestamp(3) with time zone,
    work_date date,
    emailed_at timestamp(3) with time zone,
    link character varying(300),
    title character varying(200)
);

CREATE TABLE organizations (
    id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    deleted_at timestamp(3) with time zone,
    retention_years smallint DEFAULT 5 NOT NULL,
    support_contact character varying(255),
    timezone character varying(64) DEFAULT 'Asia/Jakarta'::character varying NOT NULL,
    check_in_reminder_at time(0) without time zone DEFAULT '09:00:00'::time without time zone NOT NULL,
    check_in_reminder_enabled boolean DEFAULT true NOT NULL,
    check_out_reminder_at time(0) without time zone DEFAULT '18:00:00'::time without time zone NOT NULL,
    check_out_reminder_enabled boolean DEFAULT true NOT NULL,
    location_verification_enabled boolean DEFAULT false NOT NULL,
    selfie_verification_enabled boolean DEFAULT false NOT NULL,
    CONSTRAINT organizations_retention_years_range CHECK (((retention_years >= 1) AND (retention_years <= 10)))
);

CREATE TABLE verification_notice_acknowledgements (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    notice_version integer NOT NULL,
    acknowledged_at timestamp(3) with time zone NOT NULL
);

CREATE TABLE verification_pending_photos (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    moment "VerificationMoment" NOT NULL,
    key text NOT NULL,
    content_type character varying(32) NOT NULL,
    size integer NOT NULL,
    expires_at timestamp(3) with time zone NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE verification_photo_requests (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    verification_id uuid,
    work_date date NOT NULL,
    status "VerificationPhotoRequestStatus" DEFAULT 'open'::"VerificationPhotoRequestStatus" NOT NULL,
    identity_check character varying(200),
    decided_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL
);

CREATE TABLE work_locations (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    label character varying(120) NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    radius_meters integer DEFAULT 1000 NOT NULL,
    status "WorkLocationStatus" DEFAULT 'pending'::"WorkLocationStatus" NOT NULL,
    decided_at timestamp(3) with time zone,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    CONSTRAINT work_locations_coordinates_range CHECK ((((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision)) AND ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision)))),
    CONSTRAINT work_locations_radius_range CHECK (((radius_meters >= 100) AND (radius_meters <= 10000)))
);

CREATE TABLE work_schedules (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    scope "ScheduleScope" DEFAULT 'organization'::"ScheduleScope" NOT NULL,
    timezone character varying(64) NOT NULL,
    working_days smallint[],
    start_time time(0) without time zone NOT NULL,
    end_time time(0) without time zone NOT NULL,
    tolerance_minutes smallint NOT NULL,
    check_in_opens_at time(0) without time zone NOT NULL,
    check_in_closes_at time(0) without time zone NOT NULL,
    check_out_deadline time(3) without time zone NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_by_id uuid NOT NULL,
    created_at timestamp(3) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) with time zone NOT NULL,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    CONSTRAINT work_schedules_period CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT work_schedules_scope_organization_only CHECK ((scope = 'organization'::"ScheduleScope")),
    CONSTRAINT work_schedules_times_ordered CHECK (((check_in_opens_at <= start_time) AND (start_time < end_time) AND (check_in_opens_at < check_in_closes_at) AND (check_in_closes_at <= check_out_deadline))),
    CONSTRAINT work_schedules_tolerance_range CHECK (((tolerance_minutes >= 0) AND (tolerance_minutes <= 120))),
    CONSTRAINT work_schedules_working_days_valid CHECK (((working_days IS NOT NULL) AND ((cardinality(working_days) >= 1) AND (cardinality(working_days) <= 7)) AND (working_days <@ ARRAY[(1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint, (7)::smallint])))
);

ALTER TABLE ONLY attendance_verifications
    ADD CONSTRAINT attendance_verifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);

ALTER TABLE ONLY correction_requests
    ADD CONSTRAINT correction_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY correction_snapshots
    ADD CONSTRAINT correction_snapshots_pkey PRIMARY KEY (id);

ALTER TABLE ONLY divisions
    ADD CONSTRAINT divisions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);

ALTER TABLE ONLY holidays
    ADD CONSTRAINT holidays_pkey PRIMARY KEY (id);

ALTER TABLE ONLY idempotency_records
    ADD CONSTRAINT idempotency_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY verification_notice_acknowledgements
    ADD CONSTRAINT verification_notice_acknowledgements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY verification_pending_photos
    ADD CONSTRAINT verification_pending_photos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY verification_photo_requests
    ADD CONSTRAINT verification_photo_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY work_locations
    ADD CONSTRAINT work_locations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY work_schedules
    ADD CONSTRAINT work_schedules_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX attendance_verifications_attendance_id_moment_method_key ON attendance_verifications USING btree (attendance_id, moment, method);

CREATE INDEX attendance_verifications_delete_after_idx ON attendance_verifications USING btree (delete_after);

CREATE INDEX attendance_verifications_employee_id_work_date_idx ON attendance_verifications USING btree (employee_id, work_date DESC);

CREATE INDEX attendance_verifications_organization_id_result_reviewed_at_idx ON attendance_verifications USING btree (organization_id, result, reviewed_at);

CREATE INDEX attendance_verifications_organization_id_work_date_idx ON attendance_verifications USING btree (organization_id, work_date DESC);

CREATE INDEX attendance_verifications_photo_delete_after_idx ON attendance_verifications USING btree (photo_delete_after);

CREATE INDEX attendances_employee_id_idx ON attendances USING btree (employee_id);

CREATE INDEX attendances_organization_id_employee_id_work_date_idx ON attendances USING btree (organization_id, employee_id, work_date DESC);

CREATE UNIQUE INDEX attendances_organization_id_employee_id_work_date_key ON attendances USING btree (organization_id, employee_id, work_date);

CREATE INDEX attendances_organization_id_work_date_employee_id_idx ON attendances USING btree (organization_id, work_date, employee_id);

CREATE INDEX attendances_organization_id_work_date_status_completion_idx ON attendances USING btree (organization_id, work_date, status, completion);

CREATE INDEX attendances_work_schedule_id_idx ON attendances USING btree (work_schedule_id);

CREATE INDEX correction_requests_attendance_id_idx ON correction_requests USING btree (attendance_id);

CREATE INDEX correction_requests_decided_by_id_idx ON correction_requests USING btree (decided_by_id);

CREATE INDEX correction_requests_employee_id_idx ON correction_requests USING btree (employee_id);

CREATE INDEX correction_requests_organization_id_employee_id_work_date_idx ON correction_requests USING btree (organization_id, employee_id, work_date DESC);

CREATE INDEX correction_requests_organization_id_status_submitted_at_idx ON correction_requests USING btree (organization_id, status, submitted_at);

CREATE UNIQUE INDEX correction_requests_pending_attendance_id_key ON correction_requests USING btree (pending_attendance_id);

CREATE INDEX correction_requests_requested_by_id_idx ON correction_requests USING btree (requested_by_id);

CREATE UNIQUE INDEX correction_snapshots_correction_request_id_key ON correction_snapshots USING btree (correction_request_id);

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

CREATE INDEX holidays_created_by_id_idx ON holidays USING btree (created_by_id);

CREATE INDEX holidays_organization_id_date_idx ON holidays USING btree (organization_id, date);

CREATE INDEX idempotency_records_attendance_id_idx ON idempotency_records USING btree (attendance_id);

CREATE INDEX idempotency_records_expires_at_idx ON idempotency_records USING btree (expires_at);

CREATE UNIQUE INDEX idempotency_records_organization_id_user_id_key_key ON idempotency_records USING btree (organization_id, user_id, key);

CREATE INDEX idempotency_records_user_id_idx ON idempotency_records USING btree (user_id);

CREATE UNIQUE INDEX notifications_dedupe_key_key ON notifications USING btree (dedupe_key);

CREATE INDEX notifications_organization_id_created_at_idx ON notifications USING btree (organization_id, created_at);

CREATE INDEX notifications_recipient_id_status_sent_at_idx ON notifications USING btree (recipient_id, status, sent_at DESC);

CREATE UNIQUE INDEX verification_notice_acknowledgements_employee_id_notice_ver_key ON verification_notice_acknowledgements USING btree (employee_id, notice_version);

CREATE INDEX verification_notice_acknowledgements_organization_id_idx ON verification_notice_acknowledgements USING btree (organization_id);

CREATE UNIQUE INDEX verification_pending_photos_employee_id_moment_key ON verification_pending_photos USING btree (employee_id, moment);

CREATE INDEX verification_pending_photos_expires_at_idx ON verification_pending_photos USING btree (expires_at);

CREATE INDEX verification_photo_requests_employee_id_idx ON verification_photo_requests USING btree (employee_id);

CREATE UNIQUE INDEX verification_photo_requests_one_open_per_verification ON verification_photo_requests USING btree (verification_id) WHERE (status = 'open'::"VerificationPhotoRequestStatus");

CREATE INDEX verification_photo_requests_organization_id_status_created__idx ON verification_photo_requests USING btree (organization_id, status, created_at);

CREATE INDEX verification_photo_requests_status_decided_at_idx ON verification_photo_requests USING btree (status, decided_at);

CREATE INDEX verification_photo_requests_verification_id_idx ON verification_photo_requests USING btree (verification_id);

CREATE INDEX work_locations_employee_id_status_idx ON work_locations USING btree (employee_id, status);

CREATE UNIQUE INDEX work_locations_one_approved_per_employee ON work_locations USING btree (employee_id) WHERE (status = 'approved'::"WorkLocationStatus");

CREATE UNIQUE INDEX work_locations_one_pending_per_employee ON work_locations USING btree (employee_id) WHERE (status = 'pending'::"WorkLocationStatus");

CREATE INDEX work_locations_organization_id_status_created_at_idx ON work_locations USING btree (organization_id, status, created_at);

CREATE INDEX work_locations_status_decided_at_idx ON work_locations USING btree (status, decided_at);

CREATE INDEX work_schedules_created_by_id_idx ON work_schedules USING btree (created_by_id);

CREATE INDEX work_schedules_organization_id_scope_effective_from_effecti_idx ON work_schedules USING btree (organization_id, scope, effective_from, effective_to);

CREATE UNIQUE INDEX work_schedules_organization_id_scope_effective_from_key ON work_schedules USING btree (organization_id, scope, effective_from);

ALTER TABLE ONLY attendance_verifications
    ADD CONSTRAINT attendance_verifications_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY attendance_verifications
    ADD CONSTRAINT attendance_verifications_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY attendance_verifications
    ADD CONSTRAINT attendance_verifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY attendances
    ADD CONSTRAINT attendances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY attendances
    ADD CONSTRAINT attendances_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY attendances
    ADD CONSTRAINT attendances_work_schedule_id_fkey FOREIGN KEY (work_schedule_id) REFERENCES work_schedules(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY correction_requests
    ADD CONSTRAINT correction_requests_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY correction_requests
    ADD CONSTRAINT correction_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY correction_requests
    ADD CONSTRAINT correction_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY correction_requests
    ADD CONSTRAINT correction_requests_pending_attendance_id_fkey FOREIGN KEY (pending_attendance_id) REFERENCES attendances(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY correction_snapshots
    ADD CONSTRAINT correction_snapshots_correction_request_id_fkey FOREIGN KEY (correction_request_id) REFERENCES correction_requests(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY divisions
    ADD CONSTRAINT divisions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_division_id_fkey FOREIGN KEY (division_id) REFERENCES divisions(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY employees
    ADD CONSTRAINT employees_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY holidays
    ADD CONSTRAINT holidays_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY idempotency_records
    ADD CONSTRAINT idempotency_records_attendance_id_fkey FOREIGN KEY (attendance_id) REFERENCES attendances(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY idempotency_records
    ADD CONSTRAINT idempotency_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY notifications
    ADD CONSTRAINT notifications_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY verification_notice_acknowledgements
    ADD CONSTRAINT verification_notice_acknowledgements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY verification_notice_acknowledgements
    ADD CONSTRAINT verification_notice_acknowledgements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY verification_pending_photos
    ADD CONSTRAINT verification_pending_photos_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY verification_pending_photos
    ADD CONSTRAINT verification_pending_photos_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY verification_photo_requests
    ADD CONSTRAINT verification_photo_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY verification_photo_requests
    ADD CONSTRAINT verification_photo_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY verification_photo_requests
    ADD CONSTRAINT verification_photo_requests_verification_id_fkey FOREIGN KEY (verification_id) REFERENCES attendance_verifications(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY work_locations
    ADD CONSTRAINT work_locations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY work_locations
    ADD CONSTRAINT work_locations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY work_schedules
    ADD CONSTRAINT work_schedules_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON UPDATE CASCADE ON DELETE RESTRICT;
