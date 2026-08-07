import { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Trash2,
  Flame,
  Leaf,
  Bell,
  BarChart3,
  Users,
  AlertTriangle,
  Crown,
  Heart,
  Copy,
  Check,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { supabase, getUserId } from "./supabaseClient";

// ---- troque pela sua chave Pix real (ou apague o bloco de doação) ----
const PIX_KEY = "041.482.495-43";
const BUY_ME_A_COFFEE_URL = ""; // ex: "https://buymeacoffee.com/seuusuario"

function todayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

function hoursUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, (midnight - now) / 1000 / 60 / 60);
}

const TABS = [
  { id: "hoje", label: "Hoje", icon: Leaf },
  { id: "progresso", label: "Progresso", icon: BarChart3 },
  { id: "ranking", label: "Ranking", icon: Users },
];

export default function App() {
  const userId = useMemo(() => getUserId(), []);
  const [habits, setHabits] = useState([]);
  const [checkinsByHabit, setCheckinsByHabit] = useState({}); // { habitId: Set(dateStr) }
  const [profile, setProfile] = useState({
    nickname: "",
    streak: 0,
    reminder_time: "20:00",
    notify_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newHabit, setNewHabit] = useState("");
  const [tab, setTab] = useState("hoje");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [pixCopied, setPixCopied] = useState(false);
  const reminderTimeoutRef = useRef(null);

  const today = todayKey(0);
  const last14 = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) days.push(todayKey(-i));
    return days;
  }, [today]);
  const last30 = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(todayKey(-i));
    return days;
  }, [today]);

  function computeStreak(habitId) {
    const set = checkinsByHabit[habitId];
    if (!set) return 0;
    let streak = 0;
    let offset = set.has(today) ? 0 : -1;
    while (set.has(todayKey(offset))) {
      streak += 1;
      offset -= 1;
    }
    return streak;
  }

  // ---- carregar tudo do Supabase ----
  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [{ data: habitsData, error: hErr }, { data: checkinsData, error: cErr }, { data: profileData, error: pErr }] =
        await Promise.all([
          supabase.from("habits").select("*").eq("user_id", userId).order("created_at"),
          supabase.from("checkins").select("habit_id,date").eq("user_id", userId),
          supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
        ]);
      if (hErr || cErr || pErr) throw hErr || cErr || pErr;

      setHabits(habitsData || []);

      const grouped = {};
      (checkinsData || []).forEach((c) => {
        if (!grouped[c.habit_id]) grouped[c.habit_id] = new Set();
        grouped[c.habit_id].add(c.date);
      });
      setCheckinsByHabit(grouped);

      if (profileData) {
        setProfile(profileData);
        setNicknameDraft(profileData.nickname || "");
      }
    } catch (e) {
      console.error(e);
      setError(
        "Não consegui conectar ao banco de dados. Confira se o Supabase está configurado (veja o README)."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- hábitos ----
  async function addHabit(e) {
    e.preventDefault();
    const name = newHabit.trim();
    if (!name) return;
    setNewHabit("");
    const { data, error: err } = await supabase
      .from("habits")
      .insert({ user_id: userId, name })
      .select()
      .single();
    if (err) {
      setError("Não deu para salvar o hábito.");
      return;
    }
    setHabits((prev) => [...prev, data]);
  }

  async function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    const { error: err } = await supabase.from("habits").delete().eq("id", id);
    if (err) setError("Não deu para excluir o hábito.");
  }

  async function toggleDay(habitId, dateStr) {
    const set = checkinsByHabit[habitId] || new Set();
    const has = set.has(dateStr);
    const nextSet = new Set(set);
    if (has) nextSet.delete(dateStr);
    else nextSet.add(dateStr);
    setCheckinsByHabit((prev) => ({ ...prev, [habitId]: nextSet }));

    if (has) {
      const { error: err } = await supabase
        .from("checkins")
        .delete()
        .eq("user_id", userId)
        .eq("habit_id", habitId)
        .eq("date", dateStr);
      if (err) setError("Não deu para salvar a marcação.");
    } else {
      const { error: err } = await supabase
        .from("checkins")
        .insert({ user_id: userId, habit_id: habitId, date: dateStr });
      if (err) setError("Não deu para salvar a marcação.");
    }
  }

  const totalStreak = habits.length
    ? Math.min(...habits.map((h) => computeStreak(h.id)))
    : 0;

  const atRiskHabits = habits.filter((h) => {
    const streak = computeStreak(h.id);
    const doneToday = checkinsByHabit[h.id]?.has(today);
    return streak > 0 && !doneToday;
  });

  // mantém profiles.streak atualizado (usado no ranking)
  useEffect(() => {
    if (loading || !profile.nickname) return;
    supabase
      .from("profiles")
      .update({ streak: totalStreak, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .then(({ error: err }) => {
        if (err) console.error(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalStreak, loading]);

  // ---- lembretes (só funcionam com a aba aberta) ----
  function scheduleReminder(time, enabled) {
    if (reminderTimeoutRef.current) clearTimeout(reminderTimeoutRef.current);
    if (!enabled || typeof Notification === "undefined") return;
    const [h, m] = time.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    reminderTimeoutRef.current = setTimeout(() => {
      if (Notification.permission === "granted") {
        new Notification("Cultivo diário 🌱", {
          body: "Hora de marcar seus hábitos de hoje.",
        });
      }
      scheduleReminder(time, enabled);
    }, target - now);
  }

  useEffect(() => {
    scheduleReminder(profile.reminder_time, profile.notify_enabled);
    return () => {
      if (reminderTimeoutRef.current) clearTimeout(reminderTimeoutRef.current);
    };
  }, [profile.reminder_time, profile.notify_enabled]);

  async function persistProfileSettings(next) {
    setProfile(next);
    await supabase.from("profiles").upsert({
      user_id: userId,
      nickname: next.nickname || null,
      streak: totalStreak,
      reminder_time: next.reminder_time,
      notify_enabled: next.notify_enabled,
      updated_at: new Date().toISOString(),
    });
  }

  async function toggleNotifications() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm !== "granted") return;
    } else if (Notification.permission === "denied") {
      setNotifPermission("denied");
      return;
    }
    persistProfileSettings({ ...profile, notify_enabled: !profile.notify_enabled });
  }

  function updateReminderTime(time) {
    persistProfileSettings({ ...profile, reminder_time: time });
  }

  // ---- ranking ----
  async function loadLeaderboard() {
    setLeaderboardLoading(true);
    const { data, error: err } = await supabase
      .from("profiles")
      .select("nickname,streak")
      .not("nickname", "is", null)
      .order("streak", { ascending: false })
      .limit(50);
    if (!err) setLeaderboard(data || []);
    setLeaderboardLoading(false);
  }

  useEffect(() => {
    if (tab === "ranking") loadLeaderboard();
  }, [tab]);

  async function saveNickname(e) {
    e.preventDefault();
    const name = nicknameDraft.trim();
    if (!name) return;
    await persistProfileSettings({ ...profile, nickname: name });
    loadLeaderboard();
  }

  function copyPixKey() {
    navigator.clipboard.writeText(PIX_KEY).then(() => {
      setPixCopied(true);
      setTimeout(() => setPixCopied(false), 2000);
    });
  }

  const chartData = useMemo(() => {
    return last30.map((dateStr) => {
      const done = habits.filter((h) => checkinsByHabit[h.id]?.has(dateStr)).length;
      const pct = habits.length ? Math.round((done / habits.length) * 100) : 0;
      const d = new Date(dateStr + "T00:00:00");
      return { date: dateStr, label: d.getDate().toString(), pct };
    });
  }, [checkinsByHabit, habits, last30]);

  return (
    <div className="hs-root">
      <style>{`
        .hs-root { min-height: 100vh; background: radial-gradient(ellipse at top, #24362B 0%, #16211A 60%, #10190F 100%); color: #F2EFE4; font-family: 'Work Sans', 'Segoe UI', sans-serif; padding: 28px 20px 48px; box-sizing: border-box; }
        .hs-root * { box-sizing: border-box; }
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&display=swap');
        .hs-shell { max-width: 640px; margin: 0 auto; }
        .hs-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
        .hs-title { font-family: 'Fraunces', serif; font-weight: 700; font-size: 30px; letter-spacing: -0.01em; margin: 0; color: #F2EFE4; }
        .hs-subtitle { color: #9AA89C; font-size: 13.5px; margin-top: 4px; text-transform: capitalize; }
        .hs-streak-badge { display: flex; align-items: center; gap: 6px; background: rgba(232, 184, 75, 0.12); border: 1px solid rgba(232, 184, 75, 0.35); color: #E8B84B; padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; }
        .hs-tabs { display: flex; gap: 6px; margin-bottom: 20px; background: #182219; border: 1px solid #2C3D31; border-radius: 12px; padding: 4px; }
        .hs-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 8px; border-radius: 9px; border: none; cursor: pointer; background: transparent; color: #7C8C7F; font-size: 13px; font-weight: 600; transition: all 0.15s ease; font-family: inherit; }
        .hs-tab.active { background: #2C3D31; color: #F2EFE4; }
        .hs-risk-banner { display: flex; align-items: center; gap: 10px; background: rgba(201, 122, 107, 0.14); border: 1px solid rgba(201, 122, 107, 0.4); color: #E7A99B; padding: 12px 14px; border-radius: 12px; font-size: 13.5px; margin-bottom: 18px; }
        .hs-risk-banner b { color: #F0BEB2; }
        .hs-error-banner { background: rgba(201, 122, 107, 0.14); border: 1px solid rgba(201, 122, 107, 0.4); color: #E7A99B; padding: 12px 14px; border-radius: 12px; font-size: 13px; margin-bottom: 18px; }
        .hs-add-form { display: flex; gap: 8px; margin-bottom: 24px; }
        .hs-input { flex: 1; background: #1E2D22; border: 1px solid #33453A; color: #F2EFE4; padding: 12px 14px; border-radius: 10px; font-size: 14.5px; font-family: inherit; outline: none; transition: border-color 0.15s ease; }
        .hs-input:focus { border-color: #6FA875; }
        .hs-input::placeholder { color: #6B7A6E; }
        .hs-add-btn { background: #6FA875; color: #10190F; border: none; border-radius: 10px; padding: 0 18px; display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; cursor: pointer; transition: background 0.15s ease, transform 0.1s ease; }
        .hs-add-btn:hover { background: #7FB985; }
        .hs-add-btn:active { transform: scale(0.97); }
        .hs-empty { text-align: center; padding: 60px 20px; color: #6B7A6E; }
        .hs-empty-leaf { opacity: 0.5; margin-bottom: 10px; }
        .hs-list { display: flex; flex-direction: column; gap: 12px; }
        .hs-card { background: #1C2A20; border: 1px solid #2C3D31; border-radius: 14px; padding: 16px 16px 14px; animation: hsFadeIn 0.3s ease; }
        @keyframes hsFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .hs-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; gap: 10px; }
        .hs-card-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .hs-check { width: 30px; height: 30px; flex-shrink: 0; border-radius: 9px; border: 1.5px solid #3E5245; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s cubic-bezier(.34,1.56,.64,1); color: transparent; }
        .hs-check.checked { background: #6FA875; border-color: #6FA875; color: #10190F; transform: scale(1.05); }
        .hs-habit-name { font-size: 15.5px; font-weight: 500; color: #F2EFE4; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hs-card-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .hs-streak-mini { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #E8B84B; font-weight: 600; white-space: nowrap; }
        .hs-del-btn { background: none; border: none; color: #55645A; cursor: pointer; padding: 4px; display: flex; border-radius: 6px; transition: color 0.15s ease; }
        .hs-del-btn:hover { color: #C97A6B; }
        .hs-heatmap { display: flex; gap: 5px; }
        .hs-day { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .hs-day-dot { width: 100%; aspect-ratio: 1; border-radius: 6px; background: #263424; border: 1px solid #33452F; cursor: pointer; transition: transform 0.1s ease; }
        .hs-day-dot:hover { transform: scale(1.08); }
        .hs-day-dot.filled { background: #6FA875; border-color: #6FA875; }
        .hs-day-dot.today { box-shadow: 0 0 0 2px #E8B84B; }
        .hs-day-label { font-size: 9.5px; color: #5A6B5D; text-transform: lowercase; }
        .hs-footer-note { margin-top: 26px; text-align: center; font-size: 12px; color: #4E5C52; }
        .hs-section-title { font-family: 'Fraunces', serif; font-size: 19px; font-weight: 600; margin: 0 0 4px; color: #F2EFE4; }
        .hs-section-sub { color: #7C8C7F; font-size: 13px; margin-bottom: 16px; }
        .hs-panel { background: #1C2A20; border: 1px solid #2C3D31; border-radius: 14px; padding: 18px; margin-bottom: 16px; }
        .hs-panel-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid #26362A; }
        .hs-panel-row:last-child { border-bottom: none; }
        .hs-panel-label { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #D9E0D6; }
        .hs-time-input { background: #1E2D22; border: 1px solid #33453A; color: #F2EFE4; padding: 7px 10px; border-radius: 8px; font-size: 13px; font-family: inherit; }
        .hs-toggle { width: 40px; height: 22px; border-radius: 999px; border: none; cursor: pointer; position: relative; background: #33453A; transition: background 0.15s ease; }
        .hs-toggle.on { background: #6FA875; }
        .hs-toggle-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #F2EFE4; transition: transform 0.15s ease; }
        .hs-toggle.on .hs-toggle-knob { transform: translateX(18px); }
        .hs-hint { font-size: 11.5px; color: #5A6B5D; margin-top: 8px; line-height: 1.5; }
        .hs-nickname-form { display: flex; gap: 8px; margin-bottom: 16px; }
        .hs-leader-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-radius: 10px; margin-bottom: 8px; background: #1C2A20; border: 1px solid #2C3D31; }
        .hs-leader-row.me { border-color: #6FA875; background: rgba(111,168,117,0.1); }
        .hs-leader-left { display: flex; align-items: center; gap: 10px; }
        .hs-leader-rank { width: 22px; text-align: center; font-size: 13px; color: #7C8C7F; font-weight: 600; }
        .hs-leader-name { font-size: 14px; color: #F2EFE4; font-weight: 500; }
        .hs-leader-streak { display: flex; align-items: center; gap: 4px; color: #E8B84B; font-weight: 600; font-size: 13.5px; }
        .hs-support { background: #1C2A20; border: 1px solid rgba(232,184,75,0.3); border-radius: 14px; padding: 16px; margin-top: 20px; }
        .hs-support-top { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #E8B84B; margin-bottom: 6px; }
        .hs-support-text { font-size: 13px; color: #9AA89C; margin-bottom: 12px; line-height: 1.5; }
        .hs-pix-row { display: flex; gap: 8px; align-items: center; }
        .hs-pix-key { flex: 1; background: #1E2D22; border: 1px dashed #33453A; color: #D9E0D6; padding: 10px 12px; border-radius: 8px; font-size: 12.5px; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .hs-copy-btn { background: #2C3D31; border: 1px solid #3E5245; color: #F2EFE4; border-radius: 8px; padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-family: inherit; transition: background 0.15s ease; }
        .hs-copy-btn:hover { background: #3A4D3F; }
        .hs-coffee-link { display: inline-block; margin-top: 10px; color: #E8B84B; font-size: 12.5px; text-decoration: none; border-bottom: 1px solid rgba(232,184,75,0.4); }
      `}</style>

      <div className="hs-shell">
        <div className="hs-header">
          <div>
            <h1 className="hs-title">Cultivo diário</h1>
            <div className="hs-subtitle">
              {new Date().toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
          {habits.length > 0 && (
            <div className="hs-streak-badge">
              <Flame size={15} />
              {totalStreak} {totalStreak === 1 ? "dia seguido" : "dias seguidos"}
            </div>
          )}
        </div>

        {error && <div className="hs-error-banner">{error}</div>}

        <div className="hs-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={"hs-tab" + (tab === t.id ? " active" : "")}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "hoje" && (
          <>
            {atRiskHabits.length > 0 && (
              <div className="hs-risk-banner">
                <AlertTriangle size={18} />
                <span>
                  <b>
                    {atRiskHabits.length === 1
                      ? "1 sequência"
                      : `${atRiskHabits.length} sequências`}
                  </b>{" "}
                  em risco hoje — faltam {hoursUntilMidnight().toFixed(1)}h para
                  virar o dia.
                </span>
              </div>
            )}

            <form className="hs-add-form" onSubmit={addHabit}>
              <input
                className="hs-input"
                placeholder="Novo hábito, ex: ler 10 páginas"
                value={newHabit}
                onChange={(e) => setNewHabit(e.target.value)}
              />
              <button className="hs-add-btn" type="submit">
                <Plus size={16} /> Adicionar
              </button>
            </form>

            {loading ? (
              <div className="hs-empty">Carregando seus hábitos…</div>
            ) : habits.length === 0 ? (
              <div className="hs-empty">
                <div className="hs-empty-leaf">
                  <Leaf size={32} />
                </div>
                Nenhum hábito ainda. Plante o primeiro acima.
              </div>
            ) : (
              <div className="hs-list">
                {habits.map((habit) => {
                  const streak = computeStreak(habit.id);
                  const checkedToday = checkinsByHabit[habit.id]?.has(today);
                  return (
                    <div className="hs-card" key={habit.id}>
                      <div className="hs-card-top">
                        <div className="hs-card-left">
                          <button
                            className={"hs-check" + (checkedToday ? " checked" : "")}
                            onClick={() => toggleDay(habit.id, today)}
                            aria-label={
                              checkedToday
                                ? "Desmarcar hábito de hoje"
                                : "Marcar hábito de hoje"
                            }
                          >
                            {checkedToday ? "✓" : ""}
                          </button>
                          <span className="hs-habit-name">{habit.name}</span>
                        </div>
                        <div className="hs-card-right">
                          {streak > 0 && (
                            <span className="hs-streak-mini">
                              <Flame size={13} />
                              {streak}
                            </span>
                          )}
                          <button
                            className="hs-del-btn"
                            onClick={() => deleteHabit(habit.id)}
                            aria-label="Excluir hábito"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="hs-heatmap">
                        {last14.map((dateStr) => {
                          const filled = checkinsByHabit[habit.id]?.has(dateStr);
                          const isToday = dateStr === today;
                          return (
                            <div className="hs-day" key={dateStr}>
                              <div
                                className={
                                  "hs-day-dot" +
                                  (filled ? " filled" : "") +
                                  (isToday ? " today" : "")
                                }
                                onClick={() => toggleDay(habit.id, dateStr)}
                                title={dateStr}
                              />
                              <span className="hs-day-label">
                                {formatDayLabel(dateStr)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="hs-panel" style={{ marginTop: 20 }}>
              <div className="hs-panel-row">
                <div className="hs-panel-label">
                  <Bell size={15} />
                  Lembrete diário
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="time"
                    className="hs-time-input"
                    value={profile.reminder_time}
                    onChange={(e) => updateReminderTime(e.target.value)}
                  />
                  <button
                    className={"hs-toggle" + (profile.notify_enabled ? " on" : "")}
                    onClick={toggleNotifications}
                    aria-label="Ativar lembrete"
                  >
                    <span className="hs-toggle-knob" />
                  </button>
                </div>
              </div>
              <div className="hs-hint">
                {notifPermission === "denied"
                  ? "As notificações estão bloqueadas nas permissões do navegador."
                  : "Funciona enquanto esta aba fica aberta no navegador — não é um lembrete em segundo plano."}
              </div>
            </div>

            <div className="hs-support">
              <div className="hs-support-top">
                <Heart size={15} />
                Apoie o Cultivo diário
              </div>
              <div className="hs-support-text">
                Esse site é gratuito. Se ele te ajuda a manter seus hábitos, você
                pode apoiar com um Pix — sem nenhuma obrigação.
              </div>
              <div className="hs-pix-row">
                <div className="hs-pix-key">{PIX_KEY}</div>
                <button className="hs-copy-btn" onClick={copyPixKey}>
                  {pixCopied ? <Check size={13} /> : <Copy size={13} />}
                  {pixCopied ? "Copiado" : "Copiar"}
                </button>
              </div>
              {BUY_ME_A_COFFEE_URL && (
                <a
                  className="hs-coffee-link"
                  href={BUY_ME_A_COFFEE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  ou apoie pelo Buy Me a Coffee →
                </a>
              )}
            </div>
          </>
        )}

        {tab === "progresso" && (
          <>
            <h2 className="hs-section-title">Últimos 30 dias</h2>
            <div className="hs-section-sub">% de hábitos concluídos por dia</div>
            {habits.length === 0 ? (
              <div className="hs-empty">
                Adicione um hábito para ver seu progresso aqui.
              </div>
            ) : (
              <div className="hs-panel" style={{ height: 220, padding: "18px 8px 6px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#26362A" vertical={false} />
                    <XAxis dataKey="label" stroke="#5A6B5D" fontSize={10} tickLine={false} axisLine={false} interval={4} />
                    <YAxis stroke="#5A6B5D" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ background: "#1C2A20", border: "1px solid #2C3D31", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#9AA89C" }}
                      formatter={(value) => [value + "%", "concluído"]}
                    />
                    <Bar dataKey="pct" fill="#6FA875" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {habits.length > 0 && (
              <div className="hs-panel">
                {habits.map((h) => (
                  <div className="hs-panel-row" key={h.id}>
                    <div className="hs-panel-label">{h.name}</div>
                    <div className="hs-streak-mini">
                      <Flame size={13} />
                      {computeStreak(h.id)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "ranking" && (
          <>
            <h2 className="hs-section-title">Ranking com amigos</h2>
            <div className="hs-section-sub">
              Visível para qualquer pessoa que use este site — seu apelido e sua
              sequência ficam públicos aqui.
            </div>
            <form className="hs-nickname-form" onSubmit={saveNickname}>
              <input
                className="hs-input"
                placeholder="Seu apelido no ranking"
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
              />
              <button className="hs-add-btn" type="submit">
                {profile.nickname ? "Atualizar" : "Entrar no ranking"}
              </button>
            </form>
            {leaderboardLoading ? (
              <div className="hs-empty">Carregando ranking…</div>
            ) : leaderboard.length === 0 ? (
              <div className="hs-empty">
                Ninguém no ranking ainda. Seja a primeira pessoa a entrar.
              </div>
            ) : (
              <div>
                {leaderboard.map((entry, i) => (
                  <div
                    className={
                      "hs-leader-row" + (entry.nickname === profile.nickname ? " me" : "")
                    }
                    key={entry.nickname + i}
                  >
                    <div className="hs-leader-left">
                      <span className="hs-leader-rank">
                        {i === 0 ? <Crown size={15} color="#E8B84B" /> : i + 1}
                      </span>
                      <span className="hs-leader-name">{entry.nickname}</span>
                    </div>
                    <span className="hs-leader-streak">
                      <Flame size={13} />
                      {entry.streak}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div className="hs-footer-note">feito com 🌱 — cultivodiario</div>
      </div>
    </div>
  );
}
