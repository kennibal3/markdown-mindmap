export const WORKSPACE_STORAGE_KEY = 'markdown-mindmap:workspace:v1'

export type WorkspaceDraft = {
  fileName: string
  markdown: string
}

type StoredWorkspaceDraft = WorkspaceDraft & {
  version: 1
}

function removeInvalidDraft() {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY)
  } catch {
    // 存储整体不可用时保持静默，应用仍可使用默认内容。
  }
}

export function loadWorkspaceDraft(): WorkspaceDraft | null {
  try {
    const rawDraft = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!rawDraft) return null

    const draft = JSON.parse(rawDraft) as Partial<StoredWorkspaceDraft>
    if (
      draft.version !== 1 ||
      typeof draft.fileName !== 'string' ||
      typeof draft.markdown !== 'string'
    ) {
      removeInvalidDraft()
      return null
    }

    return { fileName: draft.fileName, markdown: draft.markdown }
  } catch {
    removeInvalidDraft()
    return null
  }
}

export function saveWorkspaceDraft(draft: WorkspaceDraft) {
  try {
    const storedDraft: StoredWorkspaceDraft = { ...draft, version: 1 }
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify(storedDraft),
    )
    return true
  } catch {
    return false
  }
}
