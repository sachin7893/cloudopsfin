# CloudOps Chat Backend (Python)

AWS Lambda backend for the CloudOps GenAI troubleshooting chat feature.

## Architecture

- **Lambda Runtime**: Python 3.11+
- **AWS Services**: CloudWatch Metrics, CloudWatch Logs, Bedrock (GenAI)
- **API Gateway**: REST API endpoint at `/cloudops-chat`

## Project Structure

```
backend/
├── lambda_function.py       # Main Lambda handler
├── query_parser.py          # Query parsing logic
├── cloudwatch_metrics.py    # CloudWatch Metrics client
├── cloudwatch_logs.py       # CloudWatch Logs client
├── genai_service.py         # GenAI analysis service
├── config.py                # Configuration constants
├── requirements.txt         # Python dependencies
└── README.md               # This file
```

## Features

1. **Query Parsing**: Extracts service type (EC2, ECS, EKS, RDS, Lambda), resource IDs, and time ranges
2. **CloudWatch Integration**: Fetches metrics and logs with anomaly detection
3. **GenAI Analysis**: Uses AWS Bedrock (Claude 3 Sonnet) with fallback to rule-based analysis
4. **Error Handling**: Proper HTTP status codes and descriptive error messages
5. **CORS Support**: Configured for cross-origin requests

## Deployment

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt -t .
```

### 2. Create Deployment Package

```bash
zip -r function.zip . -x "*.git*" -x "*__pycache__*" -x "*.pyc"
```

### 3. Deploy to AWS Lambda

#### Using AWS Console:
1. Go to AWS Lambda Console (ap-south-1 region)
2. Create new function:
   - Name: `cloudops-chat-handler`
   - Runtime: Python 3.11
   - Architecture: x86_64
3. Upload `function.zip`
4. Set handler: `lambda_function.lambda_handler`
5. Configure timeout: 30 seconds
6. Configure memory: 512 MB

#### Using AWS CLI:
```bash
aws lambda create-function \
  --function-name cloudops-chat-handler \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler lambda_function.lambda_handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 512 \
  --region ap-south-1
```

### 4. Configure IAM Role

The Lambda execution role needs these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "cloudwatch:GetMetricStatistics",
        "logs:StartQuery",
        "logs:GetQueryResults",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams",
        "logs:FilterLogEvents",
        "bedrock:InvokeModel",
        "ec2:DescribeInstances",
        "ecs:DescribeServices",
        "ecs:DescribeClusters",
        "eks:DescribeCluster",
        "rds:DescribeDBInstances",
        "lambda:GetFunction"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

### 5. Configure API Gateway

1. Create REST API in API Gateway
2. Create resource: `/cloudops-chat`
3. Create POST method:
   - Integration type: Lambda Function
   - Lambda Function: `cloudops-chat-handler`
   - Use Lambda Proxy integration: Yes
4. Enable CORS:
   - Access-Control-Allow-Origin: `*`
   - Access-Control-Allow-Headers: `Content-Type`
   - Access-Control-Allow-Methods: `POST, OPTIONS`
5. Deploy to stage: `prod`

Your endpoint will be:
```
https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/cloudops-chat
```

## Testing

### Test Request

```bash
curl -X POST https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/cloudops-chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Check EC2 instance i-1234567890abcdef0",
    "conversationContext": {
      "sessionId": "test-session",
      "messages": []
    }
  }'
```

### Expected Response

```json
{
  "message": "Analysis of EC2 instance...",
  "metrics": [
    {
      "resourceId": "i-1234567890abcdef0",
      "metricName": "CPUUtilization",
      "namespace": "AWS/EC2",
      "values": [...],
      "anomalyDetected": false
    }
  ],
  "logs": [...],
  "recommendations": [
    {
      "priority": "high",
      "title": "Investigate High CPU",
      "description": "CPU utilization is above normal",
      "steps": [...]
    }
  ]
}
```

## Environment Variables

Optional environment variables:

- `AWS_REGION`: AWS region (default: ap-south-1)
- `BEDROCK_REGION`: Bedrock region (default: us-east-1)
- `BEDROCK_MODEL_ID`: Bedrock model ID (default: anthropic.claude-3-5-sonnet-20241022-v2:0)
- `LOG_LEVEL`: Logging level (default: INFO)

### Supported Bedrock Models

The default model is Claude 3.5 Sonnet. You can change it by setting the `BEDROCK_MODEL_ID` environment variable:

**Recommended models:**
- `anthropic.claude-3-5-sonnet-20241022-v2:0` (default, best performance)
- `anthropic.claude-3-5-sonnet-20240620-v1:0` (alternative)
- `anthropic.claude-3-haiku-20240307-v1:0` (faster, lower cost)

**Note**: Ensure the model is enabled in your AWS Bedrock console before use.

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure IAM role has all required permissions
2. **Timeout**: Increase Lambda timeout if queries take longer
3. **Memory Issues**: Increase Lambda memory allocation
4. **Bedrock Access**: Ensure Bedrock is enabled in your account and region

### Logs

View Lambda logs in CloudWatch Logs:
```
/aws/lambda/cloudops-chat-handler
```

## Cost Optimization

- CloudWatch Logs Insights queries are charged per GB scanned
- Bedrock charges per token (input + output)
- Consider caching frequently accessed metrics
- Limit log query time ranges to reduce costs
