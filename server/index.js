import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const port = Number(process.env.PORT || 5000);
const localDatabasePath = path.join(root, 'data', 'careops-mongodb');
let localMongo;
let mongoReconnectPromise;
let shuttingDown = false;
const team = [
  'Kaif Khan - Project Manager',
  'Hamza Ali - Backend Developer',
  'Sara Iqbal - Backend Developer',
  'Noor Fatima - Frontend Developer',
  'Omar Shah - Frontend Developer',
  'Zain Ahmed - Database Developer',
  'Mariam Raza - QA Engineer',
];

const requirementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  priority: { type: String, enum: ['Must', 'Should', 'Could'], default: 'Should' },
  status: { type: String, enum: ['Proposed', 'Approved', 'Rejected'], default: 'Proposed' },
  source: { type: String, default: 'Project team' },
}, { timestamps: true });

const wbsSchema = new mongoose.Schema({
  code: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  owner: { type: String, required: true },
});

const activitySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  owner: { type: String, required: true },
  durationDays: { type: Number, min: 1, required: true },
  budget: { type: Number, min: 0, required: true },
  actualCost: { type: Number, min: 0, default: 0 },
  percentComplete: { type: Number, min: 0, max: 100, default: 0 },
  requirementId: { type: mongoose.Schema.Types.ObjectId, default: null },
  wbsId: { type: mongoose.Schema.Types.ObjectId, default: null },
  dependencies: [{ type: mongoose.Schema.Types.ObjectId }],
});

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  objective: { type: String, default: '' },
  stakeholders: { type: String, default: '' },
  scopeIn: { type: String, default: '' },
  scopeOut: { type: String, default: '' },
  qualityPlan: { type: String, default: '' },
  startDate: { type: Date, required: true },
  deadline: { type: Date, required: true },
  approvedBudget: { type: Number, min: 0, required: true },
  status: { type: String, enum: ['Active', 'Closed'], default: 'Active' },
  closureSummary: { type: String, default: '' },
  closedAt: { type: Date, default: null },
  requirements: [requirementSchema],
  wbs: [wbsSchema],
  activities: [activitySchema],
  changes: [{
    title: { type: String, required: true },
    justification: { type: String, required: true },
    costImpact: { type: Number, min: 0, required: true },
    scheduleWeeks: { type: Number, min: 0, required: true },
    linkedRequirementId: { type: mongoose.Schema.Types.ObjectId, default: null },
    additionalRequirements: [{ title: { type: String, required: true }, description: { type: String, default: '' }, priority: { type: String, default: 'Must' } }],
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    requestedBy: { type: String, default: '' },
    decidedAt: { type: Date, default: null },
  }],
  defects: [{
    title: { type: String, required: true },
    module: { type: String, default: '' },
    severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], required: true },
    owner: { type: String, required: true },
    status: { type: String, enum: ['Open', 'In progress', 'Resolved'], default: 'Open' },
    createdAt: { type: Date, default: Date.now },
  }],
  qualityChecks: [{
    item: { type: String, required: true },
    result: { type: String, enum: ['Pass', 'Fail', 'Not inspected'], default: 'Not inspected' },
    inspector: { type: String, default: '' },
    inspectedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
  }],
  risks: [{
    title: { type: String, required: true },
    likelihood: { type: Number, min: 1, max: 5, required: true },
    impact: { type: Number, min: 1, max: 5, required: true },
    response: { type: String, required: true },
    owner: { type: String, required: true },
    status: { type: String, default: 'Monitoring' },
  }],
  milestones: [{
    title: { type: String, required: true },
    targetDate: { type: Date, required: true },
    owner: { type: String, required: true },
    status: { type: String, default: 'Upcoming' },
  }],
}, { timestamps: true, optimisticConcurrency: true });

const Project = mongoose.model('Project', projectSchema);

function asDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function addWorkdays(start, days) {
  const result = new Date(start);
  let remaining = Math.max(days, 1) - 1;
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() !== 0 && result.getUTCDay() !== 6) remaining -= 1;
  }
  return result;
}

function nextWorkday(day) {
  const result = new Date(day);
  do result.setUTCDate(result.getUTCDate() + 1);
  while (result.getUTCDay() === 0 || result.getUTCDay() === 6);
  return result;
}

function weekdaysBetween(start, end) {
  if (end < start) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function computeSchedule(project) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const startDate = asDate(project.startDate);
  const deadline = asDate(project.deadline);
  const planned = new Map();
  const forecast = new Map();
  const visiting = new Set();
  const activities = project.activities;

  function compute(activity) {
    const id = activity._id.toString();
    if (planned.has(id)) return;
    if (visiting.has(id)) throw new Error('Activity dependencies contain a cycle.');
    visiting.add(id);
    const dependencies = activity.dependencies.map((dependency) => {
      const parent = activities.id(dependency);
      if (!parent) throw new Error('An activity references a missing predecessor.');
      compute(parent);
      return parent;
    });
    const start = dependencies.length
      ? nextWorkday(new Date(Math.max(...dependencies.map((item) => planned.get(item.id).end))))
      : new Date(startDate);
    const end = addWorkdays(start, activity.durationDays);
    planned.set(id, { start, end });

    let forecastStart;
    let forecastEnd;
    if (activity.percentComplete === 100) {
      forecastStart = start;
      forecastEnd = end;
    } else {
      forecastStart = dependencies.length
        ? nextWorkday(new Date(Math.max(...dependencies.map((item) => forecast.get(item.id).end))))
        : new Date(start);
      if (today > forecastStart) {
        forecastStart = new Date(today);
        while (forecastStart.getUTCDay() === 0 || forecastStart.getUTCDay() === 6) {
          forecastStart.setUTCDate(forecastStart.getUTCDate() + 1);
        }
      }
      const remaining = Math.max(1, Math.ceil(activity.durationDays * (100 - activity.percentComplete) / 100));
      forecastEnd = addWorkdays(forecastStart, remaining);
    }
    forecast.set(id, { start: forecastStart, end: forecastEnd });
    visiting.delete(id);
  }

  activities.forEach(compute);
  const span = Math.max(deadline - startDate, 1);
  return activities.map((activity) => {
    const id = activity._id.toString();
    const { start, end } = planned.get(id);
    const forecastDates = forecast.get(id);
    const delayed = activity.percentComplete < 100 && today > end;
    const dayAfterEnd = new Date(end);
    dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
    return {
      ...activity.toObject(),
      start,
      end,
      forecastStart: forecastDates.start,
      forecastEnd: forecastDates.end,
      isDelayed: delayed,
      delayDays: delayed ? weekdaysBetween(dayAfterEnd, today) : 0,
      timelineLeft: Math.min(Math.max((start - startDate) / span * 100, 0), 100),
      timelineWidth: Math.min(Math.max((end - start) / span * 100, 2), 100),
      predecessors: activity.dependencies.map((dependency) => activities.id(dependency)?.title || 'Unknown'),
    };
  });
}

function calculateEvm(project, schedule) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let pv = 0;
  let ev = 0;
  let ac = 0;
  for (const activity of schedule) {
    const plannedElapsed = today < activity.start ? 0 : weekdaysBetween(activity.start, new Date(Math.min(today, activity.end)));
    pv += activity.budget * Math.min(plannedElapsed / Math.max(activity.durationDays, 1), 1);
    ev += activity.budget * activity.percentComplete / 100;
    ac += activity.actualCost;
  }
  const bac = schedule.reduce((sum, activity) => sum + activity.budget, 0);
  const cpi = ac ? ev / ac : 0;
  const spi = pv ? ev / pv : 0;
  return {
    bac,
    pv,
    ev,
    ac,
    cpi,
    spi,
    progress: bac ? ev / bac : 0,
    budgetVariance: ev - ac,
    costOverrun: ac > project.approvedBudget,
    warning: (ac > 0 && cpi < 0.9) || (pv > 0 && spi < 0.9) || ac > project.approvedBudget,
  };
}

function serializeProject(project) {
  const schedule = computeSchedule(project);
  const evm = calculateEvm(project, schedule);
  const forecastFinish = schedule.reduce((latest, task) => task.forecastEnd > latest ? task.forecastEnd : latest, asDate(project.deadline));
  return {
    project,
    schedule,
    evm,
    delayed: schedule.filter((task) => task.isDelayed),
    forecastFinish,
    pendingChanges: project.changes.filter((change) => change.status === 'Pending').length,
    openCriticalDefects: project.defects.filter((defect) => defect.severity === 'Critical' && defect.status !== 'Resolved').length,
  };
}

function seedProject() {
  const reqs = [
    ['Appointment scheduling', 'Book, reschedule, and cancel appointments against doctor availability.', 'Must', 'Approved'],
    ['Patient record management', 'Authorized clinicians retrieve and update patient clinical records.', 'Must', 'Approved'],
    ['Laboratory reports', 'Link results to the correct patient and authorized clinicians.', 'Must', 'Approved'],
    ['Online consultations', 'Conduct scheduled remote consultations.', 'Should', 'Approved'],
    ['Hospital billing', 'Generate and reconcile patient invoices.', 'Must', 'Approved'],
  ].map(([title, description, priority, status]) => ({ _id: new mongoose.Types.ObjectId(), title, description, priority, status, source: 'Project charter' }));
  const aiRequirement = {
    _id: new mongoose.Types.ObjectId(),
    title: 'AI preliminary diagnosis',
    description: 'AI-assisted preliminary triage suggestion for clinician review.',
    priority: 'Could',
    status: 'Proposed',
    source: 'Management request - pending change control',
  };
  const wbs = [
    ['1', 'Project governance and discovery', team[0]],
    ['2', 'Clinical platform foundation', team[5]],
    ['3', 'Patient and appointment services', team[1]],
    ['4', 'Hospital workflows and interfaces', team[3]],
    ['5', 'Verification and release', team[6]],
  ].map(([code, title, owner]) => ({ _id: new mongoose.Types.ObjectId(), code, title, owner }));
  const taskSpecs = [
    ['Charter, discovery & requirements', team[0], 10, 500000, 510000, 100, 0, 0],
    ['Data architecture & environment', team[5], 10, 650000, 640000, 100, 1, 1],
    ['Clinical UX & workflow design', team[3], 10, 550000, 505000, 100, 0, 3],
    ['Core services & patient records', team[1], 20, 1400000, 1120000, 70, 1, 2],
    ['Appointments, lab & billing UI', team[4], 15, 1000000, 390000, 25, 0, 3],
    ['Integration, QA & defect closure', team[6], 15, 600000, 120000, 10, 0, 4],
    ['Hospital rollout & handover', team[0], 10, 300000, 0, 0, -1, 4],
  ];
  const activities = taskSpecs.map(([title, owner, durationDays, budget, actualCost, percentComplete, requirementIndex, wbsIndex]) => ({
    _id: new mongoose.Types.ObjectId(),
    title,
    owner,
    durationDays,
    budget,
    actualCost,
    percentComplete,
    requirementId: requirementIndex >= 0 ? reqs[requirementIndex]._id : null,
    wbsId: wbs[wbsIndex]._id,
    dependencies: [],
  }));
  [[1, 0], [2, 0], [3, 1], [4, 2], [4, 3], [5, 4], [6, 5]].forEach(([task, predecessor]) => {
    activities[task].dependencies.push(activities[predecessor]._id);
  });
  return {
    name: 'Smart Healthcare Project Management System',
    objective: 'Deliver a secure, integrated clinical operations platform for five hospitals within 16 weeks and the approved PKR 5,000,000 baseline.',
    stakeholders: 'Hospital management; clinicians; laboratory teams; billing staff; patients; development team.',
    scopeIn: 'Patient appointments, doctor schedules, patient records, laboratory reports, online consultations, and hospital billing.',
    scopeOut: 'AI diagnosis, native mobile applications, hardware procurement, and replacement of hospital core systems (controlled through change requests).',
    qualityPlan: 'Acceptance testing for clinical workflows, role-based access, auditability, data validation, regression testing, and release-readiness review.',
    startDate: new Date('2026-09-01T00:00:00.000Z'),
    deadline: new Date('2026-12-22T00:00:00.000Z'),
    approvedBudget: 5000000,
    status: 'Active',
    requirements: [
      ...reqs,
      aiRequirement,
    ],
    wbs,
    activities,
    changes: [{
      title: 'AI preliminary diagnosis and mobile application',
      justification: 'Hospital management requests an AI-assisted preliminary diagnosis module and patient mobile app. Add only after clinical safety review, data governance approval, and an approved change baseline.',
      costImpact: 800000,
      scheduleWeeks: 3,
      linkedRequirementId: aiRequirement._id,
      additionalRequirements: [{ title: 'Patient mobile application', description: 'Provide mobile access to patient appointment, consultation, and health-record workflows.', priority: 'Must' }],
      status: 'Pending',
      requestedBy: 'Hospital management',
    }],
    defects: [
      { title: 'Overlapping bookings accepted for a doctor', module: 'Appointment scheduling', severity: 'Critical', owner: team[1], status: 'Open', createdAt: new Date('2026-10-20T00:00:00.000Z') },
      { title: 'Patient record update can overwrite concurrent edits', module: 'Patient records', severity: 'Critical', owner: team[2], status: 'In progress', createdAt: new Date('2026-10-22T00:00:00.000Z') },
      { title: 'Invoice total rounds incorrectly for one tax case', module: 'Billing', severity: 'High', owner: team[6], status: 'Open', createdAt: new Date('2026-10-24T00:00:00.000Z') },
    ],
    qualityChecks: [
      { item: 'Appointment conflict and double-booking tests', result: 'Fail', inspector: team[6], inspectedAt: new Date('2026-10-24T00:00:00.000Z'), notes: 'Critical overlap defect logged.' },
      { item: 'Patient identity and concurrent-update integrity', result: 'Fail', inspector: team[6], inspectedAt: new Date('2026-10-25T00:00:00.000Z'), notes: 'Record overwrite defect logged.' },
      { item: 'Role access and audit trail review', result: 'Pass', inspector: team[6], inspectedAt: new Date('2026-10-21T00:00:00.000Z'), notes: 'Verified for clinician and billing roles.' },
      { item: 'Backup and recovery rehearsal', result: 'Not inspected', inspector: team[6], notes: '' },
    ],
    risks: [
      { title: 'Clinical data integrity defect escapes release', likelihood: 4, impact: 5, response: 'Add transaction-level tests, independent record reconciliation, and release-blocking regression gate.', owner: team[6], status: 'Mitigating' },
      { title: 'Hospital stakeholders expand scope', likelihood: 4, impact: 4, response: 'Route every request through impact analysis and change-control approval; protect the baseline.', owner: team[0], status: 'Monitoring' },
      { title: 'Integration dependencies delay rollout', likelihood: 3, impact: 4, response: 'Confirm hospital interface owners early and run a staged integration rehearsal.', owner: team[1], status: 'Monitoring' },
    ],
    milestones: [
      { title: 'Charter and scope baseline', targetDate: new Date('2026-09-14T00:00:00.000Z'), owner: team[0], status: 'Complete' },
      { title: 'Core clinical workflow demo', targetDate: new Date('2026-11-23T00:00:00.000Z'), owner: team[1], status: 'Upcoming' },
      { title: 'Five-hospital acceptance and release', targetDate: new Date('2026-12-22T00:00:00.000Z'), owner: team[0], status: 'Upcoming' },
    ],
  };
}

async function getProject() {
  let project = await Project.findOne();
  if (!project) project = await Project.create(seedProject());
  else if (renameProjectManagerReferences(project)) await project.save();
  return project;
}

function renameProjectManagerReferences(project) {
  const oldName = 'Aisha Khan';
  const newName = 'Kaif Khan';
  let changed = false;
  for (const field of ['wbs', 'activities', 'changes', 'defects', 'qualityChecks', 'risks', 'milestones']) {
    for (const record of project[field]) {
      for (const key of ['owner', 'requestedBy', 'inspector']) {
        if (typeof record[key] === 'string' && record[key].includes(oldName)) {
          record[key] = record[key].replaceAll(oldName, newName);
          changed = true;
        }
      }
    }
  }
  return changed;
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', async (_req, _res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) await reconnectMongo();
    next();
  } catch (error) { next(error); }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));

app.get('/api/project', async (_req, res, next) => {
  try {
    res.json(serializeProject(await getProject()));
  } catch (error) { next(error); }
});

app.patch('/api/project/charter', async (req, res, next) => {
  try {
    const { name, objective, stakeholders, scopeIn, scopeOut, qualityPlan, startDate, deadline, approvedBudget } = req.body;
    const start = asDate(startDate);
    const end = asDate(deadline);
    const budget = Number(approvedBudget);
    if (!name?.trim() || !start || !end || end <= start || !Number.isFinite(budget) || budget <= 0) {
      return res.status(400).json({ error: 'Project name, valid ordered dates, and positive approved budget are required.' });
    }
    const project = await getProject();
    Object.assign(project, { name: name.trim(), objective, stakeholders, scopeIn, scopeOut, qualityPlan, startDate: start, deadline: end, approvedBudget: budget });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/project/close', async (req, res, next) => {
  try {
    if (!req.body.summary?.trim()) return res.status(400).json({ error: 'A closure summary is required.' });
    const project = await getProject();
    project.status = 'Closed';
    project.closureSummary = req.body.summary.trim();
    project.closedAt = new Date();
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/milestones', async (req, res, next) => {
  try {
    const targetDate = asDate(req.body.targetDate);
    if (!req.body.title?.trim() || !targetDate || !team.includes(req.body.owner)) return res.status(400).json({ error: 'Milestone title, date, and team owner are required.' });
    const project = await getProject();
    project.milestones.push({ title: req.body.title.trim(), targetDate, owner: req.body.owner, status: 'Upcoming' });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/requirements', async (req, res, next) => {
  try {
    if (!req.body.title?.trim() || !['Must', 'Should', 'Could'].includes(req.body.priority)) return res.status(400).json({ error: 'Requirement title and priority are required.' });
    const project = await getProject();
    project.requirements.push({ title: req.body.title.trim(), description: req.body.description || '', priority: req.body.priority, status: 'Proposed', source: req.body.source || 'Project team' });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.patch('/api/requirements/:id', async (req, res, next) => {
  try {
    const project = await getProject();
    const item = project.requirements.id(req.params.id);
    if (!item) return res.status(404).json({ error: 'Requirement not found.' });
    if (req.body.status && ['Approved', 'Rejected'].includes(req.body.status)) item.status = req.body.status;
    if (req.body.title !== undefined) item.title = req.body.title.trim();
    if (req.body.description !== undefined) item.description = req.body.description;
    if (req.body.priority && ['Must', 'Should', 'Could'].includes(req.body.priority)) item.priority = req.body.priority;
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/wbs', async (req, res, next) => {
  try {
    const { title, parentId, owner } = req.body;
    if (!title?.trim() || !team.includes(owner)) return res.status(400).json({ error: 'WBS title and team owner are required.' });
    const project = await getProject();
    const parent = parentId ? project.wbs.id(parentId) : null;
    if (parentId && !parent) return res.status(400).json({ error: 'Selected WBS parent does not exist.' });
    const siblings = project.wbs.filter((entry) => String(entry.parentId || '') === String(parent?._id || ''));
    project.wbs.push({ code: `${parent ? `${parent.code}.` : ''}${siblings.length + 1}`, title: title.trim(), parentId: parent?._id || null, owner });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/changes', async (req, res, next) => {
  try {
    const { title, justification, costImpact, scheduleWeeks, linkedRequirementId, additionalRequirements = [] } = req.body;
    const cost = Number(costImpact);
    const weeks = Number(scheduleWeeks);
    if (!title?.trim() || !justification?.trim() || !Number.isFinite(cost) || cost < 0 || !Number.isInteger(weeks) || weeks < 0) return res.status(400).json({ error: 'Change title, justification, non-negative cost, and whole-week impact are required.' });
    const project = await getProject();
    const linkedRequirement = linkedRequirementId ? project.requirements.id(linkedRequirementId) : null;
    if (linkedRequirementId && (!linkedRequirement || linkedRequirement.status !== 'Proposed')) return res.status(400).json({ error: 'A change may only link to an existing proposed requirement.' });
    if (!Array.isArray(additionalRequirements) || additionalRequirements.some((item) => !item.title?.trim())) return res.status(400).json({ error: 'Each additional requirement needs a title.' });
    project.changes.push({ title: title.trim(), justification: justification.trim(), costImpact: cost, scheduleWeeks: weeks, linkedRequirementId: linkedRequirement?._id || null, additionalRequirements, requestedBy: team[0], status: 'Pending' });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/changes/:id/:decision', async (req, res, next) => {
  try {
    if (!['approve', 'reject'].includes(req.params.decision)) return res.status(404).json({ error: 'Unknown change decision.' });
    const project = await getProject();
    const change = project.changes.id(req.params.id);
    if (!change) return res.status(404).json({ error: 'Change request not found.' });
    if (change.status !== 'Pending') return res.status(409).json({ error: 'This change has already been decided.' });
    if (req.params.decision === 'reject') {
      change.status = 'Rejected';
      change.decidedAt = new Date();
    } else {
      project.approvedBudget += change.costImpact;
      project.deadline = new Date(project.deadline.getTime() + change.scheduleWeeks * 7 * 86400000);
      let requirement = change.linkedRequirementId ? project.requirements.id(change.linkedRequirementId) : null;
      if (requirement) {
        requirement.description = change.justification;
        requirement.priority = 'Must';
        requirement.status = 'Approved';
        requirement.source = `Approved change CR-${change._id.toString().slice(-5)}`;
      } else {
        requirement = project.requirements.create({ title: change.title, description: change.justification, priority: 'Must', status: 'Approved', source: `Approved change CR-${change._id.toString().slice(-5)}` });
        project.requirements.push(requirement);
      }
      for (const additional of change.additionalRequirements) {
        project.requirements.push({ ...additional.toObject(), status: 'Approved', source: `Approved change CR-${change._id.toString().slice(-5)}` });
      }
      const rootItems = project.wbs.filter((entry) => !entry.parentId);
      const wbs = project.wbs.create({ code: String(rootItems.length + 1), title: change.title, owner: team[0] });
      project.wbs.push(wbs);
      const terminalTasks = project.activities.filter((activity) => !project.activities.some((other) => other.dependencies.some((id) => id.equals(activity._id))));
      const task = project.activities.create({
        title: change.title,
        owner: team[1],
        durationDays: Math.max(1, change.scheduleWeeks * 5),
        budget: change.costImpact,
        requirementId: requirement._id,
        wbsId: wbs._id,
        dependencies: terminalTasks.map((activity) => activity._id),
      });
      project.activities.push(task);
      change.status = 'Approved';
      change.decidedAt = new Date();
    }
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/activities', async (req, res, next) => {
  try {
    const { title, owner, durationDays, budget, requirementId, dependencies = [] } = req.body;
    const duration = Number(durationDays);
    const cost = Number(budget);
    if (!title?.trim() || !team.includes(owner) || !Number.isInteger(duration) || duration < 1 || !Number.isFinite(cost) || cost < 0) return res.status(400).json({ error: 'Task title, team owner, positive whole-day duration, and non-negative budget are required.' });
    const project = await getProject();
    if (requirementId && project.requirements.id(requirementId)?.status !== 'Approved') return res.status(400).json({ error: 'Activities may only be linked to approved requirements.' });
    if (!Array.isArray(dependencies) || dependencies.some((id) => !project.activities.id(id))) return res.status(400).json({ error: 'Every predecessor must be an existing activity.' });
    project.activities.push({ title: title.trim(), owner, durationDays: duration, budget: cost, requirementId: requirementId || null, dependencies });
    try { computeSchedule(project); } catch (error) { project.activities.pop(); return res.status(400).json({ error: error.message }); }
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.patch('/api/activities/:id/progress', async (req, res, next) => {
  try {
    const progress = Number(req.body.percentComplete);
    const actualCost = Number(req.body.actualCost);
    if (!Number.isInteger(progress) || progress < 0 || progress > 100 || !Number.isFinite(actualCost) || actualCost < 0) return res.status(400).json({ error: 'Progress must be 0-100 and actual cost must be non-negative.' });
    const project = await getProject();
    const activity = project.activities.id(req.params.id);
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });
    activity.percentComplete = progress;
    activity.actualCost = actualCost;
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/defects', async (req, res, next) => {
  try {
    const { title, module, severity, owner } = req.body;
    if (!title?.trim() || !['Critical', 'High', 'Medium', 'Low'].includes(severity) || !team.includes(owner)) return res.status(400).json({ error: 'Defect title, severity, and valid assigned team member are required.' });
    const project = await getProject();
    project.defects.push({ title: title.trim(), module: module || '', severity, owner, status: 'Open' });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.patch('/api/defects/:id', async (req, res, next) => {
  try {
    const project = await getProject();
    const defect = project.defects.id(req.params.id);
    if (!defect) return res.status(404).json({ error: 'Defect not found.' });
    if (!['Open', 'In progress', 'Resolved'].includes(req.body.status)) return res.status(400).json({ error: 'Unknown defect status.' });
    defect.status = req.body.status;
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/quality-checks', async (req, res, next) => {
  try {
    if (!req.body.item?.trim()) return res.status(400).json({ error: 'Checklist item is required.' });
    const project = await getProject();
    project.qualityChecks.push({ item: req.body.item.trim(), inspector: team[6] });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.patch('/api/quality-checks/:id', async (req, res, next) => {
  try {
    if (!['Pass', 'Fail', 'Not inspected'].includes(req.body.result)) return res.status(400).json({ error: 'Unknown inspection result.' });
    const project = await getProject();
    const check = project.qualityChecks.id(req.params.id);
    if (!check) return res.status(404).json({ error: 'Checklist item not found.' });
    check.result = req.body.result;
    check.notes = req.body.notes || '';
    check.inspectedAt = new Date();
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.post('/api/risks', async (req, res, next) => {
  try {
    const { title, likelihood, impact, response } = req.body;
    if (!title?.trim() || !Number.isInteger(Number(likelihood)) || Number(likelihood) < 1 || Number(likelihood) > 5 || !Number.isInteger(Number(impact)) || Number(impact) < 1 || Number(impact) > 5 || !response?.trim()) return res.status(400).json({ error: 'Risk, likelihood and impact (1-5), and response are required.' });
    const project = await getProject();
    project.risks.push({ title: title.trim(), likelihood: Number(likelihood), impact: Number(impact), response: response.trim(), owner: team[0] });
    await project.save();
    res.json(serializeProject(project));
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  const status = error.name === 'ValidationError' ? 400 : error.name === 'VersionError' ? 409 : 500;
  res.status(status).json({ error: status === 500 ? 'The request could not be completed. Saved project data is unchanged.' : error.message });
});

async function reconnectMongo() {
  if (mongoose.connection.readyState === 1) return;
  if (mongoReconnectPromise) return mongoReconnectPromise;
  mongoReconnectPromise = (async () => {
    if (localMongo) {
      try { await localMongo.stop(); } catch { }
      await mkdir(localDatabasePath, { recursive: true });
      localMongo = await MongoMemoryServer.create({
        instance: { dbPath: localDatabasePath, storageEngine: 'wiredTiger' },
      });
      await mongoose.connect(localMongo.getUri('healthcare_project'));
      console.log('MongoDB connection restored.');
      return;
    }
    if (process.env.MONGODB_URI) await mongoose.connect(process.env.MONGODB_URI);
    else throw new Error('MongoDB is not available.');
  })().finally(() => { mongoReconnectPromise = null; });
  return mongoReconnectPromise;
}

async function start() {
  let mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    await mkdir(localDatabasePath, { recursive: true });
    localMongo = await MongoMemoryServer.create({
      instance: { dbPath: localDatabasePath, storageEngine: 'wiredTiger' },
    });
    mongoUri = localMongo.getUri('healthcare_project');
    console.log('Using a local MongoDB database persisted in ./data/careops-mongodb');
  }
  await mongoose.connect(mongoUri);
  await getProject();
  app.listen(port, () => console.log(`Healthcare project API listening on http://localhost:${port}`));
}

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    console.error('Unable to start MongoDB/API:', error.message);
    process.exitCode = 1;
  });
}

export { app, calculateEvm, computeSchedule, getProject, Project, renameProjectManagerReferences, seedProject, serializeProject };

process.on('SIGINT', async () => {
  shuttingDown = true;
  await mongoose.disconnect();
  await localMongo?.stop();
  process.exit(0);
});

mongoose.connection.on('disconnected', () => {
  if (localMongo && !shuttingDown && !mongoReconnectPromise) {
    console.warn('MongoDB connection dropped; attempting local recovery.');
    reconnectMongo().catch((error) => console.error('MongoDB recovery failed:', error.message));
  }
});