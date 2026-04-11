import { loadTasksForView } from "@/lib/tasks-loader";
import TasksShell from "@/components/tasks/tasks-shell";

export default async function TasksListPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>;
}) {
  const params = await searchParams;
  const data = await loadTasksForView({ selectedTaskId: params.task });

  return (
    <TasksShell
      view="list"
      buckets={data.buckets}
      users={data.users}
      events={data.events}
      selectedTask={data.selectedTask}
    />
  );
}
