"""AWS ECS management service"""

import boto3
from typing import List, Dict, Optional

class ECSManagementService:
    """Service for managing ECS clusters and services"""
    
    def __init__(self, region: str = 'ap-south-1'):
        self.ecs_client = boto3.client('ecs', region_name=region)
        self.ec2_client = boto3.client('ec2', region_name=region)
        self.region = region
    
    def get_accounts(self) -> List[Dict]:
        """Get list of AWS accounts"""
        try:
            # In a real scenario, this would query AWS Organizations
            # For now, return mock data or configured accounts
            sts = boto3.client('sts')
            account_id = sts.get_caller_identity()['Account']
            
            return [
                {
                    'accountId': account_id,
                    'accountName': 'Primary Account'
                }
            ]
        except Exception as e:
            print(f"Error getting accounts: {e}")
            raise
    
    def get_clusters(self, account_id: str) -> List[Dict]:
        """Get ECS clusters for an account"""
        try:
            response = self.ecs_client.list_clusters()
            cluster_arns = response.get('clusterArns', [])
            
            clusters = []
            for arn in cluster_arns:
                cluster_name = arn.split('/')[-1]
                clusters.append({
                    'clusterId': arn,
                    'clusterName': cluster_name,
                    'region': self.region,
                    'status': 'Active'
                })
            
            return clusters
        except Exception as e:
            print(f"Error getting clusters: {e}")
            raise
    
    def get_services(self, cluster_name: str) -> List[Dict]:
        """Get ECS services for a cluster"""
        try:
            response = self.ecs_client.list_services(cluster=cluster_name)
            service_arns = response.get('serviceArns', [])
            
            services = []
            for arn in service_arns:
                service_name = arn.split('/')[-1]
                
                # Get service details
                service_details = self.ecs_client.describe_services(
                    cluster=cluster_name,
                    services=[arn]
                )
                
                if service_details['services']:
                    service = service_details['services'][0]
                    services.append({
                        'serviceId': arn,
                        'serviceName': service_name,
                        'clusterName': cluster_name,
                        'status': service.get('status', 'UNKNOWN'),
                        'taskCount': service.get('taskCount', 0),
                        'desiredCount': service.get('desiredCount', 0),
                        'runningCount': service.get('runningCount', 0)
                    })
            
            return services
        except Exception as e:
            print(f"Error getting services: {e}")
            raise
    
    def start_service(self, cluster_name: str, service_name: str, desired_count: int = 1) -> Dict:
        """Start an ECS service by setting desired count"""
        try:
            response = self.ecs_client.update_service(
                cluster=cluster_name,
                service=service_name,
                desiredCount=desired_count
            )
            
            return {
                'serviceId': response['service']['serviceArn'],
                'status': response['service']['status'],
                'desiredCount': response['service']['desiredCount']
            }
        except Exception as e:
            print(f"Error starting service: {e}")
            raise
    
    def stop_service(self, cluster_name: str, service_name: str) -> Dict:
        """Stop an ECS service by setting desired count to 0"""
        try:
            response = self.ecs_client.update_service(
                cluster=cluster_name,
                service=service_name,
                desiredCount=0
            )
            
            return {
                'serviceId': response['service']['serviceArn'],
                'status': response['service']['status'],
                'desiredCount': response['service']['desiredCount']
            }
        except Exception as e:
            print(f"Error stopping service: {e}")
            raise
    
    def restart_service(self, cluster_name: str, service_name: str) -> Dict:
        """Restart an ECS service by forcing a new deployment"""
        try:
            response = self.ecs_client.update_service(
                cluster=cluster_name,
                service=service_name,
                forceNewDeployment=True
            )
            
            return {
                'serviceId': response['service']['serviceArn'],
                'status': response['service']['status'],
                'deployments': len(response['service'].get('deployments', []))
            }
        except Exception as e:
            print(f"Error restarting service: {e}")
            raise
    
    def tag_service_with_schedule(self, service_arn: str, schedule_id: str, schedule_name: str) -> Dict:
        """Tag an ECS service with schedule information"""
        try:
            self.ecs_client.tag_resource(
                resourceArn=service_arn,
                tags=[
                    {
                        'key': 'schedule-id',
                        'value': schedule_id
                    },
                    {
                        'key': 'schedule-name',
                        'value': schedule_name
                    }
                ]
            )
            
            return {
                'serviceArn': service_arn,
                'scheduleId': schedule_id,
                'scheduleName': schedule_name
            }
        except Exception as e:
            print(f"Error tagging service: {e}")
            raise
