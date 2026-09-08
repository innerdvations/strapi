/**
 * Test for issue: Settings > Roles crashes for update-without-create permission
 * https://github.com/strapi/strapi/issues/27536
 *
 * This test verifies that the Roles list page correctly handles different
 * permission combinations, specifically when a user has update permission
 * but not create permission.
 */

import { render, screen, waitFor } from '@tests/utils';

import { useRBAC } from '../../../../../hooks/useRBAC';
import { ListPage } from '../ListPage';

// Mock the useAdminRoles hook to return test data
jest.mock('../../../../../hooks/useAdminRoles', () => ({
  useAdminRoles: jest.fn(() => ({
    roles: [
      {
        code: 'test-role',
        created_at: '2021-08-24T14:37:20.384Z',
        description: 'Test role description',
        id: 1,
        name: 'Test Role',
        updatedAt: '2021-08-24T14:37:20.384Z',
        usersCount: 0,
      },
    ],
    isLoading: false,
    refetch: jest.fn(),
  })),
}));

// Mock useRBAC hook to control permissions
jest.mock('../../../../../hooks/useRBAC');

describe('<ListPage /> - Permission Combinations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render without crashing when user has update but not create permission', async () => {
    // Setup: User has read and update but NOT create permission
    (useRBAC as jest.Mock).mockReturnValue({
      isLoading: false,
      allowedActions: {
        canCreate: false, // No create permission
        canRead: true,
        canUpdate: true, // Has update permission
        canDelete: false,
      },
    });

    // This should not throw an error
    render(<ListPage />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Test Role')).toBeInTheDocument();
    });

    // Verify the table row is rendered
    expect(screen.getByText('Test Role').closest('tr')).toBeInTheDocument();
  });

  it('should handle clicking on a role row when user has update but not create permission', async () => {
    const mockNavigate = jest.fn();

    // Mock useNavigate
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
    }));

    // Setup: User has read and update but NOT create permission
    (useRBAC as jest.Mock).mockReturnValue({
      isLoading: false,
      allowedActions: {
        canCreate: false, // No create permission
        canRead: true,
        canUpdate: true, // Has update permission
        canDelete: false,
      },
    });

    render(<ListPage />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Test Role')).toBeInTheDocument();
    });

    // Find the table row
    const row = screen.getByText('Test Role').closest('tr');
    expect(row).toBeInTheDocument();

    // This is where the bug would occur - clicking the row should not throw
    // "Cannot read properties of undefined (reading 'onClick')"
    if (row) {
      // The row should be clickable without errors
      expect(() => {
        row.click();
      }).not.toThrow();
    }
  });

  it('should only show edit icon when user has update but not create or delete permission', async () => {
    // Setup: User has ONLY read and update permissions
    (useRBAC as jest.Mock).mockReturnValue({
      isLoading: false,
      allowedActions: {
        canCreate: false, // No create permission
        canRead: true,
        canUpdate: true, // Has update permission
        canDelete: false, // No delete permission
      },
    });

    render(<ListPage />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Test Role')).toBeInTheDocument();
    });

    // Should show edit button (Pencil icon)
    const editButton = screen.getByRole('button', { name: /edit/i });
    expect(editButton).toBeInTheDocument();

    // Should NOT show duplicate button
    expect(screen.queryByRole('button', { name: /duplicate/i })).not.toBeInTheDocument();

    // Should NOT show delete button
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('should show both duplicate and edit icons when user has create and update permissions', async () => {
    // Setup: User has create, read, and update permissions
    (useRBAC as jest.Mock).mockReturnValue({
      isLoading: false,
      allowedActions: {
        canCreate: true, // Has create permission
        canRead: true,
        canUpdate: true, // Has update permission
        canDelete: false,
      },
    });

    render(<ListPage />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Test Role')).toBeInTheDocument();
    });

    // Should show duplicate button
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();

    // Should show edit button
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();

    // Should NOT show delete button
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('should show all action icons when user has all permissions', async () => {
    // Setup: User has all permissions
    (useRBAC as jest.Mock).mockReturnValue({
      isLoading: false,
      allowedActions: {
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      },
    });

    render(<ListPage />);

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Test Role')).toBeInTheDocument();
    });

    // Should show duplicate button
    expect(screen.getByRole('button', { name: /duplicate/i })).toBeInTheDocument();

    // Should show edit button
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();

    // Should show delete button
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});
