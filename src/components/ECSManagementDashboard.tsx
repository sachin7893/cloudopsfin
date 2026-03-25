import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Play, Square, RotateCw, Clock, Loader2 } from 'lucide-react';
import type { AWSAccount } from '@/types/index';

const API_BASE = 'https://0azsdk6qbb.execute-api.ap-south-1.amazonaws.com/prod';

interface ECSCluster {
  clusterId: string;
  clusterName: string;
  region: string;
  status: string;
}

interface ECSService {
  serviceId: string;
  serviceName: string;
  clusterName: string;
  status: string;
  taskCount: number;
  desiredCount: number;
  runningCount: number;
}

interface ECSSchedule {
  scheduleId: string;
  scheduleName: string;
  startTime: string;
  stopTime: string;
  daysOfWeek: string[];
}

export function ECSManagementDashboard() {
  const { toast } = useToast();
  
  // State management
  const [accounts, setAccounts] = useState<AWSAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [clusters, setClusters] = useState<ECSCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<string>('');
  const [services, setServices] = useState<ECSService[]>([]);
  const [schedules, setSchedules] = useState<ECSSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>('');
  
  // Dialog states
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [selectedService, setSelectedService] = useState<ECSService | null>(null);
  const [confirmDialog, setConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'start' | 'stop' | 'restart'; serviceId: string } | null>(null);
  
  // Create schedule form state
  const [newSchedule, setNewSchedule] = useState({
    scheduleName: '',
    startTime: '08:00',
    stopTime: '18:00',
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    timezone: 'UTC'
  });

  // Fetch accounts on mount
  useEffect(() => {
    fetchAccounts();
  }, []);

  // Fetch clusters when account changes
  useEffect(() => {
    if (selectedAccount) {
      fetchClusters();
      setSelectedCluster('');
      setServices([]);
    }
  }, [selectedAccount]);

  // Fetch services when cluster changes
  useEffect(() => {
    if (selectedAccount && selectedCluster) {
      fetchServices();
      fetchSchedules();
    }
  }, [selectedAccount, selectedCluster]);

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

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/ecs/clusters?accountId=${selectedAccount}`);
      if (!response.ok) throw new Error('Failed to fetch clusters');
      const data = await response.json();
      setClusters(data.clusters || []);
    } catch (error) {
      console.error('Error fetching clusters:', error);
      toast({ title: 'Error', description: 'Failed to load ECS clusters', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE}/ecs/services?accountId=${selectedAccount}&clusterName=${selectedCluster}`
      );
      if (!response.ok) throw new Error('Failed to fetch services');
      const data = await response.json();
      setServices(data.services || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast({ title: 'Error', description: 'Failed to load ECS services', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/ecs/schedules?clusterName=${selectedCluster}`
      );
      if (!response.ok) throw new Error('Failed to fetch schedules');
      const data = await response.json();
      setSchedules(data.schedules || []);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({ title: 'Error', description: 'Failed to load schedules', variant: 'destructive' });
    }
  };

  const handleServiceAction = async (serviceId: string, action: 'start' | 'stop' | 'restart') => {
    setConfirmAction({ type: action, serviceId });
    setConfirmDialog(true);
  };

  const executeAction = async () => {
    if (!confirmAction) return;

    try {
      setActionLoading(confirmAction.serviceId);
      const response = await fetch(`${API_BASE}/ecs/service-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: confirmAction.serviceId,
          action: confirmAction.type,
          accountId: selectedAccount,
          clusterName: selectedCluster
        })
      });

      if (!response.ok) throw new Error('Action failed');
      
      toast({
        title: 'Success',
        description: `Service ${confirmAction.type} action completed successfully`
      });
      
      fetchServices();
    } catch (error) {
      console.error('Error performing action:', error);
      toast({ title: 'Error', description: 'Failed to perform action', variant: 'destructive' });
    } finally {
      setActionLoading('');
      setConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  const handleApplySchedule = async (scheduleId: string) => {
    if (!selectedService) return;

    try {
      setActionLoading(selectedService.serviceId);
      const response = await fetch(`${API_BASE}/ecs/apply-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.serviceId,
          scheduleId,
          accountId: selectedAccount,
          clusterName: selectedCluster
        })
      });

      if (!response.ok) throw new Error('Failed to apply schedule');
      
      toast({
        title: 'Success',
        description: 'Schedule applied successfully'
      });
      
      setScheduleDialog(false);
      fetchServices();
    } catch (error) {
      console.error('Error applying schedule:', error);
      toast({ title: 'Error', description: 'Failed to apply schedule', variant: 'destructive' });
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedCluster || !newSchedule.scheduleName) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      setActionLoading('creating-schedule');
      const response = await fetch(`${API_BASE}/ecs/create-schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clusterName: selectedCluster,
          scheduleName: newSchedule.scheduleName,
          startTime: newSchedule.startTime,
          stopTime: newSchedule.stopTime,
          daysOfWeek: newSchedule.daysOfWeek,
          timezone: newSchedule.timezone
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create schedule');
      }
      
      toast({
        title: 'Success',
        description: 'Schedule created successfully'
      });
      
      setNewSchedule({
        scheduleName: '',
        startTime: '08:00',
        stopTime: '18:00',
        daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timezone: 'UTC'
      });
      fetchSchedules();
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to create schedule', 
        variant: 'destructive' 
      });
    } finally {
      setActionLoading('');
    }
  };

  const toggleDayOfWeek = (day: string) => {
    setNewSchedule(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day]
    }));
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'running':
        return 'bg-green-100 text-green-800';
      case 'inactive':
      case 'stopped':
        return 'bg-red-100 text-red-800';
      case 'provisioning':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">ECS Management Dashboard</h2>
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
            <label className="text-sm font-medium">ECS Cluster</label>
            <Select value={selectedCluster} onValueChange={setSelectedCluster} disabled={!selectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select a cluster" />
              </SelectTrigger>
              <SelectContent>
                {clusters.map(cluster => (
                  <SelectItem key={cluster.clusterId} value={cluster.clusterName}>
                    {cluster.clusterName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Services Table */}
      {selectedCluster && (
        <Card>
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">ECS Services</h3>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchServices}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <span>🔄</span>
              )}
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Running/Desired</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : services.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      No services found
                    </TableCell>
                  </TableRow>
                ) : (
                  services.map(service => (
                    <TableRow key={service.serviceId}>
                      <TableCell className="font-medium">{service.serviceName}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(service.status)}>
                          {service.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {service.runningCount}/{service.desiredCount}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleServiceAction(service.serviceId, 'start')}
                            disabled={actionLoading === service.serviceId}
                            title="Start service"
                          >
                            {actionLoading === service.serviceId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleServiceAction(service.serviceId, 'stop')}
                            disabled={actionLoading === service.serviceId}
                            title="Stop service"
                          >
                            {actionLoading === service.serviceId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleServiceAction(service.serviceId, 'restart')}
                            disabled={actionLoading === service.serviceId}
                            title="Restart service"
                          >
                            {actionLoading === service.serviceId ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCw className="w-4 h-4" />
                            )}
                          </Button>
                          <Dialog open={scheduleDialog && selectedService?.serviceId === service.serviceId} onOpenChange={setScheduleDialog}>
                            <DialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedService(service)}
                              >
                                <Clock className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Apply Schedule</DialogTitle>
                                <DialogDescription>
                                  Select a schedule for {service.serviceName}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-2">
                                {schedules.length > 0 ? (
                                  schedules.map(schedule => (
                                    <Button
                                      key={schedule.scheduleId}
                                      variant="outline"
                                      className="w-full justify-start"
                                      onClick={() => handleApplySchedule(schedule.scheduleId)}
                                      disabled={actionLoading === service.serviceId}
                                    >
                                      <div className="text-left">
                                        <p className="font-medium">{schedule.scheduleName}</p>
                                        <p className="text-xs text-gray-500">{schedule.startTime} - {schedule.stopTime}</p>
                                      </div>
                                    </Button>
                                  ))
                                ) : (
                                  <p className="text-sm text-gray-500">No schedules available. Create one first.</p>
                                )}
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
              Are you sure you want to {confirmAction?.type} this service?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeAction}>
              {confirmAction?.type === 'start' ? 'Start' : confirmAction?.type === 'stop' ? 'Stop' : 'Restart'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
