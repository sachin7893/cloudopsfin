// CloudWatch Metrics client and analysis logic

import {
  CloudWatchClient,
  GetMetricDataCommand,
  MetricDataQuery,
  MetricStat
} from '@aws-sdk/client-cloudwatch';
import { MetricAnalysis, ServiceType } from './types.js';
import { METRIC_CONFIGS, ANOMALY_THRESHOLD_SIGMA } from './config.js';

export class CloudWatchMetricsService {
  private client: CloudWatchClient;
  
  constructor(region: string = 'ap-south-1') {
    this.client = new CloudWatchClient({ region });
  }
  
  async getMetrics(
    serviceType: ServiceType,
    resourceId: string,
    startTime: Date,
    endTime: Date
  ): Promise<MetricAnalysis[]> {
    const config = METRIC_CONFIGS[serviceType];
    if (!config) {
      throw new Error(`Unsupported service type: ${serviceType}`);
    }
    
    const queries: MetricDataQuery[] = config.metrics.map((metricName, index) => ({
      Id: `m${index}`,
      MetricStat: {
        Metric: {
          Namespace: config.namespace,
          MetricName: metricName,
          Dimensions: [
            {
              Name: config.dimensionName,
              Value: resourceId
            }
          ]
        },
        Period: this.calculatePeriod(startTime, endTime),
        Stat: 'Average'
      } as MetricStat
    }));
    
    try {
      const command = new GetMetricDataCommand({
        MetricDataQueries: queries,
        StartTime: startTime,
        EndTime: endTime
      });
      
      const response = await this.client.send(command);
      
      if (!response.MetricDataResults) {
        return [];
      }
      
      return response.MetricDataResults.map((result, index) => {
        const metricName = config.metrics[index];
        const values = (result.Timestamps || []).map((timestamp, i) => ({
          timestamp: timestamp.toISOString(),
          value: result.Values?.[i] || 0
        }));
        
        const analysis = this.analyzeMetric(values.map(v => v.value));
        
        return {
          resourceId,
          metricName,
          namespace: config.namespace,
          values,
          anomalyDetected: analysis.anomalyDetected,
          thresholdBreached: analysis.thresholdBreached
        };
      });
    } catch (error: any) {
      if (error.name === 'AccessDeniedException') {
        throw new Error('Insufficient permissions to access CloudWatch metrics');
      }
      throw error;
    }
  }
  
  private calculatePeriod(startTime: Date, endTime: Date): number {
    const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    return hours <= 24 ? 300 : 3600; // 5 minutes for <24h, 1 hour for >24h
  }
  
  private analyzeMetric(values: number[]): {
    anomalyDetected: boolean;
    thresholdBreached?: { threshold: number; breachedAt: string };
  } {
    if (values.length === 0) {
      return { anomalyDetected: false };
    }
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = mean + (ANOMALY_THRESHOLD_SIGMA * stdDev);
    
    for (let i = 0; i < values.length; i++) {
      if (values[i] > threshold) {
        return {
          anomalyDetected: true,
          thresholdBreached: {
            threshold,
            breachedAt: new Date(Date.now() - (values.length - i) * 5 * 60 * 1000).toISOString()
          }
        };
      }
    }
    
    return { anomalyDetected: false };
  }
}
