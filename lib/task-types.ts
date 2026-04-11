import type { TaskProgress, TaskPriority } from "./db/schema";

export interface TaskInput {
  eventId: string;
  name: string;
  description: string | null;
  bucketId: string;
  progress: TaskProgress;
  priority: TaskPriority;
  reviewerId: string | null;
  plannedStartDate: string | null;
  dueDate: string | null;
  estimatedSeconds: number | null;
  assigneeIds: string[];
}
