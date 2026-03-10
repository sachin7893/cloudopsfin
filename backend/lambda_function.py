"""Main Lambda handler for CloudOps chat API"""

import json
import traceback
from typing import Dict, Any
from query_parser import parse_query
from cloudwatch_metrics import CloudWatchMetricsService
from cloudwatch_logs import CloudWatchLogsService
from genai_service import GenAIService


# Initialize services
metrics_service = CloudWatchMetricsService()
logs_service = CloudWatchLogsService()
genai_service = GenAIService()


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Main Lambda handler for CloudOps chat requests"""
    print(f"Received event: {json.dumps(event)}")
    
    # CORS headers
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
    
    # Handle OPTIONS request for CORS
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': ''
        }
    
    try:
        # Validate request
        body = event.get('body')
        if not body:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Request body is required'})
            }
        
        request = json.loads(body)
        
        # Validate required fields
        message = request.get('message')
        if not message or not isinstance(message, str):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Invalid request: message field is required and must be a string'
                })
            }
        
        if not message.strip():
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Message cannot be empty'})
            }
        
        # Process request
        conversation_context = request.get('conversationContext', {})
        aws_region = request.get('awsRegion', 'ap-south-1')
        
        response = process_request(message, conversation_context, aws_region)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response)
        }
        
    except PermissionError as e:
        return {
            'statusCode': 403,
            'headers': headers,
            'body': json.dumps({'error': str(e)})
        }
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        print(traceback.format_exc())
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal server error. Please try again.'})
        }


def process_request(
    message: str,
    conversation_context: Dict,
    aws_region: str
) -> Dict[str, Any]:
    """Process the chat request and generate response"""
    
    # Parse the query
    parsed_query = parse_query(message, conversation_context)
    print(f"Parsed query: {parsed_query}")
    
    # If no service type identified, return general response
    if not parsed_query['service_type']:
        return {
            'message': "I can help you troubleshoot AWS services including EC2, ECS, EKS, RDS, and Lambda. Please specify which service you'd like to investigate.",
            'recommendations': [
                {
                    'priority': 'low',
                    'title': 'Specify Service Type',
                    'description': 'Include the AWS service name in your query',
                    'steps': [
                        'Example: "Check my EC2 instances"',
                        'Example: "Troubleshoot Lambda function my-function"',
                        'Example: "Analyze RDS database performance"'
                    ]
                }
            ]
        }
    
    # If no resource ID, provide general service health
    if not parsed_query['resource_id']:
        service_type = parsed_query['service_type']
        return {
            'message': f"To provide detailed troubleshooting for {service_type}, please specify a resource ID (instance ID, cluster name, function name, etc.)",
            'recommendations': [
                {
                    'priority': 'medium',
                    'title': 'Provide Resource Identifier',
                    'description': 'Include the specific resource you want to troubleshoot',
                    'steps': [
                        f'Example: "Check EC2 instance i-1234567890abcdef0"',
                        f'Example: "Analyze {service_type} performance for [resource-id]"'
                    ]
                }
            ]
        }
    
    try:
        # Fetch metrics and logs in parallel (using threads for I/O operations)
        from concurrent.futures import ThreadPoolExecutor, as_completed
        
        metrics = []
        logs = []
        
        with ThreadPoolExecutor(max_workers=2) as executor:
            futures = {
                executor.submit(
                    metrics_service.get_metrics,
                    parsed_query['service_type'],
                    parsed_query['resource_id'],
                    parsed_query['time_range'][0],
                    parsed_query['time_range'][1]
                ): 'metrics',
                executor.submit(
                    logs_service.query_logs,
                    parsed_query['service_type'],
                    parsed_query['resource_id'],
                    parsed_query['time_range'][0],
                    parsed_query['time_range'][1]
                ): 'logs'
            }
            
            for future in as_completed(futures):
                data_type = futures[future]
                try:
                    result = future.result()
                    if data_type == 'metrics':
                        metrics = result
                    else:
                        logs = result
                except Exception as e:
                    print(f"Failed to fetch {data_type}: {str(e)}")
        
        print(f"Fetched {len(metrics)} metrics and {len(logs)} log entries")
        
        # Analyze with GenAI
        analysis_message, recommendations = genai_service.analyze_and_recommend(
            message,
            metrics,
            logs,
            conversation_context
        )
        
        # Filter metrics to only include those with issues
        relevant_metrics = [m for m in metrics if m.get('anomalyDetected')]
        
        # Limit logs to most relevant
        relevant_logs = logs[:20]
        
        response = {
            'message': analysis_message,
            'recommendations': recommendations
        }
        
        if relevant_metrics:
            response['metrics'] = relevant_metrics
        
        if relevant_logs:
            response['logs'] = relevant_logs
        
        return response
        
    except Exception as e:
        print(f"Error during processing: {str(e)}")
        raise
