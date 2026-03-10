import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Play, Square, Settings, Clock, Loader2 } from 'lucide-react';
import type { EC2InstanceDetail, Schedule, AWSAccount } from '@/types/index';

const API_BASE = 'https://0azsdk6qbb.execute-api.ap-south-1.amazonaws.com/prod';

interface EC2ManagementDashboardProps {
  onClose?: () => void;
}

export function EC2ManagementDashboard({ onClose }: EC2ManagementDashboardProps) {
  const { toast } = useToast();
  
  // State management
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [applicationNames, setApplicationNames] = useState<string[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<string>('');
  const [instances, setInstances] = useState<EC2InstanceDetail[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>('');
  
  // Dialog states
  const [modifyTypeDialog, setModifyTypeDialog] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<EC2InstanceDetail | null>(null);
  const [newInstanceType, setNewInstanceType] = useState('');
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'start' | 'stop'; instanceId: string } | null>(null);

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Fetch application names when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetchApplicationNames();
      setSelectedApplication('');
      setInstances([]);
    }
  }, [selectedAccount]);

  // Fetch instances and schedules when application changes
  useEffect(() => {
    if (selectedAccount && selectedApplication) {
      fetchInstances();
      fetchSchedules();
    }
  }, [selectedAccount, selectedApplication]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/ec2/accounts`);
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({ title: 'Error', description: 'Failed to load AWS accounts', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchApplicationNames = async () => {
    try {
      const response = await fetch(`${API_BASE}/ec2/applications?accountId=${selectedAccount}`);
      if (!response.ok) throw new Error('Failed to fetch applications');
      const data = await response.json();
      setApplicationNames(data.applications || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
      toast({ title: 'Error', description: 'Failed to load applications', variant: 'destructive' });
    }
  };

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/ec2/instances?accountId=${selectedAccount}&applicationName=${selectedApplication}`
      );
      if (!response.ok) throw new Error('Failed to fetch instances');
      const data = await response.json();
      setInstances(data.instances || []);
    } catch (error) {
      console.error('Error fetching instances:', error);
      toast({ title: 'Error', description: 'Failed to load instances', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/ec2/schedules?applicationName=${selectedApplication}`
      );
      if (!response.ok) throw new Error('Failed to fetch schedules');
      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({ title: 'Error', description: 'Failed to load schedules', variant: 'destructive' });
    }
  };

  const handleStartInstance = async (instanceId: string) => {
    setConfirmAction({ type: 'start', instanceId });
    setConfirmDialog(true);
  };

  const handleStopInstance = async (instanceId: string) => {
    setConfirmAction({ type: 'stop', instanceId });
    setConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    try {
      setActionLoading(confirmAction.instanceId);
      const response = await fetch(`${API_BASE}/ec2/instance-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: confirmAction.instanceId,
          action: confirmAction.type,
          accountId: selectedAccount
        })
      });

      if (!response.ok) throw new Error('Action failed');
      
      toast({
        title: 'Success',
        description: `Instance ${confirmAction.type === 'start' ? 'started' : 'stopped'} successfully`
      });
      
      fetchInstances();
    } catch (error) {
      console.error('Error performing action:', error);
      toast({ title: 'Error', description: 'Failed to perform action', variant: 'destructive' });
    } finally {
      setActionLoading('');
      setConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  const handleModifyType = async () => {
    if (!selectedInstance || !newInstanceType) return;

    try {
      setActionLoading(selectedInstance.instanceId);
      const response = await fetch(`${API_BASE}/ec2/modify-instance-type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstance.instanceId,
          newInstanceType,
          accountId: selectedAccount
        })
      });

      if (!response.ok) throw new Error('Modification failed');
      
      toast({
        title: 'Success',
        description: 'Instance type modified successfully'
      });
      
      setModifyTypeDialog(false);
      setNewInstanceType('');
      fetchInstances();
    } catch (error) {
      console.error('Error modifying instance type:', error);
      toast({ title: 'Error', description: 'Failed to modify instance type', variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  };

  const handleApplySchedule = async (scheduleId: string) => {
    if (!selectedInstance) return;

    try {
      setActionLoading(selectedInstance.instanceId);
      const response = await fetch(`${API_BASE}/ec2/apply-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedInstance.instanceId,
          scheduleId,
          accountId: selectedAccount
        })
      });

      if (!response.ok) throw new Error('Failed to apply schedule');
      
      toast({
        title: 'Success',
        description: 'Schedule applied successfully'
      });
      
      setScheduleDialog(false);
      fetchInstances();
    } catch (error) {
      console.error('Error applying schedule:', error);
      toast({ title: 'Error', description: 'Failed to apply schedule', variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'stopping':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">EC2 Management Dashboard</h2>
        {onClose && <Button variant="outline" onClick={onClose}>Close</Button>}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">AWS Account</label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.accountId} value={account.accountId}>
                    {account.accountName} ({account.accountId})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Application Name</label>
            <Select value={selectedApplication} onValueChange={setSelectedApplication} disabled={!selectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an application" />
              </SelectTrigger>
              <SelectContent>
                {applicationNames.map(app => (
                  <SelectItem key={app} value={app}>
                    {app}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Schedules Info */}
      {selectedApplication && schedules.length > 0 && (
        <Card className="p-4 bg-blue-50">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Available Schedules
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {schedules.map(schedule => (
              <div key={schedule.scheduleId} className="text-sm p-2 bg-white rounded border">
                <p className="font-medium">{schedule.scheduleName}</p>
                <p className="text-gray-600">{schedule.startTime} - {schedule.stopTime}</p>
                <p className="text-gray-500 text-xs">{schedule.daysOfWeek.join(', ')}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Instances Table */}
      {selectedApplication && (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Instance ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : instances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No instances found
                    </TableCell>
                  </TableRow>
                ) : (
                  instances.map(instance => (
                    <TableRow key={instance.instanceId}>
                      <TableCell className="font-mono text-sm">{instance.instanceId}</TableCell>
                      <TableCell>{instance.instanceType}</TableCell>
                      <TableCell>
                        <Badge className={getStateColor(instance.state)}>
                          {instance.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {instance.scheduleName || 'No Schedule'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {instance.state === 'stopped' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStartInstance(instance.instanceId)}
                              disabled={actionLoading === instance.instanceId}
                            >
                              {actionLoading === instance.instanceId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          {instance.state === 'running' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleStopInstance(instance.instanceId)}
                              disabled={actionLoading === instance.instanceId}
                            >
                              {actionLoading === instance.instanceId ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </Button>
                          )}

                          <Dialog open={modifyTypeDialog && selectedInstance?.instanceId === instance.instanceId} onOpenChange={setModifyTypeDialog}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedInstance(instance)}
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Modify Instance Type</DialogTitle>
                                <DialogDescription>
                                  Change the instance type for {instance.instanceId}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <label className="text-sm font-medium">Current Type: {instance.instanceType}</label>
                                </div>
                                <div>
                                  <label className="text-sm font-medium">New Type</label>
                                  <input
                                    type="text"
                                    placeholder="e.g., t3.large"
                                    value={newInstanceType}
                                    onChange={(e) => setNewInstanceType(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md text-sm"
                                  />
                                </div>
                                <Button
                                  onClick={handleModifyType}
                                  disabled={!newInstanceType || actionLoading === instance.instanceId}
                                >
                                  {actionLoading === instance.instanceId ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                  ) : null}
                                  Apply
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={scheduleDialog && selectedInstance?.instanceId === instance.instanceId} onOpenChange={setScheduleDialog}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedInstance(instance)}
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Apply Schedule</DialogTitle>
                                <DialogDescription>
                                  Select a schedule for {instance.instanceId}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2">
                                {schedules.map(schedule => (
                                  <Button
                                    key={schedule.scheduleId}
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => handleApplySchedule(schedule.scheduleId)}
                                    disabled={actionLoading === instance.instanceId}
                                  >
                                    <div className="text-left">
                                      <p className="font-medium">{schedule.scheduleName}</p>
                                      <p className="text-xs text-gray-500">{schedule.startTime} - {schedule.stopTime}</p>
                                    </div>
                                  </Button>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog} onOpenChange={setConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Action</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to {confirmAction?.type} instance {confirmAction?.instanceId}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>
              {confirmAction?.type === 'start' ? 'Start' : 'Stop'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
