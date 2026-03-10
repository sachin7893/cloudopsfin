// CloudWatch Logs client and query logic

import {
  CloudWatchLogsClient,
  StartQueryCommand,
  GetQueryResultsCommand,
  QueryStatus
} from '@aws-sdk/client-cloudwatch-logs';
import { LogExcerpt, ServiceType } from './types.js';
import { LOG_GROUP_PATTERNS, MAX_LOG_RESULTS } from './config.js';

export class CloudWatchLogsService {
  private client: CloudWatchLogsClient;
  
  constructor(region: string = 'ap-south-1') {
    this.client = new CloudWatchLogsClient({ region });
  }
  
  async queryLogs(
    serviceType: ServiceType,
    resourceId: string,
    startTime: Date,
    endTime: Date
  ): Promise<LogExcerpt[]> {
    const logGroupPattern = LOG_GROUP_PATTERNS[serviceType];
    const logGroupName = this.constructLogGroupName(serviceType, resourceId, logGroupPattern);
    
    const queryString = `
      fields @timestamp, @message, @logStream
      | filter @message like /ERROR|Exception|Failed|WARN/
      | sort @timestamp desc
      | limit ${MAX_LOG_RESULTS}
    `;
    
    try {
      const startQueryCommand = new StartQueryCommand({
        logGroupName,
        startTime: Math.floor(startTime.getTime() / 1000),
        endTime: Math.floor(endTime.getTime() / 1000),
        queryString
      });
      
      const startResponse = await this.client.send(startQueryCommand);
      const queryId = startResponse.queryId;
      
      if (!queryId) {
        return [];
      }
      
      // Poll for query results
      let status: QueryStatus | undefined = QueryStatus.Running;
      let attempts = 0;
      const maxAttempts = 20;
      
      while (status === QueryStatus.Running && attempts < maxAttempts) {
        await this.sleep(500);
        
        const getResultsCommand = new GetQueryResultsCommand({ queryId });
        const resultsResponse = await this.client.send(getResultsCommand);
        status = resultsResponse.status;
        
        if (status === QueryStatus.Complete) {
          return this.parseLogResults(resultsResponse.results || [], logGroupName);
        }
        
        attempts++;
      }
      
      return [];
    } catch (error: any) {
      if (error.name === 'AccessDeniedException') {
        throw new Error('Insufficient permissions to access CloudWatch logs');
      }
      if (error.name === 'ResourceNotFoundException') {
        return []; // Log group doesn't exist, return empty
      }
      throw error;
    }
  }
  
  private constructLogGroupName(
    serviceType: ServiceType,
    resourceId: string,
    pattern: string
  ): string {
    switch (serviceType) {
      case 'Lambda':
        return `/aws/lambda/${resourceId}`;
      case 'RDS':
        return `/aws/rds/instance/${resourceId}/error`;
      case 'EKS':
        return `/aws/eks/${resourceId}/cluster`;
      default:
        return pattern + resourceId;
    }
  }
  
  private parseLogResults(results: any[], logGroupName: string): LogExcerpt[] {
    return results.map(result => {
      const fields = result as Array<{ field: string; value: string }>;
      const timestamp = fields.find(f => f.field === '@timestamp')?.value || '';
      const message = fields.find(f => f.field === '@message')?.value || '';
      const logStream = fields.find(f => f.field === '@logStream')?.value || '';
      
      const level = this.determineLogLevel(message);
      
      return {
        logGroup: logGroupName,
        logStream,
        timestamp,
        message,
        level
      };
    });
  }
  
  private determineLogLevel(message: string): 'ERROR' | 'WARN' | 'INFO' {
    const upperMessage = message.toUpperCase();
    if (upperMessage.includes('ERROR') || upperMessage.includes('EXCEPTION') || upperMessage.includes('FAILED')) {
      return 'ERROR';
    }
    if (upperMessage.includes('WARN')) {
      return 'WARN';
    }
    return 'INFO';
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
