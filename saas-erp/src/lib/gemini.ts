import { GoogleGenAI } from "@google/genai";
import { supabase } from './supabase';

export interface SchoolContext {
  studentCount: number | null;
  staffCount: number | null;
  presentToday: number;
  absentToday: number;
  totalMarkedToday: number;
  attPct: number | null;
  feeCollected: number;
  feeDue: number;
  collectionPct: number | null;
  openComplaints: number;
  pendingLeave: number;
  date: string;
}

export async function fetchSchoolContext(schoolId: string): Promise<SchoolContext> {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);
  const monthStart = `${currentMonth}-01`;
  const monthEndDate = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().split('T')[0];

  const [
    studentRes,
    staffRes,
    attRes,
    feeRes,
    complaintsRes,
    leaveRes,
  ] = await Promise.all([
    supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'active'),
    supabase.from('staff').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('is_active', true),
    supabase.from('attendance').select('status').eq('school_id', schoolId).eq('date', today),
    supabase.from('fee_records').select('paid_amount, total_amount').eq('school_id', schoolId).gte('month_year', monthStart).lte('month_year', monthEnd),
    supabase.from('complaints').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'open'),
    supabase.from('leave_applications').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('status', 'pending'),
  ]);

  const [studentError, staffError, attError, feeError, complaintsError, leaveError] = [
    studentRes.error,
    staffRes.error,
    attRes.error,
    feeRes.error,
    complaintsRes.error,
    leaveRes.error,
  ].filter(Boolean);

  if (studentError || staffError || attError || feeError || complaintsError || leaveError) {
    throw new Error(
      studentError?.message ||
      staffError?.message ||
      attError?.message ||
      feeError?.message ||
      complaintsError?.message ||
      leaveError?.message ||
      'Failed to load school context.'
    );
  }

  const studentCount = studentRes.count;
  const staffCount = staffRes.count;
  const attData = attRes.data;
  const feeData = feeRes.data;
  const openComplaints = complaintsRes.count;
  const pendingLeave = leaveRes.count;

  const presentToday = attData?.filter(a => a.status === 'present').length ?? 0;
  const absentToday = attData?.filter(a => a.status === 'absent').length ?? 0;
  const totalMarkedToday = attData?.length ?? 0;
  const attPct = totalMarkedToday > 0 ? Math.round((presentToday / totalMarkedToday) * 100) : null;

  const feeCollected = feeData?.reduce((s, f) => s + (f.paid_amount ?? 0), 0) ?? 0;
  const feeDue = feeData?.reduce((s, f) => s + (f.total_amount ?? 0), 0) ?? 0;
  const collectionPct = feeDue > 0 ? Math.round((feeCollected / feeDue) * 100) : null;

  return {
    studentCount: studentCount ?? null,
    staffCount: staffCount ?? null,
    presentToday,
    absentToday,
    totalMarkedToday,
    attPct,
    feeCollected,
    feeDue,
    collectionPct,
    openComplaints: openComplaints ?? 0,
    pendingLeave: pendingLeave ?? 0,
    date: today,
  };
}

export function buildSystemPrompt(ctx: SchoolContext, schoolName: string): string {
  if (!ctx) return `You are EduBot, the AI assistant for ${schoolName}.`;

  const attLine = ctx.attPct !== null
    ? `${ctx.attPct}% (${ctx.presentToday} present, ${ctx.absentToday} absent out of ${ctx.totalMarkedToday} marked)`
    : 'Not yet marked for today';

  const feeLine = ctx.collectionPct !== null
    ? `${ctx.collectionPct}% collected — ${(ctx.feeCollected || 0).toLocaleString()} of ${(ctx.feeDue || 0).toLocaleString()} due this month`
    : 'No fee data for current month';

  return `You are EduBot, the AI assistant for ${schoolName} school management system.

== Live School Data (${ctx.date}) ==
- Active students: ${ctx.studentCount ?? 'unknown'}
- Active staff: ${ctx.staffCount ?? 'unknown'}
- Today's attendance: ${attLine}
- This month's fee collection: ${feeLine}
- Open complaints: ${ctx.openComplaints}
- Pending leave requests: ${ctx.pendingLeave}

== Task Execution Capabilities ==
You can perform tasks by proposing them in your response using this EXACT format:
[[TASK: task_name, { "param1": "value1", ... }]]

Available Tasks:
1. broadcast_notification: { "title": "string", "message": "string", "target": "all" | "teachers" | "parents" }
   - Use this for school-wide alerts, holiday notices, or general announcements.
2. prepare_whatsapp: { "phone": "string", "message": "string" }
   - Use this when the user asks to "send a message" to a specific number.

== Instructions ==
- Be concise and actionable.
- If a user request involves an action (like "Send a notice" or "Remind parents"), ALWAYS include the [[TASK: ...]] tag at the end of your response.
- Use the real data above when answering.
- Keep responses under 250 words.`;
}

export async function* streamGemini(
  systemPrompt: string,
  history: { role: 'user' | 'model'; text: string }[]
): AsyncGenerator<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    yield "Error: Gemini API Key (VITE_GEMINI_API_KEY) is missing in environment variables.";
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Convert history to the format expected by SDK v1.46.0
    // Role 'user' or 'model' is expected
    const contents = history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

    const response = await ai.models.generateContentStream({
      model: "gemini-1.5-flash",
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });

    for await (const chunk of response) {
      // Robust way to get text from chunk, handling both getter and function cases
      let text = '';
      try {
        if (typeof (chunk as any).text === 'function') {
          text = (chunk as any).text();
        } else {
          text = chunk.text || '';
        }
      } catch (e) {
        // Ultimate fallback to internal structure
        text = (chunk as any).candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
      }
      
      if (text) yield text;
    }
  } catch (err: any) {
    console.error('Gemini SDK Error:', err);
    throw new Error(`Gemini SDK Error: ${err.message || 'Failed to communicate with AI'}`);
  }
}
