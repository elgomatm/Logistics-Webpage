/**
 * Global type augmentation for window.electronAPI
 * (exposed via Electron contextBridge in electron/preload.js)
 */

interface ElectronUser {
  name:  string
  email: string
  id:    string
}

interface AuthResult {
  loggedIn: boolean
  user?:    ElectronUser
  error?:   string
}

interface PartnerPayload {
  name:          string
  logo_path:     string | null
  include_guests: boolean
}

interface GeneratePayload {
  eventBase:    object
  partners:     PartnerPayload[]
  templatePath: string
  coverPath:    string | null
  titlePngPath: string | null
  outputPath:   string
}

interface ProgressMessage {
  partner?:    string
  pct?:        number
  step?:       string
  overall?:    number
  done?:       boolean
  outputPath?: string
  error?:      string
}

// ── Planner types ─────────────────────────────────────────────────────────────

interface ChecklistItem {
  id:        string
  title:     string
  isChecked: boolean
  orderHint: string
}

interface PlannerCategory {
  key:  string   // 'category1', 'category2', etc.
  name: string   // 'Texas Grand Tour', etc.
}

interface PlannerTask {
  id:                string
  etag:              string
  detailsEtag:       string
  title:             string
  percentComplete:   number   // 0 | 50 | 100
  dueDate:           string | null
  createdDateTime:   string | null
  bucketId:          string
  planId:            string
  assignees:         string[]
  orderHint:         string
  appliedCategories: string[]  // category keys e.g. ['category1', 'category3']
  checklist:         ChecklistItem[]
}

interface PlannerBucket {
  id:        string
  name:      string
  planId:    string
  orderHint: string
}

interface PlannerPlan {
  id:    string
  title: string
}

interface PlannerSyncResult {
  plans:      PlannerPlan[]
  buckets:    PlannerBucket[]
  categories: PlannerCategory[]
  tasks:      PlannerTask[]
  syncedAt:   string | null
  error?:     string
}

interface FullPlannerSyncResult extends PlannerSyncResult {
  members: string[]   // all unique assignee display names
}

// ── OneDrive types ────────────────────────────────────────────────────────────

interface OneDriveFolder {
  name:         string
  size:         number
  childCount?:  number
  lastModified?: string
}

interface OneDriveSyncResult {
  total:      number
  used:       number
  remaining:  number
  topFolders: OneDriveFolder[]
  syncedAt:   string | null
  error?:     string
}

interface OneDriveFileType {
  name: string
  size: number
}

interface OneDriveRecentFile {
  name:         string
  size:         number
  lastModified: string
  folder:       string
}

interface OneDriveDetails {
  total:       number
  used:        number
  remaining:   number
  deleted:     number
  folders:     OneDriveFolder[]
  fileTypes:   OneDriveFileType[]
  recentFiles: OneDriveRecentFile[]
  syncedAt:    string | null
  error?:      string
}

declare global {
  interface Window {
    electronAPI: {
      // File dialogs
      openFile:           (opts: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => Promise<{ filePaths: string[]; canceled: boolean }>
      saveFile:           (opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] })  => Promise<{ filePath: string; canceled: boolean }>

      // File path resolution
      getPathForFile:     (file: File) => string

      // Report generation
      startGenerate:      (payload: GeneratePayload) => Promise<{ success: boolean; outputPath: string }>
      onProgress:         (cb: (msg: ProgressMessage) => void) => void
      removeAllListeners: (channel: string) => void

      // Authentication
      getAuthStatus:      () => Promise<AuthResult>
      login:              () => Promise<AuthResult>
      logout:             () => Promise<AuthResult>
      onAuthChanged:      (cb: (result: AuthResult) => void) => void

      // Planner
      plannerSync:             () => Promise<PlannerSyncResult>
      plannerGetCache:         () => Promise<PlannerSyncResult>
      plannerUpdateTask:       (args: { taskId: string; percentComplete: number }) => Promise<{ success: boolean; error?: string }>
      plannerAddTask:          (args: { planId: string; bucketId: string; title: string; assigneeIds?: string[]; categoryKeys?: string[] }) => Promise<{ success: boolean; task?: object; error?: string }>
      plannerUpdateChecklist:  (args: { taskId: string; checklistItemId: string; isChecked: boolean }) => Promise<{ success: boolean; error?: string }>
      plannerSyncFull:         () => Promise<FullPlannerSyncResult>
      plannerGetCacheFull:     () => Promise<FullPlannerSyncResult>

      // OneDrive
      onedriveSync:        () => Promise<OneDriveSyncResult>
      onedriveGetCache:    () => Promise<OneDriveSyncResult>
      onedriveGetDetails:  () => Promise<OneDriveDetails>
      onSyncUpdated:       (cb: (data: { planner: PlannerSyncResult; onedrive: OneDriveSyncResult }) => void) => void
    }
  }
}

export {}
