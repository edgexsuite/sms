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
  const attLine = ctx.attPct !== null
    ? `${ctx.attPct}% (${ctx.presentToday} present, ${ctx.absentToday} absent out of ${ctx.totalMarkedToday} marked)`
    : 'Not yet marked for today';

  const feeLine = ctx.collectionPct !== null
    ? `${ctx.collectionPct}% collected — ${ctx.feeCollected.toLocaleString()} of ${ctx.feeDue.toLocaleString()} due this month`
    : 'No fee data for current month';

  return `You are EduBot, the AI assistant for ${schoolName} school management system.

== Live School Data (${ctx.date}) ==
- Active students: ${ctx.studentCount ?? 'unknown'}
- Active staff: ${ctx.staffCount ?? 'unknown'}
- Today's attendance: ${attLine}
- This month's fee collection: ${feeLine}
- Open complaints: ${ctx.openComplaints}
- Pending leave requests: ${ctx.pendingLeave}

== Instructions ==
- Be concise and actionable. Lead with the insight, then give context.
- Use the real data above when answering questions about attendance, fees, students, or staff.
- Format numbers with commas. Use percentages clearly.
- When suggesting actions, be specific (e.g., "send a reminder to parents of the ${ctx.absentToday} absent students").
- If something is outside the data provided, say so honestly — do not guess.
- Keep responses under 250 words unless the user explicitly asks for more detail.
- You can suggest follow-up questions at the end of your response.`;
}

export async function* streamGemini(
  systemPrompt: string,
  history: { role: 'user' | 'model'; text: string }[]
): AsyncGenerator<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.text,
    })),
  ];

  const response = await fetch('/api/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'groq',
      endpoint: 'chat/completions',
      payload: {
        model: 'llama-3.1-8b-instant',
        messages,
        stream: true,
        temperature: 0.4,
      }
    }),
  });

  if (!response.ok || !response.body) {
    let errorMessage = 'Failed to get response from AI Proxy.';
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error?.message || errorData?.error || errorMessage;
      if (response.status === 429) {
        errorMessage = `AI quota or rate limit hit. ${errorMessage}`;
      }
    } catch {
      // Ignore JSON parse failure and use the fallback message.
    }
    throw new Error(errorMessage);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const lines = event
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .filter(line => line.startsWith('data:'));

      for (const line of lines) {
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // Ignore malformed chunks and continue streaming.
        }
      }
    }
  }
}
