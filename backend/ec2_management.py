"""EC2 Management service for instance operations"""

import boto3
from typing import List, Dict, Optional
from datetime import datetime

class EC2ManagementService:
    """Service for EC2 instance management operations"""
    
    def __init__(self, region: str = 'ap-south-1'):
        self.ec2_client = boto3.client('ec2', region_name=region)
        self.region = region
    
    def get_accounts(self) -> List[Dict]:
        """Get list of AWS accounts (mock - would use AWS Organizations in production)"""
        # In production, use AWS Organizations API
        return [
            {
                'accountId': '290768402661',
                'accountName': 'Production',
                'region': 'ap-south-1'
            },
            {
                'accountId': '123456789012',
                'accountName': 'Development',
                'region': 'ap-south-1'
            }
        ]
    
    def get_application_names(self, account_id: str) -> List[str]:
        """Get unique application_name tag values from EC2 instances"""
        try:
            response = self.ec2_client.describe_instances(
                Filters=[
                    {
                        'Name': 'tag-key',
                        'Values': ['application_name']
                    },
                    {
                        'Name': 'instance-state-name',
                        'Values': ['running', 'stopped']
                    }
                ]
            )
            
            app_names = set()
            for reservation in response.get('Reservations', []):
                for instance in reservation.get('Instances', []):
                    tags = {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
                    if 'application_name' in tags:
                        app_names.add(tags['application_name'])
            
            return sorted(list(app_names))
        except Exception as e:
            print(f"Error getting application names: {e}")
            return []
    
    def get_instances(self, account_id: str, application_name: str) -> List[Dict]:
        """Get EC2 instances filtered by application_name tag"""
        try:
            response = self.ec2_client.describe_instances(
                Filters=[
                    {
                        'Name': 'tag:application_name',
                        'Values': [application_name]
                    },
                    {
                        'Name': 'instance-state-name',
                        'Values': ['running', 'stopped', 'stopping', 'pending']
                    }
                ]
            )
            
            instances = []
            for reservation in response.get('Reservations', []):
                for instance in reservation.get('Instances', []):
                    tags = {tag['Key']: tag['Value'] for tag in instance.get('Tags', [])}
                    
                    instances.append({
                        'instanceId': instance['InstanceId'],
                        'instanceType': instance['InstanceType'],
                        'state': instance['State']['Name'],
                        'launchTime': instance['LaunchTime'].isoformat(),
                        'tags': tags,
                        'applicationName': tags.get('application_name'),
                        'scheduleId': tags.get('schedule_id'),
                        'scheduleName': tags.get('schedule_name'),
                        'accountId': account_id,
                        'region': self.region
                    })
            
            return instances
        except Exception as e:
            print(f"Error getting instances: {e}")
            raise
    
    def start_instance(self, instance_id: str) -> Dict:
        """Start an EC2 instance"""
        try:
            response = self.ec2_client.start_instances(InstanceIds=[instance_id])
            return {
                'success': True,
                'instanceId': instance_id,
                'state': response['StartingInstances'][0]['CurrentState']['Name']
            }
        except Exception as e:
            print(f"Error starting instance: {e}")
            raise
    
    def stop_instance(self, instance_id: str) -> Dict:
        """Stop an EC2 instance"""
        try:
            response = self.ec2_client.stop_instances(InstanceIds=[instance_id])
            return {
                'success': True,
                'instanceId': instance_id,
                'state': response['StoppingInstances'][0]['CurrentState']['Name']
            }
        except Exception as e:
            print(f"Error stopping instance: {e}")
            raise
    
    def modify_instance_type(self, instance_id: str, new_instance_type: str) -> Dict:
        """Modify EC2 instance type (requires instance to be stopped)"""
        try:
            # First, check instance state
            response = self.ec2_client.describe_instances(InstanceIds=[instance_id])
            instance = response['Reservations'][0]['Instances'][0]
            
            if instance['State']['Name'] != 'stopped':
                raise ValueError('Instance must be stopped to modify instance type')
            
            # Modify the instance type
            self.ec2_client.modify_instance_attribute(
                InstanceId=instance_id,
                InstanceType={'Value': new_instance_type}
            )
            
            return {
                'success': True,
                'instanceId': instance_id,
                'newInstanceType': new_instance_type
            }
        except Exception as e:
            print(f"Error modifying instance type: {e}")
            raise
    
    def tag_instance_with_schedule(self, instance_id: str, schedule_id: str, schedule_name: str) -> Dict:
        """Tag an instance with schedule information"""
        try:
            self.ec2_client.create_tags(
                Resources=[instance_id],
                Tags=[
                    {'Key': 'schedule_id', 'Value': schedule_id},
                    {'Key': 'schedule_name', 'Value': schedule_name}
                ]
            )
            
            return {
                'success': True,
                'instanceId': instance_id,
                'scheduleId': schedule_id,
                'scheduleName': schedule_name
            }
        except Exception as e:
            print(f"Error tagging instance: {e}")
            raise
