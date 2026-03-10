"""Lambda handler for EC2 management API endpoints"""

import json
import traceback
from typing import Dict, Any
from ec2_management import EC2ManagementService
from scheduler_service import SchedulerService

# Initialize services
ec2_service = EC2ManagementService()
scheduler_service = SchedulerService()

def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for EC2 management endpoints"""
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
        if path == '/ec2/accounts' and method == 'GET':
            return handle_get_accounts(headers)
        
        elif path == '/ec2/applications' and method == 'GET':
            return handle_get_applications(query_params, headers)
        
        elif path == '/ec2/instances' and method == 'GET':
            return handle_get_instances(query_params, headers)
        
        elif path == '/ec2/instance-action' and method == 'POST':
            return handle_instance_action(body, headers)
        
        elif path == '/ec2/modify-instance-type' and method == 'POST':
            return handle_modify_instance_type(body, headers)
        
        elif path == '/ec2/schedules' and method == 'GET':
            return handle_get_schedules(query_params, headers)
        
        elif path == '/ec2/apply-schedule' and method == 'POST':
            return handle_apply_schedule(body, headers)
        
        elif path == '/ec2/create-schedule' and method == 'POST':
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
        accounts = ec2_service.get_accounts()
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'accounts': accounts})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_get_applications(query_params: Dict, headers: Dict) -> Dict[str, Any]:
    """Get application names for an account"""
    try:
        account_id = query_params.get('accountId')
        if not account_id:
            return error_response('accountId is required', headers, 400)
        
        applications = ec2_service.get_application_names(account_id)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'applications': applications})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_get_instances(query_params: Dict, headers: Dict) -> Dict[str, Any]:
    """Get instances for an account and application"""
    try:
        account_id = query_params.get('accountId')
        application_name = query_params.get('applicationName')
        
        if not account_id or not application_name:
            return error_response('accountId and applicationName are required', headers, 400)
        
        instances = ec2_service.get_instances(account_id, application_name)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'instances': instances})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_instance_action(body: Dict, headers: Dict) -> Dict[str, Any]:
    """Handle start/stop instance actions"""
    try:
        instance_id = body.get('instanceId')
        action = body.get('action')
        account_id = body.get('accountId')
        
        if not instance_id or not action:
            return error_response('instanceId and action are required', headers, 400)
        
        if action == 'start':
            result = ec2_service.start_instance(instance_id)
        elif action == 'stop':
            result = ec2_service.stop_instance(instance_id)
        else:
            return error_response('Invalid action', headers, 400)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(result)
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_modify_instance_type(body: Dict, headers: Dict) -> Dict[str, Any]:
    """Handle instance type modification"""
    try:
        instance_id = body.get('instanceId')
        new_instance_type = body.get('newInstanceType')
        
        if not instance_id or not new_instance_type:
            return error_response('instanceId and newInstanceType are required', headers, 400)
        
        result = ec2_service.modify_instance_type(instance_id, new_instance_type)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(result)
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_get_schedules(query_params: Dict, headers: Dict) -> Dict[str, Any]:
    """Get schedules for an application"""
    try:
        application_name = query_params.get('applicationName')
        
        if not application_name:
            return error_response('applicationName is required', headers, 400)
        
        schedules = scheduler_service.get_schedules_by_application(application_name)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'schedules': schedules})
        }
    except Exception as e:
        return error_response(str(e), headers)


def handle_apply_schedule(body: Dict, headers: Dict) -> Dict[str, Any]:
    """Apply a schedule to an instance"""
    try:
        instance_id = body.get('instanceId')
        schedule_id = body.get('scheduleId')
        account_id = body.get('accountId')
        
        if not instance_id or not schedule_id:
            return error_response('instanceId and scheduleId are required', headers, 400)
        
        # Get schedule details
        # Note: We need application_name to query DynamoDB
        # In production, this would be passed or retrieved from instance tags
        
        # Tag the instance with schedule info
        result = ec2_service.tag_instance_with_schedule(instance_id, schedule_id, 'Applied Schedule')
        
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
        application_name = body.get('applicationName')
        schedule_name = body.get('scheduleName')
        start_time = body.get('startTime')
        stop_time = body.get('stopTime')
        days_of_week = body.get('daysOfWeek', [])
        timezone = body.get('timezone', 'UTC')
        
        if not all([application_name, schedule_name, start_time, stop_time]):
            return error_response('Missing required fields', headers, 400)
        
        schedule = scheduler_service.create_schedule(
            application_name,
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
