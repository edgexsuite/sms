// ── Colors ────────────────────────────────────────────────────────────────
const C = {
  primary:'#4f46e5', primaryBg:'#eef2ff', primaryHover:'#4338ca',
  success:'#059669', successBg:'#ecfdf5', successText:'#065f46',
  warning:'#d97706', warningBg:'#fffbeb', warningText:'#92400e',
  danger:'#dc2626',  dangerBg:'#fef2f2',  dangerText:'#991b1b',
  neutral:'#6b7280', neutralBg:'#f9fafb',
  sidebar:'#0d1526', sidebarBorder:'rgba(255,255,255,0.06)',
  bg:'#f8fafc', surface:'#fff', border:'#e5e7eb', borderSoft:'#f3f4f6',
  ink:'#111827', ink2:'#374151', ink3:'#6b7280', ink4:'#9ca3af',
};

// ── Mock Data ─────────────────────────────────────────────────────────────
const SCHOOL = { name:'The Edge School', role:'Admin Dashboard' };

const STATS = [
  { label:'Total Students', value:'1,240', sub:'+12 this week', trend:'+1%', icon:'🎓', color:C.primary, colorBg:C.primaryBg, link:'students' },
  { label:"Today's Attendance", value:'94%', sub:'1,165 present', trend:'+2%', icon:'📅', color:C.success, colorBg:C.successBg, link:'attendance' },
  { label:'Month Revenue (Net)', value:'Rs. 2.4M', sub:'Income − Expenses', trend:'+8%', icon:'💳', color:'#7c3aed', colorBg:'#f5f3ff', link:'accounting' },
  { label:'Pending Fees', value:'Rs. 380K', sub:'42 invoices unpaid', trend:null, icon:'⚠️', color:C.warning, colorBg:C.warningBg, link:'fees' },
];

const ALERTS = [
  { type:'danger',  label:'3 open complaints',   icon:'💬' },
  { type:'warning', label:'5 leave requests',     icon:'📋' },
  { type:'danger',  label:'42 unpaid invoices',   icon:'🧾' },
  { type:'success', label:'4 new this week',      icon:'✅' },
];

const MONTHLY = [
  { month:'Nov', income:2100, expense:1600 },
  { month:'Dec', income:2400, expense:1800 },
  { month:'Jan', income:2200, expense:1700 },
  { month:'Feb', income:2500, expense:1900 },
  { month:'Mar', income:2300, expense:1850 },
  { month:'Apr', income:2420, expense:1720 },
];

const FEE_STATUS = [
  { label:'Paid',    value:420, color:C.success },
  { label:'Partial', value:180, color:C.warning },
  { label:'Pending', value:42,  color:C.danger  },
];

const RECENT_ACTIVITY = [
  { inv:'INV-2024-0481', student:'Ahmad Raza',    class:'9-A', amount:4500, status:'paid',    month:'Apr 2024' },
  { inv:'INV-2024-0480', student:'Fatima Noor',   class:'9-A', amount:4500, status:'partial', month:'Apr 2024' },
  { inv:'INV-2024-0479', student:'Usman Ali',     class:'8-B', amount:4200, status:'paid',    month:'Apr 2024' },
  { inv:'INV-2024-0478', student:'Sara Ahmed',    class:'7-A', amount:3800, status:'pending', month:'Apr 2024' },
  { inv:'INV-2024-0477', student:'Hassan Khan',   class:'10-A',amount:5200, status:'paid',    month:'Apr 2024' },
];

const STUDENTS = [
  { id:1, name:'Ahmad Raza',     roll:'001', class:'Class 9-A', dob:'2009-03-12', status:'active', fees:'paid',    joined:'Apr 2023' },
  { id:2, name:'Fatima Noor',    roll:'002', class:'Class 9-A', dob:'2009-07-22', status:'active', fees:'partial', joined:'Apr 2023' },
  { id:3, name:'Usman Ali',      roll:'003', class:'Class 8-B', dob:'2010-01-05', status:'active', fees:'paid',    joined:'Apr 2022' },
  { id:4, name:'Sara Ahmed',     roll:'004', class:'Class 7-A', dob:'2011-09-18', status:'active', fees:'pending', joined:'Apr 2021' },
  { id:5, name:'Hassan Khan',    roll:'005', class:'Class 10-A',dob:'2008-05-30', status:'active', fees:'paid',    joined:'Apr 2024' },
  { id:6, name:'Ayesha Malik',   roll:'006', class:'Class 6-B', dob:'2012-11-14', status:'active', fees:'paid',    joined:'Apr 2024' },
  { id:7, name:'Bilal Hussain',  roll:'007', class:'Class 9-A', dob:'2009-02-28', status:'active', fees:'partial', joined:'Apr 2023' },
  { id:8, name:'Zainab Sheikh',  roll:'008', class:'Class 8-B', dob:'2010-08-03', status:'left',   fees:'pending', joined:'Apr 2022' },
  { id:9, name:'Omar Farooq',    roll:'009', class:'Class 10-A',dob:'2008-12-19', status:'active', fees:'paid',    joined:'Apr 2020' },
  { id:10,name:'Hira Baig',      roll:'010', class:'Class 7-A', dob:'2011-04-25', status:'active', fees:'paid',    joined:'Apr 2024' },
];

const INVOICES = [
  { inv:'INV-2024-0481', student:'Ahmad Raza',    class:'9-A', month:'April 2024', total:4500, paid:4500, status:'paid'    },
  { inv:'INV-2024-0480', student:'Fatima Noor',   class:'9-A', month:'April 2024', total:4500, paid:2000, status:'partial' },
  { inv:'INV-2024-0479', student:'Usman Ali',     class:'8-B', month:'April 2024', total:4200, paid:4200, status:'paid'    },
  { inv:'INV-2024-0478', student:'Sara Ahmed',    class:'7-A', month:'April 2024', total:3800, paid:0,    status:'pending' },
  { inv:'INV-2024-0477', student:'Hassan Khan',   class:'10-A',month:'April 2024', total:5200, paid:5200, status:'paid'    },
  { inv:'INV-2024-0476', student:'Ayesha Malik',  class:'6-B', month:'April 2024', total:3600, paid:1800, status:'partial' },
  { inv:'INV-2024-0475', student:'Bilal Hussain', class:'9-A', month:'April 2024', total:4500, paid:0,    status:'pending' },
  { inv:'INV-2024-0474', student:'Omar Farooq',   class:'10-A',month:'April 2024', total:5200, paid:5200, status:'paid'    },
];

const ATTENDANCE_ROSTER = [
  { id:1, roll:'001', name:'Ahmad Raza',    status:'present' },
  { id:2, roll:'002', name:'Fatima Noor',   status:'present' },
  { id:3, roll:'003', name:'Ali Hassan',    status:'absent'  },
  { id:4, roll:'004', name:'Sara Ahmed',    status:'present' },
  { id:5, roll:'005', name:'Bilal Hussain', status:'late'    },
  { id:6, roll:'006', name:'Hira Baig',     status:'present' },
  { id:7, roll:'007', name:'Usman Khan',    status:'present' },
  { id:8, roll:'008', name:'Ayesha Malik',  status:'absent'  },
  { id:9, roll:'009', name:'Omar Siddiqui', status:'present' },
  { id:10,roll:'010', name:'Zainab Sheikh', status:'present' },
];

const EXPENSE_HEADS = ['Electricity / Gas','Water','Salaries','Stationery','Transport','Cleaning','Repairs & Maintenance','Canteen','IT / Software','Miscellaneous'];

// ── Report Data ───────────────────────────────────────────────────────────
const CLASS_STATS = [
  { cls:'Class 6-A',  students:42, present:38, att:90, feeDue:168000, feePaid:152000 },
  { cls:'Class 6-B',  students:40, present:35, att:88, feeDue:160000, feePaid:140000 },
  { cls:'Class 7-A',  students:44, present:41, att:93, feeDue:184000, feePaid:175000 },
  { cls:'Class 7-B',  students:39, present:34, att:87, feeDue:163000, feePaid:140000 },
  { cls:'Class 8-A',  students:46, present:43, att:93, feeDue:207000, feePaid:198000 },
  { cls:'Class 8-B',  students:38, present:33, att:87, feeDue:171000, feePaid:150000 },
  { cls:'Class 9-A',  students:45, present:43, att:96, feeDue:225000, feePaid:215000 },
  { cls:'Class 9-B',  students:41, present:37, att:90, feeDue:205000, feePaid:185000 },
  { cls:'Class 10-A', students:43, present:40, att:93, feeDue:258000, feePaid:245000 },
  { cls:'Class 10-B', students:40, present:36, att:90, feeDue:240000, feePaid:218000 },
];

const EXPENSE_BREAKDOWN = [
  { cat:'Salaries & Allowances', amount:1200000, color:'#6366f1' },
  { cat:'Maintenance & Repairs', amount:120000,  color:'#f59e0b' },
  { cat:'Electricity & Gas',     amount:85000,   color:'#10b981' },
  { cat:'Transport',             amount:80000,   color:'#3b82f6' },
  { cat:'Stationery',            amount:45000,   color:'#8b5cf6' },
  { cat:'Miscellaneous',         amount:190000,  color:'#6b7280' },
];

const MONTHLY_PL = [
  { month:'November', income:2100000, expense:1620000 },
  { month:'December', income:2400000, expense:1850000 },
  { month:'January',  income:2200000, expense:1710000 },
  { month:'February', income:2500000, expense:1920000 },
  { month:'March',    income:2300000, expense:1850000 },
  { month:'April',    income:2420000, expense:1720000 },
];

// ── Nav Structure ─────────────────────────────────────────────────────────
const NAV = [
  { section:'Overview', items:[
    { id:'dashboard',  label:'Dashboard',    icon:'◉' },
    { id:'ai',         label:'AI Assistant', icon:'✦' },
  ]},
  { section:'People', items:[
    { id:'students',   label:'Students',     icon:'🎓', sub:[
      { id:'students',        label:'Student List'    },
      { id:'students-add',    label:'Register New'    },
      { id:'students-id',     label:'Digital ID Cards'},
    ]},
    { id:'staff',      label:'Staff',        icon:'💼' },
    { id:'parents',    label:'Parents',      icon:'👨‍👩‍👧' },
  ]},
  { section:'Academic', items:[
    { id:'classes',    label:'Classes',      icon:'📚' },
    { id:'timetable',  label:'Timetable',    icon:'🗓' },
    { id:'attendance', label:'Attendance',   icon:'✅', sub:[
      { id:'attendance',       label:'Mark Attendance'  },
      { id:'att-daily',        label:'Daily Report'     },
      { id:'att-monthly',      label:'Monthly Report'   },
    ]},
    { id:'result',     label:'Results',      icon:'🏆' },
    { id:'library',    label:'Library',      icon:'📖' },
  ]},
  { section:'Finance', items:[
    { id:'fees',       label:'Fee Management',icon:'🧾', sub:[
      { id:'fees',             label:'Monthly Invoices' },
      { id:'fee-criteria',     label:'Fee Criteria'     },
      { id:'fee-discounts',    label:'Discounts'        },
    ]},
    { id:'expenses',   label:'Expenses',     icon:'💸', sub:[
      { id:'expenses',         label:'Add Expense'      },
      { id:'exp-heads',        label:'Expense Heads'    },
      { id:'exp-ledger',       label:'Ledger'           },
    ]},
    { id:'payroll',    label:'Payroll',      icon:'💰' },
    { id:'accounting', label:'Accounting',   icon:'📊' },
  ]},
  { section:'Reports', items:[
    { id:'reports',    label:'Reports',      icon:'📈', sub:[
      { id:'reports',          label:'Master Summary'   },
      { id:'rep-financial',    label:'Financial Report' },
      { id:'rep-attendance',   label:'Attendance Report'},
      { id:'rep-fees',         label:'Fee Collection'   },
    ]},
  ]},
  { section:'Admin', items:[
    { id:'settings',   label:'Settings',     icon:'⚙️' },
  ]},
];

// ── Shared UI Atoms ───────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    paid:    { bg:C.successBg,  color:C.successText,  label:'Paid'    },
    partial: { bg:C.warningBg,  color:C.warningText,  label:'Partial' },
    pending: { bg:C.dangerBg,   color:C.dangerText,   label:'Pending' },
    active:  { bg:C.primaryBg,  color:C.primary,      label:'Active'  },
    left:    { bg:C.neutralBg,  color:C.neutral,      label:'Left'    },
    present: { bg:C.successBg,  color:C.successText,  label:'Present' },
    absent:  { bg:C.dangerBg,   color:C.dangerText,   label:'Absent'  },
    late:    { bg:C.warningBg,  color:C.warningText,  label:'Late'    },
  };
  const s = map[status?.toLowerCase?.()] ?? { bg:C.neutralBg, color:C.neutral, label: status };
  return (
    <span style={{ background:s.bg, color:s.color, fontSize:11, fontWeight:600,
      padding:'2px 8px', borderRadius:100, display:'inline-block', letterSpacing:'.01em' }}>
      {s.label}
    </span>
  );
}

function Btn({ children, variant='primary', size='sm', onClick, style: sx={}, disabled=false }) {
  const base = { border:'none', borderRadius:7, cursor: disabled?'not-allowed':'pointer',
    fontFamily:'inherit', fontWeight:500, display:'inline-flex', alignItems:'center',
    gap:6, transition:'background .15s, box-shadow .15s', opacity: disabled?.5:1, ...sx };
  const sizes = { sm:{ fontSize:13, padding:'6px 14px' }, md:{ fontSize:14, padding:'8px 18px' } };
  const variants = {
    primary:  { background:C.primary,  color:'#fff' },
    secondary:{ background:'#f3f4f6',  color:C.ink2 },
    ghost:    { background:'transparent', color:C.ink3 },
    danger:   { background:C.dangerBg, color:C.dangerText },
    success:  { background:C.successBg,color:C.successText },
  };
  return (
    <button disabled={disabled} onClick={onClick}
      style={{ ...base, ...sizes[size], ...variants[variant] }}
      onMouseEnter={e => { if(!disabled) e.currentTarget.style.filter='brightness(0.93)'; }}
      onMouseLeave={e => { e.currentTarget.style.filter=''; }}>
      {children}
    </button>
  );
}

function Input({ value, onChange, placeholder, type='text', style: sx={} }) {
  return (
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:8,
        padding:'7px 12px', fontSize:13, color:C.ink, fontFamily:'inherit',
        outline:'none', width:'100%', ...sx }}
      onFocus={e => { e.target.style.borderColor=C.primary; e.target.style.boxShadow=`0 0 0 3px ${C.primaryBg}`; }}
      onBlur={e => { e.target.style.borderColor=C.border; e.target.style.boxShadow=''; }} />
  );
}

function Select({ value, onChange, children, style: sx={} }) {
  return (
    <select value={value} onChange={onChange}
      style={{ background:'#fff', border:`1px solid ${C.border}`, borderRadius:8,
        padding:'7px 12px', fontSize:13, color:C.ink, fontFamily:'inherit',
        outline:'none', width:'100%', appearance:'auto', ...sx }}
      onFocus={e => { e.target.style.borderColor=C.primary; }}
      onBlur={e => { e.target.style.borderColor=C.border; }}>
      {children}
    </select>
  );
}

function FieldLabel({ children }) {
  return <label style={{ fontSize:12, fontWeight:500, color:C.ink3, display:'block', marginBottom:5 }}>{children}</label>;
}

function Card({ children, style: sx={} }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}`,
      borderRadius:12, ...sx }}>
      {children}
    </div>
  );
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
      gap:16, marginBottom:24, flexWrap:'wrap' }}>
      <div>
        <h1 style={{ fontSize:22, fontWeight:700, color:C.ink, margin:0, letterSpacing:'-.02em',
          fontFamily:'Outfit, sans-serif' }}>{title}</h1>
        {subtitle && <p style={{ fontSize:13, color:C.ink3, marginTop:4, fontWeight:400 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>{actions}</div>}
    </div>
  );
}

function EmptyState({ icon='📭', title, sub }) {
  return (
    <div style={{ textAlign:'center', padding:'48px 24px', color:C.ink3 }}>
      <div style={{ fontSize:36, marginBottom:12 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:600, color:C.ink2, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13 }}>{sub}</div>
    </div>
  );
}

Object.assign(window, {
  C, SCHOOL, STATS, ALERTS, MONTHLY, FEE_STATUS, RECENT_ACTIVITY,
  STUDENTS, INVOICES, ATTENDANCE_ROSTER, EXPENSE_HEADS, NAV,
  CLASS_STATS, EXPENSE_BREAKDOWN, MONTHLY_PL,
  Badge, Btn, Input, Select, FieldLabel, Card, PageHeader, EmptyState,
});
