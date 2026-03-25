"""Lambda handler for ECS management API endpoints"""

import json
import traceback
from typing import Dict, Any
from ecs_management import ECSManagementService
from ecs_scheduler_service import ECSSchedulerService

# Initialize services
ecs_service = ECSManagementService()
scheduler_service = ECSSchedulerService()

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for ECS management endpoints"""
    print(f"Received event: {json.dumps(event)}")
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    }
    
    # Handle CORS
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    try:
        path = event.get('path', '')
        method = event.get('httpMethod', '')
        query_params = event.get('queryStringParameters', {}) or {}
        body = json.loads(event.get('body', '{}')) if event.get('body') else {}
        
        # Route to appropriate handler
        if path == '/ecs/accounts' and method == 'GET':
            return handle_get_accounts(headers)
        
        elif path == '/ecs/clusters' and method == 'GET':
            return handle_get_clusters(query_params, headers)
        
        elif path == '/ecs/services' and method == 'GET':
            return handle_get_services(query_params, headers)
        
        elif path == '/ecs/service-action' and method == 'POST':
            return handle_service_action(body, headers)
        
        elif path == '/ecs/schedules' and method == 'GET':
            return handle_get_schedules(query_params, headers)
        
        elif path == '/ecs/apply-schedule' and method == 'POST':
            return handle_apply_schedule(body, headers)
        
        elif path == '/ecs/create-schedule' and method == 'POST':
            return handle_create_schedule(body, headers)
        
        else:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Endpoint not found'})
            }
    
    except Exception as e:
        print(f"Error: {str(e)}")
        print(traceback.format_exc())
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error'})
        }


def handle_get_accounts(headers: Dict) -> Dict[str, Any]:
    """Get list of AWS accounts"""
    try:
        accounts = ecs_service.get_accounts()
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'accounts': accounts})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_get_clusters(query_params: Dict, headers: Dict) -> Dict[str, Any]:
    """Get ECS clusters for an account"""
    try:
        account_id = query_params.get('accountId')
        if not account_id:
            return error_response('accountId is required', headers, 400)
        
        clusters = ecs_service.get_clusters(account_id)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'clusters': clusters})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_get_services(query_params: Dict, headers: Dict) -> Dict[str, Any]:
    """Get ECS services for a cluster"""
    try:
        cluster_name = query_params.get('clusterName')
        
        if not cluster_name:
            return error_response('clusterName is required', headers, 400)
        
        services = ecs_service.get_services(cluster_name)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'services': services})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_service_action(body: Dict, headers: Dict) -> Dict[str, Any]:
    """Handle start/stop/restart service actions"""
    try:
        service_id = body.get('serviceId')
        action = body.get('action')
        cluster_name = body.get('clusterName')
        
        if not service_id or not action or not cluster_name:
            return error_response('serviceId, action, and clusterName are required', headers, 400)
        
        # Extract service name from ARN
        service_name = service_id.split('/')[-1]
        
        if action == 'start':
            result = ecs_service.start_service(cluster_name, service_name)
        elif action == 'stop':
            result = ecs_service.stop_service(cluster_name, service_name)
        elif action == 'restart':
            result = ecs_service.restart_service(cluster_name, service_name)
        else:
            return error_response('Invalid action', headers, 400)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(result)
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_get_schedules(query_params: Dict, headers: Dict) -> Dict[str, Any]:
    """Get schedules for a cluster"""
    try:
        cluster_name = query_params.get('clusterName')
        
        if not cluster_name:
            return error_response('clusterName is required', headers, 400)
        
        schedules = scheduler_service.get_schedules_by_cluster(cluster_name)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'schedules': schedules})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_apply_schedule(body: Dict, headers: Dict) -> Dict[str, Any]:
    """Apply a schedule to a service"""
    try:
        service_id = body.get('serviceId')
        schedule_id = body.get('scheduleId')
        cluster_name = body.get('clusterName')
        
        if not service_id or not schedule_id or not cluster_name:
            return error_response('serviceId, scheduleId, and clusterName are required', headers, 400)
        
        # Tag the service with schedule info
        result = ecs_service.tag_service_with_schedule(service_id, schedule_id, 'Applied Schedule')
        
        # Create association in DynamoDB
        scheduler_service.create_schedule_association(service_id, schedule_id, cluster_name)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(result)
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_create_schedule(body: Dict, headers: Dict) -> Dict[str, Any]:
    """Create a new schedule"""
    try:
        cluster_name = body.get('clusterName')
        schedule_name = body.get('scheduleName')
        start_time = body.get('startTime')
        stop_time = body.get('stopTime')
        days_of_week = body.get('daysOfWeek', [])
        timezone = body.get('timezone', 'UTC')
        
        if not all([cluster_name, schedule_name, start_time, stop_time]):
            return error_response('Missing required fields', headers, 400)
        
        schedule = scheduler_service.create_schedule(
            cluster_name,
            schedule_name,
            start_time,
            stop_time,
            days_of_week,
            timezone
        )
        
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps(schedule)
        }
    except Exception as e:
        return error_response(str(e), headers)


def error_response(message: str, headers: Dict, status_code: int = 500) -> Dict[str, Any]:
    """Generate error response"""
    return {
        'statusCode': status_code,
        'headers': headers,
        'body': json.dumps({'error': message})
    }
