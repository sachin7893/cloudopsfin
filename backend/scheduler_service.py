"""DynamoDB-based scheduler service for EC2 automation"""

import boto3
import json
from datetime import datetime
from typing import List, Dict, Optional
from uuid import uuid4

class SchedulerService:
    """Service for managing EC2 schedules in DynamoDB"""
    
    def __init__(self, region: str = 'ap-south-1', table_name: str = 'ec2-schedules'):
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table_name = table_name
        self.table = self.dynamodb.Table(table_name)
        self.region = region
    
    def create_schedule(
        self,
        application_name: str,
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
                'applicationName': application_name,
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
    
    def get_schedules_by_application(self, application_name: str) -> List[Dict]:
        """Get all schedules for an application"""
        try:
            response = self.table.query(
                KeyConditionExpression='applicationName = :app_name',
                ExpressionAttributeValues={
                    ':app_name': application_name
                }
            )
            
            return response.get('Items', [])
        except Exception as e:
            print(f"Error getting schedules: {e}")
            raise
    
    def get_schedule(self, application_name: str, schedule_id: str) -> Optional[Dict]:
        """Get a specific schedule"""
        try:
            response = self.table.get_item(
                Key={
                    'applicationName': application_name,
                    'scheduleId': schedule_id
                }
            )
            
            return response.get('Item')
        except Exception as e:
            print(f"Error getting schedule: {e}")
            raise
    
    def update_schedule(
        self,
        application_name: str,
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
                    'applicationName': application_name,
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
    
    def delete_schedule(self, application_name: str, schedule_id: str) -> bool:
        """Delete a schedule"""
        try:
            self.table.delete_item(
                Key={
                    'applicationName': application_name,
                    'scheduleId': schedule_id
                }
            )
            return True
        except Exception as e:
            print(f"Error deleting schedule: {e}")
            raise
    
    def create_schedule_association(
        self,
        instance_id: str,
        schedule_id: str,
        application_name: str
    ) -> Dict:
        """Create an association between an instance and a schedule"""
        try:
            association_table = self.dynamodb.Table('ec2-schedule-associations')
            
            item = {
                'instanceId': instance_id,
                'scheduleId': schedule_id,
                'applicationName': application_name,
                'createdAt': datetime.utcnow().isoformat()
            }
            
            association_table.put_item(Item=item)
            
            return item
        except Exception as e:
            print(f"Error creating schedule association: {e}")
            raise
    
    def get_instance_schedule(self, instance_id: str) -> Optional[Dict]:
        """Get the schedule associated with an instance"""
        try:
            association_table = self.dynamodb.Table('ec2-schedule-associations')
            
            response = association_table.get_item(
                Key={'instanceId': instance_id}
            )
            
            return response.get('Item')
        except Exception as e:
            print(f"Error getting instance schedule: {e}")
            raise
    
    def delete_schedule_association(self, instance_id: str) -> bool:
        """Remove schedule association from an instance"""
        try:
            association_table = self.dynamodb.Table('ec2-schedule-associations')
            
            association_table.delete_item(
                Key={'instanceId': instance_id}
            )
            
            return True
        except Exception as e:
            print(f"Error deleting schedule association: {e}")
            raise
