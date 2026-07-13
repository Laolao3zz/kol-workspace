export type PostPersistWorkflowResult =
  | { completed: true }
  | { completed: false; error: unknown }

export async function runPostPersistWorkflow(
  tasks: Array<() => Promise<unknown>>,
  recoveryRefreshes: Array<() => Promise<unknown>>
): Promise<PostPersistWorkflowResult> {
  try {
    for (const task of tasks) {
      await task()
    }
    return { completed: true }
  } catch (error) {
    await Promise.allSettled(recoveryRefreshes.map(refresh => refresh()))
    return { completed: false, error }
  }
}
