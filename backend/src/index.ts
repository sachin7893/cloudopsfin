// Main Lambda handler for CloudOps chat API

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { CloudOpsChatRequest, CloudOpsChatResponse } from './types.js';
import { parseQuery } from './queryParser.js';
import { CloudWatchMetricsService } from './cloudwatchMetrics.js';
import { CloudWatchLogsService } from './cloudwatchLogs.js';
import { GenAIService } from './genaiService.js';
import { TIMEOUT_MS } from './config.js';

const metricsService = new CloudWatchMetricsService();
const logsService = new CloudWatchLogsService();
const genaiService = new GenAIService();

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  try {
    // Validate request
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Request body is required'
        })
      };
    }
    
    const request: CloudOpsChatRequest = JSON.parse(event.body);
    
    // Validate required fields
    if (!request.message || typeof request.message !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid request: message field is required and must be a string'
        })
      };
    }
    
    if (request.message.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Message cannot be empty'
        })
      };
    }
    
    // Set timeout for processing
    const timeoutPromise = new Promise<CloudOpsChatResponse>((resolve) => {
      setTimeout(() => {
        resolve({
          message: 'Query is taking longer than expected. Partial results shown below.',
          error: 'Request timeout'
        });
      }, TIMEOUT_MS);
    });
    
    // Process request
    const processingPromise = processRequest(request);
    
    // Race between processing and timeout
    const response = await Promise.race([processingPromise, timeoutPromise]);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };
    
  } catch (error: any) {
    console.error('Error processing request:', error);
    
    // Handle specific error types
    if (error.message?.includes('Insufficient permissions')) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          error: error.message
        })
      };
    }
    
    if (error.name === 'SyntaxError') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Invalid JSON in request body'
        })
      };
    }
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error. Please try again.'
      })
    };
  }
};

async function processRequest(
  request: CloudOpsChatRequest
): Promise<CloudOpsChatResponse> {
  const { message, conversationContext, awsRegion } = request;
  
  // Parse the query
  const parsedQuery = parseQuery(message, conversationContext);
  
  console.log('Parsed query:', parsedQuery);
  
  // If no service type identified, return general response
  if (!parsedQuery.serviceType) {
    return {
      message: 'I can help you troubleshoot AWS services including EC2, ECS, EKS, RDS, and Lambda. Please specify which service you\'d like to investigate.',
      recommendations: [
        {
          priority: 'low',
          title: 'Specify Service Type',
          description: 'Include the AWS service name in your query',
          steps: [
            'Example: "Check my EC2 instances"',
            'Example: "Troubleshoot Lambda function my-function"',
            'Example: "Analyze RDS database performance"'
          ]
        }
      ]
    };
  }
  
  // If no resource ID, provide general service health
  if (!parsedQuery.resourceId) {
    return {
      message: `To provide detailed troubleshooting for ${parsedQuery.serviceType}, please specify a resource ID (instance ID, cluster name, function name, etc.)`,
      recommendations: [
        {
          priority: 'medium',
          title: 'Provide Resource Identifier',
          description: 'Include the specific resource you want to troubleshoot',
          steps: [
            `Example: "Check EC2 instance i-1234567890abcdef0"`,
            `Example: "Analyze ${parsedQuery.serviceType} performance for [resource-id]"`
          ]
        }
      ]
    };
  }
  
  try {
    // Fetch metrics and logs in parallel
    const [metrics, logs] = await Promise.all([
      metricsService.getMetrics(
        parsedQuery.serviceType,
        parsedQuery.resourceId,
        parsedQuery.timeRange.start,
        parsedQuery.timeRange.end
      ).catch(error => {
        console.warn('Failed to fetch metrics:', error);
        return [];
      }),
      logsService.queryLogs(
        parsedQuery.serviceType,
        parsedQuery.resourceId,
        parsedQuery.timeRange.start,
        parsedQuery.timeRange.end
      ).catch(error => {
        console.warn('Failed to fetch logs:', error);
        return [];
      })
    ]);
    
    console.log(`Fetched ${metrics.length} metrics and ${logs.length} log entries`);
    
    // Analyze with GenAI
    const analysis = await genaiService.analyzeAndRecommend(
      message,
      metrics,
      logs,
      conversationContext
    );
    
    // Filter metrics to only include those with issues
    const relevantMetrics = metrics.filter(m => m.anomalyDetected);
    
    // Limit logs to most relevant
    const relevantLogs = logs.slice(0, 20);
    
    return {
      message: analysis.message,
      metrics: relevantMetrics.length > 0 ? relevantMetrics : undefined,
      logs: relevantLogs.length > 0 ? relevantLogs : undefined,
      recommendations: analysis.recommendations
    };
    
  } catch (error: any) {
    console.error('Error during processing:', error);
    throw error;
  }
}
