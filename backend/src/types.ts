// Type definitions for CloudOps Chat API

export interface CloudOpsChatRequest {
  message: string;
  conversationContext: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    sessionId: string;
  };
  awsRegion?: string;
}

export interface CloudOpsChatResponse {
  message: string;
  metrics?: MetricAnalysis[];
  logs?: LogExcerpt[];
  recommendations?: Remediation[];
  error?: string;
}

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

export type ServiceType = 'EC2' | 'ECS' | 'EKS' | 'RDS' | 'Lambda';

export interface ParsedQuery {
  serviceType?: ServiceType;
  resourceId?: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  rawQuery: string;
}
