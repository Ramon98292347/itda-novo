BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('secretary', 'teacher', 'student');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE bimester_status AS ENUM ('active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE grade_status AS ENUM ('approved', 'recovery', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  role          user_role NOT NULL,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users
DROP COLUMN IF EXISTS password_hash;

CREATE TABLE IF NOT EXISTS classes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  academic_year text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, academic_year)
);

CREATE TABLE IF NOT EXISTS subjects (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  workload      integer NOT NULL CHECK (workload > 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  cpf           text NOT NULL UNIQUE,
  birth_date    date NOT NULL,
  class_id      uuid NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (cpf ~ '^[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}$' OR cpf ~ '^[0-9]{11}$')
);

CREATE TABLE IF NOT EXISTS teachers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  PRIMARY KEY (teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS bimesters (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name        text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  status      bimester_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  UNIQUE (subject_id, name, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS grades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  bimester_id uuid NOT NULL REFERENCES bimesters(id) ON DELETE CASCADE,

  grade1      numeric(4,2) NOT NULL CHECK (grade1 >= 0 AND grade1 <= 10),
  grade2      numeric(4,2) NOT NULL CHECK (grade2 >= 0 AND grade2 <= 10),
  absences    integer NOT NULL DEFAULT 0 CHECK (absences >= 0),

  average     numeric(4,2) NOT NULL DEFAULT 0,
  status      grade_status NOT NULL DEFAULT 'failed',

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (student_id, subject_id, bimester_id)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.register_user(text, text, user_role, text);
DROP FUNCTION IF EXISTS public.authenticate_user(text, text);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_name text;
  v_user_role user_role;
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  v_user_role := CASE
    WHEN v_role IN ('secretary', 'teacher', 'student') THEN v_role::user_role
    ELSE 'student'::user_role
  END;

  v_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1));

  INSERT INTO public.users (id, name, email, role)
  VALUES (NEW.id, v_name, NEW.email, v_user_role)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_name text;
  v_user_role user_role;
  v_subject_id uuid;
  v_teacher_id uuid;
  v_cpf text;
  v_birth_date date;
  v_class_id uuid;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'student');
  v_user_role := CASE
    WHEN v_role IN ('secretary', 'teacher', 'student') THEN v_role::user_role
    ELSE 'student'::user_role
  END;

  v_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1));

  INSERT INTO public.users (id, name, email, role)
  VALUES (NEW.id, v_name, NEW.email, v_user_role)
  ON CONFLICT (id) DO UPDATE
  SET name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      updated_at = now();

  IF v_user_role = 'teacher' THEN
    INSERT INTO public.teachers (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT id INTO v_teacher_id FROM public.teachers WHERE user_id = NEW.id;

    v_subject_id := NULLIF(NEW.raw_user_meta_data->>'subjectId', '')::uuid;
    IF v_teacher_id IS NOT NULL AND v_subject_id IS NOT NULL THEN
      DELETE FROM public.teacher_subjects WHERE teacher_id = v_teacher_id;
      INSERT INTO public.teacher_subjects (teacher_id, subject_id)
      VALUES (v_teacher_id, v_subject_id)
      ON CONFLICT (teacher_id, subject_id) DO NOTHING;
    END IF;
  ELSIF v_user_role = 'student' THEN
    v_cpf := NULLIF(NEW.raw_user_meta_data->>'cpf', '');
    v_birth_date := NULLIF(NEW.raw_user_meta_data->>'birthDate', '')::date;
    v_class_id := NULLIF(NEW.raw_user_meta_data->>'classId', '')::uuid;

    IF v_cpf IS NOT NULL AND v_birth_date IS NOT NULL AND v_class_id IS NOT NULL THEN
      INSERT INTO public.students (user_id, cpf, birth_date, class_id)
      VALUES (NEW.id, v_cpf, v_birth_date, v_class_id)
      ON CONFLICT (user_id) DO UPDATE
      SET cpf = EXCLUDED.cpf,
          birth_date = EXCLUDED.birth_date,
          class_id = EXCLUDED.class_id,
          updated_at = now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user()';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_email_confirmed') THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_email_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION public.handle_auth_user_email_confirmed()';
  END IF;
END $$;

DROP TRIGGER IF EXISTS users_sync_role_rows ON public.users;
DROP FUNCTION IF EXISTS public.sync_user_role_rows();

DELETE FROM public.students
WHERE cpf IS NULL OR birth_date IS NULL OR class_id IS NULL;

ALTER TABLE public.students
  ALTER COLUMN cpf SET NOT NULL,
  ALTER COLUMN birth_date SET NOT NULL,
  ALTER COLUMN class_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_select_own') THEN
    EXECUTE 'CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated USING (id = auth.uid())';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'teachers' AND policyname = 'teachers_select_own') THEN
    EXECUTE 'CREATE POLICY teachers_select_own ON public.teachers FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'students_select_own') THEN
    EXECUTE 'CREATE POLICY students_select_own ON public.students FOR SELECT TO authenticated USING (user_id = auth.uid())';
  END IF;
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

CREATE OR REPLACE FUNCTION grades_compute_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  avg_val numeric(4,2);
BEGIN
  avg_val := ROUND(((NEW.grade1 + NEW.grade2) / 2.0)::numeric, 2);
  NEW.average := avg_val;

  IF avg_val >= 5 THEN
    NEW.status := 'approved';
  ELSIF avg_val >= 3 THEN
    NEW.status := 'recovery';
  ELSE
    NEW.status := 'failed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id  uuid NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  bimester_id uuid NOT NULL REFERENCES bimesters(id) ON DELETE CASCADE,
  date        date NOT NULL,
  present     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_id, bimester_id, date)
);

DO $$ BEGIN
  CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER classes_set_updated_at
  BEFORE UPDATE ON classes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER subjects_set_updated_at
  BEFORE UPDATE ON subjects
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER students_set_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER teachers_set_updated_at
  BEFORE UPDATE ON teachers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER bimesters_set_updated_at
  BEFORE UPDATE ON bimesters
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER grades_set_updated_at
  BEFORE UPDATE ON grades
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER attendance_set_updated_at
  BEFORE UPDATE ON attendance
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER grades_compute_fields_trigger
  BEFORE INSERT OR UPDATE OF grade1, grade2 ON grades
  FOR EACH ROW
  EXECUTE FUNCTION grades_compute_fields();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_bimesters_subject_id ON bimesters(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_student_id ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_grades_subject_id ON grades(subject_id);
CREATE INDEX IF NOT EXISTS idx_grades_bimester_id ON grades(bimester_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_subject_id ON attendance(subject_id);
CREATE INDEX IF NOT EXISTS idx_attendance_bimester_id ON attendance(bimester_id);

CREATE OR REPLACE VIEW v_student_grades AS
SELECT
  g.id AS grade_id,
  u.name AS student_name,
  u.email AS student_email,
  c.name AS class_name,
  s2.name AS subject_name,
  b.name AS bimester_name,
  g.grade1, g.grade2, g.average, g.absences, g.status,
  g.created_at, g.updated_at
FROM grades g
JOIN students st ON st.id = g.student_id
JOIN users u ON u.id = st.user_id
JOIN classes c ON c.id = st.class_id
JOIN subjects s2 ON s2.id = g.subject_id
JOIN bimesters b ON b.id = g.bimester_id;

COMMIT;
