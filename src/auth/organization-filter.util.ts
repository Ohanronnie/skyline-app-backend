import { Organization } from '../user/users.schema';

/**
 * Builds an organization filter that bypasses filtering for SKYLINE organization
 * (super admin). For SKYLINE, returns empty object to allow access to all organizations.
 * For other organizations, returns the standard organization filter.
 *
 * @param organization - The organization to filter by
 * @returns Filter object with organization field (or empty for SKYLINE)
 */
export function buildOrganizationFilter(
  organization: Organization,
): Record<string, Organization> | Record<string, never> {
  if (organization === Organization.SKYLINE) {
    return {}; // Empty filter = return all organizations
  }
  return { organization };
}

/**
 * Checks if the organization is SKYLINE (super admin)
 *
 * @param organization - The organization to check
 * @returns true if organization is SKYLINE, false otherwise
 */
export function isSuperAdmin(organization: Organization): boolean {
  return organization === Organization.SKYLINE;
}
