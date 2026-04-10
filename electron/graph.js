'use strict';

/**
 * TEN Document Studio — Microsoft Graph API Helper
 */

const GRAPH_BASE    = 'https://graph.microsoft.com/v1.0';
const TARGET_NAMES  = ['adonis', 'malik', 'andre'];
const TARGET_PLAN   = 'TEN Planner';

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function graphRequest(method, path, token, body = null, extraHeaders = {}) {
  const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extraHeaders };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (res.status === 204) return {};
  const text = await res.text();
  if (!res.ok) throw new Error(`Graph ${method} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return {}; }
}

const gGet   = (path, token)              => graphRequest('GET',   path, token);
const gPost  = (path, token, body)        => graphRequest('POST',  path, token, body);
const gPatch = (path, token, body, etag)  => graphRequest('PATCH', path, token, body, etag ? { 'If-Match': etag } : {});

async function getAllPages(firstPath, token) {
  const items = [];
  let url = firstPath;
  while (url) {
    const page = await gGet(url, token);
    items.push(...(page.value || []));
    url = page['@odata.nextLink'] || null;
  }
  return items;
}

/** Run async functions with max `concurrency` in-flight at once */
async function withConcurrency(items, fn, concurrency = 6) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(fn));
    results.push(...settled);
  }
  return results;
}

// ── User resolution ───────────────────────────────────────────────────────────

async function resolveUserIds(ids, token) {
  if (!ids || ids.length === 0) return {};
  const unique = [...new Set(ids)];
  const map = {};

  // Try batch lookup first (requires Directory.Read.All — may fail without admin consent)
  try {
    const result = await gPost('/directoryObjects/getByIds', token, {
      ids: unique, types: ['user'],
    });
    for (const obj of result.value || []) {
      if (obj.id && obj.displayName) map[obj.id] = obj.displayName;
    }
    if (Object.keys(map).length > 0) return map;
  } catch (err) {
    console.warn('[graph] batch resolveUserIds failed, falling back to individual lookups:', err.message);
  }

  // Fallback: individual /users/{id} calls — works with User.ReadBasic.All
  const settled = await Promise.allSettled(
    unique.map(id =>
      gGet(`/users/${id}?$select=id,displayName`, token)
        .then(u => { if (u.id && u.displayName) map[u.id] = u.displayName; })
    )
  );
  const failCount = settled.filter(r => r.status === 'rejected').length;
  if (failCount > 0) console.warn(`[graph] ${failCount}/${unique.length} individual user lookups failed`);

  return map;
}

// ── Planner ───────────────────────────────────────────────────────────────────

async function getPlans(token) {
  let groups = [];
  try {
    groups = await getAllPages('/me/joinedTeams?$select=id,displayName', token);
  } catch (err) {
    console.warn('[graph] joinedTeams failed:', err.message);
  }

  let personalPlans = [];
  try {
    const p = await gGet('/me/planner/plans?$select=id,title,owner', token);
    personalPlans = p.value || [];
  } catch {}

  const groupPlanArrays = await Promise.allSettled(
    groups.map(g =>
      gGet(`/groups/${g.id}/planner/plans?$select=id,title,owner`, token)
        .then(r => (r.value || []).map(p => ({ ...p, _groupName: g.displayName })))
        .catch(() => [])
    )
  );

  const all = [...personalPlans, ...groupPlanArrays.flatMap(r => r.status === 'fulfilled' ? r.value : [])];
  const seen = new Set();
  return all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
}

/** Fetch tasks, buckets, plan category labels, and task checklists for one plan */
async function getPlanDetails(planId, token) {
  const [tasksR, bucketsR, planDetailsR] = await Promise.allSettled([
    // NOTE: no $select on tasks so we always get appliedCategories (some Graph versions drop it)
    getAllPages(`/planner/plans/${planId}/tasks`, token),
    getAllPages(`/planner/plans/${planId}/buckets?$select=id,name,planId,orderHint`, token),
    // NOTE: no $select on plan details — ensures categoryDescriptions is always returned
    gGet(`/planner/plans/${planId}/details`, token),
  ]);

  const tasks   = tasksR.status   === 'fulfilled' ? tasksR.value   : [];
  const buckets = bucketsR.status === 'fulfilled' ? bucketsR.value : [];
  const categoryDescriptions = planDetailsR.status === 'fulfilled'
    ? (planDetailsR.value.categoryDescriptions || {})
    : {};

  // Fetch task details (checklists) with concurrency limit
  const taskDetailResults = await withConcurrency(tasks, async (task) => {
    const details = await gGet(`/planner/tasks/${task.id}/details?$select=checklist,description`, token);
    return { taskId: task.id, details, detailsEtag: details['@odata.etag'] || '*' };
  }, 6);

  const taskDetailsMap = {};
  for (const r of taskDetailResults) {
    if (r.status === 'fulfilled' && r.value) {
      taskDetailsMap[r.value.taskId] = { checklist: r.value.details.checklist || {}, detailsEtag: r.value.detailsEtag };
    }
  }

  return { tasks, buckets, categoryDescriptions, taskDetailsMap };
}

/** Main sync — fetches TEN Planner, filters by team members, returns structured data */
async function syncPlanner(token) {
  try {
    const plans = await getPlans(token);
    console.log(`[graph] Found ${plans.length} plan(s):`, plans.map(p => p.title || p._groupName));

    if (plans.length === 0) return { plans: [], buckets: [], tasks: [], categories: [], syncedAt: new Date().toISOString() };

    let activePlans = plans.filter(p => p.title === TARGET_PLAN);
    if (activePlans.length === 0) {
      console.warn(`[graph] "${TARGET_PLAN}" not found — using all plans`);
      activePlans = plans;
    }
    console.log(`[graph] Using:`, activePlans.map(p => p.title));

    const detailResults = await Promise.allSettled(
      activePlans.map(p => getPlanDetails(p.id, token).then(d => ({ planId: p.id, ...d })))
    );

    const allBuckets        = [];
    const allRawTasks       = [];
    const allTaskDetailsMap = {};
    let   categoryDescriptions = {};

    for (const r of detailResults) {
      if (r.status !== 'fulfilled') continue;
      allBuckets.push(...r.value.buckets);
      allRawTasks.push(...r.value.tasks);
      Object.assign(allTaskDetailsMap, r.value.taskDetailsMap);
      Object.assign(categoryDescriptions, r.value.categoryDescriptions);
    }

    console.log(`[graph] ${allRawTasks.length} tasks, ${allBuckets.length} buckets`);
    console.log(`[graph] Categories:`, categoryDescriptions);

    // Resolve user IDs → display names
    const userIds = allRawTasks.flatMap(t => Object.keys(t.assignments || {}));
    const userMap = await resolveUserIds(userIds, token);
    const nameResolutionWorked = Object.keys(userMap).length > 0;
    console.log(`[graph] Resolved ${Object.keys(userMap).length} users:`, Object.values(userMap));

    // Filter to target team members (fallback: include all if resolution failed)
    const filteredTasks = allRawTasks.filter(task => {
      const ids = Object.keys(task.assignments || {});
      if (ids.length === 0) return false;
      if (!nameResolutionWorked) return true;
      return ids.some(id => TARGET_NAMES.some(t => (userMap[id] || '').toLowerCase().includes(t)));
    });

    console.log(`[graph] ${filteredTasks.length} tasks after filter`);

    // Shape categories (only include ones with a non-empty name; skip OData metadata keys)
    const categories = Object.entries(categoryDescriptions)
      .filter(([key, name]) => key.startsWith('category') && name && name.trim())
      .map(([key, name]) => ({ key, name: name.trim() }));

    console.log(`[graph] Named categories:`, categories);

    // Shape tasks
    const tasks = filteredTasks.map(task => {
      const det = allTaskDetailsMap[task.id] || { checklist: {}, detailsEtag: '*' };
      const checklist = Object.entries(det.checklist || {}).map(([id, item]) => ({
        id,
        title:     item.title || '',
        isChecked: item.isChecked || false,
        orderHint: item.orderHint || '',
      })).sort((a, b) => a.orderHint < b.orderHint ? -1 : 1);

      return {
        id:              task.id,
        etag:            task['@odata.etag'] || '*',
        detailsEtag:     det.detailsEtag,
        title:           task.title || '(Untitled)',
        percentComplete: task.percentComplete || 0,
        dueDate:         task.dueDateTime || null,
        createdDateTime: task.createdDateTime || null,
        bucketId:        task.bucketId,
        planId:          task.planId,
        assignees:       Object.keys(task.assignments || {}).map(id => userMap[id] || id),
        orderHint:       task.orderHint || '',
        appliedCategories: Object.keys(task.appliedCategories || {}),
        checklist,
      };
    });

    return {
      plans:      activePlans.map(p => ({ id: p.id, title: p.title || 'Unnamed Plan' })),
      buckets:    allBuckets.map(b => ({ id: b.id, name: b.name || 'Unnamed', planId: b.planId, orderHint: b.orderHint || '' })),
      categories,
      tasks,
      syncedAt:   new Date().toISOString(),
    };
  } catch (err) {
    console.error('[graph] syncPlanner failed:', err.message);
    return { plans: [], buckets: [], tasks: [], categories: [], syncedAt: new Date().toISOString(), error: err.message };
  }
}

// ── Full team planner — all plans, all assignees ──────────────────────────────

async function syncFullPlanner(token) {
  try {
    const plans = await getPlans(token);
    console.log(`[graph/full] Found ${plans.length} plan(s):`, plans.map(p => p.title));

    if (plans.length === 0) {
      return { plans: [], buckets: [], tasks: [], categories: [], syncedAt: new Date().toISOString() };
    }

    const detailResults = await Promise.allSettled(
      plans.map(p => getPlanDetails(p.id, token).then(d => ({ planId: p.id, planTitle: p.title, ...d })))
    );

    const allBuckets        = [];
    const allRawTasks       = [];
    const allTaskDetailsMap = {};
    let   categoryDescriptions = {};

    for (const r of detailResults) {
      if (r.status !== 'fulfilled') continue;
      allBuckets.push(...r.value.buckets);
      allRawTasks.push(...r.value.tasks);
      Object.assign(allTaskDetailsMap, r.value.taskDetailsMap);
      Object.assign(categoryDescriptions, r.value.categoryDescriptions);
    }

    // Resolve ALL assignee IDs (no filter by name)
    const userIds = allRawTasks.flatMap(t => Object.keys(t.assignments || {}));
    const userMap = await resolveUserIds(userIds, token);
    console.log(`[graph/full] ${allRawTasks.length} tasks, ${Object.keys(userMap).length} unique members`);

    const categories = Object.entries(categoryDescriptions)
      .filter(([key, name]) => key.startsWith('category') && name && name.trim())
      .map(([key, name]) => ({ key, name: name.trim() }));

    const tasks = allRawTasks.map(task => {
      const det = allTaskDetailsMap[task.id] || { checklist: {}, detailsEtag: '*' };
      const checklist = Object.entries(det.checklist || {}).map(([id, item]) => ({
        id,
        title:     item.title || '',
        isChecked: item.isChecked || false,
        orderHint: item.orderHint || '',
      })).sort((a, b) => a.orderHint < b.orderHint ? -1 : 1);

      return {
        id:                task.id,
        etag:              task['@odata.etag'] || '*',
        detailsEtag:       det.detailsEtag,
        title:             task.title || '(Untitled)',
        percentComplete:   task.percentComplete || 0,
        dueDate:           task.dueDateTime || null,
        createdDateTime:   task.createdDateTime || null,
        bucketId:          task.bucketId,
        planId:            task.planId,
        assignees:         Object.keys(task.assignments || {}).map(id => userMap[id] || id),
        orderHint:         task.orderHint || '',
        appliedCategories: Object.keys(task.appliedCategories || {}),
        checklist,
      };
    });

    return {
      plans:     plans.map(p => ({ id: p.id, title: p.title || 'Unnamed Plan' })),
      buckets:   allBuckets.map(b => ({ id: b.id, name: b.name || 'Unnamed', planId: b.planId, orderHint: b.orderHint || '' })),
      categories,
      tasks,
      // Collect every unique assignee name for the person filter chips
      members:   [...new Set(tasks.flatMap(t => t.assignees))].filter(Boolean).sort(),
      syncedAt:  new Date().toISOString(),
    };
  } catch (err) {
    console.error('[graph] syncFullPlanner failed:', err.message);
    return { plans: [], buckets: [], tasks: [], categories: [], members: [], syncedAt: new Date().toISOString(), error: err.message };
  }
}

// ── Planner mutations ─────────────────────────────────────────────────────────

async function updateTaskCompletion(taskId, percentComplete, token) {
  const fresh = await gGet(`/planner/tasks/${taskId}`, token);
  const etag  = fresh['@odata.etag'] || '*';
  return gPatch(`/planner/tasks/${taskId}`, token, { percentComplete }, etag);
}

async function updateChecklistItem(taskId, checklistItemId, isChecked, token) {
  // Need fresh task-details ETag
  const det     = await gGet(`/planner/tasks/${taskId}/details`, token);
  const detEtag = det['@odata.etag'] || '*';
  const body = {
    checklist: {
      [checklistItemId]: {
        '@odata.type': '#microsoft.graph.plannerChecklistItem',
        isChecked,
      },
    },
  };
  return gPatch(`/planner/tasks/${taskId}/details`, token, body, detEtag);
}

async function createTask(planId, bucketId, title, assigneeIds, categoryKeys, token) {
  const assignments = {};
  for (const uid of (assigneeIds || [])) {
    assignments[uid] = { '@odata.type': '#microsoft.graph.plannerAssignment', orderHint: ' !' };
  }
  const appliedCategories = {};
  for (const key of (categoryKeys || [])) appliedCategories[key] = true;

  return gPost('/planner/tasks', token, { planId, bucketId, title, assignments, appliedCategories });
}

// ── OneDrive ──────────────────────────────────────────────────────────────────

async function syncOneDrive(token) {
  try {
    const drive      = await gGet('/me/drive?$select=quota,owner', token);
    const quota      = drive.quota || {};
    const rootItems  = await getAllPages('/me/drive/root/children?$select=name,size,folder,file&$top=100', token);

    const topFolders = rootItems
      .filter(i => i.folder)
      .map(i => ({ name: i.name, size: i.size || 0, childCount: i.folder.childCount || 0 }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    return {
      total:      quota.total     || 0,
      used:       quota.used      || 0,
      remaining:  quota.remaining || 0,
      topFolders,
      syncedAt:   new Date().toISOString(),
    };
  } catch (err) {
    console.error('[graph] syncOneDrive failed:', err.message);
    return { total: 0, used: 0, remaining: 0, topFolders: [], syncedAt: new Date().toISOString(), error: err.message };
  }
}

/** Extended OneDrive analytics — called when user opens the OneDrive modal */
async function getOneDriveDetails(token) {
  try {
    const [driveRes, rootRes, recentRes] = await Promise.allSettled([
      gGet('/me/drive?$select=quota,owner', token),
      getAllPages('/me/drive/root/children?$select=name,size,folder,file,lastModifiedDateTime&$top=100', token),
      getAllPages('/me/drive/recent?$select=name,size,file,lastModifiedDateTime,parentReference&$top=20', token),
    ]);

    const drive     = driveRes.status     === 'fulfilled' ? driveRes.value     : {};
    const rootItems = rootRes.status      === 'fulfilled' ? rootRes.value      : [];
    const recent    = recentRes.status    === 'fulfilled' ? recentRes.value    : [];

    const quota = drive.quota || {};

    // Folder breakdown
    const folders = rootItems
      .filter(i => i.folder)
      .map(i => ({ name: i.name, size: i.size || 0, childCount: (i.folder || {}).childCount || 0, lastModified: i.lastModifiedDateTime }))
      .sort((a, b) => b.size - a.size);

    // File type breakdown from root-level files
    const files = rootItems.filter(i => i.file);
    const typeBuckets = {};
    for (const f of files) {
      const mime = (f.file || {}).mimeType || 'other';
      const ext  = (f.name || '').split('.').pop()?.toLowerCase() || 'other';
      const cat  = mime.startsWith('image/') ? 'Images'
                 : mime.startsWith('video/') ? 'Videos'
                 : mime.includes('pdf')       ? 'PDFs'
                 : mime.includes('word') || ext === 'docx' ? 'Documents'
                 : mime.includes('sheet') || ext === 'xlsx' ? 'Spreadsheets'
                 : mime.includes('presentation') || ext === 'pptx' ? 'Presentations'
                 : 'Other';
      typeBuckets[cat] = (typeBuckets[cat] || 0) + (f.size || 0);
    }

    const fileTypes = Object.entries(typeBuckets)
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size);

    // Recent files (last 10 meaningful ones)
    const recentFiles = recent
      .filter(f => f.file)
      .slice(0, 10)
      .map(f => ({
        name:         f.name,
        size:         f.size || 0,
        lastModified: f.lastModifiedDateTime,
        folder:       (f.parentReference || {}).name || 'OneDrive',
      }));

    return {
      total:      quota.total     || 0,
      used:       quota.used      || 0,
      remaining:  quota.remaining || 0,
      deleted:    quota.deleted   || 0,
      folders,
      fileTypes,
      recentFiles,
      syncedAt:   new Date().toISOString(),
    };
  } catch (err) {
    console.error('[graph] getOneDriveDetails failed:', err.message);
    return { total: 0, used: 0, remaining: 0, deleted: 0, folders: [], fileTypes: [], recentFiles: [], syncedAt: new Date().toISOString(), error: err.message };
  }
}

module.exports = {
  syncPlanner,
  syncFullPlanner,
  updateTaskCompletion,
  updateChecklistItem,
  createTask,
  syncOneDrive,
  getOneDriveDetails,
};
