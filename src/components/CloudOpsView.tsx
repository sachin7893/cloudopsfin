import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Cloud, MoreVertical, Play, Square, Calendar } from 'lucide-react';
import {
  fetchEC2Instances,
  fetchEKSClusters,
  fetchECSServices,
} from '@/lib/mockData';
import { EC2Instance, EKSCluster, ECSService } from '@/types';
import { toast } from 'sonner';

export function CloudOpsView() {
  const [ec2Instances, setEc2Instances] = useState<EC2Instance[]>([]);
  const [eksClusters, setEksClusters] = useState<EKSCluster[]>([]);
  const [ecsServices, setEcsServices] = useState<ECSService[]>([]);

  useEffect(() => {
    setEc2Instances(fetchEC2Instances());
    setEksClusters(fetchEKSClusters());
    setEcsServices(fetchECSServices());
  }, []);

  const handleEC2Action = (
    instanceId: string,
    action: 'start' | 'stop' | 'schedule'
  ) => {
    if (action === 'start') {
      setEc2Instances((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId
            ? { ...inst, status: 'Running' }
            : inst
        )
      );
      toast.success(`Starting instance ${instanceId}`);
    } else if (action === 'stop') {
      setEc2Instances((prev) =>
        prev.map((inst) =>
          inst.instanceId === instanceId
            ? { ...inst, status: 'Stopped' }
            : inst
        )
      );
      toast.success(`Stopping instance ${instanceId}`);
    } else if (action === 'schedule') {
      toast.info(`Schedule action for ${instanceId} - Not implemented in demo`);
    }
  };

  const handleSuspendCluster = (clusterId: string, suspend: boolean) => {
    setEksClusters((prev) =>
      prev.map((cluster) =>
        cluster.id === clusterId
          ? {
              ...cluster,
              status: suspend ? 'Suspended' : 'Active',
              nodeCount: suspend ? 0 : 6,
            }
          : cluster
      )
    );
    toast.success(
      suspend
        ? `Suspending cluster (setting node min/max to 0)`
        : `Activating cluster`
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Cloud className="h-6 w-6" />
        <h1 className="text-3xl font-bold">CloudOps Dashboard</h1>
      </div>

      <Tabs defaultValue="ec2" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="ec2">EC2</TabsTrigger>
          <TabsTrigger value="ecs">ECS</TabsTrigger>
          <TabsTrigger value="eks">EKS</TabsTrigger>
        </TabsList>

        <TabsContent value="ec2" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>EC2 Instances</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instance ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ec2Instances.map((instance) => (
                    <TableRow key={instance.id}>
                      <TableCell className="font-mono text-sm">
                        {instance.instanceId}
                      </TableCell>
                      <TableCell>{instance.type}</TableCell>
                      <TableCell>{instance.region}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            instance.status === 'Running'
                              ? 'default'
                              : 'secondary'
                          }
                        >
                          {instance.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                handleEC2Action(instance.instanceId, 'start')
                              }
                              disabled={instance.status === 'Running'}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Start
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleEC2Action(instance.instanceId, 'stop')
                              }
                              disabled={instance.status === 'Stopped'}
                            >
                              <Square className="mr-2 h-4 w-4" />
                              Stop
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                handleEC2Action(instance.instanceId, 'schedule')
                              }
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              Schedule
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ecs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>ECS Services</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service Name</TableHead>
                    <TableHead>Cluster</TableHead>
                    <TableHead>Task Count</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ecsServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell className="font-medium">
                        {service.name}
                      </TableCell>
                      <TableCell>{service.cluster}</TableCell>
                      <TableCell>{service.taskCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            service.status === 'Active' ? 'default' : 'secondary'
                          }
                        >
                          {service.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="eks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>EKS Clusters</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cluster Name</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Node Count</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Suspend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eksClusters.map((cluster) => (
                    <TableRow key={cluster.id}>
                      <TableCell className="font-medium">
                        {cluster.name}
                      </TableCell>
                      <TableCell>{cluster.region}</TableCell>
                      <TableCell>{cluster.nodeCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            cluster.status === 'Active' ? 'default' : 'secondary'
                          }
                        >
                          {cluster.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm text-muted-foreground">
                            {cluster.status === 'Suspended'
                              ? 'Activate'
                              : 'Suspend'}
                          </span>
                          <Switch
                            checked={cluster.status === 'Suspended'}
                            onCheckedChange={(checked) =>
                              handleSuspendCluster(cluster.id, checked)
                            }
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
