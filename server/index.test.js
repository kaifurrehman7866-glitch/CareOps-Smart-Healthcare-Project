import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
const { app, Project, renameProjectManagerReferences, seedProject, serializeProject } = await import('./index.js');

let database;
let server;
let baseUrl;

before(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri('healthcare_project_test'));
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server?.close(resolve));
  await mongoose.disconnect();
  await database?.stop();
});

async function callApi(route, method = 'GET', body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test('seeded model calculates planned, earned, actual, CPI, and SPI', () => {
  const project = new Project(seedProject());
  const result = serializeProject(project);
  assert.equal(project.approvedBudget, 5_000_000);
  assert.equal(result.schedule.length, 7);
  assert.equal(result.evm.ev, 2_990_000);
  assert.equal(result.evm.ac, 3_285_000);
  assert.equal(result.evm.cpi, result.evm.ev / result.evm.ac);
  assert.equal(result.evm.spi, result.evm.ev / result.evm.pv);
  assert.ok(result.evm.pv > 0);
  assert.equal(result.openCriticalDefects, 2);
});

test('pending requirements remain outside approved scope and cannot receive activities', async () => {
  const initial = await callApi('/api/project');
  const baselineBudget = initial.body.project.approvedBudget;
  const baselineDeadline = initial.body.project.deadline;
  const proposed = initial.body.project.requirements.find((item) => item.status === 'Proposed');
  assert.ok(proposed);
  assert.equal(initial.body.pendingChanges, 1);

  const task = await callApi('/api/activities', 'POST', {
    title: 'Unapproved work', owner: 'Hamza Ali - Backend Developer', durationDays: 3,
    budget: 10000, requirementId: proposed._id,
  });
  assert.equal(task.status, 400);

  const after = await callApi('/api/project');
  assert.equal(after.body.project.approvedBudget, baselineBudget);
  assert.equal(after.body.project.deadline, baselineDeadline);
  assert.equal(after.body.schedule.length, 7);
});

test('rejecting a change preserves scope, schedule, deadline, and approved budget', async () => {
  const initial = await callApi('/api/project');
  const change = initial.body.project.changes.find((item) => item.status === 'Pending');
  const result = await callApi(`/api/changes/${change._id}/reject`, 'POST', {});
  assert.equal(result.status, 200);
  assert.equal(result.body.project.approvedBudget, 5_000_000);
  assert.equal(result.body.schedule.length, 7);
  assert.equal(result.body.project.deadline, '2026-12-22T00:00:00.000Z');
  assert.equal(result.body.project.changes.find((item) => item._id === change._id).status, 'Rejected');
});

test('approving AI and mobile change atomically updates scope, WBS, schedule, and baseline', async () => {
  const added = await callApi('/api/changes', 'POST', {
    title: 'AI preliminary diagnosis and mobile application',
    justification: 'Hospital management approved the safety and data governance review.',
    costImpact: 800_000,
    scheduleWeeks: 3,
  });
  assert.equal(added.status, 200);
  const change = added.body.project.changes.find((item) => item.status === 'Pending');
  const result = await callApi(`/api/changes/${change._id}/approve`, 'POST', {});

  assert.equal(result.status, 200);
  assert.equal(result.body.project.approvedBudget, 5_800_000);
  assert.equal(result.body.project.deadline, '2027-01-12T00:00:00.000Z');
  assert.equal(result.body.schedule.length, 8);
  assert.equal(result.body.project.wbs.length, 6);
  assert.equal(result.body.project.requirements.some((item) => item.title === change.title && item.status === 'Approved'), true);
  assert.equal(result.body.schedule.some((item) => item.title === change.title), true);
  assert.equal(result.body.project.changes.find((item) => item._id === change._id).status, 'Approved');
});

test('schedule dependencies determine successor dates and actuals recalculate EVM', async () => {
  const project = await callApi('/api/project');
  const predecessor = project.body.schedule[0];
  const added = await callApi('/api/activities', 'POST', {
    title: 'Regression verification', owner: 'Mariam Raza - QA Engineer', durationDays: 5,
    budget: 120_000, dependencies: [predecessor._id],
  });
  assert.equal(added.status, 200);
  const task = added.body.schedule.find((item) => item.title === 'Regression verification');
  assert.equal(task.predecessors[0], predecessor.title);
  assert.ok(new Date(task.start) > new Date(predecessor.end));

  const progress = await callApi(`/api/activities/${task._id}/progress`, 'PATCH', { percentComplete: 50, actualCost: 80_000 });
  assert.equal(progress.status, 200);
  assert.equal(progress.body.evm.ev, 3_050_000);
  assert.equal(progress.body.evm.ac, 3_365_000);
});

test('invalid inputs are rejected and defects/checklist/risk records persist', async () => {
  const invalidRisk = await callApi('/api/risks', 'POST', { title: 'Bad risk', likelihood: 6, impact: 3, response: 'Review' });
  assert.equal(invalidRisk.status, 400);

  const defect = await callApi('/api/defects', 'POST', {
    title: 'Lab result patient mismatch', module: 'Laboratory reports', severity: 'Critical', owner: 'Sara Iqbal - Backend Developer',
  });
  assert.equal(defect.status, 200);
  const addedDefect = defect.body.project.defects.find((item) => item.title === 'Lab result patient mismatch');
  assert.equal(addedDefect.status, 'Open');

  const resolved = await callApi(`/api/defects/${addedDefect._id}`, 'PATCH', { status: 'Resolved' });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.project.defects.find((item) => item._id === addedDefect._id).status, 'Resolved');

  const check = await callApi('/api/quality-checks', 'POST', { item: 'Clinical safety signoff' });
  assert.equal(check.status, 200);
  assert.equal(check.body.project.qualityChecks.some((item) => item.item === 'Clinical safety signoff'), true);
});

test('project manager rename migrates existing owner, requestor, and inspector records', () => {
  const project = new Project(seedProject());
  project.activities[0].owner = 'Aisha Khan - Project Manager';
  project.changes[0].requestedBy = 'Aisha Khan - Project Manager';
  project.milestones[0].owner = 'Aisha Khan - Project Manager';

  assert.equal(renameProjectManagerReferences(project), true);
  assert.equal(project.activities[0].owner, 'Kaif Khan - Project Manager');
  assert.equal(project.changes[0].requestedBy, 'Kaif Khan - Project Manager');
  assert.equal(project.milestones[0].owner, 'Kaif Khan - Project Manager');
  assert.equal(renameProjectManagerReferences(project), false);
});