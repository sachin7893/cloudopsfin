// Configuration for CloudWatch metrics and logs

import { ServiceType } from './types.js';

export const METRIC_CONFIGS: Record<ServiceType, {
  namespace: string;
  metrics: string[];
  dimensionName: string;
}> = {
  EC2: {
    namespace: 'AWS/EC2',
    metrics: ['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadBytes', 'DiskWriteBytes'],
    dimensionName: 'InstanceId'
  },
  ECS: {
    namespace: 'AWS/ECS',
    metrics: ['CPUUtilization', 'MemoryUtilization'],
    dimensionName: 'ServiceName'
  },
  EKS: {
    namespace: 'ContainerInsights',
    metrics: ['node_cpu_utilization', 'node_memory_utilization', 'pod_cpu_utilization'],
    dimensionName: 'ClusterName'
  },
  RDS: {
    namespace: 'AWS/RDS',
    metrics: ['CPUUtilization', 'DatabaseConnections', 'FreeableMemory', 'ReadLatency', 'WriteLatency'],
    dimensionName: 'DBInstanceIdentifier'
  },
  Lambda: {
    namespace: 'AWS/Lambda',
    metrics: ['Invocations', 'Errors', 'Duration', 'Throttles', 'ConcurrentExecutions'],
    dimensionName: 'FunctionName'
  }
};

export const LOG_GROUP_PATTERNS: Record<ServiceType, string> = {
  EC2: '/aws/ec2/',
  ECS: '/aws/ecs/',
  EKS: '/aws/eks/',
  RDS: '/aws/rds/instance/',
  Lambda: '/aws/lambda/'
};

export const DEFAULT_TIME_RANGE_HOURS = 24;
export const MAX_LOG_RESULTS = 50;
export const ANOMALY_THRESHOLD_SIGMA = 2;
export const TIMEOUT_MS = 10000;
