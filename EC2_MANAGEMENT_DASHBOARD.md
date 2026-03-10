# EC2 Management Dashboard Implementation

## Overview

The EC2 Management Dashboard is a comprehensive feature for managing EC2 instances across multiple AWS accounts with tag-based filtering, instance actions (start/stop/modify type), and DynamoDB-backed scheduling.

## Frontend Components

### EC2ManagementDashboard.tsx
Located at: `src/components/EC2ManagementDashboard.tsx`

**Features:**
- Account selection dropdown
- Application name tag filtering
- Instance table with state, type, and schedule information
- Instance actions:
  - Start/Stop instances with confirmation dialog
  - Modify instance type with dialog
  - Apply schedules to instances
- Schedule display for selected application
- Loading states and error handling
- Toast notifications for user feedback

**State Management:**
- `accounts`: List of AWS accounts
- `selectedAccount`: Currently selected account
- `applicationNames`: Unique application_name tags
- `selectedApplication`: Currently selected application
- `instances`: Filtered EC2 instances
- `schedules`: Available schedules for application
- `loading`: Loading state for data fetches
- `actionLoading`: Loading state for instance actions

**Key Functions:**
- `fetchAccounts()`: Get list of AWS accounts
- `fetchApplicationNames()`: Get unique application tags
- `fetchInstances()`: Get instances for account/application
- `fetchSchedules()`: Get schedules for application
- `handleStartInstance()`: Start an instance
- `handleStopInstance()`: Stop an instance
- `handleModifyType()`: Modify instance type
- `handleApplySchedule()`: Apply schedule to instance

## Backend Services

### EC2 Management Service
File: `backend/ec2_management.py`

**Class: EC2ManagementService**

Methods:
- `get_accounts()`: Returns list of AWS accounts
- `get_application_names(account_id)`: Get unique application_name tags
- `get_instances(account_id, application_name)`: Get filtered instances
- `start_instance(instance_id)`: Start an EC2 instance
- `stop_instance(instance_id)`: Stop an EC2 instance
- `modify_instance_type(instance_id, new_instance_type)`: Change instance type
- `tag_instance_with_schedule(instance_id, schedule_id, schedule_name)`: Tag instance with schedule

### Scheduler Service
File: `backend/scheduler_service.py`

**Class: SchedulerService**

Methods:
- `create_schedule()`: Create new schedule in DynamoDB
- `get_schedules_by_application()`: Get all schedules for application
- `get_schedule()`: Get specific schedule
- `update_schedule()`: Update existing schedule
- `delete_schedule()`: Delete schedule
- `create_schedule_association()`: Link instance to schedule
- `get_instance_schedule()`: Get schedule for instance
- `delete_schedule_association()`: Remove schedule from instance

### EC2 Handler
File: `backend/ec2_handler.py`

**Lambda Handler Routes:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/ec2/accounts` | GET | Get list of AWS accounts |
| `/ec2/applications` | GET | Get application names for account |
| `/ec2/instances` | GET | Get instances for account/application |
| `/ec2/instance-action` | POST | Start/stop instance |
| `/ec2/modify-instance-type` | POST | Modify instance type |
| `/ec2/schedules` | GET | Get schedules for application |
| `/ec2/apply-schedule` | POST | Apply schedule to instance |
| `/ec2/create-schedule` | POST | Create new schedule |

## DynamoDB Tables

### ec2-schedules
**Partition Key:** `applicationName`
**Sort Key:** `scheduleId`

**Attributes:**
- `applicationName` (String): Application name tag
- `scheduleId` (String): Unique schedule identifier
- `scheduleName` (String): Human-readable schedule name
- `startTime` (String): Start time in HH:MM format
- `stopTime` (String): Stop time in HH:MM format
- `daysOfWeek` (List): Days when schedule applies
- `timezone` (String): Timezone for schedule
- `createdAt` (String): ISO 8601 timestamp
- `updatedAt` (String): ISO 8601 timestamp

### ec2-schedule-associations
**Partition Key:** `instanceId`

**Attributes:**
- `instanceId` (String): EC2 instance ID
- `scheduleId` (String): Associated schedule ID
- `applicationName` (String): Application name
- `createdAt` (String): ISO 8601 timestamp

## Type Definitions

Located in: `src/types/index.ts`

```typescript
interface EC2InstanceDetail {
  instanceId: string;
  instanceType: string;
  state: 'running' | 'stopped' | 'stopping' | 'pending' | 'terminated';
  launchTime: string;
  tags: Record<string, string>;
  applicationName?: string;
  scheduleId?: string;
  scheduleName?: string;
  accountId: string;
  region: string;
}

interface Schedule {
  scheduleId: string;
  applicationName: string;
  scheduleName: string;
  startTime: string;
  stopTime: string;
  daysOfWeek: string[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleAssociation {
  instanceId: string;
  scheduleId: string;
  applicationName: string;
  createdAt: string;
}

interface AWSAccount {
  accountId: string;
  accountName: string;
  region: string;
}
```

## Integration with CloudOpsView

The EC2 Management Dashboard is integrated as a new tab in the CloudOpsView component:

```typescript
<Tabs defaultValue="ec2" className="w-full">
  <TabsList className="grid w-full grid-cols-4 max-w-md">
    <TabsTrigger value="ec2">EC2</TabsTrigger>
    <TabsTrigger value="ec2-manage">EC2 Manage</TabsTrigger>
    <TabsTrigger value="ecs">ECS</TabsTrigger>
    <TabsTrigger value="eks">EKS</TabsTrigger>
  </TabsList>

  <TabsContent value="ec2-manage" className="mt-6">
    <EC2ManagementDashboard onClose={() => setShowEC2Dashboard(false)} />
  </TabsContent>
</Tabs>
```

## Deployment

### Frontend
No additional deployment needed - component is part of existing React app.

### Backend

1. **Create DynamoDB Tables:**
```bash
# ec2-schedules table
aws dynamodb create-table \
  --table-name ec2-schedules \
  --attribute-definitions \
    AttributeName=applicationName,AttributeType=S \
    AttributeName=scheduleId,AttributeType=S \
  --key-schema \
    AttributeName=applicationName,KeyType=HASH \
    AttributeName=scheduleId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1

# ec2-schedule-associations table
aws dynamodb create-table \
  --table-name ec2-schedule-associations \
  --attribute-definitions \
    AttributeName=instanceId,AttributeType=S \
  --key-schema \
    AttributeName=instanceId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

2. **Deploy Lambda Function:**
```bash
cd backend

# Install dependencies
pip install -r requirements.txt -t .

# Create deployment package
zip -r ec2-handler.zip . -x "*.git*" -x "*__pycache__*" -x "*.pyc"

# Deploy to Lambda
aws lambda create-function \
  --function-name ec2-management-handler \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role \
  --handler ec2_handler.lambda_handler \
  --zip-file fileb://ec2-handler.zip \
  --timeout 30 \
  --memory-size 512 \
  --region ap-south-1
```

3. **Configure API Gateway:**
- Create REST API
- Create resources: `/ec2/accounts`, `/ec2/applications`, `/ec2/instances`, etc.
- Create methods (GET/POST) for each resource
- Integrate with Lambda function
- Enable CORS
- Deploy to `prod` stage

4. **IAM Permissions:**

Lambda execution role needs:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:StartInstances",
        "ec2:StopInstances",
        "ec2:ModifyInstanceAttribute",
        "ec2:CreateTags",
        "ec2:DescribeTags"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-south-1:*:table/ec2-schedules",
        "arn:aws:dynamodb:ap-south-1:*:table/ec2-schedule-associations"
      ]
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

## Usage Examples

### Get Accounts
```bash
curl https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/ec2/accounts
```

### Get Applications for Account
```bash
curl "https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/ec2/applications?accountId=290768402661"
```

### Get Instances
```bash
curl "https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/ec2/instances?accountId=290768402661&applicationName=web-app"
```

### Start Instance
```bash
curl -X POST https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/ec2/instance-action \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "i-1234567890abcdef0",
    "action": "start",
    "accountId": "290768402661"
  }'
```

### Create Schedule
```bash
curl -X POST https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/prod/ec2/create-schedule \
  -H "Content-Type: application/json" \
  -d '{
    "applicationName": "web-app",
    "scheduleName": "Business Hours",
    "startTime": "08:00",
    "stopTime": "18:00",
    "daysOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "timezone": "UTC"
  }'
```

## Features

✅ **Account Selection** - Filter instances by AWS account
✅ **Application Tag Filtering** - Filter by application_name tag
✅ **Instance Display** - Show ID, type, state, and schedule
✅ **Start/Stop Actions** - Control instance state with confirmation
✅ **Modify Instance Type** - Resize instances (requires stopped state)
✅ **Scheduler System** - DynamoDB-backed scheduling
✅ **Schedule Display** - Show available schedules for application
✅ **Apply Schedules** - Associate schedules with instances
✅ **Error Handling** - Comprehensive error messages
✅ **Loading States** - Visual feedback during operations
✅ **Toast Notifications** - User feedback for actions

## Future Enhancements

- Automated schedule execution (EventBridge + Lambda)
- Schedule history and audit logs
- Bulk operations (start/stop multiple instances)
- Custom schedule creation UI
- Instance cost estimation
- Performance metrics integration
- Multi-region support
- Cross-account management
