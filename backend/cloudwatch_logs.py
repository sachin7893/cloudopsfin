"""CloudWatch Logs client and query logic"""

import boto3
import time
from datetime import datetime
from typing import List, Dict, Optional
from config import LOG_GROUP_PATTERNS, MAX_LOG_RESULTS


class CloudWatchLogsService:
    """Service for querying CloudWatch logs"""
    
    def __init__(self, region: str = 'ap-south-1'):
        self.client = boto3.client('logs', region_name=region)
        self.region = region
    
    def query_logs(
        self,
        service_type: str,
        resource_id: str,
        start_time: datetime,
        end_time: datetime
    ) -> List[Dict]:
        """Query CloudWatch logs for a resource"""
        log_group_name = self._construct_log_group_name(service_type, resource_id)
        
        query_string = f"""
            fields @timestamp, @message, @logStream
            | filter @message like /ERROR|Exception|Failed|WARN/
            | sort @timestamp desc
            | limit {MAX_LOG_RESULTS}
        """
        
        try:
            # Start the query
            start_response = self.client.start_query(
                logGroupName=log_group_name,
                startTime=int(start_time.timestamp()),
                endTime=int(end_time.timestamp()),
                queryString=query_string
            )
            
            query_id = start_response.get('queryId')
            if not query_id:
                return []
            
            # Poll for results
            max_attempts = 20
            for attempt in range(max_attempts):
                time.sleep(0.5)
                
                results_response = self.client.get_query_results(queryId=query_id)
                status = results_response.get('status')
                
                if status == 'Complete':
                    return self._parse_log_results(
                        results_response.get('results', []),
                        log_group_name
                    )
                elif status == 'Failed':
                    return []
            
            return []
            
        except self.client.exceptions.ResourceNotFoundException:
            # Log group doesn't exist
            return []
        except self.client.exceptions.ClientError as e:
            error_code = e.response['Error']['Code']
            if error_code == 'AccessDeniedException':
                raise PermissionError('Insufficient permissions to access CloudWatch logs')
            raise
    
    def _construct_log_group_name(self, service_type: str, resource_id: str) -> str:
        """Construct log group name based on service type and resource ID"""
        pattern = LOG_GROUP_PATTERNS.get(service_type, '')
        
        if service_type == 'Lambda':
            return f'/aws/lambda/{resource_id}'
        elif service_type == 'RDS':
            return f'/aws/rds/instance/{resource_id}/error'
        elif service_type == 'EKS':
            return f'/aws/eks/{resource_id}/cluster'
        else:
            return f'{pattern}{resource_id}'
    
    def _parse_log_results(self, results: List[List[Dict]], log_group_name: str) -> List[Dict]:
        """Parse CloudWatch Logs Insights query results"""
        parsed_logs = []
        
        for result in results:
            fields = {field['field']: field['value'] for field in result}
            
            timestamp = fields.get('@timestamp', '')
            message = fields.get('@message', '')
            log_stream = fields.get('@logStream', '')
            
            level = self._determine_log_level(message)
            
            parsed_logs.append({
                'logGroup': log_group_name,
                'logStream': log_stream,
                'timestamp': timestamp,
                'message': message,
                'level': level
            })
        
        return parsed_logs
    
    def _determine_log_level(self, message: str) -> str:
        """Determine log level from message content"""
        upper_message = message.upper()
        
        if any(keyword in upper_message for keyword in ['ERROR', 'EXCEPTION', 'FAILED']):
            return 'ERROR'
        elif 'WARN' in upper_message:
            return 'WARN'
        else:
            return 'INFO'
