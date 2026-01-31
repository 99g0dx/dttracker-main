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
  return role === "brand_owner";
}

export function canEditWorkspaceRole(role: WorkspaceRole | null | undefined): boolean {
  return role === "brand_owner";
}

export function canViewWorkspaceRole(role: WorkspaceRole | null | undefined): boolean {
  return role !== null && role !== undefined;
}

export function workspaceRoleLabel(role: WorkspaceRole | null | undefined): string {
  switch (role) {
    case "brand_owner":
      return "Owner";
    case "agency_admin":
    case "brand_member":
    case "agency_ops":
      return "Operator";
    default:
      return "Operator";
  }
}
