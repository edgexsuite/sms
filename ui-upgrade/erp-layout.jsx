// ── Sidebar ───────────────────────────────────────────────────────────────
function Sidebar({ activePage, setPage, collapsed, setCollapsed }) {
  const [openSection, setOpenSection] = React.useState(() => {
    for (const s of NAV) {
      for (const item of s.items) {
        if (item.id === activePage || item.sub?.some(x => x.id === activePage)) return item.id;
      }
    }
    return null;
  });

  React.useEffect(() => {
    for (const s of NAV) {
      for (const item of s.items) {
        if (item.id === activePage || item.sub?.some(x => x.id === activePage)) {
          setOpenSection(item.id); return;
        }
      }
    }
  }, [activePage]);

  const isItemActive = (item) =>
    item.id === activePage || item.sub?.some(x => x.id === activePage);

  return (
    <aside style={{
      width: collapsed ? 64 : 220, minWidth: collapsed ? 64 : 220,
      height:'100vh', background:C.sidebar, display:'flex', flexDirection:'column',
      transition:'width .25s ease', overflow:'hidden', flexShrink:0,
    }}>
      {/* Brand */}
      <div style={{ height:56, display:'flex', alignItems:'center', justifyContent:'space-between',
        padding: collapsed ? '0 14px' : '0 16px', borderBottom:`1px solid ${C.sidebarBorder}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <div style={{ width:34, height:34, borderRadius:9, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>🏫</div>
          {!collapsed && (
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,.9)',
                textTransform:'uppercase', letterSpacing:'.1em', lineHeight:1.2,
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontFamily:'Outfit,sans-serif' }}>
                The Edge School
              </div>
              <div style={{ fontSize:9.5, color:'rgba(255,255,255,.35)', letterSpacing:'.15em',
                textTransform:'uppercase', marginTop:2 }}>ERP Platform</div>
            </div>
          )}
        </div>
        <button onClick={() => setCollapsed(v => !v)}
          style={{ background:'none', border:'none', cursor:'pointer', padding:4,
            color:'rgba(255,255,255,.25)', borderRadius:6, flexShrink:0, lineHeight:1,
            transition:'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color='rgba(255,255,255,.6)'}
          onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.25)'}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, overflowY:'auto', overflowX:'hidden', padding:'10px 8px' }}>
        {NAV.map((section, si) => (
          <div key={section.section} style={{ marginBottom:4, ...(si > 0 ? { borderTop:`1px solid ${C.sidebarBorder}`, marginTop:8, paddingTop:8 } : {}) }}>
            {!collapsed && (
              <div style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,.25)',
                textTransform:'uppercase', letterSpacing:'.18em', padding:'0 10px 6px',
                userSelect:'none' }}>
                {section.section}
              </div>
            )}
            {section.items.map(item => {
              const active = isItemActive(item);
              const hasSub = item.sub?.length > 0;
              const subOpen = openSection === item.id && hasSub;
              return (
                <div key={item.id}>
                  <div
                    onClick={() => {
                      if (hasSub) setOpenSection(subOpen ? null : item.id);
                      else setPage(item.id);
                    }}
                    style={{
                      display:'flex', alignItems:'center', gap:9,
                      padding: collapsed ? '8px 14px' : '7px 10px',
                      borderRadius: collapsed ? 8 : '0 8px 8px 0',
                      marginBottom:1, cursor:'pointer', userSelect:'none',
                      transition:'all .15s',
                      ...(active ? {
                        background:'rgba(99,102,241,.2)',
                        borderLeft:'3px solid #818cf8',
                        paddingLeft: collapsed ? 11 : 7,
                        color:'#e0e7ff',
                      } : {
                        borderLeft:'3px solid transparent',
                        color:'rgba(255,255,255,.38)',
                      }),
                    }}
                    onMouseEnter={e => { if(!active) { e.currentTarget.style.background='rgba(255,255,255,.04)'; e.currentTarget.style.color='rgba(255,255,255,.7)'; }}}
                    onMouseLeave={e => { if(!active) { e.currentTarget.style.background=''; e.currentTarget.style.color='rgba(255,255,255,.4)'; }}}
                  >
                    <div style={{ width:26, height:26, borderRadius:6, display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:13, flexShrink:0,
                      background: active ? 'rgba(99,102,241,.22)' : 'rgba(255,255,255,.04)' }}>
                      {item.icon}
                    </div>
                    {!collapsed && <>
                      <span style={{ fontSize:13, fontWeight: active ? 600 : 500, flex:1, whiteSpace:'nowrap' }}>
                        {item.label}
                      </span>
                      {hasSub && (
                        <span style={{ fontSize:10, opacity:.4, transform: subOpen ? 'rotate(90deg)' : '', transition:'transform .2s' }}>▶</span>
                      )}
                    </>}
                  </div>

                  {/* Sub items */}
                  {!collapsed && hasSub && subOpen && (
                    <div style={{ marginLeft:36, paddingLeft:12, borderLeft:'1px solid rgba(255,255,255,.07)',
                      marginBottom:4, marginTop:1 }}>
                      {item.sub.map(sub => {
                        const subActive = sub.id === activePage;
                        return (
                          <div key={sub.id} onClick={() => setPage(sub.id)}
                            style={{ fontSize:12, padding:'5px 8px', borderRadius:6, cursor:'pointer',
                              marginBottom:1, transition:'all .15s', userSelect:'none',
                              fontWeight: subActive ? 600 : 400,
                              color: subActive ? '#a5b4fc' : 'rgba(255,255,255,.35)',
                              background: subActive ? 'rgba(99,102,241,.1)' : 'transparent',
                            }}
                            onMouseEnter={e => { if(!subActive) { e.currentTarget.style.color='rgba(255,255,255,.7)'; e.currentTarget.style.background='rgba(255,255,255,.05)'; }}}
                            onMouseLeave={e => { if(!subActive) { e.currentTarget.style.color='rgba(255,255,255,.35)'; e.currentTarget.style.background=''; }}}
                          >
                            {sub.label}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User Footer */}
      <div style={{ borderTop:`1px solid ${C.sidebarBorder}`, padding: collapsed ? '10px 8px' : '10px 8px', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9,
          padding: collapsed ? '8px 6px' : '8px 10px', borderRadius:9,
          background:'rgba(255,255,255,.04)' }}>
          <div style={{ width:30, height:30, borderRadius:8, background:'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:700, color:'#fff', flexShrink:0 }}>A</div>
          {!collapsed && (
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,.7)',
                textTransform:'uppercase', letterSpacing:'.08em', whiteSpace:'nowrap' }}>Admin</div>
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'#34d399',
                  boxShadow:'0 0 6px rgba(52,211,153,.7)' }}/>
                <span style={{ fontSize:10, color:'rgba(255,255,255,.3)' }}>Active session</span>
              </div>
            </div>
          )}
          {!collapsed && (
            <button style={{ background:'none', border:'none', cursor:'pointer', padding:4,
              color:'rgba(255,255,255,.25)', fontSize:13, borderRadius:5, transition:'color .15s' }}
              onMouseEnter={e => e.currentTarget.style.color='#f87171'}
              onMouseLeave={e => e.currentTarget.style.color='rgba(255,255,255,.25)'}>
              ⎋
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────
function Topbar({ activePage, setPage }) {
  const labels = {
    dashboard:'Dashboard', students:'Students', 'students-add':'Register Student',
    attendance:'Mark Attendance', 'att-daily':'Daily Attendance Report',
    fees:'Fee Invoices', 'fee-criteria':'Fee Criteria',
    expenses:'Add Expense', 'exp-ledger':'Expense Ledger',
    payroll:'Payroll', result:'Results', accounting:'Accounting',
    settings:'Settings', library:'Library', staff:'Staff Directory',
    classes:'Classes & Subjects', timetable:'Timetable', parents:'Parents', ai:'AI Assistant',
  };
  const today = new Date().toLocaleDateString('en-PK', { weekday:'short', day:'numeric', month:'long', year:'numeric' });

  return (
    <header style={{ height:56, background:C.surface, borderBottom:`1px solid ${C.border}`,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 24px', flexShrink:0, position:'sticky', top:0, zIndex:40 }}>
      {/* Left */}
      <div>
        <div style={{ fontSize:13, color:C.ink4, fontWeight:400 }}>{today}</div>
      </div>
      {/* Right */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {/* Search */}
        <button style={{ display:'flex', alignItems:'center', gap:10, background:C.borderSoft,
          border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 14px',
          fontSize:13, color:C.ink3, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
          <span>🔍</span>
          <span>Search</span>
          <kbd style={{ fontSize:10, background:C.surface, border:`1px solid ${C.border}`,
            borderRadius:4, padding:'1px 5px', color:C.ink4, fontFamily:'inherit' }}>CTRL K</kbd>
        </button>
        {/* Bell */}
        <div style={{ position:'relative' }}>
          <button style={{ width:36, height:36, borderRadius:8, background:C.borderSoft,
            border:`1px solid ${C.border}`, display:'flex', alignItems:'center',
            justifyContent:'center', cursor:'pointer', fontSize:15 }}>🔔</button>
          <div style={{ position:'absolute', top:8, right:8, width:8, height:8,
            background:C.danger, borderRadius:'50%', border:'2px solid #fff' }}/>
        </div>
        {/* Density toggle placeholder */}
        <button style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
          background:C.borderSoft, border:`1px solid ${C.border}`, borderRadius:8,
          fontSize:12, color:C.ink3, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
          ⊞ Compact
        </button>
        {/* Logout */}
        <button style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
          background:'none', border:`1px solid ${C.dangerBg}`, borderRadius:8,
          fontSize:12, color:C.danger, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
          ⎋ Logout
        </button>
      </div>
    </header>
  );
}

// ── SVG Bar Chart ─────────────────────────────────────────────────────────
function BarChart({ data }) {
  const W = 520, H = 220, PAD = { left:40, right:10, top:10, bottom:30 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(...data.flatMap(d => [d.income, d.expense]));
  const bw = 22, gap = 8, groupW = chartW / data.length;
  const gridLines = [0, 25, 50, 75, 100].map(p => p / 100 * maxVal);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'100%' }}>
      {/* Grid */}
      {gridLines.map((v, i) => {
        const y = PAD.top + chartH - (v / maxVal) * chartH;
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke={C.borderSoft} strokeWidth={1} />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={10} fill={C.ink4}>
              {Math.round(v / 100)}k
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((d, i) => {
        const cx = PAD.left + i * groupW + groupW / 2;
        const inH = (d.income / maxVal) * chartH;
        const exH = (d.expense / maxVal) * chartH;
        const inX = cx - bw - gap / 2;
        const exX = cx + gap / 2;
        return (
          <g key={d.month}>
            <rect x={inX} y={PAD.top + chartH - inH} width={bw} height={inH} fill="#6366f1" rx={4} />
            <rect x={exX} y={PAD.top + chartH - exH} width={bw} height={exH} fill="#fb7185" rx={4} opacity={.85} />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize={10.5} fill={C.ink4} fontWeight={500}>
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────
function DonutChart({ data }) {
  const size = 160, r = 54, cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumulative = 0;
  const slices = data.map(d => {
    const pct = d.value / total;
    const dash = pct * circ;
    const offset = circ - cumulative * circ / total;
    cumulative += d.value;
    return { ...d, dash, offset, pct };
  });

  return (
    <div style={{ position:'relative', width:size, height:size, margin:'0 auto' }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.borderSoft} strokeWidth={20} />
        {slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color} strokeWidth={20}
            strokeDasharray={`${s.dash - 2} ${circ - s.dash + 2}`}
            strokeDashoffset={s.offset}
            strokeLinecap="butt" />
        ))}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', textAlign:'center' }}>
        <div style={{ fontSize:11, color:C.ink4, fontWeight:500 }}>Pending</div>
        <div style={{ fontSize:17, fontWeight:700, color:C.ink, letterSpacing:'-.02em' }}>
          Rs. 380K
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar, BarChart, DonutChart });
