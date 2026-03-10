// Query parsing logic to extract service type, resource ID, and time range

import { ParsedQuery, ServiceType } from './types.js';
import { DEFAULT_TIME_RANGE_HOURS } from './config.js';

const SERVICE_KEYWORDS: Record<ServiceType, string[]> = {
  EC2: ['ec2', 'instance', 'instances'],
  ECS: ['ecs', 'container', 'service', 'task'],
  EKS: ['eks', 'kubernetes', 'k8s', 'cluster'],
  RDS: ['rds', 'database', 'db'],
  Lambda: ['lambda', 'function']
};

const RESOURCE_ID_PATTERNS: Record<ServiceType, RegExp> = {
  EC2: /i-[a-z0-9]{8,17}/i,
  ECS: /arn:aws:ecs:[^:]+:[^:]+:(service|task)\/[^\s]+/i,
  EKS: /[a-zA-Z0-9][\w-]{0,99}/,
  RDS: /[a-zA-Z][a-zA-Z0-9-]{0,62}/,
  Lambda: /[a-zA-Z0-9-_]{1,64}/
};

const TIME_PATTERNS = [
  { pattern: /last\s+(\d+)\s+hour(s)?/i, multiplier: 1 },
  { pattern: /last\s+(\d+)\s+day(s)?/i, multiplier: 24 },
  { pattern: /past\s+(\d+)\s+hour(s)?/i, multiplier: 1 },
  { pattern: /past\s+(\d+)\s+day(s)?/i, multiplier: 24 },
  { pattern: /since\s+yesterday/i, multiplier: 24, value: 24 }
];

export function parseQuery(query: string, conversationContext?: any): ParsedQuery {
  const lowerQuery = query.toLowerCase();
  
  // Extract service type
  let serviceType: ServiceType | undefined;
  for (const [service, keywords] of Object.entries(SERVICE_KEYWORDS)) {
    if (keywords.some(keyword => lowerQuery.includes(keyword))) {
      serviceType = service as ServiceType;
      break;
    }
  }
  
  // Use context if service type not found in current query
  if (!serviceType && conversationContext?.lastServiceType) {
    serviceType = conversationContext.lastServiceType;
  }
  
  // Extract resource ID
  let resourceId: string | undefined;
  if (serviceType) {
    const pattern = RESOURCE_ID_PATTERNS[serviceType];
    const match = query.match(pattern);
    if (match) {
      resourceId = match[0];
    }
  }
  
  // Use context if resource ID not found in current query
  if (!resourceId && conversationContext?.lastResourceId) {
    resourceId = conversationContext.lastResourceId;
  }
  
  // Extract time range
  const timeRange = parseTimeRange(query);
  
  return {
    serviceType,
    resourceId,
    timeRange,
    rawQuery: query
  };
}

function parseTimeRange(query: string): { start: Date; end: Date } {
  const end = new Date();
  let hours = DEFAULT_TIME_RANGE_HOURS;
  
  for (const { pattern, multiplier, value } of TIME_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      hours = value || (parseInt(match[1]) * multiplier);
      break;
    }
  }
  
  const start = new Date(end.getTime() - hours * 60 * 60 * 1000);
  
  return { start, end };
}

export function extractServiceAndResource(query: string): {
  serviceType?: ServiceType;
  resourceId?: string;
} {
  const parsed = parseQuery(query);
  return {
    serviceType: parsed.serviceType,
    resourceId: parsed.resourceId
  };
}
