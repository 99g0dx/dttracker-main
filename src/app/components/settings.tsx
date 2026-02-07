import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Switch } from './ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from './ui/select';
import { User, Lock, Users, Mail, Crown, ArrowRight, Bell, CreditCard, ArrowLeft, Palette } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { createTeamInvite } from '../../lib/api/team';
import { useBillingSummary } from '../../hooks/useBilling';
import { formatPrice } from '../../lib/api/billing';
import { toast } from 'sonner';

interface SettingsProps {
  onNavigate: (path: string) => void;
}

interface ProfileFormState {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
}

interface NotificationSettings {
  campaignUpdates: boolean;
  performanceAlerts: boolean;
  teamMentions: boolean;
  weeklyReports: boolean;
}

interface TeamMemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  isCurrentUser: boolean;
}

const defaultNotifications: NotificationSettings = {
  campaignUpdates: true,
  performanceAlerts: true,
  teamMentions: true,
  weeklyReports: false,
};

const defaultLimits: Record<string, { campaigns: number | null; creators: number | null; analytics: string }> = {
  free: { campaigns: 1, creators: 10, analytics: 'Basic' },
  starter: { campaigns: 3, creators: 25, analytics: 'Standard' },
  pro: { campaigns: 10, creators: 100, analytics: 'Advanced' },
  agency: { campaigns: null, creators: null, analytics: 'Enterprise' },
};

const splitFullName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
};

const getInitial = (name: string, email: string) => {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return 'U';
};

const formatLabel = (value: string) =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

export function Settings({ onNavigate }: SettingsProps) {
  const { user, loading: authLoading } = useAuth();
  const { activeWorkspaceId } = useWorkspace();
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState<string | null>(null);
  const [workspaceMetaLoading, setWorkspaceMetaLoading] = useState(false);
  const { data: billing, isLoading: billingLoading } = useBillingSummary();
  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [supportsCompany, setSupportsCompany] = useState(false);

  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(defaultNotifications);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [inviteSending, setInviteSending] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<any[]>([]);
  const [mfaEnrollOpen, setMfaEnrollOpen] = useState(false);
  const [mfaQr, setMfaQr] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const {
    currentTier,
    isAgencyRole,
    isPaid,
    planLabel,
    planSubtitle,
    ctaLabel,
    campaignLimitValue,
    creatorLimitValue,
    analyticsLabel,
  } = React.useMemo(() => {
    const tier = billing?.subscription?.tier || billing?.plan?.tier || 'free';
    const agencyRole =
      billing?.agency_role === 'agency' || billing?.agency_role === 'super_agency';
    const paid = billing?.is_paid || billing?.is_trialing || tier !== 'free';
    const tierDefaults = defaultLimits[tier] || defaultLimits.free;
    return {
      currentTier: tier,
      isAgencyRole: agencyRole,
      isPaid: paid,
      planLabel: agencyRole ? 'Agency Plan' : `${formatLabel(tier)} Plan`,
      planSubtitle: paid
        ? 'Your current subscription details'
        : 'Upgrade to unlock powerful features',
      ctaLabel: paid ? 'Manage Subscription' : 'Upgrade to Pro',
      campaignLimitValue: billing?.plan?.max_active_campaigns ?? tierDefaults.campaigns,
      creatorLimitValue: billing?.plan?.max_creators_per_campaign ?? tierDefaults.creators,
      analyticsLabel: tierDefaults.analytics,
    };
  }, [billing]);
  const formatLimit = (value: number | null) =>
    value === null ? 'Unlimited' : value.toString();
  const billingCycle = billing?.subscription?.billing_cycle || 'monthly';
  const planPriceLabel = billingLoading
    ? '--'
    : formatPrice(billing?.plan?.base_price_cents ?? 0, 'USD');
  const planCycleLabel = billingCycle === 'yearly' ? 'Yearly' : 'Monthly';
  const invoiceHint = isPaid
    ? 'Your invoices will appear after the next successful charge.'
    : 'Upgrade to Pro to see your invoices here';

  const resolveWorkspaceId = async () => {
    if (!user?.id) return null;
    if (activeWorkspaceId) return activeWorkspaceId;
    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1);

    if (error) {
      return user.id;
    }

    return data?.[0]?.workspace_id || user.id;
  };

  useEffect(() => {
    if (user?.id) {
      loadProfile();
      loadTeamMembers();
      return;
    }
    if (!authLoading) {
      setProfileLoading(false);
      setTeamLoading(false);
      setProfileError('Not authenticated');
      setTeamError('Not authenticated');
    }
  }, [user?.id, authLoading, activeWorkspaceId]);

  useEffect(() => {
    const loadWorkspaceMeta = async () => {
      if (!user?.id || !activeWorkspaceId) {
        setWorkspaceOwnerId(user?.id || null);
        return;
      }

      setWorkspaceMetaLoading(true);
      const { data, error } = await supabase
        .from('workspaces')
        .select('owner_user_id')
        .eq('id', activeWorkspaceId)
        .maybeSingle();

      if (error) {
        setWorkspaceOwnerId(null);
        setWorkspaceMetaLoading(false);
        return;
      }

      setWorkspaceOwnerId(data?.owner_user_id || null);
      setWorkspaceMetaLoading(false);
    };

    loadWorkspaceMeta();
  }, [activeWorkspaceId, user?.id]);

  const loadProfile = async () => {
    if (!user?.id) return;
    setProfileLoading(true);
    setProfileError(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      setProfileError('Unable to load profile');
      setProfileLoading(false);
      return;
    }

    const fullName =
      data?.full_name || user.user_metadata?.full_name || '';
    const { firstName, lastName } = splitFullName(fullName);
    const companyValue =
      (data as any)?.company || user.user_metadata?.company || '';
    const phoneValue =
      data?.phone || user.phone || user.user_metadata?.phone || '';

    setSupportsCompany(Object.prototype.hasOwnProperty.call(data || {}, 'company'));
    setProfileForm({
      firstName,
      lastName,
      email: user.email || '',
      company: companyValue || '',
      phone: phoneValue || '',
    });
    setProfileLoading(false);
  };

  const loadTeamMembers = async () => {
    if (!user?.id) return;
    setTeamLoading(true);
    setTeamError(null);

    const workspaceId = await resolveWorkspaceId();
    if (!workspaceId) {
      setTeamError('Unable to resolve workspace');
      setTeamLoading(false);
      return;
    }

    const { data: members, error } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (error) {
      setTeamError('Unable to load team members');
      setTeamLoading(false);
      return;
    }

    const memberIds = (members || []).map((member) => member.user_id);
    const profileMap = new Map<string, any>();

    if (memberIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('id', memberIds);

      (profiles || []).forEach((profile) => {
        profileMap.set(profile.id, profile);
      });
    }

    const rows: TeamMemberRow[] = (members || []).map((member) => {
      const profile = profileMap.get(member.user_id) || {};
      const displayName =
        profile.full_name ||
        (member.user_id === user.id ? user.email?.split('@')[0] : 'Member') ||
        'Member';
      const emailValue =
        profile.email ||
        (member.user_id === user.id ? user.email : '') ||
        'Email unavailable';

      return {
        id: member.id,
        userId: member.user_id,
        name: displayName,
        email: emailValue,
        role: member.role,
        status: member.status,
        isCurrentUser: member.user_id === user.id,
      };
    });

    if (user && !rows.some((member) => member.userId === user.id)) {
      rows.unshift({
        id: user.id,
        userId: user.id,
        name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'You',
        email: user.email || 'Email unavailable',
        role: 'brand_owner',
        status: 'active',
        isCurrentUser: true,
      });
    }

    setTeamMembers(rows);
    setTeamLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setProfileSaving(true);
    setProfileError(null);

    const fullName = [profileForm.firstName, profileForm.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    const updatePayload: Record<string, any> = {
      full_name: fullName || null,
      phone: profileForm.phone || null,
    };

    if (supportsCompany) {
      updatePayload.company = profileForm.company || null;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id);

    if (error) {
      setProfileError(error.message || 'Unable to update profile');
      toast.error('Failed to update profile');
      setProfileSaving(false);
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        full_name: fullName || null,
        company: profileForm.company || null,
        phone: profileForm.phone || null,
      },
    });

    if (authError) {
      toast.error(authError.message || 'Profile saved, but metadata update failed');
    }

    toast.success('Profile updated');
    addNotification({
      type: 'campaign',
      title: 'Profile Updated',
      message: 'Your profile information has been saved',
    });
    setProfileSaving(false);
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (!user?.email) {
      toast.error('Unable to update password');
      return;
    }

    setPasswordSaving(true);

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (reauthError) {
      toast.error('Current password is incorrect');
      setPasswordSaving(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      toast.error(updateError.message || 'Failed to update password');
      setPasswordSaving(false);
      return;
    }

    toast.success('Password updated successfully');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSaving(false);

    addNotification({
      type: 'campaign',
      title: 'Password Changed',
      message: 'Your password has been updated successfully',
    });
  };

  const loadMfaFactors = async () => {
    if (!supabase.auth.mfa?.listFactors) return;
    setMfaLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message || 'Unable to load MFA status');
      setMfaLoading(false);
      return;
    }
    setMfaFactors([...(data?.totp || [])]);
    setMfaLoading(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    loadMfaFactors();
  }, [user?.id]);

  const startMfaEnrollment = async () => {
    if (!supabase.auth.mfa?.enroll) {
      toast.error('MFA is not supported in this environment');
      return;
    }
    setMfaLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
    if (error) {
      toast.error(error.message || 'Failed to start MFA setup');
      setMfaLoading(false);
      return;
    }
    setMfaFactorId(data.id);
    setMfaQr(data.totp?.qr_code || null);
    setMfaSecret(data.totp?.secret || null);
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: data.id,
    });
    if (challengeError) {
      toast.error(challengeError.message || 'Unable to create MFA challenge');
      setMfaLoading(false);
      return;
    }
    setMfaChallengeId(challengeData.id);
    setMfaEnrollOpen(true);
    setMfaLoading(false);
  };

  const verifyMfa = async () => {
    if (!mfaFactorId || !mfaChallengeId || !mfaCode) {
      toast.error('Enter the 6-digit code from your authenticator app');
      return;
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId: mfaChallengeId,
      code: mfaCode.trim(),
    });
    if (error) {
      toast.error(error.message || 'MFA verification failed');
      return;
    }
    toast.success('MFA enabled');
    setMfaEnrollOpen(false);
    setMfaCode('');
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setMfaQr(null);
    setMfaSecret(null);
    loadMfaFactors();
  };

  const isWorkspaceOwner =
    !activeWorkspaceId || (workspaceOwnerId && workspaceOwnerId === user?.id);

  if (!workspaceMetaLoading && user?.id && !isWorkspaceOwner) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate('/')}
            className="w-9 h-9 flex-shrink-0 rounded-md bg-muted/60 hover:bg-muted border border-border flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Only workspace owners can manage account settings.
            </p>
          </div>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">
              Settings are only available to the workspace owner.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const removeMfa = async (factorId: string) => {
    if (!confirm('Remove MFA from this account?')) return;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message || 'Failed to remove MFA');
      return;
    }
    toast.success('MFA removed');
    loadMfaFactors();
  };

  const handleSendInvite = async () => {
    if (!inviteEmail) {
      toast.error('Please enter an email address');
      return;
    }
    if (!inviteEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!user?.id) {
      toast.error('You must be signed in to send invites');
      return;
    }

    setInviteSending(true);

    const emailValue = inviteEmail.trim().toLowerCase();
    const workspaceId = activeWorkspaceId || user.id;

    const scopeValue = inviteRole === 'viewer' ? 'viewer' : 'editor';
    const roleMap: Record<typeof inviteRole, TeamMemberRow['role']> = {
      admin: 'agency_admin',
      editor: 'brand_member',
      viewer: 'agency_ops',
    };
    const result = await createTeamInvite(
      workspaceId,
      emailValue,
      roleMap[inviteRole],
      [{ scope_type: 'workspace', scope_value: scopeValue }],
      null
    );

    if (result.error) {
      toast.error(result.error.message || 'Failed to send invite');
      setInviteSending(false);
      return;
    }

    toast.success('Invite sent');
    setInviteEmail('');
    await loadTeamMembers();
    setInviteSending(false);

    addNotification({
      type: 'team',
      title: 'Invite Sent',
      message: `Team invitation sent to ${emailValue}`,
    });
  };

  const toggleNotification = (key: keyof NotificationSettings) => {
    setNotificationSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const addNotification = (notification: any) => {
    if (typeof window !== 'undefined') {
      const notifications = JSON.parse(localStorage.getItem('dttracker-notifications') || '[]');
      const newNotification = {
        id: Date.now(),
        ...notification,
        time: 'Just now',
        read: false,
      };
      localStorage.setItem('dttracker-notifications', JSON.stringify([newNotification, ...notifications]));
      window.dispatchEvent(new Event('notifications-updated'));
    }
  };

  const roleStyles: Record<string, string> = {
    brand_owner:
      'text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/20',
    agency_admin:
      'text-purple-700 dark:text-purple-400 bg-purple-100/70 dark:bg-purple-400/10 border-purple-200 dark:border-purple-400/20',
    brand_member: 'text-primary bg-primary/10 border-primary/20',
    agency_ops:
      'text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-400/10 border-slate-200 dark:border-slate-400/20',
  };

  const statusStyles: Record<string, string> = {
    active:
      'text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/20',
    pending:
      'text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/20',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate('/')}
          className="w-11 h-11 min-h-[44px] flex-shrink-0 rounded-md bg-muted/60 hover:bg-muted active:bg-muted border border-border flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Manage your account and preferences</p>
        </div>
      </div>

      {/* Subscription Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-card border-primary/20 rounded-xl relative overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardContent className="p-5 sm:p-6 lg:p-7">
          <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  {billingLoading ? 'Loading Plan...' : planLabel}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {billingLoading ? 'Fetching subscription details' : planSubtitle}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => onNavigate('/subscription')}
              className="min-h-[44px] h-11 px-4 bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <div className="mt-4 p-4 bg-muted/60 rounded-lg border border-border">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {billingLoading ? '--' : formatLimit(campaignLimitValue)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Campaign Limit</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {billingLoading ? '--' : formatLimit(creatorLimitValue)}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Creators per Campaign</div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold tracking-tight text-muted-foreground">
                  {billingLoading ? '--' : analyticsLabel}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground">Analytics</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card className="bg-card border-border rounded-xl overflow-hidden" style={{ boxShadow: 'var(--shadow-card)' }}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Profile</h3>
              <p className="text-sm text-muted-foreground">Update your personal information</p>
            </div>
          </div>

          {profileLoading || authLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-11 w-full" />
              </div>
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-32" />
            </div>
          ) : (
            <div className="space-y-4">
              {profileError && (
                <p className="text-sm text-red-400">{profileError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-normal text-foreground mb-2">First Name</label>
                  <Input
                    value={profileForm.firstName}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, firstName: e.target.value })
                    }
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-foreground mb-2">Last Name</label>
                  <Input
                    value={profileForm.lastName}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, lastName: e.target.value })
                    }
                    placeholder="Enter last name"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-normal text-foreground mb-2">Email</label>
                  <Input
                    type="email"
                    value={profileForm.email}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
                <div>
                  <label className="block text-sm font-normal text-foreground mb-2">Phone</label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-normal text-foreground mb-2">Company</label>
                <Input
                  value={profileForm.company}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, company: e.target.value })
                  }
                  placeholder="Enter company name"
                />
              </div>
              <Button
                onClick={handleSaveProfile}
                className="min-h-[44px] h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={profileSaving}
              >
                {profileSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {mfaEnrollOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">Set up MFA</h3>
                <p className="text-xs text-muted-foreground">Scan the QR code in your authenticator app.</p>
              </div>
              <button onClick={() => setMfaEnrollOpen(false)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center gap-3">
              {mfaQr ? (
                mfaQr.startsWith('data:') ? (
                  <img src={mfaQr} alt="MFA QR Code" className="h-40 w-40 rounded-lg bg-white p-2" />
                ) : (
                  <div className="w-full rounded-lg border border-border bg-muted/60 p-3 text-xs text-foreground">
                    {mfaQr}
                  </div>
                )
              ) : (
                <div className="text-xs text-muted-foreground">QR code unavailable.</div>
              )}

              {mfaSecret && (
                <div className="w-full rounded-lg border border-border bg-muted/60 p-3 text-xs text-foreground">
                  <div className="text-[11px] text-muted-foreground mb-1">Manual code</div>
                  <div className="font-mono break-all">{mfaSecret}</div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-normal text-foreground mb-2">6-digit code</label>
              <Input
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="123456"
                className="h-10"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setMfaEnrollOpen(false)}>
                Cancel
              </Button>
              <Button onClick={verifyMfa}>Verify MFA</Button>
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Security</h3>
              <p className="text-sm text-muted-foreground">Manage your password and security settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-normal text-foreground mb-2">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-normal text-foreground mb-2">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <label className="block text-sm font-normal text-foreground mb-2">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            <Button
              onClick={handleUpdatePassword}
              className="min-h-[44px] h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
              disabled={passwordSaving}
            >
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </Button>

            <div className="mt-6 border-t border-border pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">Multi-Factor Authentication</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Protect your account with an authenticator app.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-[40px]"
                  onClick={startMfaEnrollment}
                  disabled={mfaLoading}
                >
                  {mfaLoading ? 'Loading...' : 'Set up MFA'}
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {mfaFactors.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No MFA factors configured.</div>
                ) : (
                  mfaFactors.map((factor: any) => (
                    <div
                      key={factor.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">Authenticator App</span>
                        <span className="text-muted-foreground">•</span>
                        <span>{factor.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Added {new Date(factor.created_at).toLocaleDateString()}</span>
                        <button
                          onClick={() => removeMfa(factor.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Management */}
     
     

      {/* Notifications */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground">Manage how you receive notifications</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/60 rounded-lg border border-border">
              <div>
                <div className="font-medium text-foreground mb-1">Campaign Updates</div>
                <div className="text-sm text-muted-foreground">Get notified when campaigns are created or updated</div>
              </div>
              <Switch
                checked={notificationSettings.campaignUpdates}
                onCheckedChange={() => toggleNotification('campaignUpdates')}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/60 rounded-lg border border-border">
              <div>
                <div className="font-medium text-foreground mb-1">Performance Alerts</div>
                <div className="text-sm text-muted-foreground">Receive alerts when performance metrics change significantly</div>
              </div>
              <Switch
                checked={notificationSettings.performanceAlerts}
                onCheckedChange={() => toggleNotification('performanceAlerts')}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/60 rounded-lg border border-border">
              <div>
                <div className="font-medium text-foreground mb-1">Team Mentions</div>
                <div className="text-sm text-muted-foreground">Get notified when team members mention you</div>
              </div>
              <Switch
                checked={notificationSettings.teamMentions}
                onCheckedChange={() => toggleNotification('teamMentions')}
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/60 rounded-lg border border-border">
              <div>
                <div className="font-medium text-foreground mb-1">Weekly Reports</div>
                <div className="text-sm text-muted-foreground">Receive weekly summary of campaign performance</div>
              </div>
              <Switch
                checked={notificationSettings.weeklyReports}
                onCheckedChange={() => toggleNotification('weeklyReports')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Billing & Invoices</h3>
              <p className="text-sm text-muted-foreground">View your billing history and download invoices</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-muted/60 rounded-lg border border-border">
              <div>
                <div className="font-medium text-foreground mb-1">
                  {billingLoading ? 'Loading Plan...' : planLabel}
                </div>
                <div className="text-sm text-muted-foreground">
                  {billingLoading
                    ? 'Fetching billing details'
                    : `${isPaid ? 'Current plan' : 'Free plan'} • ${planCycleLabel} billing`}
                </div>
              </div>
              <div className="text-lg font-semibold text-foreground">
                {billingLoading ? '--' : planPriceLabel}
              </div>
            </div>

            <div className="p-4 bg-muted/60 rounded-lg border border-border">
              <div className="text-sm font-medium text-muted-foreground mb-3">Payment History</div>
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No payment history available</p>
                <p className="text-xs text-muted-foreground mt-1">{invoiceHint}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
