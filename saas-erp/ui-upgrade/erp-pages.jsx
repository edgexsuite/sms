// ── Horizontal mini bar (for reports) ────────────────────────────────────
function MiniBar({ value, max, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:C.borderSoft, borderRadius:100 }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:100, transition:'width .4s' }} />
      </div>
      <span style={{ fontSize:11, fontWeight:600, color:C.ink3, minWidth:32, textAlign:'right' }}>{pct}%</span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function DashboardPage({ setPage }) {
  const [activeTab, setActiveTab] = React.useState('attention');
  const [attMap, setAttMap] = React.useState(() =>
    Object.fromEntries(ATTENDANCE_ROSTER.map(s => [s.id, s.status]))
  );

  return (
    <div style={{ maxWidth:1200, margin:'0 auto' }}>
      {/* Page header */}
      <PageHeader
        title={SCHOOL.name}
        subtitle="Good morning — here's today's overview."
        actions={<>
          <Btn variant="secondary" onClick={() => setPage('students-add')}>+ Add Student</Btn>
          <Btn onClick={() => setPage('fees')}>Fee Invoices</Btn>
        </>}
      />

      {/* Alert pills */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:24 }}>
        {ALERTS.map((a, i) => {
          const colors = {
            danger:  { bg:C.dangerBg,  color:C.dangerText,  dot:C.danger  },
            warning: { bg:C.warningBg, color:C.warningText, dot:C.warning },
            success: { bg:C.successBg, color:C.successText, dot:C.success },
          };
          const s = colors[a.type];
          return (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:6,
              background:s.bg, border:`1px solid ${s.dot}22`,
              borderRadius:100, padding:'5px 12px', cursor:'pointer',
              fontSize:12, fontWeight:500, color:s.color }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:s.dot, flexShrink:0 }}/>
              {a.label}
            </div>
          );
        })}
      </div>

      {/* Stat Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
        {STATS.map(st => (
          <div key={st.label} onClick={() => setPage(st.link)}
            style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
              padding:20, cursor:'pointer', transition:'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#d1d5db'}
            onMouseLeave={e => e.currentTarget.style.borderColor=C.border}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:st.colorBg,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                {st.icon}
              </div>
              {st.trend && (
                <span style={{ fontSize:11, fontWeight:600, color:C.successText,
                  background:C.successBg, padding:'2px 8px', borderRadius:100 }}>
                  {st.trend}
                </span>
              )}
            </div>
            <div style={{ fontSize:24, fontWeight:700, color:C.ink, letterSpacing:'-.03em', lineHeight:1 }}>
              {st.value}
            </div>
            <div style={{ fontSize:13, fontWeight:500, color:C.ink3, marginTop:5 }}>{st.label}</div>
            <div style={{ fontSize:12, color:C.ink4, marginTop:3 }}>{st.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:16 }}>
        {/* Bar chart */}
        <Card style={{ padding:24 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:600, color:C.ink, letterSpacing:'-.01em' }}>Financial Pulse</div>
              <div style={{ fontSize:12, color:C.ink4, marginTop:3 }}>Income vs Expenses — last 6 months</div>
            </div>
            <div style={{ display:'flex', gap:14 }}>
              {[{color:'#6366f1',label:'Income'},{color:'#fb7185',label:'Expense'}].map(l => (
                <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:l.color }}/>
                  <span style={{ fontSize:11, color:C.ink4, fontWeight:500 }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ height:190 }}><BarChart data={MONTHLY} /></div>
        </Card>

        {/* Donut */}
        <Card style={{ padding:24, display:'flex', flexDirection:'column' }}>
          <div style={{ fontSize:15, fontWeight:600, color:C.ink, letterSpacing:'-.01em', marginBottom:4 }}>Revenue Split</div>
          <div style={{ fontSize:12, color:C.ink4, marginBottom:20 }}>Fee collection status</div>
          <DonutChart data={FEE_STATUS} />
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:20 }}>
            {FEE_STATUS.map(f => {
              const total = FEE_STATUS.reduce((s,d) => s+d.value, 0);
              return (
                <div key={f.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:f.color, flexShrink:0 }}/>
                    <span style={{ fontSize:13, color:C.ink2 }}>{f.label}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:13, fontWeight:600, color:C.ink }}>{f.value}</span>
                    <span style={{ fontSize:11, color:C.ink4 }}>{Math.round(f.value/total*100)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Operations + Quick Actions */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16 }}>
        {/* Tabbed panel */}
        <Card>
          <div style={{ display:'flex', borderBottom:`1px solid ${C.borderSoft}`, background:C.bg, borderRadius:'12px 12px 0 0', overflow:'hidden' }}>
            {[
              { id:'attention', label:'Needs Attention', count:8 },
              { id:'recent',    label:'Recent Activity', count:RECENT_ACTIVITY.length },
              { id:'defaulters',label:'Fee Defaulters',  count:42 },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex:1, padding:'13px 8px', border:'none', cursor:'pointer',
                  background: activeTab===tab.id ? C.surface : 'transparent',
                  borderBottom: activeTab===tab.id ? `2px solid ${C.primary}` : '2px solid transparent',
                  fontFamily:'inherit', fontSize:12, fontWeight:600,
                  color: activeTab===tab.id ? C.primary : C.ink3,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all .15s' }}>
                {tab.label}
                {tab.count > 0 && (
                  <span style={{ fontSize:10, fontWeight:700,
                    background: activeTab===tab.id ? C.primary : C.borderSoft,
                    color: activeTab===tab.id ? '#fff' : C.ink3,
                    padding:'1px 6px', borderRadius:100 }}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>
          <div style={{ padding:16, height:320, overflowY:'auto' }}>
            {activeTab === 'attention' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { icon:'💬', label:'3 Open Complaints', sub:'Require admin response', color:C.dangerBg, tc:C.dangerText, link:'complaints' },
                  { icon:'📋', label:'5 Leave Requests Pending', sub:'Awaiting approval', color:C.warningBg, tc:C.warningText, link:'leave' },
                ].map((a,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', borderRadius:9, background:a.color, cursor:'pointer' }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {a.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>{a.label}</div>
                      <div style={{ fontSize:12, color:a.tc, marginTop:2 }}>{a.sub}</div>
                    </div>
                    <span style={{ color:C.ink4, fontSize:12 }}>→</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'recent' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {RECENT_ACTIVITY.map((item, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'10px 12px', borderRadius:9, background:C.bg,
                    border:`1px solid ${C.borderSoft}` }}>
                    <div style={{ width:34, height:34, borderRadius:8, flexShrink:0,
                      background: item.status==='paid' ? C.successBg : C.warningBg,
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>
                      {item.status==='paid' ? '✅' : '⏳'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:C.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {item.inv}
                      </div>
                      <div style={{ fontSize:11, color:C.ink4, marginTop:2 }}>
                        {item.student} · {item.class} · {item.month}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.ink }}>Rs. {item.amount.toLocaleString()}</div>
                      <Badge status={item.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'defaulters' && (
              <EmptyState icon="🚧" title="Coming soon" sub="Class-wise defaulter reports are being compiled." />
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card style={{ padding:20 }}>
          <div style={{ fontSize:12, fontWeight:600, color:C.ink3, marginBottom:14, textTransform:'uppercase', letterSpacing:'.08em' }}>
            Quick Access
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { icon:'🎓', label:'Students',    page:'students'  },
              { icon:'✅', label:'Attendance',  page:'attendance'},
              { icon:'🧾', label:'Invoices',    page:'fees'      },
              { icon:'🏆', label:'Results',     page:'result'    },
              { icon:'📢', label:'Notices',     page:'settings'  },
              { icon:'📊', label:'Reports',     page:'accounting'},
            ].map(a => (
              <div key={a.page} onClick={() => setPage(a.page)}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                  padding:'14px 8px', borderRadius:9, background:C.bg, cursor:'pointer',
                  border:`1px solid ${C.borderSoft}`, transition:'all .15s' }}
                onMouseEnter={e => { e.currentTarget.style.background=C.surface; e.currentTarget.style.boxShadow='0 2px 12px rgba(0,0,0,.06)'; e.currentTarget.style.borderColor=C.border; }}
                onMouseLeave={e => { e.currentTarget.style.background=C.bg; e.currentTarget.style.boxShadow=''; e.currentTarget.style.borderColor=C.borderSoft; }}>
                <div style={{ fontSize:20 }}>{a.icon}</div>
                <span style={{ fontSize:11, fontWeight:500, color:C.ink3 }}>{a.label}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop:14, padding:14, borderRadius:9, background:'linear-gradient(135deg,#4f46e5,#7c3aed)', color:'#fff' }}>
            <div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginBottom:4, fontWeight:500 }}>System Status</div>
            <div style={{ fontSize:13, fontWeight:600 }}>✓ All systems operational</div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Students ──────────────────────────────────────────────────────────────
function StudentsPage({ setPage }) {
  const [search, setSearch] = React.useState('');
  const [classFilter, setClassFilter] = React.useState('');
  const [statusTab, setStatusTab] = React.useState('active');

  const classes = [...new Set(STUDENTS.map(s => s.class))].sort();
  const filtered = STUDENTS.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.roll.includes(search);
    const matchClass  = !classFilter || s.class === classFilter;
    const matchStatus = s.status === statusTab;
    return matchSearch && matchClass && matchStatus;
  });

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      <PageHeader title="Students" subtitle={`${STUDENTS.filter(s=>s.status==='active').length} active students enrolled`}
        actions={<>
          <Btn variant="secondary">⬆ Import</Btn>
          <Btn onClick={() => setPage('students-add')}>+ Register Student</Btn>
        </>}
      />

      {/* Status tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20, background:C.borderSoft, padding:3, borderRadius:9, width:'fit-content' }}>
        {['active','left','graduated'].map(t => (
          <button key={t} onClick={() => setStatusTab(t)}
            style={{ padding:'6px 16px', borderRadius:7, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:13, fontWeight:500, transition:'all .15s',
              background: statusTab===t ? C.surface : 'transparent',
              color: statusTab===t ? C.ink : C.ink3,
              boxShadow: statusTab===t ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
            }}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or roll no…" style={{ maxWidth:280 }} />
        <Select value={classFilter} onChange={e=>setClassFilter(e.target.value)} style={{ maxWidth:200 }}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c}>{c}</option>)}
        </Select>
      </div>

      <Card>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
              {['Roll #','Student Name','Class','Joined','Fee Status','Status',''].map(h => (
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700,
                  color:C.ink3, textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}><EmptyState icon="🔍" title="No students found" sub="Try adjusting your search or filters" /></td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} style={{ borderBottom:`1px solid ${C.borderSoft}`, transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background=C.bg}
                onMouseLeave={e => e.currentTarget.style.background=''}>
                <td style={{ padding:'11px 16px', fontSize:13, fontFamily:'monospace', color:C.ink3 }}>{s.roll}</td>
                <td style={{ padding:'11px 16px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:30, height:30, borderRadius:8, background:C.primaryBg,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:12, fontWeight:700, color:C.primary, flexShrink:0 }}>
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>{s.name}</div>
                      <div style={{ fontSize:11, color:C.ink4 }}>{s.dob}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding:'11px 16px', fontSize:13, color:C.ink2 }}>{s.class}</td>
                <td style={{ padding:'11px 16px', fontSize:12, color:C.ink4 }}>{s.joined}</td>
                <td style={{ padding:'11px 16px' }}><Badge status={s.fees} /></td>
                <td style={{ padding:'11px 16px' }}><Badge status={s.status} /></td>
                <td style={{ padding:'11px 16px' }}>
                  <div style={{ display:'flex', gap:4 }}>
                    <Btn variant="ghost" size="sm">View</Btn>
                    <Btn variant="ghost" size="sm">⋯</Btn>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.borderSoft}`,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, color:C.ink4 }}>Showing {filtered.length} of {STUDENTS.length} students</span>
          <Btn variant="secondary" size="sm">Export →</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── Attendance ────────────────────────────────────────────────────────────
function AttendancePage() {
  const [selectedClass, setSelectedClass] = React.useState('Class 9-A');
  const [date, setDate] = React.useState(new Date().toISOString().slice(0,10));
  const [attMap, setAttMap] = React.useState(() =>
    Object.fromEntries(ATTENDANCE_ROSTER.map(s => [s.id, s.status]))
  );
  const [saved, setSaved] = React.useState(false);

  const mark = (id, status) => { setAttMap(p => ({...p, [id]:status})); setSaved(false); };
  const markAll = (status) => { setAttMap(Object.fromEntries(ATTENDANCE_ROSTER.map(s => [s.id, status]))); setSaved(false); };

  const counts = ATTENDANCE_ROSTER.reduce((acc, s) => {
    const st = attMap[s.id] || 'present';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth:860, margin:'0 auto' }}>
      <PageHeader title="Mark Attendance" subtitle="Fast-action roll call — mark and notify absent parents instantly"
        actions={saved && (
          <div style={{ display:'flex', alignItems:'center', gap:6, color:C.successText,
            background:C.successBg, padding:'6px 14px', borderRadius:8, fontSize:13, fontWeight:500 }}>
            ✓ Saved — {counts.absent||0} absent
          </div>
        )}
      />

      {/* Filter row */}
      <Card style={{ padding:20, marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:12, alignItems:'end' }}>
          <div>
            <FieldLabel>Class Section</FieldLabel>
            <Select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)}>
              {['Class 6-A','Class 6-B','Class 7-A','Class 8-B','Class 9-A','Class 10-A'].map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <Input type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant="success" onClick={() => markAll('present')}>All Present</Btn>
            <Btn variant="danger" onClick={() => markAll('absent')}>All Absent</Btn>
          </div>
        </div>
      </Card>

      {/* Summary strip */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        {[
          { label:'Present', count:counts.present||0, color:C.successText, bg:C.successBg },
          { label:'Absent',  count:counts.absent||0,  color:C.dangerText,  bg:C.dangerBg  },
          { label:'Late',    count:counts.late||0,    color:C.warningText, bg:C.warningBg },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, color:s.color, padding:'6px 14px',
            borderRadius:8, fontSize:13, fontWeight:600 }}>
            {s.label}: {s.count}
          </div>
        ))}
      </div>

      {/* Roster */}
      <Card>
        <div style={{ padding:'0 20px', borderBottom:`1px solid ${C.border}` }}>
          <div style={{ padding:'12px 0', fontSize:14, fontWeight:600, color:C.ink }}>
            Class Roster — {selectedClass}
          </div>
        </div>
        <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:8 }}>
          {ATTENDANCE_ROSTER.map(s => {
            const status = attMap[s.id] || 'present';
            const colors = {
              present:{ bg:C.successBg, border:'#bbf7d0' },
              absent: { bg:C.dangerBg,  border:'#fecdd3' },
              late:   { bg:C.warningBg, border:'#fde68a' },
            };
            const col = colors[status];
            return (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'10px 14px', borderRadius:9, background:col.bg,
                border:`1px solid ${col.border}`, transition:'all .15s' }}>
                <div style={{ width:28, height:28, borderRadius:7, background:'#fff',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:11, fontWeight:700, color:C.ink3, flexShrink:0 }}>
                  {s.roll}
                </div>
                <div style={{ flex:1, fontSize:13, fontWeight:600, color:C.ink }}>{s.name}</div>
                <div style={{ display:'flex', gap:6 }}>
                  {['present','late','absent'].map(opt => (
                    <button key={opt} onClick={() => mark(s.id, opt)}
                      style={{ padding:'5px 12px', borderRadius:7, border:'none', cursor:'pointer',
                        fontFamily:'inherit', fontSize:12, fontWeight:500, transition:'all .15s',
                        background: status===opt ? (opt==='present'?C.success:opt==='absent'?C.danger:C.warning) : '#fff',
                        color: status===opt ? '#fff' : C.ink3,
                        boxShadow: status===opt ? '0 1px 4px rgba(0,0,0,.15)' : 'none',
                      }}>
                      {opt.charAt(0).toUpperCase()+opt.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ padding:'14px 20px', borderTop:`1px solid ${C.borderSoft}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          {counts.absent > 0 && (
            <Btn variant="secondary">💬 Notify {counts.absent} Absentees</Btn>
          )}
          <Btn onClick={() => setSaved(true)}>💾 Save Attendance</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── Expenses ──────────────────────────────────────────────────────────────
function ExpensesPage() {
  const [form, setForm] = React.useState({ amount:'', category:'', date:new Date().toISOString().slice(0,10), mode:'Cash', remarks:'' });
  const [saved, setSaved] = React.useState(false);
  const [errors, setErrors] = React.useState({});

  const validate = () => {
    const e = {};
    if (!form.amount) e.amount = 'Amount is required';
    if (!form.category) e.category = 'Please select a category';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setForm({ amount:'', category:'', date:new Date().toISOString().slice(0,10), mode:'Cash', remarks:'' });
  };

  const recentExpenses = [
    { cat:'Electricity / Gas', date:'30 Apr', amount:12400, mode:'Bank' },
    { cat:'Stationery',        date:'29 Apr', amount:3200,  mode:'Cash' },
    { cat:'Maintenance',       date:'28 Apr', amount:8500,  mode:'Bank' },
    { cat:'Cleaning',          date:'27 Apr', amount:2000,  mode:'Cash' },
    { cat:'Miscellaneous',     date:'26 Apr', amount:1500,  mode:'Cash' },
  ];

  return (
    <div style={{ maxWidth:960, margin:'0 auto' }}>
      <PageHeader title="Add Daily Expense" subtitle="Record a new financial transaction to the ledger" />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        {/* Form */}
        <Card style={{ padding:28 }}>
          {saved && (
            <div style={{ background:C.successBg, border:`1px solid #bbf7d0`,
              borderRadius:9, padding:'12px 16px', marginBottom:20,
              fontSize:13, fontWeight:500, color:C.successText }}>
              ✓ Transaction committed to the ledger.
            </div>
          )}
          <form onSubmit={handleSave}>
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              <div>
                <FieldLabel>Expense Amount (PKR)</FieldLabel>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
                    fontSize:12, fontWeight:600, color:C.ink3, pointerEvents:'none' }}>PKR</div>
                  <Input type="number" value={form.amount}
                    onChange={e => { setForm(p=>({...p,amount:e.target.value})); setErrors(p=>({...p,amount:''})); }}
                    placeholder="0.00" style={{ paddingLeft:44 }} />
                </div>
                {errors.amount && <div style={{ fontSize:12, color:C.danger, marginTop:4 }}>{errors.amount}</div>}
              </div>

              <div>
                <FieldLabel>Category / Expense Head</FieldLabel>
                <Select value={form.category} onChange={e => { setForm(p=>({...p,category:e.target.value})); setErrors(p=>({...p,category:''})); }}>
                  <option value="">Select a category…</option>
                  {EXPENSE_HEADS.map(h => <option key={h}>{h}</option>)}
                </Select>
                {errors.category && <div style={{ fontSize:12, color:C.danger, marginTop:4 }}>{errors.category}</div>}
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <FieldLabel>Transaction Date</FieldLabel>
                  <Input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} />
                </div>
                <div>
                  <FieldLabel>Payment Mode</FieldLabel>
                  <Select value={form.mode} onChange={e => setForm(p=>({...p,mode:e.target.value}))}>
                    {['Cash','Bank Transfer','Cheque','Online'].map(m => <option key={m}>{m}</option>)}
                  </Select>
                </div>
              </div>

              <div>
                <FieldLabel>Remarks / Details <span style={{ color:C.ink4 }}>(optional)</span></FieldLabel>
                <textarea value={form.remarks} onChange={e => setForm(p=>({...p,remarks:e.target.value}))}
                  placeholder="e.g. Paid electricity bill for April 2024…"
                  rows={3}
                  style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:8,
                    padding:'8px 12px', fontSize:13, color:C.ink, fontFamily:'inherit',
                    outline:'none', width:'100%', resize:'vertical', boxSizing:'border-box' }}
                  onFocus={e => { e.target.style.borderColor=C.primary; e.target.style.boxShadow=`0 0 0 3px ${C.primaryBg}`; }}
                  onBlur={e => { e.target.style.borderColor=C.border; e.target.style.boxShadow=''; }} />
              </div>

              <div style={{ paddingTop:4 }}>
                <Btn size="md" style={{ width:'100%', justifyContent:'center' }}>
                  💾 Commit to Ledger
                </Btn>
              </div>
            </div>
          </form>
        </Card>

        {/* Recent sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <Card style={{ padding:20 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.ink, marginBottom:14 }}>Recent Expenses</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {recentExpenses.map((e, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 12px', borderRadius:8, background:C.bg }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:C.ink }}>{e.cat}</div>
                    <div style={{ fontSize:11, color:C.ink4, marginTop:2 }}>{e.date} · {e.mode}</div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>
                    Rs. {e.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ padding:20 }}>
            <div style={{ fontSize:12, color:C.ink3, marginBottom:8, fontWeight:500 }}>April Total Expenses</div>
            <div style={{ fontSize:24, fontWeight:700, color:C.ink, letterSpacing:'-.03em' }}>Rs. 1.72M</div>
            <div style={{ fontSize:12, color:C.ink4, marginTop:4 }}>vs Rs. 1.85M in March</div>
            <div style={{ marginTop:10, height:4, borderRadius:100, background:C.borderSoft }}>
              <div style={{ height:'100%', width:'93%', borderRadius:100, background:C.success }} />
            </div>
            <div style={{ fontSize:11, color:C.successText, marginTop:6, fontWeight:500 }}>
              ↓ 7% vs last month — under budget
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Fee Invoices ──────────────────────────────────────────────────────────
function FeeInvoicesPage() {
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');
  const [month, setMonth] = React.useState('April 2024');

  const filtered = INVOICES.filter(inv => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchSearch = inv.student.toLowerCase().includes(search.toLowerCase()) ||
      inv.inv.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totals = INVOICES.reduce((acc, inv) => {
    acc.total += inv.total; acc.paid += inv.paid;
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, { total:0, paid:0, paid:0, partial:0, pending:0 });

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      <PageHeader title="Fee Invoices" subtitle={`Monthly invoices for ${month}`}
        actions={<>
          <Btn variant="secondary">⬆ Bulk Generate</Btn>
          <Btn>+ New Invoice</Btn>
        </>}
      />

      {/* Stats strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Invoiced', value:`Rs. ${(totals.total/1000).toFixed(0)}K`, color:C.ink },
          { label:'Collected',      value:`Rs. ${(totals.paid/1000).toFixed(0)}K`,  color:C.successText },
          { label:'Outstanding',    value:`Rs. ${((totals.total-totals.paid)/1000).toFixed(0)}K`, color:C.dangerText },
          { label:'Collection Rate', value:`${Math.round(totals.paid/totals.total*100)}%`, color:C.primary },
        ].map(s => (
          <Card key={s.label} style={{ padding:'14px 18px' }}>
            <div style={{ fontSize:12, fontWeight:500, color:C.ink3, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:s.color, letterSpacing:'-.02em' }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Filter row */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <Input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search student or invoice…" style={{ maxWidth:260 }} />
        <Select value={month} onChange={e=>setMonth(e.target.value)} style={{ maxWidth:180 }}>
          {['April 2024','March 2024','February 2024','January 2024'].map(m => <option key={m}>{m}</option>)}
        </Select>
        <div style={{ display:'flex', gap:4, marginLeft:'auto' }}>
          {['all','paid','partial','pending'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding:'6px 14px', borderRadius:7, border:`1px solid ${statusFilter===s ? C.primary : C.border}`,
                background: statusFilter===s ? C.primaryBg : C.surface, color: statusFilter===s ? C.primary : C.ink3,
                fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer', transition:'all .15s' }}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
              {['Invoice #','Student','Class','Month','Total','Paid','Balance','Status',''].map(h => (
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700,
                  color:C.ink3, textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9}><EmptyState icon="🔍" title="No invoices match" sub="Try a different filter" /></td></tr>
            ) : filtered.map(inv => (
              <tr key={inv.inv} style={{ borderBottom:`1px solid ${C.borderSoft}`, transition:'background .1s' }}
                onMouseEnter={e => e.currentTarget.style.background=C.bg}
                onMouseLeave={e => e.currentTarget.style.background=''}>
                <td style={{ padding:'11px 14px', fontSize:12, fontFamily:'monospace', color:C.ink3 }}>{inv.inv}</td>
                <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600, color:C.ink }}>{inv.student}</td>
                <td style={{ padding:'11px 14px', fontSize:13, color:C.ink2 }}>{inv.class}</td>
                <td style={{ padding:'11px 14px', fontSize:12, color:C.ink3 }}>{inv.month}</td>
                <td style={{ padding:'11px 14px', fontSize:13, fontWeight:500 }}>Rs. {inv.total.toLocaleString()}</td>
                <td style={{ padding:'11px 14px', fontSize:13, color:C.successText }}>Rs. {inv.paid.toLocaleString()}</td>
                <td style={{ padding:'11px 14px', fontSize:13, color: inv.total-inv.paid > 0 ? C.dangerText : C.ink4 }}>
                  Rs. {(inv.total-inv.paid).toLocaleString()}
                </td>
                <td style={{ padding:'11px 14px' }}><Badge status={inv.status} /></td>
                <td style={{ padding:'11px 14px' }}>
                  <div style={{ display:'flex', gap:4 }}>
                    <Btn variant="ghost" size="sm">View</Btn>
                    {inv.status !== 'paid' && <Btn size="sm">Collect</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding:'12px 16px', borderTop:`1px solid ${C.borderSoft}`,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:12, color:C.ink4 }}>{filtered.length} invoices</span>
          <Btn variant="secondary" size="sm">Export CSV →</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── Reporting ─────────────────────────────────────────────────────────────
function ReportingPage({ initialTab }) {
  const [tab, setTab] = React.useState(initialTab || 'summary');

  const TABS = [
    { id:'summary',    label:'Master Summary' },
    { id:'financial',  label:'Financial'      },
    { id:'attendance', label:'Attendance'     },
    { id:'fees',       label:'Fee Collection' },
  ];

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      <PageHeader title="Reports & Analytics"
        subtitle="School-wide performance overview — May 2026"
        actions={<>
          <Btn variant="secondary">⬇ Export CSV</Btn>
          <Btn variant="secondary">🖨 Print</Btn>
        </>}
      />

      {/* Tab bar */}
      <div style={{ display:'flex', gap:2, background:C.borderSoft, padding:3,
        borderRadius:9, marginBottom:24, width:'fit-content' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'7px 18px', borderRadius:7, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:13, fontWeight:500, transition:'all .15s',
              background: tab===t.id ? C.surface : 'transparent',
              color: tab===t.id ? C.ink : C.ink3,
              boxShadow: tab===t.id ? '0 1px 4px rgba(0,0,0,.08)' : 'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary'    && <SummaryReport />}
      {tab === 'financial'  && <FinancialReport />}
      {tab === 'attendance' && <AttendanceReport />}
      {tab === 'fees'       && <FeeReport />}
    </div>
  );
}

// ── Summary Report ────────────────────────────────────────────────────────
function SummaryReport() {
  const totalStudents = CLASS_STATS.reduce((s,c) => s+c.students, 0);
  const totalPresent  = CLASS_STATS.reduce((s,c) => s+c.present, 0);
  const totalDue      = CLASS_STATS.reduce((s,c) => s+c.feeDue, 0);
  const totalPaid     = CLASS_STATS.reduce((s,c) => s+c.feePaid, 0);
  const avgAtt        = Math.round(totalPresent / totalStudents * 100);
  const collRate      = Math.round(totalPaid / totalDue * 100);

  const kpis = [
    { label:'Total Enrolled',    value:totalStudents, sub:'Across 10 classes',      icon:'🎓', color:C.primary,   bg:C.primaryBg   },
    { label:'Avg Attendance',    value:`${avgAtt}%`,  sub:'Today across all classes',icon:'📅', color:C.success,   bg:C.successBg   },
    { label:'Fee Collection',    value:`${collRate}%`,sub:'This month',              icon:'💰', color:'#7c3aed',   bg:'#f5f3ff'     },
    { label:'Total Outstanding', value:`Rs. ${((totalDue-totalPaid)/1000).toFixed(0)}K`, sub:'Across all classes', icon:'⚠️', color:C.warning, bg:C.warningBg },
  ];

  const maxStudents = Math.max(...CLASS_STATS.map(c => c.students));
  const expTotal = EXPENSE_BREAKDOWN.reduce((s,e) => s+e.amount, 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {kpis.map(k => (
          <Card key={k.label} style={{ padding:'18px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:k.bg,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{k.icon}</div>
            </div>
            <div style={{ fontSize:24, fontWeight:700, color:k.color, letterSpacing:'-.03em' }}>{k.value}</div>
            <div style={{ fontSize:13, fontWeight:500, color:C.ink2, marginTop:4 }}>{k.label}</div>
            <div style={{ fontSize:12, color:C.ink4, marginTop:2 }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Class enrollment table */}
        <Card>
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>Class-wise Enrollment</div>
            <div style={{ fontSize:12, color:C.ink4, marginTop:2 }}>Students per class with capacity bar</div>
          </div>
          <div style={{ padding:'8px 0' }}>
            {CLASS_STATS.map((c,i) => (
              <div key={c.cls} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'8px 20px', background: i%2===0 ? '' : C.bg }}>
                <div style={{ width:90, fontSize:13, fontWeight:500, color:C.ink, flexShrink:0 }}>{c.cls}</div>
                <div style={{ flex:1 }}>
                  <MiniBar value={c.students} max={maxStudents} color={C.primary} />
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:C.ink, minWidth:28, textAlign:'right' }}>{c.students}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'10px 20px', borderTop:`1px solid ${C.borderSoft}`,
            display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontSize:12, color:C.ink3 }}>Total enrolled</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.ink }}>{totalStudents} students</span>
          </div>
        </Card>

        {/* Expense breakdown */}
        <Card>
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.borderSoft}` }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>Expense Breakdown</div>
            <div style={{ fontSize:12, color:C.ink4, marginTop:2 }}>April 2026 — Rs. {(expTotal/1000000).toFixed(2)}M total</div>
          </div>
          <div style={{ padding:'8px 0' }}>
            {EXPENSE_BREAKDOWN.map((e,i) => (
              <div key={e.cat} style={{ display:'flex', alignItems:'center', gap:12,
                padding:'9px 20px', background: i%2===0 ? '' : C.bg }}>
                <div style={{ width:10, height:10, borderRadius:3, background:e.color, flexShrink:0 }}/>
                <div style={{ flex:1, fontSize:13, color:C.ink2 }}>{e.cat}</div>
                <div style={{ minWidth:80, textAlign:'right' }}>
                  <div style={{ fontSize:13, fontWeight:600, color:C.ink }}>
                    Rs. {(e.amount/1000).toFixed(0)}K
                  </div>
                  <div style={{ fontSize:11, color:C.ink4 }}>
                    {Math.round(e.amount/expTotal*100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Financial Report ──────────────────────────────────────────────────────
function FinancialReport() {
  const totals = MONTHLY_PL.reduce((acc,m) => ({
    income:  acc.income  + m.income,
    expense: acc.expense + m.expense,
  }), { income:0, expense:0 });

  const fmt = n => `Rs. ${(n/1000000).toFixed(2)}M`;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {[
          { label:'Total Income (6M)',   value:fmt(totals.income),              color:C.successText, bg:C.successBg },
          { label:'Total Expenses (6M)', value:fmt(totals.expense),             color:C.dangerText,  bg:C.dangerBg  },
          { label:'Net Surplus (6M)',    value:fmt(totals.income-totals.expense),color:C.primary,    bg:C.primaryBg },
        ].map(s => (
          <Card key={s.label} style={{ padding:'18px 20px' }}>
            <div style={{ fontSize:12, fontWeight:500, color:C.ink3, marginBottom:8 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color, letterSpacing:'-.02em' }}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* P&L table */}
      <Card>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${C.borderSoft}` }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>Monthly Profit & Loss Statement</div>
          <div style={{ fontSize:12, color:C.ink4, marginTop:2 }}>November 2025 – April 2026</div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
              {['Month','Income','Expenses','Net Surplus','Margin',''].map(h => (
                <th key={h} style={{ padding:'10px 20px', textAlign: h===''?'center':'left',
                  fontSize:11, fontWeight:700, color:C.ink3,
                  textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MONTHLY_PL.map((m,i) => {
              const net = m.income - m.expense;
              const margin = Math.round(net / m.income * 100);
              return (
                <tr key={m.month} style={{ borderBottom:`1px solid ${C.borderSoft}` }}
                  onMouseEnter={e => e.currentTarget.style.background=C.bg}
                  onMouseLeave={e => e.currentTarget.style.background=''}>
                  <td style={{ padding:'12px 20px', fontSize:13, fontWeight:600, color:C.ink }}>{m.month}</td>
                  <td style={{ padding:'12px 20px', fontSize:13, color:C.successText, fontWeight:500 }}>
                    Rs. {(m.income/1000).toFixed(0)}K
                  </td>
                  <td style={{ padding:'12px 20px', fontSize:13, color:C.dangerText, fontWeight:500 }}>
                    Rs. {(m.expense/1000).toFixed(0)}K
                  </td>
                  <td style={{ padding:'12px 20px', fontSize:13, fontWeight:700, color: net>=0?C.successText:C.dangerText }}>
                    Rs. {(net/1000).toFixed(0)}K
                  </td>
                  <td style={{ padding:'12px 20px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:80, height:6, background:C.borderSoft, borderRadius:100 }}>
                        <div style={{ width:`${margin}%`, height:'100%', background:C.success, borderRadius:100 }}/>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:C.ink3 }}>{margin}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px 20px', textAlign:'center' }}>
                    <Badge status={net >= 0 ? 'active' : 'pending'} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
              <td style={{ padding:'12px 20px', fontSize:13, fontWeight:700, color:C.ink }}>Total</td>
              <td style={{ padding:'12px 20px', fontSize:13, fontWeight:700, color:C.successText }}>
                Rs. {(totals.income/1000).toFixed(0)}K
              </td>
              <td style={{ padding:'12px 20px', fontSize:13, fontWeight:700, color:C.dangerText }}>
                Rs. {(totals.expense/1000).toFixed(0)}K
              </td>
              <td style={{ padding:'12px 20px', fontSize:13, fontWeight:700, color:C.primary }}>
                Rs. {((totals.income-totals.expense)/1000).toFixed(0)}K
              </td>
              <td colSpan={2}/>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

// ── Attendance Report ─────────────────────────────────────────────────────
function AttendanceReport() {
  const [sortBy, setSortBy] = React.useState('att');
  const sorted = [...CLASS_STATS].sort((a,b) => sortBy==='att' ? b.att-a.att : b.students-a.students);
  const overall = Math.round(CLASS_STATS.reduce((s,c)=>s+c.present,0) / CLASS_STATS.reduce((s,c)=>s+c.students,0) * 100);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {[
          { label:'School Avg Attendance', value:`${overall}%`, sub:'Today',           color:overall>=90?C.successText:C.warningText },
          { label:'Best Class',            value:sorted[0]?.cls, sub:`${sorted[0]?.att}% attendance`, color:C.successText },
          { label:'Needs Attention',       value:sorted.filter(c=>c.att<90).length,    sub:'Classes below 90%', color:C.warningText },
        ].map(s => (
          <Card key={s.label} style={{ padding:'18px 20px' }}>
            <div style={{ fontSize:12, fontWeight:500, color:C.ink3, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color, letterSpacing:'-.02em' }}>{s.value}</div>
            <div style={{ fontSize:12, color:C.ink4, marginTop:4 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.borderSoft}`,
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>Class-wise Attendance — Today</div>
            <div style={{ fontSize:12, color:C.ink4, marginTop:2 }}>1 May 2026</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[{id:'att',label:'By Attendance'},{id:'students',label:'By Size'}].map(s => (
              <button key={s.id} onClick={()=>setSortBy(s.id)}
                style={{ padding:'5px 12px', borderRadius:7, border:`1px solid ${sortBy===s.id?C.primary:C.border}`,
                  background: sortBy===s.id?C.primaryBg:C.surface, color: sortBy===s.id?C.primary:C.ink3,
                  fontFamily:'inherit', fontSize:12, fontWeight:500, cursor:'pointer' }}>{s.label}</button>
            ))}
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
              {['Class','Enrolled','Present','Absent','Attendance Rate','Status'].map(h => (
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11,
                  fontWeight:700, color:C.ink3, textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c,i) => {
              const absent = c.students - c.present;
              const status = c.att >= 95 ? 'excellent' : c.att >= 90 ? 'good' : 'attention';
              const statusColors = {
                excellent: { bg:'#ecfdf5', color:'#065f46', label:'Excellent' },
                good:      { bg:'#eff6ff', color:'#1e40af', label:'Good'      },
                attention: { bg:'#fffbeb', color:'#92400e', label:'Attention' },
              };
              const sc = statusColors[status];
              return (
                <tr key={c.cls} style={{ borderBottom:`1px solid ${C.borderSoft}` }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td style={{ padding:'11px 16px', fontSize:13, fontWeight:600, color:C.ink }}>{c.cls}</td>
                  <td style={{ padding:'11px 16px', fontSize:13, color:C.ink2 }}>{c.students}</td>
                  <td style={{ padding:'11px 16px', fontSize:13, color:C.successText, fontWeight:500 }}>{c.present}</td>
                  <td style={{ padding:'11px 16px', fontSize:13, color: absent>3?C.dangerText:C.ink3, fontWeight: absent>3?600:400 }}>{absent}</td>
                  <td style={{ padding:'11px 16px', minWidth:180 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1, height:6, background:C.borderSoft, borderRadius:100 }}>
                        <div style={{ width:`${c.att}%`, height:'100%', borderRadius:100,
                          background: c.att>=95?C.success:c.att>=90?C.primary:C.warning }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:C.ink, minWidth:32 }}>{c.att}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'11px 16px' }}>
                    <span style={{ background:sc.bg, color:sc.color, fontSize:11, fontWeight:600,
                      padding:'2px 9px', borderRadius:100 }}>{sc.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Fee Collection Report ─────────────────────────────────────────────────
function FeeReport() {
  const totalDue  = CLASS_STATS.reduce((s,c) => s+c.feeDue, 0);
  const totalPaid = CLASS_STATS.reduce((s,c) => s+c.feePaid, 0);
  const pending   = totalDue - totalPaid;
  const rate      = Math.round(totalPaid/totalDue*100);

  const sorted = [...CLASS_STATS].sort((a,b) => (b.feeDue-b.feePaid)-(a.feeDue-a.feePaid));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        {[
          { label:'Total Invoiced', value:`Rs. ${(totalDue/1000).toFixed(0)}K`, color:C.ink },
          { label:'Collected',      value:`Rs. ${(totalPaid/1000).toFixed(0)}K`, color:C.successText },
          { label:'Outstanding',    value:`Rs. ${(pending/1000).toFixed(0)}K`,   color:C.dangerText  },
          { label:'Collection Rate',value:`${rate}%`,                            color:rate>=90?C.successText:C.warningText },
        ].map(s => (
          <Card key={s.label} style={{ padding:'16px 20px' }}>
            <div style={{ fontSize:12, fontWeight:500, color:C.ink3, marginBottom:6 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:s.color, letterSpacing:'-.02em' }}>{s.value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{ padding:'14px 20px', borderBottom:`1px solid ${C.borderSoft}` }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.ink }}>Class-wise Fee Collection — April 2026</div>
          <div style={{ fontSize:12, color:C.ink4, marginTop:2 }}>Sorted by outstanding dues (highest first)</div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:C.bg, borderBottom:`1px solid ${C.border}` }}>
              {['Class','Total Due','Collected','Outstanding','Collection Rate'].map(h => (
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11,
                  fontWeight:700, color:C.ink3, textTransform:'uppercase', letterSpacing:'.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c,i) => {
              const outstanding = c.feeDue - c.feePaid;
              const cRate = Math.round(c.feePaid/c.feeDue*100);
              return (
                <tr key={c.cls} style={{ borderBottom:`1px solid ${C.borderSoft}` }}
                  onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                  onMouseLeave={e=>e.currentTarget.style.background=''}>
                  <td style={{ padding:'11px 16px', fontSize:13, fontWeight:600, color:C.ink }}>{c.cls}</td>
                  <td style={{ padding:'11px 16px', fontSize:13, color:C.ink2 }}>Rs. {(c.feeDue/1000).toFixed(0)}K</td>
                  <td style={{ padding:'11px 16px', fontSize:13, color:C.successText, fontWeight:500 }}>
                    Rs. {(c.feePaid/1000).toFixed(0)}K
                  </td>
                  <td style={{ padding:'11px 16px', fontSize:13,
                    color: outstanding>10000?C.dangerText:C.ink3, fontWeight: outstanding>10000?600:400 }}>
                    Rs. {(outstanding/1000).toFixed(0)}K
                  </td>
                  <td style={{ padding:'11px 16px', minWidth:180 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ flex:1, height:6, background:C.borderSoft, borderRadius:100 }}>
                        <div style={{ width:`${cRate}%`, height:'100%', borderRadius:100,
                          background: cRate>=95?C.success:cRate>=85?C.primary:C.warning }} />
                      </div>
                      <span style={{ fontSize:12, fontWeight:700, color:C.ink, minWidth:32 }}>{cRate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
              <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color:C.ink }}>Total</td>
              <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700 }}>Rs. {(totalDue/1000).toFixed(0)}K</td>
              <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color:C.successText }}>Rs. {(totalPaid/1000).toFixed(0)}K</td>
              <td style={{ padding:'11px 16px', fontSize:13, fontWeight:700, color:C.dangerText }}>Rs. {(pending/1000).toFixed(0)}K</td>
              <td style={{ padding:'11px 16px' }}>
                <span style={{ fontSize:13, fontWeight:700, color:rate>=90?C.successText:C.warningText }}>{rate}% overall</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

// ── Placeholder page ──────────────────────────────────────────────────────
function PlaceholderPage({ title }) {
  return (
    <div style={{ maxWidth:900, margin:'0 auto' }}>
      <PageHeader title={title} />
      <Card>
        <EmptyState icon="🚧" title={`${title} module`}
          sub="This page is part of the live app and will be updated with the unified design." />
      </Card>
    </div>
  );
}

Object.assign(window, { DashboardPage, StudentsPage, AttendancePage, ExpensesPage, FeeInvoicesPage, ReportingPage, PlaceholderPage });
