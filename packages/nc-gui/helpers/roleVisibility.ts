import {
  OrderedProjectRoles,
  OrderedWorkspaceRoles,
  ProjectRoles,
  WorkspaceUserRoles,
} from 'nocodb-sdk'

// FanJam-specific: Owner is reserved for the system user and Creator is never
// assigned. Both are hidden from every role-picker and the system Owner is
// hidden from the Members list. Backend/SDK still exposes them.
const HIDDEN_PROJECT_ROLES = new Set<string>([ProjectRoles.OWNER, ProjectRoles.CREATOR])
const HIDDEN_WORKSPACE_ROLES = new Set<string>([WorkspaceUserRoles.OWNER, WorkspaceUserRoles.CREATOR])

export const VISIBLE_PROJECT_ROLES = OrderedProjectRoles.filter((r) => !HIDDEN_PROJECT_ROLES.has(r))
export const VISIBLE_WORKSPACE_ROLES = OrderedWorkspaceRoles.filter((r) => !HIDDEN_WORKSPACE_ROLES.has(r))

export function isVisibleProjectRole(role: string | null | undefined): boolean {
  return !!role && !HIDDEN_PROJECT_ROLES.has(role)
}

export function isVisibleWorkspaceRole(role: string | null | undefined): boolean {
  return !!role && !HIDDEN_WORKSPACE_ROLES.has(role)
}

export function isHiddenSystemRole(role: string | null | undefined): boolean {
  return role === ProjectRoles.OWNER || role === WorkspaceUserRoles.OWNER
}
