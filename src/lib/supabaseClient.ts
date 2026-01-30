import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env vars missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Configure em .env.local e reinicie o servidor (npm run dev).",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type AuthRole = "secretary" | "teacher" | "student";
type CreateAuthUserPayload = {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
  subjectId?: string;
  cpf?: string;
  birthDate?: string;
  classId?: string;
};

export const createAuthUserAsSecretary = async (payload: CreateAuthUserPayload): Promise<{ userId: string }> => {
  const normalizedEmail = payload.email.trim().toLowerCase();
  const password = payload.password ?? "";
  if (!normalizedEmail) throw new Error("Email é obrigatório.");
  if (!password || password.trim().length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres.");

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw new Error(sessionErr.message);
  const previousSession = sessionData.session;

  const signUpMetadata: Record<string, unknown> = {
    name: payload.name.trim(),
    role: payload.role,
  };
  if (payload.subjectId) signUpMetadata.subjectId = payload.subjectId;
  if (payload.cpf) signUpMetadata.cpf = payload.cpf;
  if (payload.birthDate) signUpMetadata.birthDate = payload.birthDate;
  if (payload.classId) signUpMetadata.classId = payload.classId;

  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: signUpMetadata },
  });

  if (signUpErr) throw new Error(signUpErr.message);
  const createdId = signUpData.user?.id;
  if (!createdId) throw new Error("Falha ao criar usuário no Authentication.");

  if (previousSession?.access_token && previousSession.refresh_token) {
    const { data: now } = await supabase.auth.getSession();
    const nowUserId = now.session?.user?.id;
    if (nowUserId && nowUserId !== previousSession.user.id) {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: previousSession.access_token,
        refresh_token: previousSession.refresh_token,
      });
      if (setErr) throw new Error(setErr.message);
    }
  }

  return { userId: createdId };
};
