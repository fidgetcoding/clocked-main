import { useState } from 'react';
import { ArrowLeft, UserPlus, Trash2, Shield, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  name: string;
  handle: string | null;
  role: string;
  experience_level: string | null;
  total_xp: number;
  workouts_completed: number;
  current_streak: number;
}

const AdminPortal = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('admin-users', {
        method: 'GET',
      });

      if (response.error) throw new Error(response.error.message);
      return response.data.users as AdminUser[];
    },
    enabled: isAdmin,
  });

  const addUser = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('admin-users', {
        method: 'POST',
        body: { email: newEmail, password: newPassword, name: newName || 'Fighter' },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setShowAddForm(false);
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      toast.success('User created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create user: ' + error.message);
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke(`admin-users?userId=${userId}`, {
        method: 'DELETE',
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setUserToDelete(null);
      toast.success('User deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete user: ' + error.message);
    },
  });

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-bold text-lg">Access Denied</p>
            <p className="text-muted-foreground text-sm mt-1">Admin privileges required</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 pt-8 pb-6 safe-top">
          <button onClick={() => navigate('/settings')} className="text-muted-foreground">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-black text-foreground tracking-wider flex-1">
            ADMIN
          </h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-volt text-background text-sm font-bold"
          >
            <UserPlus className="w-4 h-4" />
            Add
          </button>
        </header>

        <div className="px-4 space-y-4 pb-24">
          {/* Add User Form */}
          {showAddForm && (
            <div className="card-workout space-y-3">
              <h3 className="text-sm font-bold text-foreground">Create New User</h3>
              <Input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-surface-2 border-surface-3"
              />
              <Input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-surface-2 border-surface-3"
              />
              <Input
                type="password"
                placeholder="Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-surface-2 border-surface-3"
              />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => addUser.mutate()}
                  disabled={!newEmail || !newPassword || addUser.isPending}
                  className="flex-1 bg-volt text-background hover:bg-volt/90 font-bold"
                >
                  {addUser.isPending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          )}

          {/* User Count */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">{users.length} users</span>
          </div>

          {/* User List */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">Loading users...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Administrators */}
              {users.filter(u => u.role === 'admin').length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-volt">
                    <Shield className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">Administrators</span>
                  </div>
                  {users.filter(u => u.role === 'admin').map((user) => (
                    <div key={user.id} className="card-workout flex items-center gap-3 border border-volt/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-bold text-sm truncate">
                          {user.name}
                          {user.handle && (
                            <span className="text-muted-foreground font-normal ml-1">@{user.handle}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] text-volt uppercase font-bold">ADMIN</span>
                          <span className="text-[10px] text-muted-foreground">{user.total_xp} XP</span>
                          <span className="text-[10px] text-muted-foreground">{user.workouts_completed} sessions</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Regular Users */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Users</span>
                  <span className="text-xs text-muted-foreground">({users.filter(u => u.role !== 'admin').length})</span>
                </div>
                {users.filter(u => u.role !== 'admin').map((user) => (
                  <div key={user.id} className="card-workout flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-bold text-sm truncate">
                        {user.name}
                        {user.handle && (
                          <span className="text-muted-foreground font-normal ml-1">@{user.handle}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground uppercase">{user.role}</span>
                        <span className="text-[10px] text-muted-foreground">{user.total_xp} XP</span>
                        <span className="text-[10px] text-muted-foreground">{user.workouts_completed} sessions</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setUserToDelete(user)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent className="bg-surface-1 border-surface-3">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete User?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete <strong>{userToDelete?.name}</strong> ({userToDelete?.email}) and all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-surface-2 border-surface-3 text-foreground">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUser.mutate(userToDelete.id)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminPortal;
