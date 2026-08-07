import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY. Veja o README para configurar o .env"
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Identifica o visitante no navegador (sem login). Fica salvo localmente
// e é o que liga os hábitos e o apelido do ranking a essa pessoa.
const USER_ID_KEY = "cultivo-diario-user-id";

export function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}
