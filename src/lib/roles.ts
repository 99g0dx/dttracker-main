export type WorkspaceRole =
  | "brand_owner"
  | "brand_member"
  | "agency_admin"
  | "agency_ops";

export function normalizeWorkspaceRole(
  role: WorkspaceRole | null | undefined
): WorkspaceRole | null {
  return role ?? null;
}

export function isWorkspaceOwner(role: WorkspaceRole | null | undefined): boolean {
  return role === "brand_owner";
}

export function isWorkspaceAdmin(role: WorkspaceRole | null | undefined): boolean {
  return role === "brand_owner" || role === "agency_admin";
}

export function canEditWorkspaceRole(role: WorkspaceRole | null | undefined): boolean {
  return role === "brand_owner" || role === "agency_admin" || role === "brand_member";
}

export function canViewWorkspaceRole(role: WorkspaceRole | null | undefined): boolean {
  return role !== null && role !== undefined;
}

export function workspaceRoleLabel(role: WorkspaceRole | null | undefined): string {
  switch (role) {
    case "brand_owner":
      return "Owner";
    case "agency_admin":
      return "Admin";
    case "brand_member":
      return "Editor";
    case "agency_ops":
      return "Viewer";
    default:
      return "Viewer";
  }
}
