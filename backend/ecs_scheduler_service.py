"""DynamoDB-based scheduler service for ECS automation"""

import boto3
from datetime import datetime
from typing import List, Dict, Optional
from uuid import uuid4

class ECSSchedulerService:
    """Service for managing ECS schedules in DynamoDB"""
    
    def __init__(self, region: str = 'ap-south-1', table_name: str = 'ecs-schedules'):
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table_name = table_name
        self.table = self.dynamodb.Table(table_name)
        self.region = region
    
    def create_schedule(
        self,
        cluster_name: str,
        schedule_name: str,
        start_time: str,
        stop_time: str,
        days_of_week: List[str],
        timezone: str = 'UTC'
    ) -> Dict:
        """Create a new schedule in DynamoDB"""
        try:
            schedule_id = str(uuid4())
            now = datetime.utcnow().isoformat()
            
            item = {
                'clusterName': cluster_name,
                'scheduleId': schedule_id,
                'scheduleName': schedule_name,
                'startTime': start_time,
                'stopTime': stop_time,
                'daysOfWeek': days_of_week,
                'timezone': timezone,
                'createdAt': now,
                'updatedAt': now
            }
            
            self.table.put_item(Item=item)
            
            return item
        except Exception as e:
            print(f"Error creating schedule: {e}")
            raise
    
    def get_schedules_by_cluster(self, cluster_name: str) -> List[Dict]:
        """Get all schedules for a cluster"""
        try:
            response = self.table.query(
                KeyConditionExpression='clusterName = :cluster_name',
                ExpressionAttributeValues={
                    ':cluster_name': cluster_name
                }
            )
            
            return response.get('Items', [])
        except Exception as e:
            print(f"Error getting schedules: {e}")
            raise
    
    def get_schedule(self, cluster_name: str, schedule_id: str) -> Optional[Dict]:
        """Get a specific schedule"""
        try:
            response = self.table.get_item(
                Key={
                    'clusterName': cluster_name,
                    'scheduleId': schedule_id
                }
            )
            
            return response.get('Item')
        except Exception as e:
            print(f"Error getting schedule: {e}")
            raise
    
    def update_schedule(
        self,
        cluster_name: str,
        schedule_id: str,
        schedule_name: Optional[str] = None,
        start_time: Optional[str] = None,
        stop_time: Optional[str] = None,
        days_of_week: Optional[List[str]] = None
    ) -> Dict:
        """Update an existing schedule"""
        try:
            update_expr = 'SET updatedAt = :now'
            expr_values = {':now': datetime.utcnow().isoformat()}
            
            if schedule_name:
                update_expr += ', scheduleName = :name'
                expr_values[':name'] = schedule_name
            
            if start_time:
                update_expr += ', startTime = :start'
                expr_values[':start'] = start_time
            
            if stop_time:
                update_expr += ', stopTime = :stop'
                expr_values[':stop'] = stop_time
            
            if days_of_week:
                update_expr += ', daysOfWeek = :days'
                expr_values[':days'] = days_of_week
            
            response = self.table.update_item(
                Key={
                    'clusterName': cluster_name,
                    'scheduleId': schedule_id
                },
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_values,
                ReturnValues='ALL_NEW'
            )
            
            return response.get('Attributes', {})
        except Exception as e:
            print(f"Error updating schedule: {e}")
            raise
    
    def delete_schedule(self, cluster_name: str, schedule_id: str) -> bool:
        """Delete a schedule"""
        try:
            self.table.delete_item(
                Key={
                    'clusterName': cluster_name,
                    'scheduleId': schedule_id
                }
            )
            return True
        except Exception as e:
            print(f"Error deleting schedule: {e}")
            raise
    
    def create_schedule_association(
        self,
        service_arn: str,
        schedule_id: str,
        cluster_name: str
    ) -> Dict:
        """Create an association between a service and a schedule"""
        try:
            association_table = self.dynamodb.Table('ecs-schedule-associations')
            
            item = {
                'serviceArn': service_arn,
                'scheduleId': schedule_id,
                'clusterName': cluster_name,
                'createdAt': datetime.utcnow().isoformat()
            }
            
            association_table.put_item(Item=item)
            
            return item
        except Exception as e:
            print(f"Error creating schedule association: {e}")
            raise
    
    def get_service_schedule(self, service_arn: str) -> Optional[Dict]:
        """Get the schedule associated with a service"""
        try:
            association_table = self.dynamodb.Table('ecs-schedule-associations')
            
            response = association_table.get_item(
                Key={'serviceArn': service_arn}
            )
            
            return response.get('Item')
        except Exception as e:
            print(f"Error getting service schedule: {e}")
            raise
    
    def delete_schedule_association(self, service_arn: str) -> bool:
        """Remove schedule association from a service"""
        try:
            association_table = self.dynamodb.Table('ecs-schedule-associations')
            
            association_table.delete_item(
                Key={'serviceArn': service_arn}
            )
            
            return True
        except Exception as e:
            print(f"Error deleting schedule association: {e}")
            raise
