# Design Document: CloudOps GenAI Troubleshooting Chat

## Overview

This design specifies the architecture and implementation for integrating a GenAI-powered troubleshooting chatbox into the CloudOps view. The feature enables users to diagnose AWS infrastructure issues through natural language queries, with the system analyzing CloudWatch metrics and logs to provide actionable recommendations.

The design follows the established pattern from the FinOps chat copilot, adapting it for CloudOps-specific use cases including EC2, ECS, EKS, RDS, and Lambda troubleshooting.

### Key Capabilities

- Natural language troubleshooting queries for AWS services
- CloudWatch metrics analysis for performance anomalies
- CloudWatch logs querying for error pattern detection
- Conversation context management with localStorage persistence
- Actionable remediation recommendations
- Consistent UI/UX with existing FinOps chat interface

## Architecture

### Component Structure

```
CloudOpsView (Enhanced)
├── Resource Management Tabs (Existing)
│   ├── EC2 Tab
│   ├── ECS Tab
│   └── EKS Tab
└── TroubleshootingChat (New)
    ├── MessageList
    ├── MessageInput
    └── ClearChatButton
```

### Integration Approach

The troubleshooting chat will be integrated into the existing `CloudOpsView` component following a two-column layout pattern:

1. **Left Column (60%)**: Existing resource management tabs (EC2, ECS, EKS)
2. **Right Column (40%)**: New troubleshooting chat interface

This layout maintains visibility of both resource management and troubleshooting capabilities simultaneously, enabling users to take action on resources while diagnosing issues.

### API Architecture

```
Frontend (React)
    ↓
    POST /cloudops-chat
    ↓
API Gateway (AWS)
    ↓
Lambda Handler
    ├── Query Parser
    ├── CloudWatch Metrics Client
    ├── CloudWatch Logs Client
    ├── GenAI Service (Bedrock/OpenAI)
    └── Response Formatter
```

The backend follows a serverless architecture using AWS Lambda, with the handler orchestrating:
- Natural language understanding to extract resource IDs and service types
- Parallel queries to CloudWatch Metrics and Logs APIs
- GenAI processing to analyze data and generate recommendations
- Structured response formatting

## Components and Interfaces

### Frontend Components

#### TroubleshootingChat Component

**Location**: `src/components/CloudOpsView.tsx` (integrated within)

**State Management**:
```typescript
interface TroubleshootingChatState {
  messages: CloudOpsChatMessage[];
  inputMessage: string;
  isLoading: boolean;
  conversationContext: ConversationContext;
}
```

**Key Functions**:
- `handleSendMessage()`: Validates input, sends API request, updates message history
- `loadConversationContext()`: Retrieves context from localStorage on mount
- `saveConversationContext()`: Persists context to localStorage with TTL
- `clearChat()`: Resets conversation context and message history
- `formatMetricData()`: Renders metric values in user-friendly format
- `formatLogExcerpts()`: Displays log entries with timestamps

**UI Elements**:
- Scrollable message area with auto-scroll to latest
- Message bubbles with distinct styling for user/assistant roles
- Loading indicator during API calls
- Input field with send button
- Clear chat button in header
- Timestamp display for each message

#### Enhanced CloudOpsView Component

**Modifications**:
- Add flex layout container for two-column design
- Integrate TroubleshootingChat component in right column
- Maintain existing resource management tabs in left column
- Responsive design: stack vertically on mobile viewports

### Backend API

#### Endpoint: POST /cloudops-chat

**Request Schema**:
```typescript
interface CloudOpsChatRequest {
  message: string;                    // User's query
  conversationContext: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: string;
    }>;
    sessionId: string;
  };
  awsRegion?: string;                 // Optional, defaults to configured region
}
```

**Response Schema**:
```typescript
interface CloudOpsChatResponse {
  message: string;                    // AI-generated response text
  metrics?: MetricAnalysis[];         // Analyzed CloudWatch metrics
  logs?: LogExcerpt[];               // Relevant log entries
  recommendations?: Remediation[];    // Actionable steps
  error?: string;                    // Error message if request failed
}

interface MetricAnalysis {
  resourceId: string;
  metricName: string;
  namespace: string;
  values: Array<{
    timestamp: string;
    value: number;
  }>;
  anomalyDetected: boolean;
  thresholdBreached?: {
    threshold: number;
    breachedAt: string;
  };
}

interface LogExcerpt {
  logGroup: string;
  logStream: string;
  timestamp: string;
  message: string;
  level: 'ERROR' | 'WARN' | 'INFO';
}

interface Remediation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  steps: string[];
  awsCliCommand?: string;
  consoleLink?: string;
}
```

**Error Responses**:
- 400: Invalid request payload
- 403: Insufficient AWS permissions
- 408: Request timeout (>10 seconds)
- 500: Internal server error

#### Lambda Handler Logic

**Query Processing Pipeline**:

1. **Parse User Query**
   - Extract resource IDs using regex patterns (instance-id, cluster name, function ARN)
   - Identify service type (EC2, ECS, EKS, RDS, Lambda)
   - Determine time range (default: last 24 hours, or parse from query)

2. **CloudWatch Metrics Query**
   - Map service type to relevant metric namespaces
   - Fetch metrics for identified resources
   - Analyze for anomalies using statistical thresholds (mean ± 2σ)
   - Identify threshold breaches

3. **CloudWatch Logs Query**
   - Determine log groups based on service type
   - Query logs with filters for ERROR, WARN, Exception patterns
   - Limit results to 50 most relevant entries
   - Extract error patterns and frequencies

4. **GenAI Analysis**
   - Construct prompt with query, metrics data, and log excerpts
   - Request analysis and recommendations from GenAI service
   - Parse structured response

5. **Response Formatting**
   - Combine GenAI response with structured metric/log data
   - Generate remediation steps with priority ordering
   - Include AWS CLI commands and console links where applicable

**Conversation Context Handling**:
- Store last 10 messages in context for follow-up queries
- Use context to resolve ambiguous references ("check that instance again")
- Maintain resource focus across conversation turns

## Data Models

### TypeScript Type Definitions

**Location**: `src/types/index.ts`

```typescript
// Extend existing ChatMessage for CloudOps-specific metadata
export interface CloudOpsChatMessage extends ChatMessage {
  metrics?: MetricAnalysis[];
  logs?: LogExcerpt[];
  recommendations?: Remediation[];
}

export interface ConversationContext {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  lastResourceId?: string;
  lastServiceType?: string;
  createdAt: string;
  expiresAt: string;
}

export interface MetricAnalysis {
  resourceId: string;
  metricName: string;
  namespace: string;
  values: Array<{
    timestamp: string;
    value: number;
  }>;
  anomalyDetected: boolean;
  thresholdBreached?: {
    threshold: number;
    breachedAt: string;
  };
}

export interface LogExcerpt {
  logGroup: string;
  logStream: string;
  timestamp: string;
  message: string;
  level: 'ERROR' | 'WARN' | 'INFO';
}

export interface Remediation {
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  steps: string[];
  awsCliCommand?: string;
  consoleLink?: string;
}
```

### LocalStorage Schema

**Key**: `cloudops_chat_context_v1`

**Value Structure**:
```typescript
{
  sessionId: string;
  messages: CloudOpsChatMessage[];
  lastResourceId?: string;
  lastServiceType?: string;
  createdAt: string;      // ISO 8601 timestamp
  expiresAt: string;      // ISO 8601 timestamp (createdAt + 24 hours)
}
```

**TTL Management**:
- Context expires after 24 hours
- On component mount, check `expiresAt` and clear if expired
- Update `expiresAt` on each new message

### CloudWatch Query Patterns

**Metrics by Service Type**:

```typescript
const METRIC_CONFIGS = {
  EC2: {
    namespace: 'AWS/EC2',
    metrics: ['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadBytes', 'DiskWriteBytes'],
    dimensions: [{ Name: 'InstanceId', Value: '<instance-id>' }]
  },
  ECS: {
    namespace: 'AWS/ECS',
    metrics: ['CPUUtilization', 'MemoryUtilization'],
    dimensions: [
      { Name: 'ServiceName', Value: '<service-name>' },
      { Name: 'ClusterName', Value: '<cluster-name>' }
    ]
  },
  EKS: {
    namespace: 'ContainerInsights',
    metrics: ['node_cpu_utilization', 'node_memory_utilization', 'pod_cpu_utilization'],
    dimensions: [{ Name: 'ClusterName', Value: '<cluster-name>' }]
  },
  RDS: {
    namespace: 'AWS/RDS',
    metrics: ['CPUUtilization', 'DatabaseConnections', 'FreeableMemory', 'ReadLatency', 'WriteLatency'],
    dimensions: [{ Name: 'DBInstanceIdentifier', Value: '<db-instance-id>' }]
  },
  Lambda: {
    namespace: 'AWS/Lambda',
    metrics: ['Invocations', 'Errors', 'Duration', 'Throttles', 'ConcurrentExecutions'],
    dimensions: [{ Name: 'FunctionName', Value: '<function-name>' }]
  }
};
```

**Log Groups by Service Type**:

```typescript
const LOG_GROUP_PATTERNS = {
  EC2: '/aws/ec2/*',
  ECS: '/aws/ecs/*',
  EKS: '/aws/eks/<cluster-name>/cluster',
  RDS: '/aws/rds/instance/<instance-id>/*',
  Lambda: '/aws/lambda/<function-name>'
};
```

## Integration with Existing CloudOps Components

### State Sharing

The troubleshooting chat will have read-only access to the existing CloudOps state:

```typescript
// In CloudOpsView component
const [ec2Instances, setEc2Instances] = useState<EC2Instance[]>([]);
const [eksClusters, setEksClusters] = useState<EKSCluster[]>([]);
const [ecsServices, setEcsServices] = useState<ECSService[]>([]);

// Pass to TroubleshootingChat for context enrichment
<TroubleshootingChat
  ec2Instances={ec2Instances}
  eksClusters={eksClusters}
  ecsServices={ecsServices}
/>
```

**Use Cases**:
- Auto-suggest resource IDs in chat input
- Validate resource IDs against current inventory
- Provide resource status context in queries

### Action Integration (Future Enhancement)

While not in the initial scope, the design supports future integration where chat recommendations can trigger CloudOps actions:

```typescript
// Future: Pass action handlers to chat
<TroubleshootingChat
  onEC2Action={handleEC2Action}
  onSuspendCluster={handleSuspendCluster}
/>
```

This would enable "one-click remediation" where users can execute recommended actions directly from chat responses.

## CloudWatch Metrics and Logs Querying Strategy

### Metrics Query Strategy

**Time Range Selection**:
- Default: Last 24 hours
- Parse user query for time expressions: "last hour", "past week", "since yesterday"
- Maximum range: 14 days (CloudWatch Metrics retention)

**Aggregation**:
- Period: 5 minutes for recent data (<24h), 1 hour for historical (>24h)
- Statistics: Average, Maximum, Minimum
- Anomaly detection: Calculate mean and standard deviation, flag values >2σ from mean

**Optimization**:
- Batch metric queries using `GetMetricData` API (up to 500 metrics per request)
- Cache metric data in Lambda memory for 5 minutes to reduce API calls
- Parallel queries for multiple resources

### Logs Query Strategy

**Query Construction**:
```typescript
// Example CloudWatch Logs Insights query
const query = `
  fields @timestamp, @message, @logStream
  | filter @message like /ERROR|Exception|Failed/
  | sort @timestamp desc
  | limit 50
`;
```

**Filtering**:
- Priority 1: ERROR level messages
- Priority 2: Exception stack traces
- Priority 3: WARN messages with specific patterns (timeout, connection, memory)

**Performance**:
- Use CloudWatch Logs Insights for structured queries
- Limit time range to reduce query cost
- Stream results to avoid memory issues with large log volumes

**Error Pattern Detection**:
- Group similar errors by message pattern
- Count occurrences to identify frequent issues
- Extract timestamps to show error frequency over time

### Permissions Required

The Lambda execution role must have:

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
        "ec2:DescribeInstances",
        "ecs:DescribeServices",
        "ecs:DescribeClusters",
        "eks:DescribeCluster",
        "rds:DescribeDBInstances",
        "lambda:GetFunction"
      ],
      "Resource": "*"
    }
  ]
}
```

**Permission Error Handling**:
- Catch `AccessDeniedException` from AWS SDK calls
- Return user-friendly message: "Insufficient permissions to access [resource]. Please contact your administrator."
- Log detailed error for debugging


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Service Query Diagnostic Response

*For any* valid AWS service query (EC2, ECS, EKS, RDS, or Lambda), the Chat API should return a response containing diagnostic information relevant to that service type.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 2: Resource-Specific Analysis

*For any* query containing a valid Resource_ID, the Chat API response should focus analysis exclusively on that specific resource rather than all resources of that type.

**Validates: Requirements 2.6**

### Property 3: General Service Health Analysis

*For any* query about service health without a Resource_ID, the Chat API should analyze all resources of the requested service type.

**Validates: Requirements 2.7**

### Property 4: CloudWatch Data Retrieval

*For any* troubleshooting query about a resource, the Chat API should retrieve both CloudWatch metrics and CloudWatch logs associated with that resource.

**Validates: Requirements 3.1, 4.1**

### Property 5: Metric Anomaly Detection

*For any* set of CloudWatch metrics, the Chat API should analyze them for anomalies, threshold breaches, and performance degradation patterns.

**Validates: Requirements 3.2**

### Property 6: Conditional Metric Analysis Inclusion

*For any* metric data that indicates an issue (anomaly or threshold breach), the Chat API response should include the metric analysis in the diagnostic information.

**Validates: Requirements 3.4**

### Property 7: Time Range Handling

*For any* query, the Chat API should use the time range specified in the query, or default to the last 24 hours if no time range is specified.

**Validates: Requirements 3.5, 4.5**

### Property 8: Log Error Pattern Identification

*For any* CloudWatch logs data, the Chat API should identify and extract error patterns, exceptions, and warning messages present in the logs.

**Validates: Requirements 4.2**

### Property 9: Log Display with Timestamps

*For any* log excerpts displayed in the Troubleshooting Chatbox, each excerpt should include its associated timestamp.

**Validates: Requirements 4.3**

### Property 10: Conditional Error Summarization

*For any* log data containing errors, the Chat API response should include a summary of the error patterns found.

**Validates: Requirements 4.4**

### Property 11: Log Result Limiting

*For any* CloudWatch logs query that would return more than 50 entries, the Chat API should limit the results to the 50 most relevant entries.

**Validates: Requirements 4.6**

### Property 12: Conversation Context Persistence

*For any* user session, the Troubleshooting Chatbox should maintain conversation context including previous queries and responses, stored in localStorage with a 24-hour TTL.

**Validates: Requirements 5.1, 5.3, 5.4**

### Property 13: Context-Aware Follow-up Interpretation

*For any* follow-up query submitted after a previous query, the Chat API should use the conversation context to interpret ambiguous references.

**Validates: Requirements 5.2**

### Property 14: Context Reset on Clear or Expiry

*For any* conversation context, when the user clears the chat or the 24-hour TTL expires, the context should be reset to empty.

**Validates: Requirements 5.5**

### Property 15: Remediation Steps Inclusion

*For any* Chat API response where an issue is identified, the response should include remediation steps for addressing the issue.

**Validates: Requirements 6.1**

### Property 16: Remediation Content Requirements

*For any* remediation steps provided, they should include at least one of: AWS CLI commands, console actions, or configuration changes.

**Validates: Requirements 6.4**

### Property 17: Remediation Prioritization

*For any* Chat API response identifying multiple issues, the remediation steps should be ordered by priority (high, medium, low) based on severity and impact.

**Validates: Requirements 6.5**

### Property 18: API Failure Error Display

*For any* Chat API request that fails, the Troubleshooting Chatbox should display an error message to the user.

**Validates: Requirements 7.1**

### Property 19: Error Response Display

*For any* Chat API error response, the Troubleshooting Chatbox should display the error details from the response.

**Validates: Requirements 7.2**

### Property 20: Loading Indicator During Processing

*For any* query being processed, the Troubleshooting Chatbox should display a loading indicator from the time of submission until the response is received.

**Validates: Requirements 7.3**

### Property 21: Empty Message Prevention

*For any* message input that is empty or contains only whitespace, the Troubleshooting Chatbox should prevent submission and provide feedback to the user.

**Validates: Requirements 7.4**

### Property 22: Unavailable Data Messaging

*For any* scenario where AWS service data is unavailable, the Chat API should return a descriptive message explaining the limitation.

**Validates: Requirements 7.5**

### Property 23: API Request Structure

*For any* request made to the Chat API, the request payload should include both the user message and the conversation context in valid JSON format.

**Validates: Requirements 8.2, 8.6**

### Property 24: API Response Structure

*For any* successful Chat API response, the response payload should be valid JSON containing the AI-generated message, and may include analyzed metrics, log excerpts, and remediation steps.

**Validates: Requirements 8.3, 8.6**

### Property 25: Timeout Handling

*For any* Chat API request that exceeds 10 seconds, the API should return a partial response with a timeout indicator.

**Validates: Requirements 8.5**

### Property 26: Request Validation

*For any* invalid request payload sent to the Chat API, the API should return a descriptive error message explaining what is invalid.

**Validates: Requirements 8.7**

### Property 27: Permission Error Messaging

*For any* resource query where the user lacks permissions, the Chat API should return a message indicating insufficient permissions.

**Validates: Requirements 9.2**

### Property 28: Resource Scope Limiting

*For any* CloudWatch query, the Chat API should only query resources within the configured AWS account and region.

**Validates: Requirements 9.3**

### Property 29: Sensitive Information Exclusion

*For any* Chat API response, the response should not contain credentials, secrets, or personally identifiable information.

**Validates: Requirements 9.4**

### Property 30: Keyboard Navigation Support

*For any* interactive element in the Troubleshooting Chatbox, the element should be accessible via keyboard navigation.

**Validates: Requirements 10.1**

### Property 31: ARIA Label Presence

*For any* interactive element in the Troubleshooting Chatbox, the element should have appropriate ARIA labels for screen reader compatibility.

**Validates: Requirements 10.2**

### Property 32: Message Timestamp Display

*For any* message displayed in the Troubleshooting Chatbox, the message should include a visible timestamp.

**Validates: Requirements 10.3**

### Property 33: Auto-scroll to Latest Message

*For any* new message added to the Troubleshooting Chatbox, the message area should automatically scroll to display the latest message.

**Validates: Requirements 10.4**

### Property 34: Text Selection Support

*For any* message content in the Troubleshooting Chatbox, the text should be selectable and copyable by the user.

**Validates: Requirements 10.5**

### Property 35: Contrast Ratio Compliance

*For any* text element in the Troubleshooting Chatbox, the contrast ratio between text and background should be at least 4.5:1.

**Validates: Requirements 10.6**


## Error Handling

### Frontend Error Handling

**Input Validation**:
- Empty message prevention with inline feedback
- Maximum message length: 2000 characters
- Display character count warning at 1800 characters

**API Error Scenarios**:

| Error Type | HTTP Status | User Message | Recovery Action |
|------------|-------------|--------------|-----------------|
| Network failure | N/A | "Unable to connect to troubleshooting service. Please check your connection." | Retry button |
| Invalid request | 400 | "Invalid query format. Please rephrase your question." | Allow new query |
| Unauthorized | 401 | "Session expired. Please refresh the page." | Refresh prompt |
| Forbidden | 403 | "Insufficient permissions to access this resource." | Contact admin link |
| Timeout | 408 | "Query is taking longer than expected. Partial results shown below." | Show partial data |
| Server error | 500 | "Troubleshooting service is temporarily unavailable. Please try again." | Retry button |

**State Management Errors**:
- LocalStorage quota exceeded: Clear old conversation contexts, keep only last 5 sessions
- Context parse error: Reset to empty context, log error for debugging
- Invalid message format: Skip rendering, log warning

**Graceful Degradation**:
- If metrics API fails: Show logs only, indicate metrics unavailable
- If logs API fails: Show metrics only, indicate logs unavailable
- If both fail: Show GenAI analysis based on query only, indicate data unavailable

### Backend Error Handling

**AWS SDK Error Handling**:

```typescript
try {
  const metrics = await cloudwatch.getMetricData(params);
} catch (error) {
  if (error.name === 'AccessDeniedException') {
    return { error: 'Insufficient permissions to access CloudWatch metrics' };
  } else if (error.name === 'ResourceNotFoundException') {
    return { error: 'Resource not found. Please verify the resource ID.' };
  } else if (error.name === 'ThrottlingException') {
    // Implement exponential backoff
    await sleep(Math.pow(2, retryCount) * 100);
    return retry();
  } else {
    logger.error('CloudWatch API error', { error, params });
    return { error: 'Unable to retrieve metrics. Please try again.' };
  }
}
```

**Query Parsing Errors**:
- Ambiguous query: Request clarification from user
- Unsupported service type: List supported services
- Invalid resource ID format: Provide format examples

**Timeout Management**:
- Set Lambda timeout to 30 seconds
- Implement internal 10-second soft timeout
- Return partial results if soft timeout reached
- Include timeout indicator in response

**Rate Limiting**:
- Implement per-user rate limiting: 30 requests per minute
- Return 429 status with retry-after header
- Frontend: Display "Too many requests. Please wait X seconds."

**Logging Strategy**:
- Log all errors with context (user query, resource IDs, AWS region)
- Use structured logging for CloudWatch Logs Insights queries
- Include correlation ID for request tracing
- Sanitize sensitive data before logging

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

**Library**: fast-check (for TypeScript/JavaScript)

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: cloudops-genai-troubleshooting-chat, Property {number}: {property_text}`

**Property Test Examples**:

```typescript
// Property 1: Service Query Diagnostic Response
test('Feature: cloudops-genai-troubleshooting-chat, Property 1: Service query returns diagnostic info', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.constantFrom('EC2', 'ECS', 'EKS', 'RDS', 'Lambda'),
      fc.string({ minLength: 5, maxLength: 100 }),
      async (serviceType, queryText) => {
        const query = `Check ${serviceType} ${queryText}`;
        const response = await chatAPI.query({ message: query, conversationContext: {} });
        
        expect(response).toHaveProperty('message');
        expect(response.message).toBeTruthy();
        // Diagnostic info should be present (metrics, logs, or recommendations)
        expect(
          response.metrics || response.logs || response.recommendations
        ).toBeTruthy();
      }
    ),
    { numRuns: 100 }
  );
});

// Property 7: Time Range Handling
test('Feature: cloudops-genai-troubleshooting-chat, Property 7: Time range defaults to 24 hours', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 10, maxLength: 100 }),
      async (queryText) => {
        const response = await chatAPI.query({ message: queryText, conversationContext: {} });
        
        // Verify metrics were queried with 24-hour default
        const metricsTimeRange = response.metrics?.[0]?.values;
        if (metricsTimeRange && metricsTimeRange.length > 0) {
          const oldestTimestamp = new Date(metricsTimeRange[0].timestamp);
          const now = new Date();
          const hoursDiff = (now.getTime() - oldestTimestamp.getTime()) / (1000 * 60 * 60);
          expect(hoursDiff).toBeLessThanOrEqual(24);
        }
      }
    ),
    { numRuns: 100 }
  );
});

// Property 21: Empty Message Prevention
test('Feature: cloudops-genai-troubleshooting-chat, Property 21: Empty messages prevented', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('', '   ', '\t', '\n', '  \t\n  '),
      (emptyMessage) => {
        const result = validateMessageInput(emptyMessage);
        expect(result.isValid).toBe(false);
        expect(result.feedback).toBeTruthy();
      }
    ),
    { numRuns: 100 }
  );
});

// Property 29: Sensitive Information Exclusion
test('Feature: cloudops-genai-troubleshooting-chat, Property 29: No sensitive info in responses', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 10, maxLength: 100 }),
      async (queryText) => {
        const response = await chatAPI.query({ message: queryText, conversationContext: {} });
        
        const responseText = JSON.stringify(response);
        
        // Check for common sensitive patterns
        expect(responseText).not.toMatch(/AKIA[0-9A-Z]{16}/); // AWS access key
        expect(responseText).not.toMatch(/[0-9]{3}-[0-9]{2}-[0-9]{4}/); // SSN
        expect(responseText).not.toMatch(/password["\s:]+[^"\s]+/i);
        expect(responseText).not.toMatch(/secret["\s:]+[^"\s]+/i);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing

**Focus Areas**:
- Component rendering (chat interface, message display)
- User interactions (send message, clear chat)
- LocalStorage operations (save/load context, TTL expiration)
- API request/response formatting
- Error message display
- Loading state transitions

**Example Unit Tests**:

```typescript
describe('TroubleshootingChat Component', () => {
  test('displays chat interface on mount', () => {
    render(<CloudOpsView />);
    expect(screen.getByRole('textbox', { name: /message input/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  test('displays loading indicator during API call', async () => {
    const { getByText, queryByText } = render(<CloudOpsView />);
    
    const input = screen.getByRole('textbox');
    const sendButton = screen.getByRole('button', { name: /send/i });
    
    fireEvent.change(input, { target: { value: 'Check EC2 instances' } });
    fireEvent.click(sendButton);
    
    expect(getByText(/loading/i)).toBeInTheDocument();
    
    await waitFor(() => {
      expect(queryByText(/loading/i)).not.toBeInTheDocument();
    });
  });

  test('clears conversation context on clear button click', () => {
    localStorage.setItem('cloudops_chat_context_v1', JSON.stringify({ messages: ['test'] }));
    
    render(<CloudOpsView />);
    const clearButton = screen.getByRole('button', { name: /clear chat/i });
    fireEvent.click(clearButton);
    
    expect(localStorage.getItem('cloudops_chat_context_v1')).toBeNull();
  });

  test('expires context after 24 hours', () => {
    const expiredContext = {
      sessionId: 'test',
      messages: [],
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    };
    
    localStorage.setItem('cloudops_chat_context_v1', JSON.stringify(expiredContext));
    
    render(<CloudOpsView />);
    
    // Context should be cleared on mount
    expect(localStorage.getItem('cloudops_chat_context_v1')).toBeNull();
  });
});

describe('Chat API Integration', () => {
  test('sends correct request structure', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Test response' })
    });
    global.fetch = mockFetch;
    
    await chatAPI.query({
      message: 'Check EC2',
      conversationContext: { sessionId: 'test', messages: [] }
    });
    
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/cloudops-chat'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"message":"Check EC2"')
      })
    );
  });

  test('handles 403 permission error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });
    
    const response = await chatAPI.query({ message: 'Check EC2', conversationContext: {} });
    
    expect(response.error).toContain('Insufficient permissions');
  });
});
```

### Integration Testing

**Scenarios**:
1. End-to-end query flow: User input → API call → Response display
2. Multi-turn conversation with context
3. Error recovery and retry
4. LocalStorage persistence across page reloads
5. Concurrent queries handling

**Tools**:
- Playwright or Cypress for E2E tests
- Mock Service Worker (MSW) for API mocking
- Testing Library for component testing

### Accessibility Testing

**Automated Tools**:
- axe-core for WCAG compliance
- jest-axe for unit test integration
- Lighthouse CI for continuous monitoring

**Manual Testing Checklist**:
- [ ] Keyboard navigation through all interactive elements
- [ ] Screen reader announces messages correctly
- [ ] Focus management on message send
- [ ] Color contrast meets WCAG AA standards
- [ ] Text scaling up to 200% without layout breaking

### Performance Testing

**Metrics to Monitor**:
- API response time (p50, p95, p99)
- Frontend render time for message display
- LocalStorage read/write performance
- Memory usage with long conversation history

**Load Testing**:
- Simulate 100 concurrent users
- Test with conversation contexts of varying sizes (10, 50, 100 messages)
- Verify graceful degradation under load

### Test Coverage Goals

- Unit test coverage: >80% for frontend components
- Property test coverage: All 35 correctness properties
- Integration test coverage: All critical user flows
- E2E test coverage: Happy path + 5 most common error scenarios

