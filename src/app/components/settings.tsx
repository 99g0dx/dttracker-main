import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { User, Lock, Users, Mail, X, Shield, Crown, ArrowRight, Bell, CreditCard, Key, Copy, Check, ArrowLeft } from 'lucide-react';
import { TeamManagement } from './team-management';
import { canManageTeam, getCurrentUser } from '../utils/permissions';

interface SettingsProps {
  onNavigate: (path: string) => void;
}

interface UserSettings {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  notifications: {
    campaignUpdates: boolean;
    performanceAlerts: boolean;
    teamMentions: boolean;
    weeklyReports: boolean;
  };
  apiKey: string;
}

const defaultSettings: UserSettings = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  company: 'Acme Inc.',
  notifications: {
    campaignUpdates: true,
    performanceAlerts: true,
    teamMentions: true,
    weeklyReports: false,
  },
  apiKey: 'dttr_sk_live_51H9x2H7KqLwZ8pN3vX4mY6tR2sB9cD1fG3hJ5kL8nM0pQ4rS6tU8vW0xY2zA4bC6dE8fG0hI2jK4',
};

export function Settings({ onNavigate }: SettingsProps) {
  const [settings, setSettings] = useState<UserSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dttracker-settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return defaultSettings;
        }
      }
    }
    return defaultSettings;
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [apiKeyCopied, setApiKeyCopied] = useState(false);

  // Save to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dttracker-settings', JSON.stringify(settings));
    }
  }, [settings]);

  const handleSaveProfile = () => {
    // Settings are already saved via useEffect
    alert('Profile updated successfully!');
    addNotification({
      type: 'campaign',
      title: 'Profile Updated',
      message: 'Your profile information has been saved',
    });
  };

  const handleUpdatePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    // In a real app, this would make an API call
    alert('Password updated successfully!');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    addNotification({
      type: 'campaign',
      title: 'Password Changed',
      message: 'Your password has been updated successfully',
    });
  };

  const handleSendInvite = () => {
    if (!inviteEmail) {
      alert('Please enter an email address');
      return;
    }
    if (!inviteEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    alert(`Invite sent to ${inviteEmail}!`);
    setInviteEmail('');

    addNotification({
      type: 'team',
      title: 'Invite Sent',
      message: `Team invitation sent to ${inviteEmail}`,
    });
  };

  const toggleNotification = (key: keyof typeof settings.notifications) => {
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: !settings.notifications[key],
      },
    });
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(settings.apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const generateNewApiKey = () => {
    if (confirm('Are you sure you want to generate a new API key? Your old key will stop working.')) {
      const newKey = 'dttr_sk_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setSettings({ ...settings, apiKey: newKey });
      alert('New API key generated successfully!');

      addNotification({
        type: 'campaign',
        title: 'API Key Generated',
        message: 'A new API key has been created. Update your integrations.',
      });
    }
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate('/')}
          className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Settings</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">Manage your account and preferences</p>
        </div>
      </div>

      {/* Subscription Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-[#0D0D0D] border-primary/20 relative overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Free Plan</h3>
                <p className="text-sm text-slate-400">Upgrade to unlock powerful features</p>
              </div>
            </div>
            <Button 
              onClick={() => onNavigate('/subscription')}
              className="h-9 px-4 bg-primary hover:bg-primary/90 text-black w-full sm:w-auto"
            >
              Upgrade to Pro
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <div className="mt-4 p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-semibold text-white">2</div>
                <div className="text-xs text-slate-500">Campaign Limit</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-white">5</div>
                <div className="text-xs text-slate-500">Creators per Campaign</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-slate-400">Basic</div>
                <div className="text-xs text-slate-500">Analytics</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Settings */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Profile</h3>
              <p className="text-sm text-slate-400">Update your personal information</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">First Name</label>
                <Input
                  value={settings.firstName}
                  onChange={(e) => setSettings({ ...settings, firstName: e.target.value })}
                  className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">Last Name</label>
                <Input
                  value={settings.lastName}
                  onChange={(e) => setSettings({ ...settings, lastName: e.target.value })}
                  className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Email</label>
              <Input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Company</label>
              <Input
                value={settings.company}
                onChange={(e) => setSettings({ ...settings, company: e.target.value })}
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
            <Button onClick={handleSaveProfile} className="h-9 bg-primary hover:bg-primary/90 text-black">
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Security</h3>
              <p className="text-sm text-slate-400">Manage your password and security settings</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Current Password</label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">New Password</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">Confirm New Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
              />
            </div>
            <Button onClick={handleUpdatePassword} className="h-9 bg-purple-500 hover:bg-purple-500/90 text-white">
              Update Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Management */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Team Members</h3>
              <p className="text-sm text-slate-400">Manage your team and permissions</p>
            </div>
          </div>

          {/* Invite Member */}
          <div className="flex gap-3 mb-6 flex-col sm:flex-row">
            <Input
              type="email"
              placeholder="Enter email to invite..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 h-10 bg-white/[0.03] border-white/[0.08] text-white"
            />
            <Button onClick={handleSendInvite} className="h-10 px-4 bg-primary hover:bg-primary/90 text-[rgb(0,0,0)] w-full sm:w-auto">
              <Mail className="w-4 h-4 mr-2" />
              Send Invite
            </Button>
          </div>

          {/* Team Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white font-medium">
                  {settings.firstName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{settings.firstName} {settings.lastName}</span>
                    <span className="text-xs text-slate-500">(You)</span>
                  </div>
                  <div className="text-sm text-slate-400">{settings.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs border border-primary/20">
                <Shield className="w-3 h-3" />
                Admin
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Notification Preferences</h3>
              <p className="text-sm text-slate-400">Manage how you receive notifications</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <div>
                <div className="font-medium text-white mb-1">Campaign Updates</div>
                <div className="text-sm text-slate-400">Get notified when campaigns are created or updated</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.notifications.campaignUpdates}
                  onChange={() => toggleNotification('campaignUpdates')}
                />
                <div className="w-11 h-6 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" style={{ color: 'rgba(76, 72, 72, 1)', backgroundColor: 'var(--color-slate-800)' }}></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <div>
                <div className="font-medium text-white mb-1">Performance Alerts</div>
                <div className="text-sm text-slate-400">Receive alerts when performance metrics change significantly</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.notifications.performanceAlerts}
                  onChange={() => toggleNotification('performanceAlerts')}
                />
                <div className="w-11 h-6 bg-white/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" style={{ color: 'rgba(76, 72, 72, 1)', backgroundColor: 'var(--color-slate-800)' }}></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <div>
                <div className="font-medium text-white mb-1">Team Mentions</div>
                <div className="text-sm text-slate-400">Get notified when team members mention you</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.notifications.teamMentions}
                  onChange={() => toggleNotification('teamMentions')}
                />
                <div className="w-11 h-6 bg-[rgba(67,66,66,1)] peer-focus:outline-none rounded-[40px] peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" style={{ backgroundColor: 'var(--color-slate-800)' }}></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <div>
                <div className="font-medium text-white mb-1">Weekly Reports</div>
                <div className="text-sm text-slate-400">Receive weekly summary of campaign performance</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={settings.notifications.weeklyReports}
                  onChange={() => toggleNotification('weeklyReports')}
                />
                <div className="w-11 h-6 bg-white/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" style={{ color: 'rgba(76, 72, 72, 1)', backgroundColor: 'var(--color-slate-800)' }}></div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Billing & Invoices</h3>
              <p className="text-sm text-slate-400">View your billing history and download invoices</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <div>
                <div className="font-medium text-white mb-1">Free Plan</div>
                <div className="text-sm text-slate-400">Current plan • No charges</div>
              </div>
              <div className="text-lg font-semibold text-white">$0.00</div>
            </div>

            <div className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <div className="text-sm font-medium text-slate-400 mb-3">Payment History</div>
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">No payment history available</p>
                <p className="text-xs text-slate-600 mt-1">Upgrade to Pro to see your invoices here</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">API Keys</h3>
              <p className="text-sm text-slate-400">Manage API keys for custom integrations</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Production API Key</label>
              <div className="flex gap-3 flex-col sm:flex-row">
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  readOnly
                  className="flex-1 h-10 bg-white/[0.03] border-white/[0.08] text-white font-mono text-sm"
                />
                <Button
                  onClick={() => setShowApiKey(!showApiKey)}
                  variant="outline"
                  className="h-10 px-4 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                >
                  {showApiKey ? 'Hide' : 'Reveal'}
                </Button>
                <Button
                  onClick={copyApiKey}
                  variant="outline"
                  className="h-10 px-4 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                >
                  {apiKeyCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {apiKeyCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            <div className="flex gap-3 flex-col sm:flex-row">
              <Button onClick={generateNewApiKey} className="h-9 bg-primary hover:bg-primary/90 text-[rgb(0,0,0)]">
                Generate New Key
              </Button>
              <Button
                variant="outline"
                className="h-9 px-4 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
              >
                View API Docs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}