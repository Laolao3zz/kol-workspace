export interface ProgressSubmitInput {
  progress_status: string
  progress_notes: string
  completed_at: string | null
}

const todayISO = () => new Date().toISOString().slice(0, 10)

export function buildProgressSubmitPayload(
  form: ProgressSubmitInput,
  today = todayISO()
): ProgressSubmitInput {
  const completed = form.progress_status === '已完成' || Boolean(form.completed_at)
  return {
    progress_status: completed ? '已完成' : form.progress_status || '待制作',
    progress_notes: form.progress_notes.trim(),
    completed_at: completed ? (form.completed_at || today) : null,
  }
}
