"""CloudWatch Metrics client and analysis logic"""

import boto3
from datetime import datetime
from typing import List, Dict, Optional
from config import METRIC_CONFIGS, ANOMALY_THRESHOLD_SIGMA
import statistics


class CloudWatchMetricsService:
    """Service for querying and analyzing CloudWatch metrics"""
    
    def __init__(self, region: str = 'ap-south-1'):
        self.client = boto3.client('cloudwatch', region_name=region)
        self.region = region
    
    def get_metrics(
        self,
        service_type: str,
        resource_id: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict]:
        """Fetch CloudWatch metrics for a resource"""
        config = METRIC_CONFIGS.get(service_type)
        if not config:
            raise ValueError(f"Unsupported service type: {service_type}")
        
        period = self._calculate_period(start_time, end_time)
        metric_data_queries = []
        
        for idx, metric_name in enumerate(config['metrics']):
            metric_data_queries.append({
                'Id': f'm{idx}',
                'MetricStat': {
                    'Metric': {
                        'Namespace': config['namespace'],
                        'MetricName': metric_name,
                        'Dimensions': [
                            {
                                'Name': config['dimension_name'],
                                'Value': resource_id
                            }
                        ]
                    },
                    'Period': period,
                    'Stat': 'Average'
                }
            })
        
        try:
            response = self.client.get_metric_data(
                MetricDataQueries=metric_data_queries,
                StartTime=start_time,
                EndTime=end_time
            )
            
            results = []
            for idx, result in enumerate(response.get('MetricDataResults', [])):
                metric_name = config['metrics'][idx]
                
                values = [
                    {
                        'timestamp': ts.isoformat(),
                        'value': val
                    }
                    for ts, val in zip(result.get('Timestamps', []), result.get('Values', []))
                ]
                
                analysis = self._analyze_metric([v['value'] for v in values])
                
                metric_analysis = {
                    'resourceId': resource_id,
                    'metricName': metric_name,
                    'namespace': config['namespace'],
                    'values': values,
                    'anomalyDetected': analysis['anomaly_detected']
                }
                
                if analysis.get('threshold_breached'):
                    metric_analysis['thresholdBreached'] = analysis['threshold_breached']
                
                results.append(metric_analysis)
            
            return results
            
        except self.client.exceptions.ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'AccessDeniedException':
                raise PermissionError('Insufficient permissions to access CloudWatch metrics')
            raise
    
    def _calculate_period(self, start_time: datetime, end_time: datetime) -> int:
        """Calculate appropriate period based on time range"""
        hours = (end_time - start_time).total_seconds() / 3600
        return 300 if hours <= 24 else 3600  # 5 minutes for <24h, 1 hour for >24h
    
    def _analyze_metric(self, values: List[float]) -> Dict:
        """Analyze metric values for anomalies"""
        if not values:
            return {'anomaly_detected': False}
        
        mean = statistics.mean(values)
        
        if len(values) < 2:
            return {'anomaly_detected': False}
        
        stdev = statistics.stdev(values)
        threshold = mean + (ANOMALY_THRESHOLD_SIGMA * stdev)
        
        for idx, value in enumerate(values):
            if value > threshold:
                return {
                    'anomaly_detected': True,
                    'threshold_breached': {
                        'threshold': threshold,
                        'breachedAt': datetime.utcnow().isoformat()
                    }
                }
        
        return {'anomaly_detected': False}
