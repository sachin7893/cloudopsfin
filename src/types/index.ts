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

// CloudOps Troubleshooting Chat Types

export interface MetricAnalysis {
  resourceId: string;
  metricName: string;
  namespace: string;
  values: Array<{
    timestamp: string;
    value: number;
  }>;
  anomalyDetected: boolean;
  thresholdBreached?: {
    threshold: number;
    breachedAt: string;
  };
}

export interface LogExcerpt {
  logGroup: string;
  logStream: string;
  timestamp: string;
  message: string;
  level: 'ERROR' | 'WARN' | 'INFO';
}

export interface Remediation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  steps: string[];
  awsCliCommand?: string;
  consoleLink?: string;
}

export interface CloudOpsChatMessage extends ChatMessage {
  metrics?: MetricAnalysis[];
  logs?: LogExcerpt[];
  recommendations?: Remediation[];
}

export interface ConversationContext {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  lastResourceId?: string;
  lastServiceType?: string;
  createdAt: string;
  expiresAt: string;
}

// EC2 Management Dashboard Types

export interface EC2InstanceDetail {
  instanceId: string;
  instanceType: string;
  state: 'running' | 'stopped' | 'stopping' | 'pending' | 'terminated';
  launchTime: string;
  tags: Record<string, string>;
  applicationName?: string;
  scheduleId?: string;
  scheduleName?: string;
  accountId: string;
  region: string;
}

export interface Schedule {
  scheduleId: string;
  applicationName: string;
  scheduleName: string;
  startTime: string; // HH:MM format
  stopTime: string;  // HH:MM format
  daysOfWeek: string[]; // ['Monday', 'Tuesday', ...]
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleAssociation {
  instanceId: string;
  scheduleId: string;
  applicationName: string;
  createdAt: string;
}

export interface AWSAccount {
  accountId: string;
  accountName: string;
  region: string;
}
