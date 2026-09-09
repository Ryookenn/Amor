// =========================
// CONNEXION À SUPABASE
// =========================

const SUPABASE_URL =
    "https://yiqxralenyeusfrgvcxp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_dlrrUMzdCZoVTKCFVaOrpg_dcNCG5HH";


const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );