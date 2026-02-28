export interface CostData {
  date: string;
  compute: number;
  storage: number;
  network: number;
}

export interface EC2Instance {
  id: string;
  instanceId: string;
  status: 'Running' | 'Stopped';
  type: string;
  region: string;
}

export interface EKSCluster {
  id: string;
  name: string;
  status: 'Active' | 'Suspended';
  nodeCount: number;
  region: string;
}

export interface ECSService {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
  taskCount: number;
  cluster: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
