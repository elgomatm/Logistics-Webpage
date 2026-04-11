import type { Task, EventStatus } from "./db/schema";

export interface TaskUserRef {
  id: string;
  name: string;
  avatarColor: string | null;
}

export interface TaskEventRef {
  id: string;
  name: string;
  slug: string;
  status: EventStatus;
}

export interface ChecklistItemCompact {
  id: string;
  label: string;
  isDone: boolean;
}

export interface BucketWithTasksHydrated {
  id: string;
  name: string;
  color: string;
  position: number;
  tasks: HydratedTask[];
}

export interface HydratedTask {
  task: Task;
  assignees: TaskUserRef[];
  reviewer: TaskUserRef | null;
  checklistDone: number;
  checklistTotal: number;
  checklistItems: ChecklistItemCompact[];
  event: TaskEventRef;
}

export interface TaskChecklistItemRef {
  id: string;
  label: string;
  isDone: boolean;
  position: number;
  doneByUserId: string | null;
  doneAt: Date | null;
}

export interface HydratedTaskDetail extends HydratedTask {
  checklist: TaskChecklistItemRef[];
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  estimatedSeconds: number | null;
  totalSecondsLogged: number;
}

export interface EventOption {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
}
