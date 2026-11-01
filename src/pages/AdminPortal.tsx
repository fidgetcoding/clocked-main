import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { BroadcastPage, EmptyPlate, FitText, SectionChyron } from '@/components/broadcast';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { getRankingFromLevel, Prestige, PRESTIGE_NAMES, RANKING_NAMES } from '@/lib/xpSystem';
import { functionErrorMessage } from '@/lib/functionError';
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
  profile_role: string;
  experience_level: string | null;
  prestige: string | null;
  current_level: number | null;
  equipment: Record<string, boolean | string> | null;
  goals: string[];
  total_xp: number;
  workouts_completed: number;
  current_streak: number;
}

const equipmentLabels: Record<string, string> = {
  gloves: 'Gloves',
  wraps: 'Wraps',
  heavyBag: 'Heavy Bag',
  doubleEndBag: 'Double-End Bag',
  speedBag: 'Speed Bag',
  jumpRope: 'Jump Rope',
  treadmill: 'Treadmill',
};

const goalLabels: Record<string, string> = {
  learn_boxing: 'Learn Boxing',
  get_fit: 'Get Fit',
  competition: 'Competition',
  home_workout: 'Home Workout',
  supplement_training: 'Supplement Training',
};

const AdminPortal = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const queryClient = useQueryClient();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading, error: usersError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('admin-users', {
        method: 'GET',
      });

      if (response.error) throw new Error(await functionErrorMessage(response.error));
      return response.data.users as AdminUser[];
    },
    enabled: isAdmin,
  });


  const renderOnboardingDetails = (user: AdminUser) => {
    const selectedEquipment = user.equipment
      ? Object.entries(user.equipment).filter(([key, val]) => val === true && key !== 'primaryBag').map(([key]) => equipmentLabels[key] || key)
      : [];
    const primaryBag = user.equipment?.primaryBag as string | undefined;
    const userGoals = (user.goals || []).map(g => goalLabels[g] || g);

    // Only show primary bag star when user has BOTH bag types
    const hasBothBags = user.equipment?.heavyBag === true && user.equipment?.doubleEndBag === true;
    const showPrimaryStar = hasBothBags && primaryBag && primaryBag !== 'none';

    return (
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-surface-2 pt-1.5">
        {user.prestige && (
          <span className="lab lab-lime">
            {PRESTIGE_NAMES[user.prestige as Prestige]}, {RANKING_NAMES[getRankingFromLevel(user.current_level || 1)]}, Lvl {user.current_level || 1}
          </span>
        )}
        {selectedEquipment.map(eq => (
          <span key={eq} className="lab">{eq}</span>
        ))}
        {selectedEquipment.length > 0 && showPrimaryStar && (
          <span className="lab lab-w">Primary: {primaryBag === 'heavy' ? 'Heavy Bag' : 'Double-End Bag'}</span>
        )}
        {!user.prestige && !user.experience_level && selectedEquipment.length === 0 && (
          <span className="lab">No onboarding data</span>
        )}
      </div>
    );
  };

  // One row on the credits. The whole row opens the profile; the name is its keyboard stop.
  const renderUserRow = (user: AdminUser, canDelete: boolean) => (
    <div
      key={user.id}
      onClick={() => navigate(`/profile/${user.id}`)}
      className="card-workout cursor-pointer border-b border-surface-2 bg-transparent p-0 px-4 py-2 transition-colors hover:bg-surface-1"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <button type="button" className="block min-h-11 w-full text-left">
            <span className="fx block break-words text-3xl">{user.name}</span>
          </button>
          {user.handle && <p className="lab truncate normal-case tracking-normal">@{user.handle}</p>}
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="fx text-2xl">{user.total_xp} XP</p>
          <p className="lab mt-0.5">{user.workouts_completed} sessions</p>
          <p className="lab mt-0.5">{user.profile_role || 'fighter'}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            aria-label={`Delete ${user.name}`}
            onClick={(e) => { e.stopPropagation(); setUserToDelete(user); }}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {renderOnboardingDetails(user)}
    </div>
  );

  const addUser = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('admin-users', {
        method: 'POST',
        body: { email: newEmail, password: newPassword, name: newName || 'Fighter' },
      });

      if (response.error) throw new Error(await functionErrorMessage(response.error));
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

      if (response.error) throw new Error(await functionErrorMessage(response.error));
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
        <BroadcastPage>
          <p className="lab px-4 py-8">Loading...</p>
        </BroadcastPage>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <BroadcastPage>
          <EmptyPlate title="Access Denied" body="Admin privileges required" />
        </BroadcastPage>
      </AppLayout>
    );
  }

  const admins = users.filter(u => u.role === 'admin');
  const regulars = users.filter(u => u.role !== 'admin');

  return (
    <AppLayout>
      <BroadcastPage show="Crew" onBack={() => navigate('/settings')}>
        <div className="px-4 pt-3" role="heading" aria-level={1}>
          <FitText className="fx h-14" max={72}>ADMIN PANEL</FitText>
        </div>

        <button
          type="button"
          aria-expanded={showAddForm}
          onClick={() => setShowAddForm(!showAddForm)}
          className="plate plate-lime plate-bleed-l fx mt-2 h-11 pl-4 pr-6 text-2xl"
        >
          Add
        </button>

        {showAddForm && (
          <section className="mt-3 bg-surface-1 px-4 py-3">
            <h2 className="fx text-2xl">Create New User</h2>
            <div className="mt-1 grid gap-x-4 gap-y-2 sm:grid-cols-3">
              <Input placeholder="Name" aria-label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input type="email" placeholder="Email" aria-label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <Input type="password" placeholder="Password" aria-label="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="mt-3 flex gap-4 px-1">
              <Button variant="secondary" size="sm" onClick={() => setShowAddForm(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => addUser.mutate()}
                disabled={!newEmail || !newPassword || addUser.isPending}
                className="flex-1"
              >
                {addUser.isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </section>
        )}

        {isLoading ? (
          <p className="lab px-4 py-8">Loading users...</p>
        ) : usersError ? (
          <p role="alert" className="prose-w px-4 py-8 text-lg text-destructive">Couldn't load users: {usersError.message}</p>
        ) : (
          <div className="pb-6">
            {admins.length > 0 && (
              <section className="pt-4">
                <SectionChyron>
                  Administrators ({admins.length})
                </SectionChyron>
                <div className="mt-1">{admins.map((user) => renderUserRow(user, false))}</div>
              </section>
            )}
            <section className="pt-4">
              <SectionChyron tone="graphite">
                Users ({regulars.length})
              </SectionChyron>
              <div className="mt-1">{regulars.map((user) => renderUserRow(user, true))}</div>
            </section>
          </div>
        )}
      </BroadcastPage>

      {/* Delete Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{userToDelete?.name}</strong> ({userToDelete?.email}) and all their data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUser.mutate(userToDelete.id)}
              className={buttonVariants({ variant: 'destructive' })}
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
