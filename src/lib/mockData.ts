import { CostData, EC2Instance, EKSCluster, ECSService } from '@/types';

export const fetchCostData = (): CostData[] => {
  const data: CostData[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split('T')[0],
      compute: Math.floor(Math.random() * 5000) + 8000,
      storage: Math.floor(Math.random() * 2000) + 3000,
      network: Math.floor(Math.random() * 1500) + 1000,
    });
  }

  return data;
};

export const fetchEC2Instances = (): EC2Instance[] => {
  return [
    {
      id: '1',
      instanceId: 'i-0a1b2c3d4e5f6g7h8',
      status: 'Running',
      type: 't3.large',
      region: 'us-east-1',
    },
    {
      id: '2',
      instanceId: 'i-9i8h7g6f5e4d3c2b1',
      status: 'Running',
      type: 't3.xlarge',
      region: 'us-west-2',
    },
    {
      id: '3',
      instanceId: 'i-1a2b3c4d5e6f7g8h9',
      status: 'Stopped',
      type: 't3.medium',
      region: 'us-east-1',
    },
    {
      id: '4',
      instanceId: 'i-9h8g7f6e5d4c3b2a1',
      status: 'Running',
      type: 'm5.large',
      region: 'eu-west-1',
    },
  ];
};

export const fetchEKSClusters = (): EKSCluster[] => {
  return [
    {
      id: '1',
      name: 'prod-cluster-01',
      status: 'Active',
      nodeCount: 12,
      region: 'us-east-1',
    },
    {
      id: '2',
      name: 'staging-cluster-01',
      status: 'Active',
      nodeCount: 6,
      region: 'us-west-2',
    },
    {
      id: '3',
      name: 'dev-cluster-01',
      status: 'Suspended',
      nodeCount: 0,
      region: 'us-east-1',
    },
  ];
};

export const fetchECSServices = (): ECSService[] => {
  return [
    {
      id: '1',
      name: 'web-service',
      status: 'Active',
      taskCount: 8,
      cluster: 'prod-cluster',
    },
    {
      id: '2',
      name: 'api-service',
      status: 'Active',
      taskCount: 12,
      cluster: 'prod-cluster',
    },
    {
      id: '3',
      name: 'worker-service',
      status: 'Active',
      taskCount: 4,
      cluster: 'staging-cluster',
    },
    {
      id: '4',
      name: 'batch-service',
      status: 'Inactive',
      taskCount: 0,
      cluster: 'dev-cluster',
    },
  ];
};
