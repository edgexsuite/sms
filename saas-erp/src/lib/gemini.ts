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
  recentAbsentees?: { name: string; class: string; phone?: string }[];
  topDefaulters?: { name: string; class: string; dues: number; phone?: string }[];
  pendingLeaveList?: { id: string; staffName: string; reason: string; dates: string }[];
  openComplaintList?: { id: string; title: string; sender: string; description: string }[];
}

export async function fetchSchoolContext(schoolId: string): Promise<SchoolContext> {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = today.slice(0, 7);
  const monthStart = `${currentMonth}-01`;
  const monthEndDate = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0);
  const monthEnd = monthEndDate.toISOString().split('T')[0];

  let studentCount: number | null = null;
  let staffCount: number | null = null;
  let attData: any[] = [];
  let feeData: any[] = [];
  let openComplaints = 0;
  let pendingLeave = 0;
  let pendingLeaveList: any[] = [];
  let openComplaintList: any[] = [];

  try {
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('status', 'active')
      .eq('is_deleted', false);
    studentCount = count;
  } catch (e) {
    console.warn('Could not fetch student count:', e);
  }

  try {
    const { count } = await supabase
      .from('staff')
      .select('*', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('is_active', true);
    staffCount = count;
  } catch (e) {
    console.warn('Could not fetch staff count:', e);
  }

  try {
    const { data } = await supabase
      .from('attendance')
      .select('status, student_id, staff_id, students(full_name, roll_number, class_id, classes(name, section))')
      .eq('school_id', schoolId)
      .eq('date', today);
    if (data) attData = data;
  } catch (e) {
    console.warn('Could not fetch attendance:', e);
  }

  try {
    const { data } = await supabase
      .from('fee_records')
      .select('paid_amount, total_amount, status, student_id, students(full_name, classes(name, section), parents(whatsapp_number, mobile_number))')
      .eq('school_id', schoolId)
      .gte('month_year', monthStart)
      .lte('month_year', monthEnd);
    if (data) feeData = data;
  } catch (e) {
    console.warn('Could not fetch fees:', e);
  }

  try {
    const { data, count } = await supabase
      .from('complaints')
      .select('id, title, description, parent_name, student_name, status', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('status', 'open')
      .limit(5);
    openComplaints = count || 0;
    if (data) {
      openComplaintList = data.map(c => ({
        id: c.id,
        title: c.title || 'Complaint',
        sender: c.parent_name || c.student_name || 'Parent',
        description: c.description || ''
      }));
    }
  } catch (e) {
    console.warn('Could not fetch complaints:', e);
  }

  // Check leave applications (support both leave_applications and leave_requests)
  try {
    const { data, count } = await supabase
      .from('leave_applications')
      .select('id, reason, start_date, end_date, staff:staff_id(full_name)', { count: 'exact' })
      .eq('school_id', schoolId)
      .eq('status', 'pending')
      .limit(5);
    pendingLeave = count || 0;
    if (data) {
      pendingLeaveList = data.map((l: any) => ({
        id: l.id,
        staffName: l.staff?.full_name || 'Staff Member',
        reason: l.reason || 'Personal Leave',
        dates: `${l.start_date || ''} to ${l.end_date || ''}`
      }));
    }
  } catch {
    try {
      const { data, count } = await supabase
        .from('leave_requests')
        .select('id, reason, start_date, end_date, staff_name', { count: 'exact' })
        .eq('school_id', schoolId)
        .eq('status', 'pending')
        .limit(5);
      pendingLeave = count || 0;
      if (data) {
        pendingLeaveList = data.map((l: any) => ({
          id: l.id,
          staffName: l.staff_name || 'Staff Member',
          reason: l.reason || 'Personal Leave',
          dates: `${l.start_date || ''} to ${l.end_date || ''}`
        }));
      }
    } catch (e) {
      console.warn('Could not fetch leave requests:', e);
    }
  }

  const presentToday = attData.filter(a => a.status === 'present').length;
  const absentToday = attData.filter(a => a.status === 'absent').length;
  const totalMarkedToday = attData.length;
  const attPct = totalMarkedToday > 0 ? Math.round((presentToday / totalMarkedToday) * 100) : null;

  const feeCollected = feeData.reduce((s, f) => s + (Number(f.paid_amount) || 0), 0);
  const feeDue = feeData.reduce((s, f) => s + (Number(f.total_amount) || 0), 0);
  const collectionPct = feeDue > 0 ? Math.round((feeCollected / feeDue) * 100) : null;

  // Extract recent absentees
  const recentAbsentees = attData
    .filter(a => a.status === 'absent' && a.students)
    .slice(0, 8)
    .map(a => ({
      name: a.students?.full_name || 'Student',
      class: a.students?.classes ? `${a.students.classes.name} (${a.students.classes.section})` : 'Class',
      phone: ''
    }));

  // Extract top fee defaulters
  const topDefaulters = feeData
    .filter(f => (Number(f.total_amount) || 0) > (Number(f.paid_amount) || 0) && f.students)
    .slice(0, 6)
    .map(f => ({
      name: f.students?.full_name || 'Student',
      class: f.students?.classes ? `${f.students.classes.name} (${f.students.classes.section})` : 'Class',
      dues: (Number(f.total_amount) || 0) - (Number(f.paid_amount) || 0),
      phone: f.students?.parents?.whatsapp_number || f.students?.parents?.mobile_number || ''
    }));

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
    openComplaints,
    pendingLeave,
    date: today,
    recentAbsentees,
    topDefaulters,
    pendingLeaveList,
    openComplaintList
  };
}

export function buildSystemPrompt(ctx: SchoolContext, schoolName: string): string {
  if (!ctx) return `You are EduBot, the AI assistant for ${schoolName}.`;

  const attLine = ctx.attPct !== null
    ? `${ctx.attPct}% (${ctx.presentToday} present, ${ctx.absentToday} absent out of ${ctx.totalMarkedToday} marked)`
    : 'Not yet marked for today';

  const feeLine = ctx.collectionPct !== null
    ? `${ctx.collectionPct}% collected — PKR ${(ctx.feeCollected || 0).toLocaleString()} of PKR ${(ctx.feeDue || 0).toLocaleString()} due this month`
    : 'No fee data for current month';

  return `You are EduBot, the AI Assistant and Executive Copilot for ${schoolName}.
You assist the School Principal, Director, and Administrators with school management, drafting circulars, broadcasting alerts, reviewing attendance, fee tracking, approving staff leaves, and handling complaints.

== Live School Snapshot (${ctx.date}) ==
- School Name: ${schoolName}
- Total Active Students: ${ctx.studentCount ?? 'unknown'}
- Total Active Staff: ${ctx.staffCount ?? 'unknown'}
- Today's Attendance: ${attLine}
- This Month's Fee Collection: ${feeLine}
- Open Complaints: ${ctx.openComplaints}
- Pending Staff Leaves: ${ctx.pendingLeave}

== Available Automated Tasks ==
When performing or proposing an action on behalf of the administration, include the corresponding task block in your response:
1. Broadcast notification to portal dashboard:
   [[TASK: broadcast_notification, { "title": "Notice Title", "message": "Full notice body", "target": "all" | "teachers" | "parents" | "students" }]]

2. Prepare WhatsApp message for a parent/staff:
   [[TASK: prepare_whatsapp, { "phone": "03001234567", "message": "Pre-filled polite message" }]]

3. Review & approve staff leave:
   [[TASK: review_leaves, {}]]

4. Review & resolve complaints:
   [[TASK: review_complaints, {}]]

5. Show fee defaulters list:
   [[TASK: show_fee_defaulters, {}]]

6. Show today's absentees:
   [[TASK: show_absentees, {}]]

7. Direct Navigation:
   [[TASK: navigate_to, { "path": "/fees/invoices", "label": "Open Invoices" }]]

== Guidelines ==
- Speak clearly, concisely, and professionally in simple English or Urdu if asked.
- Provide completed, ready-to-use circulars, letters, or notifications.
- Include the appropriate [[TASK: ...]] tag whenever the administrator asks you to announce, broadcast, message, remind, or perform an action.`;
}

/**
 * Built-in Autonomous School Intelligence Engine.
 * Provides instant, free, reliable responses without requiring an external Gemini API key.
 */
async function* runBuiltInSchoolAgent(
  userQuery: string,
  ctx: SchoolContext,
  schoolName: string
): AsyncGenerator<string> {
  const q = userQuery.toLowerCase().trim();

  // Helper delay to provide natural streaming feel
  const streamText = async function* (fullText: string) {
    const words = fullText.split(' ');
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(' ') + (i + 3 < words.length ? ' ' : '');
      yield chunk;
      await new Promise(r => setTimeout(r, 22));
    }
  };

  // ── 1. Holiday & Smog Notices ──────────────────────────────────────────────
  if (q.includes('holiday') || q.includes('smog') || q.includes('rain') || q.includes('closed') || q.includes('off') || q.includes('winter') || q.includes('vacation')) {
    const isSmog = q.includes('smog') || q.includes('pollution') || q.includes('weather');
    const isRain = q.includes('rain') || q.includes('flood') || q.includes('storm');
    
    const reason = isSmog ? 'due to severe smog and air quality advisories' :
                   isRain ? 'due to heavy rainfall and weather warnings' :
                   'as per official government directives';

    const noticeTitle = isSmog ? 'School Closure Notice - Smog Alert' :
                        isRain ? 'Emergency Weather Advisory - School Closed' :
                        'Important Notice: School Holiday';

    const noticeBody = `Dear Parents & Staff,

Please be informed that ${schoolName} will remain closed tomorrow ${reason}. 

Online academic support and daily diary assignments will be shared through the portal. Regular classes are scheduled to resume following the advisory. 

Warm regards,
Principal Office, ${schoolName}`;

    const reply = `I have drafted the official holiday notice for you and prepared the broadcast action:

**${noticeTitle}**
---
${noticeBody}

You can broadcast this notice to all parents and teachers immediately using the button below:

[[TASK: broadcast_notification, { "title": "${noticeTitle}", "message": "${noticeBody.replace(/\n/g, '\\n')}", "target": "all" }]]`;

    yield* streamText(reply);
    return;
  }

  // ── 2. Attendance & Absentee Inquiries ────────────────────────────────────
  if (q.includes('attendance') || q.includes('absent') || q.includes('present') || q.includes('who is absent') || q.includes('attendance summary')) {
    const attPctText = ctx.attPct !== null ? `${ctx.attPct}%` : 'Not recorded yet';
    const present = ctx.presentToday || 0;
    const absent = ctx.absentToday || 0;
    const total = ctx.totalMarkedToday || 0;

    let absenteesText = '';
    if (ctx.recentAbsentees && ctx.recentAbsentees.length > 0) {
      absenteesText = `\n\n**Absent Students Marked Today:**\n` + 
        ctx.recentAbsentees.map((s, idx) => `${idx + 1}. **${s.name}** (${s.class})`).join('\n');
    }

    const reply = `Here is today's attendance summary for **${schoolName}** (${ctx.date}):

• **Attendance Rate:** ${attPctText}
• **Present Today:** ${present} students / staff
• **Absent Today:** ${absent}
• **Total Marked:** ${total}${absenteesText}

Would you like me to send an automated absentee alert to the parents? You can view and message absentees below:

[[TASK: show_absentees, {}]]`;

    yield* streamText(reply);
    return;
  }

  // ── 3. Fee Collection & Defaulters ─────────────────────────────────────────
  if (q.includes('fee') || q.includes('defaulter') || q.includes('collection') || q.includes('dues') || q.includes('unpaid') || q.includes('challan')) {
    const colPct = ctx.collectionPct !== null ? `${ctx.collectionPct}%` : 'Pending calculation';
    const collected = (ctx.feeCollected || 0).toLocaleString();
    const due = (ctx.feeDue || 0).toLocaleString();

    let defaultersText = '';
    if (ctx.topDefaulters && ctx.topDefaulters.length > 0) {
      defaultersText = `\n\n**Recent Outstanding Accounts:**\n` +
        ctx.topDefaulters.map((d, i) => `${i + 1}. **${d.name}** (${d.class}) — Dues: PKR ${d.dues.toLocaleString()}`).join('\n');
    }

    const reply = `Here is the current fee status for **${schoolName}**:

• **Monthly Collection Progress:** ${colPct}
• **Total Collected:** PKR ${collected}
• **Total Invoiced:** PKR ${due}
• **Pending Dues:** PKR ${(ctx.feeDue - ctx.feeCollected > 0 ? (ctx.feeDue - ctx.feeCollected).toLocaleString() : '0')}${defaultersText}

I can help you send polite fee reminder notices to parents via in-app broadcast or WhatsApp:

[[TASK: show_fee_defaulters, {}]]`;

    yield* streamText(reply);
    return;
  }

  // ── 4. Staff Leave Applications ───────────────────────────────────────────
  if (q.includes('leave') || q.includes('application') || q.includes('sick leave') || q.includes('casual leave')) {
    const pendingCount = ctx.pendingLeave || 0;
    let leavesList = '';
    if (ctx.pendingLeaveList && ctx.pendingLeaveList.length > 0) {
      leavesList = `\n\n**Pending Applications:**\n` +
        ctx.pendingLeaveList.map((l, i) => `${i + 1}. **${l.staffName}**: ${l.reason} (${l.dates})`).join('\n');
    }

    const reply = `You currently have **${pendingCount}** pending staff leave request${pendingCount === 1 ? '' : 's'}.${leavesList}

Click below to review and approve or reject pending leave requests:

[[TASK: review_leaves, {}]]`;

    yield* streamText(reply);
    return;
  }

  // ── 5. Complaints & Feedback ──────────────────────────────────────────────
  if (q.includes('complaint') || q.includes('grievance') || q.includes('issue') || q.includes('feedback')) {
    const openCount = ctx.openComplaints || 0;
    let complaintsList = '';
    if (ctx.openComplaintList && ctx.openComplaintList.length > 0) {
      complaintsList = `\n\n**Open Complaints:**\n` +
        ctx.openComplaintList.map((c, i) => `${i + 1}. **${c.title}** from ${c.sender} — "${c.description.slice(0, 80)}${c.description.length > 80 ? '...' : ''}"`).join('\n');
    }

    const reply = `There are currently **${openCount}** open complaint${openCount === 1 ? '' : 's'} registered in the system.${complaintsList}

Click below to view details and mark complaints as resolved:

[[TASK: review_complaints, {}]]`;

    yield* streamText(reply);
    return;
  }

  // ── 6. Parent-Teacher Meeting (PTM) ───────────────────────────────────────
  if (q.includes('ptm') || q.includes('parent teacher meeting') || q.includes('meeting notice')) {
    const ptmTitle = 'Parent-Teacher Meeting (PTM) Notification';
    const ptmBody = `Dear Respected Parents,

You are cordially invited to attend the Parent-Teacher Meeting (PTM) this Saturday from 9:00 AM to 1:00 PM at ${schoolName}.

This meeting is an important opportunity to discuss your child's academic progress, class behavior, and upcoming term evaluations. Please ensure punctuality.

Best regards,
Administration, ${schoolName}`;

    const reply = `I have drafted the official PTM meeting circular for you:

**${ptmTitle}**
---
${ptmBody}

You can broadcast this notification to all parents right now:

[[TASK: broadcast_notification, { "title": "${ptmTitle}", "message": "${ptmBody.replace(/\n/g, '\\n')}", "target": "parents" }]]`;

    yield* streamText(reply);
    return;
  }

  // ── 7. Direct Navigation Request ──────────────────────────────────────────
  if (q.includes('navigate') || q.includes('go to') || q.includes('open page') || q.includes('take me to') || q.includes('where is')) {
    let targetPath = '/dashboard';
    let label = 'Dashboard';

    if (q.includes('fee') || q.includes('challan') || q.includes('invoice')) {
      targetPath = '/fees/invoices';
      label = 'Fee Invoices';
    } else if (q.includes('student')) {
      targetPath = '/students';
      label = 'Student List';
    } else if (q.includes('staff') || q.includes('teacher')) {
      targetPath = '/staff';
      label = 'Staff Directory';
    } else if (q.includes('attendance') || q.includes('qr')) {
      targetPath = '/attendance/daily-report';
      label = 'Daily Attendance';
    } else if (q.includes('report') || q.includes('arrear')) {
      targetPath = '/reports';
      label = 'Reports Hub';
    } else if (q.includes('timetable') || q.includes('substitution')) {
      targetPath = '/timetable';
      label = 'Timetable';
    } else if (q.includes('setting')) {
      targetPath = '/settings';
      label = 'School Settings';
    }

    const reply = `I can take you directly to **${label}**. Click the button below:

[[TASK: navigate_to, { "path": "${targetPath}", "label": "Open ${label}" }]]`;

    yield* streamText(reply);
    return;
  }

  // ── 8. Default Executive Briefing & Assistance ─────────────────────────────
  const reply = `Hello! I am **EduBot**, your AI Executive Assistant for **${schoolName}**.

Here is your quick status update for today (${ctx.date}):
• **Active Students:** ${ctx.studentCount ?? '—'}
• **Active Staff:** ${ctx.staffCount ?? '—'}
• **Attendance Rate:** ${ctx.attPct !== null ? `${ctx.attPct}%` : 'Pending attendance'}
• **Fee Collection:** ${ctx.collectionPct !== null ? `${ctx.collectionPct}%` : 'In progress'}
• **Open Inquiries / Complaints:** ${ctx.openComplaints}
• **Pending Leaves:** ${ctx.pendingLeave}

**What would you like me to do for you right now?**
1. 📢 **Broadcast a Notice** (e.g., "Draft a smog holiday notice")
2. 💳 **Fee Management** (e.g., "Who are the top fee defaulters?")
3. 📊 **Attendance Review** (e.g., "Who is absent today?")
4. 📝 **Staff Leaves** (e.g., "Show pending leave requests")
5. 💬 **Send WhatsApp Reminders** to parents or teachers`;

  yield* streamText(reply);
}

/**
 * Main Streaming Function:
 * Tries Google Gemini API first if VITE_GEMINI_API_KEY is available.
 * If no key is set or an API error occurs, falls back smoothly to the
 * built-in Autonomous School Intelligence Engine. No user API key required!
 */
export async function* streamGemini(
  systemPrompt: string,
  history: { role: 'user' | 'model'; text: string }[],
  schoolContext?: SchoolContext,
  schoolName: string = 'Our School'
): AsyncGenerator<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const lastUserMessage = history.filter(h => h.role === 'user').slice(-1)[0]?.text || '';
  const ctx = schoolContext || {
    studentCount: null,
    staffCount: null,
    presentToday: 0,
    absentToday: 0,
    totalMarkedToday: 0,
    attPct: null,
    feeCollected: 0,
    feeDue: 0,
    collectionPct: null,
    openComplaints: 0,
    pendingLeave: 0,
    date: new Date().toISOString().split('T')[0]
  };

  // If Gemini API Key is configured, attempt official Google Gemini streaming
  if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI({ apiKey });
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

      let streamedAny = false;
      for await (const chunk of response) {
        let text = '';
        try {
          if (typeof (chunk as any).text === 'function') {
            text = (chunk as any).text();
          } else {
            text = chunk.text || '';
          }
        } catch {
          text = (chunk as any).candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text || '';
        }

        if (text) {
          streamedAny = true;
          yield text;
        }
      }

      if (streamedAny) return;
    } catch (err) {
      console.warn('Gemini API call failed, switching to Built-in Autonomous Engine:', err);
    }
  }

  // ── Default Free Engine Fallback (Zero API required) ───────────────────────
  yield* runBuiltInSchoolAgent(lastUserMessage, ctx, schoolName);
}
