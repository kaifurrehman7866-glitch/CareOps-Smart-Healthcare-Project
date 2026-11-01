import { useEffect, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight, BadgeCheck, Banknote, CalendarDays,
  Check, CheckCircle2, ChevronDown, CircleDot, ClipboardCheck, Clock3, FileText, Flag,
  FileBarChart2, GitBranch, LayoutDashboard, ListChecks, LoaderCircle, Plus, Printer,
  ShieldAlert, ShieldCheck, Pencil, SlidersHorizontal, Sparkles, Stethoscope, Target, Users, X,
} from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'project', label: 'Project charter', icon: FileText },
  { id: 'scope', label: 'Scope & changes', icon: Target },
  { id: 'schedule', label: 'Schedule & EVM', icon: CalendarDays },
  { id: 'quality', label: 'Quality & risk', icon: ShieldCheck },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
];
const TEAM = [
  'Kaif Khan - Project Manager', 'Hamza Ali - Backend Developer', 'Sara Iqbal - Backend Developer',
  'Noor Fatima - Frontend Developer', 'Omar Shah - Frontend Developer', 'Zain Ahmed - Database Developer',
  'Mariam Raza - QA Engineer',
];
const money = (amount) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(amount || 0);
const dateText = (value) => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Not set';
const durationWeeks = (start, end) => Math.ceil((Date.parse(end) - Date.parse(start)) / (7 * 24 * 60 * 60 * 1000));
const shortPerson = (value = '') => value.split(' - ')[0];

async function request(url, method = 'GET', body) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request could not be completed.');
  return result;
}

function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  async function refresh() {
    setLoading(true);
    try { setData(await request('/api/project')); }
    catch (error) { setNotice({ type: 'error', text: error.message }); }
    finally { setLoading(false); }
  }

  async function mutate(url, method, body, success) {
    setBusy(true);
    setNotice(null);
    try {
      setData(await request(url, method, body));
      setNotice({ type: 'success', text: success });
      return true;
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
      return false;
    } finally { setBusy(false); }
  }

  useEffect(() => { refresh(); }, []);

  if (loading && !data) return <div className="loading"><LoaderCircle className="spin" size={24} /><span>Opening project workspace</span></div>;
  if (!data) return <div className="fatal"><Stethoscope size={28} /><h1>Project API unavailable</h1><p>Start the application with <code>npm run dev</code>, then refresh this page.</p><button className="button button-primary" onClick={refresh}>Retry connection</button></div>;

  const { project, schedule, evm } = data;
  const currentPage = NAV.find((item) => item.id === page) || NAV[0];
  const pageProps = { data, project, schedule, evm, mutate, busy, setPage };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Activity size={20} strokeWidth={2.6} /></div>
          <div><span className="brand-name">careops</span><span className="brand-caption">PROJECT CONTROL</span></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Project modules">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {id === 'quality' && data.openCriticalDefects > 0 && <span className="nav-count">{data.openCriticalDefects}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-project-card">
            <div className="side-project-top"><span className="mini-pulse" /> Active project</div>
            <strong>Smart Healthcare</strong>
            <span>Five-hospital rollout</span>
            <div className="side-progress"><i style={{ width: `${Math.round(evm.progress * 100)}%` }} /></div>
            <div className="side-progress-label"><span>{Math.round(evm.progress * 100)}% earned</span><span>{durationWeeks(project.startDate, project.deadline)} weeks</span></div>
          </div>
          <div className="user-chip"><div className="avatar">KK</div><div><strong>Kaif Khan</strong><span>Project Manager</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Healthcare portfolio</span><span className="crumb-separator">/</span><strong>{currentPage.label}</strong></div>
          <div className="topbar-right"><span className="sync-indicator"><span /> Live project data</span><span className="topbar-divider" /><div className="avatar avatar-small">KK</div></div>
        </header>
        <section className="page-content">
          {notice && <div className={`toast toast-${notice.type}`} role="status"><span>{notice.type === 'error' ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}{notice.text}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16} /></button></div>}
          {page === 'dashboard' && <Dashboard {...pageProps} />}
          {page === 'project' && <ProjectPage {...pageProps} />}
          {page === 'scope' && <ScopePage {...pageProps} />}
          {page === 'schedule' && <SchedulePage {...pageProps} />}
          {page === 'quality' && <QualityPage {...pageProps} />}
          {page === 'reports' && <ReportsPage {...pageProps} />}
        </section>
        <footer className="page-footer"><span>CareOps project workspace</span><span>Saved to MongoDB · Last checked just now</span></footer>
      </main>
      {busy && <div className="busy-bar"><i /></div>}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function StatusPill({ children, tone = 'neutral' }) { return <span className={`pill pill-${tone}`}>{children}</span>; }

function Dashboard({ data, project, schedule, evm, setPage }) {
  const metrics = [
    { label: 'Earned progress', value: `${Math.round(evm.progress * 100)}%`, foot: `${money(evm.ev)} earned of ${money(evm.bac)} BAC`, icon: Activity, tone: 'green' },
    { label: 'Approved baseline', value: money(project.approvedBudget), foot: `Planned work: ${money(evm.bac)}`, icon: Banknote, tone: 'blue' },
    { label: 'Schedule performance', value: evm.spi.toFixed(2), foot: evm.spi < 0.9 ? 'SPI below 0.90 threshold' : 'SPI within control threshold', icon: Clock3, tone: evm.spi < 0.9 ? 'amber' : 'green' },
    { label: 'Critical defects', value: String(data.openCriticalDefects).padStart(2, '0'), foot: 'Unresolved release blockers', icon: ShieldAlert, tone: 'red' },
  ];
  const topRisks = [...project.risks].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact).slice(0, 3);
  const pendingChangeItems = project.changes.filter((change) => change.status === 'Pending');
  return <>
    <PageHeading eyebrow="PROJECT SNAPSHOT · 26 OCT 2026" title="Good morning, KAIF" subtitle="Here’s the current control picture for the five-hospital rollout." action={<button className="button button-outline" onClick={() => setPage('project')}><FileText size={16} /> Project brief</button>} />
    {data.openCriticalDefects > 0 && <div className="alert-banner"><div className="alert-icon"><ShieldAlert size={19} /></div><div><strong>Release gate blocked by {data.openCriticalDefects} critical defects</strong><span>Appointment scheduling and patient-record integrity need verified fixes before acceptance testing.</span></div><button className="text-button" onClick={() => setPage('quality')}>Review defects <ArrowUpRight size={15} /></button></div>}
    <div className="metric-grid">{metrics.map(({ label, value, foot, icon: Icon, tone }) => <div className="metric-card" key={label}><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${tone}`}><Icon size={17} /></span></div><strong className="metric-value">{value}</strong><span className="metric-foot">{foot}</span></div>)}</div>
    <div className="dashboard-grid">
      <section className="panel performance-panel">
        <div className="panel-heading"><div><h2>Earned value performance</h2><p>Cost and schedule health against the measured baseline</p></div><button className="icon-button" title="Open schedule and EVM" onClick={() => setPage('schedule')}><ArrowUpRight size={17} /></button></div>
        {evm.warning && <div className="inline-warning"><AlertCircle size={15} /> Performance has crossed a control threshold. Review CPI, SPI, and actual cost.</div>}
        <div className="evm-grid">
          <EvmNumber label="Planned value · PV" value={evm.pv} sub="Work planned to date" />
          <EvmNumber label="Earned value · EV" value={evm.ev} sub="Budgeted completed work" />
          <EvmNumber label="Actual cost · AC" value={evm.ac} sub="Cost incurred to date" />
        </div>
        <div className="index-row"><div><span>Cost performance index</span><strong className={evm.cpi < 0.9 ? 'text-red' : ''}>{evm.cpi.toFixed(2)}</strong></div><div className="index-track"><i className={evm.cpi < 0.9 ? 'is-low' : ''} style={{ width: `${Math.min(evm.cpi * 100, 100)}%` }} /></div><small>{evm.cpi >= 0.9 ? 'On target' : 'Below 0.90'}</small></div>
        <div className="index-row"><div><span>Schedule performance index</span><strong className={evm.spi < 0.9 ? 'text-red' : ''}>{evm.spi.toFixed(2)}</strong></div><div className="index-track"><i className={evm.spi < 0.9 ? 'is-low' : ''} style={{ width: `${Math.min(evm.spi * 100, 100)}%` }} /></div><small>{evm.spi >= 0.9 ? 'On target' : 'Below 0.90'}</small></div>
        <div className="panel-note">Thresholds: CPI ≥ 0.90 · SPI ≥ 0.90 · actual cost ≤ approved budget</div>
      </section>
      <section className="panel change-panel">
        <div className="panel-heading"><div><h2>Change control</h2><p>Requests awaiting baseline review</p></div><span className="count-badge">{data.pendingChanges} pending</span></div>
        {project.changes.filter((change) => change.status === 'Pending').map((change) => <div className="change-preview" key={change._id}><div className="change-preview-icon"><Sparkles size={17} /></div><div className="change-preview-main"><strong>{change.title}</strong><span>{money(change.costImpact)} · +{change.scheduleWeeks} weeks</span></div><button className="text-button" onClick={() => setPage('scope')}>Review <ArrowUpRight size={15} /></button></div>)}
        {!data.pendingChanges && <div className="empty-state">No pending change requests.</div>}
        <div className={`baseline-comparison ${pendingChangeItems.length ? '' : 'baseline-final'}`}>{pendingChangeItems.length ? <><div><span>Current baseline</span><strong>{money(project.approvedBudget)}</strong><small>{dateText(project.deadline)} deadline</small></div><div className="baseline-arrow"><ArrowDownRight size={17} /></div><div className="baseline-proposed"><span>With pending change</span><strong>{money(project.approvedBudget + pendingChangeItems.reduce((sum, c) => sum + c.costImpact, 0))}</strong><small>+{pendingChangeItems.reduce((sum, c) => sum + c.scheduleWeeks, 0)} weeks</small></div></> : <div><span>Current approved baseline</span><strong>{money(project.approvedBudget)}</strong><small>{durationWeeks(project.startDate, project.deadline)}-week plan · no pending changes</small></div>}</div>
      </section>
      <section className="panel timeline-panel">
        <div className="panel-heading"><div><h2>Schedule pulse</h2><p>Forecast finish: <strong>{dateText(data.forecastFinish)}</strong> · baseline {dateText(project.deadline)}</p></div><button className="text-button" onClick={() => setPage('schedule')}>Full schedule <ArrowUpRight size={15} /></button></div>
        {data.delayed.length > 0 && <div className="schedule-alert"><Clock3 size={16} /><span><strong>{data.delayed.length} delayed activities</strong> · {data.delayed.map((task) => task.title).slice(0, 2).join(', ')}</span></div>}
        <div className="mini-task-list">{schedule.slice(0, 5).map((task) => <div className="mini-task" key={task._id}><div className="mini-task-name"><span className={`task-dot ${task.percentComplete === 100 ? 'done' : task.isDelayed ? 'late' : ''}`} /><span>{task.title}</span></div><div className="mini-task-progress"><i style={{ width: `${task.percentComplete}%` }} /></div><strong>{task.percentComplete}%</strong></div>)}</div>
      </section>
      <section className="panel risk-panel">
        <div className="panel-heading"><div><h2>Priority watch</h2><p>Top risks by likelihood × impact</p></div><button className="icon-button" title="Open risk controls" onClick={() => setPage('quality')}><ArrowUpRight size={17} /></button></div>
        <div className="risk-list">{topRisks.map((risk) => <div className="risk-item" key={risk._id}><div className={`risk-score score-${risk.likelihood * risk.impact >= 16 ? 'high' : 'medium'}`}>{risk.likelihood * risk.impact}</div><div><strong>{risk.title}</strong><span>{shortPerson(risk.owner)} · L{risk.likelihood} × I{risk.impact}</span></div><ChevronDown size={15} className="risk-chevron" /></div>)}</div>
      </section>
    </div>
    <div className="dashboard-bottom"><div className="bottom-note"><div className="note-symbol"><BadgeCheck size={18} /></div><span><strong>Quality remains the release gate</strong> Resolve critical schedule and record defects, then rerun regression before five-hospital acceptance.</span><button className="text-button" onClick={() => setPage('quality')}>Quality log <ArrowUpRight size={15} /></button></div><span className="dashboard-date"><CalendarDays size={14} /> 26 Oct 2026</span></div>
  </>;
}

function EvmNumber({ label, value, sub }) { return <div className="evm-number"><span>{label}</span><strong>{money(value)}</strong><small>{sub}</small></div>; }

function ProjectPage({ project, mutate, busy }) {
  const [form, setForm] = useState({ ...project, startDate: project.startDate.slice(0, 10), deadline: project.deadline.slice(0, 10) });
  const [milestone, setMilestone] = useState({ title: '', targetDate: '', owner: TEAM[0] });
  const [closure, setClosure] = useState('');
  useEffect(() => setForm({ ...project, startDate: project.startDate.slice(0, 10), deadline: project.deadline.slice(0, 10) }), [project]);
  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const save = (event) => { event.preventDefault(); mutate('/api/project/charter', 'PATCH', form, 'Project charter and plan saved.'); };
  const addMilestone = async (event) => { event.preventDefault(); if (await mutate('/api/milestones', 'POST', milestone, 'Milestone added to the project plan.')) setMilestone({ ...milestone, title: '', targetDate: '' }); };
  return <>
    <PageHeading eyebrow="INITIATION & INTEGRATION" title="Project charter" subtitle="Control the approved baseline, stakeholder agreement, and closure record." action={<StatusPill tone={project.status === 'Active' ? 'green' : 'neutral'}>{project.status} project</StatusPill>} />
    <form className="panel form-panel" onSubmit={save}>
      <div className="panel-heading"><div><h2>Charter and management plan</h2><p>Changes to this approved baseline are recorded immediately.</p></div><span className="section-index">01 / BASELINE</span></div>
      <div className="form-grid">
        <label className="field field-wide"><span>Project name</span><input required name="name" value={form.name} onChange={update} /></label>
        <label className="field field-wide"><span>Project objective</span><textarea required name="objective" value={form.objective} onChange={update} rows="2" /></label>
        <label className="field field-wide"><span>Stakeholders</span><textarea name="stakeholders" value={form.stakeholders} onChange={update} rows="2" /></label>
        <label className="field field-wide"><span>Scope included</span><textarea name="scopeIn" value={form.scopeIn} onChange={update} rows="2" /></label>
        <label className="field field-wide"><span>Scope boundaries / excluded</span><textarea name="scopeOut" value={form.scopeOut} onChange={update} rows="2" /></label>
        <label className="field field-wide"><span>Quality management plan</span><textarea name="qualityPlan" value={form.qualityPlan} onChange={update} rows="2" /></label>
        <label className="field"><span>Baseline start date</span><input required type="date" name="startDate" value={form.startDate} onChange={update} /></label>
        <label className="field"><span>Approved deadline</span><input required type="date" name="deadline" value={form.deadline} onChange={update} /></label>
        <label className="field"><span>Approved budget · PKR</span><input required type="number" min="1" step="10000" name="approvedBudget" value={form.approvedBudget} onChange={update} /></label>
        <div className="field"><span>Delivery team</span><div className="team-avatars">{TEAM.map((person, index) => <span key={person} title={person} className={`team-avatar team-avatar-${index}`}>{shortPerson(person).split(' ').map((part) => part[0]).join('')}</span>)}<small>7 assigned</small></div></div>
      </div>
      <div className="form-actions"><span>Charter, scope, schedule, cost and quality baseline</span><button className="button button-primary" disabled={busy}><Check size={16} /> Save charter</button></div>
    </form>
    <div className="two-column lower-panels">
      <section className="panel"><div className="panel-heading"><div><h2>Milestones</h2><p>Decision points and accountable owners</p></div><span className="section-index">02 / DELIVERY</span></div>
        <div className="milestone-list">{project.milestones.map((item) => <div className="milestone-row" key={item._id}><div className={`milestone-icon ${item.status === 'Complete' ? 'milestone-done' : ''}`}>{item.status === 'Complete' ? <Check size={15} /> : <Flag size={15} />}</div><div className="milestone-info"><strong>{item.title}</strong><span>{shortPerson(item.owner)}</span></div><div className="milestone-date"><strong>{dateText(item.targetDate)}</strong><StatusPill tone={item.status === 'Complete' ? 'green' : 'neutral'}>{item.status}</StatusPill></div></div>)}</div>
        <form className="inline-form milestone-form" onSubmit={addMilestone}><input aria-label="Milestone title" placeholder="New milestone name" required value={milestone.title} onChange={(e) => setMilestone({ ...milestone, title: e.target.value })} /><input aria-label="Milestone target date" type="date" required value={milestone.targetDate} onChange={(e) => setMilestone({ ...milestone, targetDate: e.target.value })} /><select aria-label="Milestone owner" value={milestone.owner} onChange={(e) => setMilestone({ ...milestone, owner: e.target.value })}>{TEAM.map((person) => <option key={person}>{person}</option>)}</select><button className="icon-button" title="Add milestone" disabled={busy}><Plus size={17} /></button></form>
      </section>
      <section className="panel closure-panel"><div className="panel-heading"><div><h2>Project closure</h2><p>Capture the final handover and acceptance record</p></div><span className="section-index">03 / CLOSE</span></div>
        {project.status === 'Closed' ? <div className="closure-saved"><CheckCircle2 size={19} /><div><strong>Closed {dateText(project.closedAt)}</strong><span>{project.closureSummary}</span></div></div> : <form onSubmit={(event) => { event.preventDefault(); mutate('/api/project/close', 'POST', { summary: closure }, 'Project closure record saved.'); }}><label className="field"><span>Closure summary</span><textarea placeholder="Acceptance results, outstanding actions, handover owner..." rows="4" required value={closure} onChange={(e) => setClosure(e.target.value)} /></label><button className="button button-outline" disabled={busy}><ClipboardCheck size={16} /> Record closure</button></form>}
      </section>
    </div>
  </>;
}

function ScopePage({ data, project, mutate, busy }) {
  const [requirement, setRequirement] = useState({ title: '', description: '', priority: 'Must' });
  const [editingRequirement, setEditingRequirement] = useState(null);
  const [work, setWork] = useState({ title: '', owner: TEAM[0], parentId: '' });
  const [change, setChange] = useState({ title: '', justification: '', costImpact: '', scheduleWeeks: '' });
  const addRequirement = async (event) => { event.preventDefault(); if (await mutate('/api/requirements', 'POST', requirement, 'Requirement recorded as proposed and kept out of approved scope.')) setRequirement({ title: '', description: '', priority: 'Must' }); };
  const addWbs = async (event) => { event.preventDefault(); if (await mutate('/api/wbs', 'POST', work, `WBS work package added.`)) setWork({ ...work, title: '', parentId: '' }); };
  const addChange = async (event) => { event.preventDefault(); if (await mutate('/api/changes', 'POST', { ...change, costImpact: Number(change.costImpact), scheduleWeeks: Number(change.scheduleWeeks) }, 'Change request submitted for impact assessment.')) setChange({ title: '', justification: '', costImpact: '', scheduleWeeks: '' }); };
  const saveRequirement = async (event, item) => {
    event.preventDefault();
    if (await mutate(`/api/requirements/${item._id}`, 'PATCH', editingRequirement, 'Requirement details and priority updated.')) setEditingRequirement(null);
  };
  const approval = (item, decision) => {
    const prompt = decision === 'approve' ? `Approve “${item.title}”? The baseline will change by ${money(item.costImpact)} and ${item.scheduleWeeks} weeks, and approved scope/WBS/schedule records will be added.` : `Reject “${item.title}” and preserve the current baseline?`;
    if (window.confirm(prompt)) mutate(`/api/changes/${item._id}/${decision}`, 'POST', {}, decision === 'approve' ? 'Change approved; scope, budget, schedule and WBS baselines updated together.' : 'Change rejected; approved baselines remain unchanged.');
  };
  return <>
    <PageHeading eyebrow="SCOPE & CHANGE CONTROL" title="Scope, made explicit" subtitle="Requirements stay proposed until authorized. Approved changes flow through cost, time, WBS, and schedule together." action={<span className="scope-baseline"><CircleDot size={14} /> {money(project.approvedBudget)} approved baseline</span>} />
    <section className="panel section-panel"><div className="panel-heading"><div><h2>Requirements register</h2><p>Prioritized, traceable requirements · only approved items enter the scope baseline</p></div><span className="count-badge">{project.requirements.filter((r) => r.status === 'Approved').length} approved / {project.requirements.length} total</span></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Requirement</th><th>Priority</th><th>Source</th><th>Approval</th><th>Action</th></tr></thead><tbody>{project.requirements.map((item) => editingRequirement?._id === item._id ? <tr key={item._id} className="requirement-edit-row"><td><input aria-label="Requirement title" required value={editingRequirement.title} onChange={(e) => setEditingRequirement({ ...editingRequirement, title: e.target.value })} /><input aria-label="Requirement description" value={editingRequirement.description} onChange={(e) => setEditingRequirement({ ...editingRequirement, description: e.target.value })} /></td><td><select aria-label="Requirement priority" value={editingRequirement.priority} onChange={(e) => setEditingRequirement({ ...editingRequirement, priority: e.target.value })}>{['Must', 'Should', 'Could'].map((priority) => <option key={priority}>{priority}</option>)}</select></td><td>{item.source}</td><td><StatusPill tone={item.status === 'Approved' ? 'green' : item.status === 'Rejected' ? 'neutral' : 'amber'}>{item.status}</StatusPill></td><td><form className="row-actions" onSubmit={(event) => saveRequirement(event, item)}><button type="submit" title="Save requirement" className="small-action action-approve" disabled={busy}><Check size={14} /></button><button type="button" title="Cancel editing" className="small-action action-reject" onClick={() => setEditingRequirement(null)}><X size={14} /></button></form></td></tr> : <tr key={item._id}><td><strong>{item.title}</strong><small>{item.description}</small></td><td><StatusPill tone={item.priority === 'Must' ? 'red' : item.priority === 'Should' ? 'amber' : 'blue'}>{item.priority}</StatusPill></td><td>{item.source}</td><td><StatusPill tone={item.status === 'Approved' ? 'green' : item.status === 'Rejected' ? 'neutral' : 'amber'}>{item.status}</StatusPill></td><td><div className="row-actions"><button title="Edit requirement" className="small-action" onClick={() => setEditingRequirement({ _id: item._id, title: item.title, description: item.description, priority: item.priority })}><Pencil size={13} /></button>{item.status === 'Proposed' ? <><button title="Approve requirement" className="small-action action-approve" onClick={() => mutate(`/api/requirements/${item._id}`, 'PATCH', { status: 'Approved' }, 'Requirement approved and added to the project scope.')}><Check size={14} /></button><button title="Reject requirement" className="small-action action-reject" onClick={() => mutate(`/api/requirements/${item._id}`, 'PATCH', { status: 'Rejected' }, 'Requirement rejected.')}><X size={14} /></button></> : <span className="muted-dash">—</span>}</div></td></tr>)}</tbody></table></div>
      <form className="quick-add requirement-add" onSubmit={addRequirement}><div className="quick-add-label"><Plus size={16} /><span>Add requirement</span></div><input required placeholder="Requirement title" value={requirement.title} onChange={(e) => setRequirement({ ...requirement, title: e.target.value })} /><input placeholder="Short description" value={requirement.description} onChange={(e) => setRequirement({ ...requirement, description: e.target.value })} /><select value={requirement.priority} onChange={(e) => setRequirement({ ...requirement, priority: e.target.value })}><option>Must</option><option>Should</option><option>Could</option></select><button className="button button-small button-primary" disabled={busy}>Add proposed</button></form>
    </section>
    <div className="two-column scope-lower">
      <section className="panel"><div className="panel-heading"><div><h2>Work breakdown structure</h2><p>Hierarchical deliverables and accountable owners</p></div><GitBranch size={18} className="panel-heading-icon" /></div>
        <div className="wbs-list">{project.wbs.map((item) => { const parent = project.wbs.find((entry) => entry._id === item.parentId); return <div className={`wbs-row ${parent ? 'wbs-child' : ''}`} key={item._id}><span className="wbs-code">{item.code}</span><span className="wbs-title">{parent && <span className="tree-elbow">└</span>}{item.title}</span><span className="wbs-owner">{shortPerson(item.owner)}</span></div>; })}</div>
        <form className="stack-form compact-form" onSubmit={addWbs}><label className="field"><span>Work package / deliverable</span><input required placeholder="e.g. Lab report integration" value={work.title} onChange={(e) => setWork({ ...work, title: e.target.value })} /></label><div className="form-grid compact-grid"><label className="field"><span>Parent item</span><select value={work.parentId} onChange={(e) => setWork({ ...work, parentId: e.target.value })}><option value="">Top level</option>{project.wbs.map((item) => <option key={item._id} value={item._id}>{item.code} · {item.title}</option>)}</select></label><label className="field"><span>Owner</span><select value={work.owner} onChange={(e) => setWork({ ...work, owner: e.target.value })}>{TEAM.map((person) => <option key={person}>{person}</option>)}</select></label></div><button className="button button-outline" disabled={busy}><Plus size={15} /> Add WBS item</button></form>
      </section>
      <section className="panel changes-section"><div className="panel-heading"><div><h2>Change requests</h2><p>Integrated review: justification, cost, schedule, decision</p></div><SlidersHorizontal size={18} className="panel-heading-icon" /></div>
        <div className="change-list">{[...project.changes].reverse().map((item) => <article className="change-card" key={item._id}><div className="change-card-head"><div><span className="change-id">CR-{item._id.slice(-5).toUpperCase()}</span><h3>{item.title}</h3></div><StatusPill tone={item.status === 'Approved' ? 'green' : item.status === 'Rejected' ? 'neutral' : 'amber'}>{item.status}</StatusPill></div><p>{item.justification}</p><div className="impact-strip"><div><span>Cost impact</span><strong className={item.costImpact ? 'text-red' : ''}>{item.costImpact ? `+${money(item.costImpact)}` : money(0)}</strong></div><div><span>Schedule impact</span><strong className="text-amber">+{item.scheduleWeeks} weeks</strong></div><div><span>Requestor</span><strong>{item.requestedBy}</strong></div></div>{item.status === 'Pending' && <div className="change-actions"><span>Approval updates linked scope + WBS + schedule</span><div><button className="button button-danger-outline" disabled={busy} onClick={() => approval(item, 'reject')}><X size={15} /> Reject</button><button className="button button-primary" disabled={busy} onClick={() => approval(item, 'approve')}><Check size={15} /> Approve change</button></div></div>}</article>)}</div>
        <form className="stack-form compact-form change-form" onSubmit={addChange}><div className="form-grid compact-grid"><label className="field field-wide"><span>Proposed change</span><input required placeholder="Change summary" value={change.title} onChange={(e) => setChange({ ...change, title: e.target.value })} /></label><label className="field field-wide"><span>Business justification</span><textarea required rows="2" placeholder="Why is this change needed?" value={change.justification} onChange={(e) => setChange({ ...change, justification: e.target.value })} /></label><label className="field"><span>Cost impact · PKR</span><input required min="0" type="number" step="10000" value={change.costImpact} onChange={(e) => setChange({ ...change, costImpact: e.target.value })} /></label><label className="field"><span>Schedule impact · weeks</span><input required min="0" type="number" step="1" value={change.scheduleWeeks} onChange={(e) => setChange({ ...change, scheduleWeeks: e.target.value })} /></label></div><button className="button button-outline" disabled={busy}><Plus size={15} /> Submit change request</button></form>
      </section>
    </div>
  </>;
}

function SchedulePage({ project, schedule, evm, mutate, busy }) {
  const [task, setTask] = useState({ title: '', owner: TEAM[1], durationDays: 5, budget: '', requirementId: '', dependencies: [] });
  const [editing, setEditing] = useState({});
  const addTask = async (event) => { event.preventDefault(); if (await mutate('/api/activities', 'POST', { ...task, durationDays: Number(task.durationDays), budget: Number(task.budget), requirementId: task.requirementId || null }, 'Activity added; dependency dates and EVM are recalculated.')) setTask({ ...task, title: '', budget: '', dependencies: [] }); };
  const updateProgress = async (activity) => {
    const values = editing[activity._id] || { percentComplete: activity.percentComplete, actualCost: activity.actualCost };
    if (await mutate(`/api/activities/${activity._id}/progress`, 'PATCH', { percentComplete: Number(values.percentComplete), actualCost: Number(values.actualCost) }, 'Actuals saved; EVM indicators recalculated.')) setEditing({ ...editing, [activity._id]: undefined });
  };
  const setTaskField = (name, value) => setTask({ ...task, [name]: value });
  const updateEdit = (activity, name, value) => setEditing({ ...editing, [activity._id]: { ...(editing[activity._id] || { percentComplete: activity.percentComplete, actualCost: activity.actualCost }), [name]: value } });
  return <>
    <PageHeading eyebrow="SCHEDULE & RESOURCE CONTROL" title="Delivery schedule" subtitle="Dependency-driven workdays, forecast dates, owners, actual expenditure, and earned value." action={<StatusPill tone={dataDelayed(schedule) ? 'amber' : 'green'}>{dataDelayed(schedule) ? `${dataDelayed(schedule)} delayed` : 'Schedule monitored'}</StatusPill>} />
    <div className="evm-summary-grid">{[['PV · Planned value', evm.pv, 'planned'], ['EV · Earned value', evm.ev, 'earned'], ['AC · Actual cost', evm.ac, 'actual'], ['CPI · Cost index', evm.cpi.toFixed(2), evm.cpi < 0.9 ? 'red' : 'green'], ['SPI · Schedule index', evm.spi.toFixed(2), evm.spi < 0.9 ? 'red' : 'green']].map(([label, value, tone]) => <div className="evm-summary" key={label}><span>{label}</span><strong className={tone === 'red' ? 'text-red' : ''}>{typeof value === 'number' ? money(value) : value}</strong></div>)}</div>
    {evm.warning && <div className="inline-warning evm-warning"><AlertCircle size={16} /> CPI / SPI control limit is 0.90; actual cost is compared against the {money(project.approvedBudget)} approved budget.</div>}
    <section className="panel schedule-panel"><div className="panel-heading"><div><h2>Activity timeline</h2><p>Calculated forward pass · five-day workweek · project baseline ends {dateText(project.deadline)}</p></div><div className="timeline-legend"><span><i className="legend-plan" /> Planned</span><span><i className="legend-delay" /> Delayed</span></div></div>
      <div className="gantt-header"><span>Activity · owner</span><div><span>START</span><span>DEPENDENCY-BASED TIMELINE</span><span>FINISH</span></div></div>
      <div className="gantt-rows">{schedule.map((activity) => <div className="gantt-row" key={activity._id}><div className="gantt-activity"><strong>{activity.title}</strong><span>{shortPerson(activity.owner)}{activity.predecessors.length > 0 && <> · after {activity.predecessors.map((name) => name.split(' ')[0]).join(', ')}</>}</span><div className="gantt-progress"><i style={{ width: `${activity.percentComplete}%` }} /></div><small>{activity.percentComplete}% complete</small></div><span className="gantt-start">{dateText(activity.start)}</span><div className="gantt-track"><div className={`gantt-bar ${activity.percentComplete === 100 ? 'bar-done' : activity.isDelayed ? 'bar-delayed' : ''}`} style={{ left: `${activity.timelineLeft}%`, width: `${activity.timelineWidth}%` }} title={`${dateText(activity.start)}–${dateText(activity.end)}`}><i style={{ width: `${activity.percentComplete}%` }} /></div>{activity.isDelayed && <span className="delay-tag">+{activity.delayDays}d</span>}</div><span className="gantt-end">{dateText(activity.end)}{activity.forecastEnd > activity.end && activity.percentComplete < 100 && <small>Forecast {dateText(activity.forecastEnd)}</small>}</span></div>)}</div>
      <div className="forecast-strip"><Clock3 size={16} /><span>Current forecast finish <strong>{dateText(schedule.reduce((latest, item) => item.forecastEnd > latest ? item.forecastEnd : latest, new Date(project.deadline)))}</strong></span><span>Approved deadline <strong>{dateText(project.deadline)}</strong></span></div>
    </section>
    <section className="panel activity-entry"><div className="panel-heading"><div><h2>Add activity</h2><p>New work can be linked to approved requirements and existing predecessors.</p></div><Plus size={18} className="panel-heading-icon" /></div>
      <form className="form-grid activity-form" onSubmit={addTask}><label className="field field-wide"><span>Activity name</span><input required placeholder="e.g. Doctor schedule synchronization" value={task.title} onChange={(e) => setTaskField('title', e.target.value)} /></label><label className="field"><span>Owner</span><select value={task.owner} onChange={(e) => setTaskField('owner', e.target.value)}>{TEAM.map((person) => <option key={person}>{person}</option>)}</select></label><label className="field"><span>Duration · workdays</span><input required type="number" min="1" value={task.durationDays} onChange={(e) => setTaskField('durationDays', e.target.value)} /></label><label className="field"><span>Budget · PKR</span><input required type="number" min="0" step="10000" value={task.budget} onChange={(e) => setTaskField('budget', e.target.value)} /></label><label className="field"><span>Approved requirement</span><select value={task.requirementId} onChange={(e) => setTaskField('requirementId', e.target.value)}><option value="">Not linked</option>{project.requirements.filter((item) => item.status === 'Approved').map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select></label><label className="field field-wide"><span>Predecessor activities</span><select multiple value={task.dependencies} onChange={(e) => setTaskField('dependencies', Array.from(e.target.selectedOptions, (option) => option.value))}>{schedule.map((item) => <option key={item._id} value={item._id}>{item.title}</option>)}</select><small>Use Ctrl / Command to select more than one.</small></label><div className="form-actions field-wide"><span>Task dates are calculated from dependencies.</span><button className="button button-primary" disabled={busy}><Plus size={16} /> Add activity</button></div></form>
    </section>
    <section className="panel actuals-panel"><div className="panel-heading"><div><h2>Progress and actuals</h2><p>Update completion and actual cost to recalculate EV, AC, CPI, and SPI.</p></div><Banknote size={18} className="panel-heading-icon" /></div>
      <div className="table-wrap"><table className="data-table actuals-table"><thead><tr><th>Activity</th><th>Budget</th><th>Complete</th><th>Actual cost</th><th>Save actuals</th></tr></thead><tbody>{schedule.map((activity) => { const values = editing[activity._id] || { percentComplete: activity.percentComplete, actualCost: activity.actualCost }; return <tr key={activity._id}><td><strong>{activity.title}</strong><small>{shortPerson(activity.owner)}</small></td><td>{money(activity.budget)}</td><td><div className="percent-edit"><input type="number" min="0" max="100" value={values.percentComplete} onChange={(e) => updateEdit(activity, 'percentComplete', e.target.value)} /><span>%</span></div></td><td><input className="cost-edit" type="number" min="0" step="10000" value={values.actualCost} onChange={(e) => updateEdit(activity, 'actualCost', e.target.value)} /></td><td><button className="small-action action-approve" title="Save activity actuals" disabled={busy} onClick={() => updateProgress(activity)}><Check size={15} /></button></td></tr>; })}</tbody></table></div>
    </section>
  </>;
}

function dataDelayed(schedule) { return schedule.filter((item) => item.isDelayed).length; }

function ReportsPage({ data, project, schedule, evm }) {
  const resolvedDefects = project.defects.filter((item) => item.status === 'Resolved').length;
  const unresolvedDefects = project.defects.filter((item) => item.status !== 'Resolved').length;
  const passedChecks = project.qualityChecks.filter((item) => item.result === 'Pass').length;
  const failedChecks = project.qualityChecks.filter((item) => item.result === 'Fail').length;
  const approvedChanges = project.changes.filter((item) => item.status === 'Approved');
  const reportDate = new Date().toISOString();
  return <>
    <PageHeading eyebrow="PROJECT REPORTING" title="End project report" subtitle="A consolidated management report for status review, handover, and project closure." action={<button className="button button-primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>} />
    <section className="report-cover panel">
      <div><div className="report-kicker">CAREOPS · PROJECT CONTROL</div><h2>{project.name}</h2><p>{project.objective}</p></div>
      <div className="report-cover-meta"><StatusPill tone={project.status === 'Closed' ? 'green' : 'amber'}>{project.status}</StatusPill><span>Generated {dateText(reportDate)}</span><strong>Prepared for hospital management</strong></div>
    </section>
    <div className="report-status-grid">
      <div className="report-status-card"><span>Overall progress</span><strong>{Math.round(evm.progress * 100)}%</strong><small>{money(evm.ev)} earned value</small></div>
      <div className="report-status-card"><span>Cost position</span><strong className={evm.cpi < .9 ? 'text-red' : 'text-green'}>{evm.cpi.toFixed(2)} CPI</strong><small>{money(evm.ac)} actual cost</small></div>
      <div className="report-status-card"><span>Schedule position</span><strong className={evm.spi < .9 ? 'text-red' : 'text-green'}>{evm.spi.toFixed(2)} SPI</strong><small>{dateText(data.forecastFinish)} forecast finish</small></div>
      <div className="report-status-card"><span>Release quality</span><strong className={unresolvedDefects ? 'text-red' : 'text-green'}>{unresolvedDefects ? `${unresolvedDefects} open` : 'Ready'}</strong><small>{resolvedDefects} defects resolved</small></div>
    </div>
    <div className="report-grid">
      <section className="panel report-section"><div className="panel-heading"><div><h2>Executive summary</h2><p>Baseline, delivery window, and decision context</p></div><FileBarChart2 size={18} className="panel-heading-icon" /></div><div className="report-facts"><div><span>Approved budget</span><strong>{money(project.approvedBudget)}</strong></div><div><span>Project window</span><strong>{dateText(project.startDate)} – {dateText(project.deadline)}</strong></div><div><span>Duration</span><strong>{durationWeeks(project.startDate, project.deadline)} weeks</strong></div><div><span>Stakeholders</span><strong>{project.stakeholders}</strong></div></div><div className={`report-callout ${unresolvedDefects ? 'report-callout-warning' : 'report-callout-success'}`}><ShieldAlert size={17} /><span>{unresolvedDefects ? `Release remains gated by ${unresolvedDefects} unresolved defect(s). Complete corrective actions and repeat acceptance regression before handover.` : 'Quality gate cleared. The project is ready for formal acceptance and handover.'}</span></div></section>
      <section className="panel report-section"><div className="panel-heading"><div><h2>Earned value statement</h2><p>Performance against the approved cost baseline</p></div><Banknote size={18} className="panel-heading-icon" /></div><div className="report-value-list"><div><span>Budget at completion · BAC</span><strong>{money(evm.bac)}</strong></div><div><span>Planned value · PV</span><strong>{money(evm.pv)}</strong></div><div><span>Earned value · EV</span><strong>{money(evm.ev)}</strong></div><div><span>Actual cost · AC</span><strong>{money(evm.ac)}</strong></div><div><span>Cost variance · EV − AC</span><strong className={evm.budgetVariance < 0 ? 'text-red' : 'text-green'}>{money(evm.budgetVariance)}</strong></div></div></section>
      <section className="panel report-section report-wide"><div className="panel-heading"><div><h2>Delivery and schedule summary</h2><p>{schedule.length} activities · {dataDelayed(schedule)} delayed · dependency-based forecast</p></div><CalendarDays size={18} className="panel-heading-icon" /></div><div className="report-table-wrap"><table className="data-table"><thead><tr><th>Activity</th><th>Owner</th><th>Progress</th><th>Planned finish</th><th>Forecast finish</th><th>Status</th></tr></thead><tbody>{schedule.map((item) => <tr key={item._id}><td><strong>{item.title}</strong></td><td>{shortPerson(item.owner)}</td><td>{item.percentComplete}%</td><td>{dateText(item.end)}</td><td>{dateText(item.forecastEnd)}</td><td><StatusPill tone={item.isDelayed ? 'amber' : item.percentComplete === 100 ? 'green' : 'neutral'}>{item.isDelayed ? 'Delayed' : item.percentComplete === 100 ? 'Complete' : 'In progress'}</StatusPill></td></tr>)}</tbody></table></div></section>
      <section className="panel report-section"><div className="panel-heading"><div><h2>Scope and change log</h2><p>Approved scope decisions included in this report</p></div><Target size={18} className="panel-heading-icon" /></div><div className="report-mini-list"><div><span>Approved requirements</span><strong>{project.requirements.filter((item) => item.status === 'Approved').length}</strong></div><div><span>Approved change requests</span><strong>{approvedChanges.length}</strong></div><div><span>WBS deliverables</span><strong>{project.wbs.length}</strong></div></div>{approvedChanges.length ? approvedChanges.map((item) => <div className="report-change" key={item._id}><strong>{item.title}</strong><span>+{money(item.costImpact)} · +{item.scheduleWeeks} weeks · Approved</span></div>) : <div className="empty-state">No approved changes recorded.</div>}</section>
      <section className="panel report-section"><div className="panel-heading"><div><h2>Quality and risk conclusion</h2><p>Inspection evidence and risk response position</p></div><ShieldCheck size={18} className="panel-heading-icon" /></div><div className="report-mini-list"><div><span>Checklist passed</span><strong className="text-green">{passedChecks}</strong></div><div><span>Checklist failed</span><strong className={failedChecks ? 'text-red' : 'text-green'}>{failedChecks}</strong></div><div><span>Priority risks tracked</span><strong>{project.risks.length}</strong></div><div><span>Critical defects open</span><strong className={unresolvedDefects ? 'text-red' : 'text-green'}>{project.defects.filter((item) => item.severity === 'Critical' && item.status !== 'Resolved').length}</strong></div></div><div className="report-risk-note">Risk responses are documented in the PDPC register and remain assigned to accountable owners.</div></section>
    </div>
    <section className="panel report-signoff"><div><span>REPORT STATUS</span><strong>{project.status === 'Closed' ? 'Closure record complete' : 'Draft for management review'}</strong></div><div><span>PROJECT MANAGER</span><strong>Kaif Khan</strong></div><div><span>NEXT DECISION</span><strong>{unresolvedDefects ? 'Resolve release blockers' : 'Formal acceptance and handover'}</strong></div></section>
  </>;
}

function QualityPage({ project, mutate, busy }) {
  const [defect, setDefect] = useState({ title: '', module: '', severity: 'High', owner: TEAM[6] });
  const [checkItem, setCheckItem] = useState('');
  const [risk, setRisk] = useState({ title: '', likelihood: 3, impact: 3, response: '' });
  const addDefect = async (event) => { event.preventDefault(); if (await mutate('/api/defects', 'POST', defect, 'Defect added to the quality register.')) setDefect({ ...defect, title: '', module: '' }); };
  const addCheck = async (event) => { event.preventDefault(); if (await mutate('/api/quality-checks', 'POST', { item: checkItem }, 'Quality checklist item added.')) setCheckItem(''); };
  const addRisk = async (event) => { event.preventDefault(); if (await mutate('/api/risks', 'POST', { ...risk, likelihood: Number(risk.likelihood), impact: Number(risk.impact) }, 'Risk added to the prioritization matrix and response view.')) setRisk({ title: '', likelihood: 3, impact: 3, response: '' }); };
  const orderedRisks = [...project.risks].sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact);
  return <>
    <PageHeading eyebrow="QUALITY ASSURANCE & RISK" title="Protect the release" subtitle="Resolve critical defects, record inspection evidence, and assign preventive responses before rollout." action={<StatusPill tone={project.defects.some((item) => item.severity === 'Critical' && item.status !== 'Resolved') ? 'red' : 'green'}>{project.defects.filter((item) => item.severity === 'Critical' && item.status !== 'Resolved').length} release blockers</StatusPill>} />
    <div className="quality-summary"><div className="quality-summary-icon"><ShieldAlert size={18} /></div><div><strong>Do not proceed to acceptance while critical clinical defects remain open.</strong><span>Regression exit criteria: appointment conflict tests pass; patient-record writes are concurrency-safe; no unresolved critical severity findings.</span></div><StatusPill tone="red">Gate: blocked</StatusPill></div>
    <section className="panel section-panel"><div className="panel-heading"><div><h2>Defect register</h2><p>Severity, accountable owner, and resolution state</p></div><span className="count-badge">{project.defects.filter((item) => item.status !== 'Resolved').length} unresolved</span></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Defect</th><th>Module</th><th>Severity</th><th>Assigned to</th><th>Resolution</th><th>Logged</th></tr></thead><tbody>{project.defects.map((item) => <tr key={item._id}><td><strong>{item.title}</strong></td><td>{item.module}</td><td><StatusPill tone={item.severity === 'Critical' ? 'red' : item.severity === 'High' ? 'amber' : 'blue'}>{item.severity}</StatusPill></td><td>{shortPerson(item.owner)}</td><td><select className={`status-select status-${item.status.toLowerCase().replace(' ', '-')}`} aria-label={`Update ${item.title} status`} value={item.status} onChange={(e) => mutate(`/api/defects/${item._id}`, 'PATCH', { status: e.target.value }, 'Defect status updated.')}>{['Open', 'In progress', 'Resolved'].map((status) => <option key={status}>{status}</option>)}</select></td><td>{dateText(item.createdAt)}</td></tr>)}</tbody></table></div>
      <form className="quick-add" onSubmit={addDefect}><div className="quick-add-label"><Plus size={16} /><span>Log defect</span></div><input required placeholder="Defect summary" value={defect.title} onChange={(e) => setDefect({ ...defect, title: e.target.value })} /><input placeholder="Module" value={defect.module} onChange={(e) => setDefect({ ...defect, module: e.target.value })} /><select value={defect.severity} onChange={(e) => setDefect({ ...defect, severity: e.target.value })}>{['Critical', 'High', 'Medium', 'Low'].map((item) => <option key={item}>{item}</option>)}</select><select value={defect.owner} onChange={(e) => setDefect({ ...defect, owner: e.target.value })}>{TEAM.map((person) => <option key={person}>{person}</option>)}</select><button className="button button-small button-primary" disabled={busy}>Log defect</button></form>
    </section>
    <div className="two-column quality-lower">
      <section className="panel"><div className="panel-heading"><div><h2>Inspection checklist</h2><p>Evidence against the quality management plan</p></div><ListChecks size={18} className="panel-heading-icon" /></div>
        <div className="check-list">{project.qualityChecks.map((item) => <div className="check-row" key={item._id}><div className={`check-result-icon result-${item.result.toLowerCase().replace(' ', '-')}`}>{item.result === 'Pass' ? <Check size={15} /> : item.result === 'Fail' ? <X size={15} /> : <CircleDot size={14} />}</div><div className="check-info"><strong>{item.item}</strong><span>{item.inspectedAt ? `${dateText(item.inspectedAt)} · ${item.notes}` : 'Not inspected'}</span></div><select aria-label={`Inspection result for ${item.item}`} value={item.result} onChange={(e) => mutate(`/api/quality-checks/${item._id}`, 'PATCH', { result: e.target.value, notes: item.notes }, 'Inspection result recorded.')}>{['Not inspected', 'Pass', 'Fail'].map((result) => <option key={result}>{result}</option>)}</select></div>)}</div>
        <form className="inline-form checklist-add" onSubmit={addCheck}><input required placeholder="Add a deliverable inspection item" value={checkItem} onChange={(e) => setCheckItem(e.target.value)} /><button className="icon-button" title="Add checklist item" disabled={busy}><Plus size={17} /></button></form>
      </section>
      <section className="panel risk-matrix-panel"><div className="panel-heading"><div><h2>Risk prioritization matrix</h2><p>Likelihood × impact · score 1-25</p></div><SlidersHorizontal size={18} className="panel-heading-icon" /></div>
        <div className="risk-matrix-layout"><div className="matrix-y-label">LIKELIHOOD</div><div className="risk-matrix">{[5, 4, 3, 2, 1].map((likelihood) => [1, 2, 3, 4, 5].map((impact) => { const score = likelihood * impact; const count = project.risks.filter((item) => item.likelihood === likelihood && item.impact === impact).length; return <div key={`${likelihood}-${impact}`} title={`Likelihood ${likelihood}, impact ${impact}${count ? `, ${count} risk(s)` : ''}`} className={`matrix-cell ${score >= 16 ? 'matrix-high' : score >= 8 ? 'matrix-medium' : 'matrix-low'}`}>{count > 0 && <span>{count}</span>}</div>; }))}</div><div className="matrix-scale"><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span></div></div><div className="matrix-x-label">IMPACT <span>1 → 5</span></div>
        <div className="risk-register">{orderedRisks.map((item) => <div className="risk-register-row" key={item._id}><span className={`risk-score score-${item.likelihood * item.impact >= 16 ? 'high' : item.likelihood * item.impact >= 8 ? 'medium' : 'low'}`}>{item.likelihood * item.impact}</span><div><strong>{item.title}</strong><span>L{item.likelihood} × I{item.impact} · {shortPerson(item.owner)}</span></div></div>)}</div>
      </section>
    </div>
    <section className="panel pdpc-panel"><div className="panel-heading"><div><h2>Preventive and corrective response plan</h2><p>PDPC view · prioritized threats mapped to actionable controls</p></div><GitBranch size={18} className="panel-heading-icon" /></div><div className="pdpc-list">{orderedRisks.map((item, index) => <div className="pdpc-row" key={item._id}><div className="pdpc-problem"><span className="pdpc-number">0{index + 1}</span><div><span>Potential problem · risk {item.likelihood * item.impact}/25</span><strong>{item.title}</strong></div></div><div className="pdpc-connector"><i /><ArrowUpRight size={14} /></div><div className="pdpc-response"><div><ShieldCheck size={17} /><span>RESPONSE · {shortPerson(item.owner)}</span></div><p>{item.response}</p></div></div>)}</div>
      <form className="stack-form compact-form risk-add" onSubmit={addRisk}><div className="form-grid compact-grid"><label className="field field-wide"><span>Risk or issue</span><input required placeholder="Describe a threat to project objectives" value={risk.title} onChange={(e) => setRisk({ ...risk, title: e.target.value })} /></label><label className="field"><span>Likelihood · 1–5</span><select value={risk.likelihood} onChange={(e) => setRisk({ ...risk, likelihood: e.target.value })}>{[1, 2, 3, 4, 5].map((level) => <option key={level}>{level}</option>)}</select></label><label className="field"><span>Impact · 1–5</span><select value={risk.impact} onChange={(e) => setRisk({ ...risk, impact: e.target.value })}>{[1, 2, 3, 4, 5].map((level) => <option key={level}>{level}</option>)}</select></label><label className="field field-wide"><span>Preventive / corrective action</span><textarea required rows="2" placeholder="Name an owner and a concrete response" value={risk.response} onChange={(e) => setRisk({ ...risk, response: e.target.value })} /></label></div><button className="button button-outline" disabled={busy}><Plus size={15} /> Add prioritized risk</button></form>
    </section>
  </>;
}

export default App;