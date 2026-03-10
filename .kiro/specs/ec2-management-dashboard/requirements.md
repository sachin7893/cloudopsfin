# Requirements Document: EC2 Management Dashboard

## Introduction

The EC2 Management Dashboard is an enhanced feature for the CloudOps view that provides granular control over EC2 instances through account and application-based filtering, instance management actions, and a scheduler system for automated start/stop operations. This feature enables operators to efficiently manage EC2 instances across multiple AWS accounts and applications with tag-based organization and time-based automation.

## Glossary

- **AWS Account**: A distinct AWS account identifier used to scope EC2 instances
- **Application Tag**: The `application_name` tag assigned to EC2 instances for logical grouping
- **Instance State**: The current operational state of an EC2 instance (Running, Stopped, Stopping, Pending)
- **Instance Type**: The EC2 instance class (e.g., t3.micro, m5.large) that determines compute resources
- **Scheduler**: A time-based rule that automatically starts or stops instances based on application tags
- **Schedule Rule**: A specific schedule configuration stored in DynamoDB with start/stop times and days
- **DynamoDB**: AWS NoSQL database used to persist scheduler configurations
- **CloudOpsView**: The main component in the application that displays cloud resource management interfaces

## Requirements

### Requirement 1: Account Selection

**User Story:** As a CloudOps operator, I want to select an AWS account from a dropdown, so that I can view and manage EC2 instances for a specific account.

#### Acceptance Criteria

1. WHEN the EC2 Management Dashboard loads, THE Dashboard SHALL display a dropdown menu for account selection
2. WHEN the user clicks the account dropdown, THE Dashboard SHALL display a list of available AWS accounts
3. WHEN the user selects an account from the dropdown, THE Dashboard SHALL filter all displayed EC2 instances to only show instances from the selected account
4. WHEN an account is selected, THE Dashboard SHALL persist the selection in local state for the current session
5. WHEN no account is selected, THE Dashboard SHALL display a default message prompting the user to select an account

### Requirement 2: Application Tag Filtering

**User Story:** As a CloudOps operator, I want to filter EC2 instances by their application_name tag, so that I can focus on instances for a specific application.

#### Acceptance Criteria

1. WHEN an account is selected, THE Dashboard SHALL display a dropdown menu for application tag filtering
2. WHEN the user clicks the application tag dropdown, THE Dashboard SHALL display all unique application_name tag values from instances in the selected account
3. WHEN the user selects an application tag, THE Dashboard SHALL filter the instance list to show only instances with the matching application_name tag
4. WHEN an application tag is selected, THE Dashboard SHALL persist the selection in local state for the current session
5. WHEN no application tag is selected, THE Dashboard SHALL display all instances from the selected account

### Requirement 3: Instance Display

**User Story:** As a CloudOps operator, I want to view all EC2 instances with their current state, type, and schedule information, so that I can understand the current configuration and status.

#### Acceptance Criteria

1. WHEN instances are filtered by account and application tag, THE Dashboard SHALL display a table of matching instances
2. WHEN displaying instances, THE Dashboard SHALL show the instance ID, instance type, current state (Running/Stopped), and assigned schedule (if any)
3. WHEN an instance has no assigned schedule, THE Dashboard SHALL display "No Schedule" or similar indicator
4. WHEN the instance list is empty after filtering, THE Dashboard SHALL display a message indicating no instances match the current filters
5. WHEN instances are displayed, THE Dashboard SHALL update the display when instance state changes due to user actions

### Requirement 4: Stop Instance Action

**User Story:** As a CloudOps operator, I want to stop a running EC2 instance, so that I can reduce costs when the instance is not needed.

#### Acceptance Criteria

1. WHEN an instance is in Running state, THE Dashboard SHALL display a Stop action button for that instance
2. WHEN the user clicks the Stop button, THE Dashboard SHALL send a stop request to the backend API
3. WHEN the stop request succeeds, THE Dashboard SHALL update the instance state to Stopped and display a success notification
4. WHEN the stop request fails, THE Dashboard SHALL display an error notification with the failure reason
5. WHEN an instance is in Stopped state, THE Dashboard SHALL disable the Stop button

### Requirement 5: Start Instance Action

**User Story:** As a CloudOps operator, I want to start a stopped EC2 instance, so that I can bring instances online when needed.

#### Acceptance Criteria

1. WHEN an instance is in Stopped state, THE Dashboard SHALL display a Start action button for that instance
2. WHEN the user clicks the Start button, THE Dashboard SHALL send a start request to the backend API
3. WHEN the start request succeeds, THE Dashboard SHALL update the instance state to Running and display a success notification
4. WHEN the start request fails, THE Dashboard SHALL display an error notification with the failure reason
5. WHEN an instance is in Running state, THE Dashboard SHALL disable the Start button

### Requirement 6: Modify Instance Type

**User Story:** As a CloudOps operator, I want to modify the instance type of an EC2 instance, so that I can resize instances to match changing workload requirements.

#### Acceptance Criteria

1. WHEN viewing an instance, THE Dashboard SHALL display a Modify Type action button
2. WHEN the user clicks the Modify Type button, THE Dashboard SHALL display a dialog with a list of available instance types
3. WHEN the user selects a new instance type, THE Dashboard SHALL send a modify request to the backend API with the new type
4. WHEN the modify request succeeds, THE Dashboard SHALL update the instance type and display a success notification
5. WHEN the modify request fails, THE Dashboard SHALL display an error notification with the failure reason

### Requirement 7: Scheduler System - Display Common Schedules

**User Story:** As a CloudOps operator, I want to view common schedules for the selected application tag, so that I can understand available automation options.

#### Acceptance Criteria

1. WHEN an application tag is selected, THE Dashboard SHALL query DynamoDB for schedules associated with that application tag
2. WHEN schedules are retrieved, THE Dashboard SHALL display a list of common schedules with their names, start times, stop times, and applicable days
3. WHEN no schedules exist for the selected application tag, THE Dashboard SHALL display a message indicating no schedules are configured
4. WHEN schedules are displayed, THE Dashboard SHALL show the schedule information in a readable format (e.g., "Business Hours: 8 AM - 6 PM, Mon-Fri")
5. WHEN the application tag selection changes, THE Dashboard SHALL refresh the displayed schedules

### Requirement 8: Scheduler System - Apply Schedule to Instance

**User Story:** As a CloudOps operator, I want to apply a schedule to an EC2 instance, so that I can automate start/stop operations based on time-based rules.

#### Acceptance Criteria

1. WHEN viewing an instance, THE Dashboard SHALL display an Apply Schedule action button
2. WHEN the user clicks Apply Schedule, THE Dashboard SHALL display a dialog with available schedules for the selected application tag
3. WHEN the user selects a schedule from the dialog, THE Dashboard SHALL send a request to the backend API to associate the schedule with the instance
4. WHEN the schedule association succeeds, THE Dashboard SHALL update the instance's displayed schedule and show a success notification
5. WHEN the schedule association fails, THE Dashboard SHALL display an error notification with the failure reason

### Requirement 9: Scheduler System - Store Schedules in DynamoDB

**User Story:** As a system administrator, I want schedules to be persisted in DynamoDB, so that scheduler configurations survive application restarts and are accessible across sessions.

#### Acceptance Criteria

1. WHEN a schedule is created or modified, THE Backend SHALL store the schedule in DynamoDB with the application tag as a partition key
2. WHEN a schedule is stored, THE Backend SHALL include the schedule name, start time, stop time, and applicable days of week
3. WHEN a schedule is associated with an instance, THE Backend SHALL store the association in DynamoDB linking the instance ID to the schedule
4. WHEN the Dashboard queries for schedules, THE Backend SHALL retrieve all schedules for the selected application tag from DynamoDB
5. WHEN a schedule is deleted, THE Backend SHALL remove the schedule from DynamoDB and disassociate it from all instances

### Requirement 10: Integration with CloudOpsView

**User Story:** As a CloudOps operator, I want the EC2 Management Dashboard to integrate seamlessly with the existing CloudOpsView component, so that I can access it alongside other cloud resource management features.

#### Acceptance Criteria

1. WHEN the CloudOpsView component loads, THE Dashboard SHALL be available as a tab or section within the EC2 tab
2. WHEN the user navigates to the EC2 Management Dashboard, THE Dashboard SHALL load without errors and display the account selection dropdown
3. WHEN the user switches between tabs in CloudOpsView, THE Dashboard SHALL maintain its current filter selections (account and application tag)
4. WHEN the Dashboard is displayed, THE Dashboard SHALL use the same styling and component patterns as the existing CloudOpsView (Tailwind CSS, shadcn/ui)
5. WHEN the Dashboard makes API calls, THE Dashboard SHALL use the same API base URL and error handling patterns as the existing CloudOpsView

### Requirement 11: Backend API - EC2 Instance Management

**User Story:** As a backend service, I want to provide API endpoints for EC2 instance management, so that the frontend can perform start, stop, and modify operations.

#### Acceptance Criteria

1. WHEN the frontend sends a start request, THE Backend SHALL call the AWS EC2 API to start the specified instance
2. WHEN the frontend sends a stop request, THE Backend SHALL call the AWS EC2 API to stop the specified instance
3. WHEN the frontend sends a modify type request, THE Backend SHALL call the AWS EC2 API to modify the instance type
4. WHEN an EC2 API call succeeds, THE Backend SHALL return a success response with the updated instance state
5. WHEN an EC2 API call fails, THE Backend SHALL return an error response with a descriptive error message

### Requirement 12: Backend API - Scheduler Management

**User Story:** As a backend service, I want to provide API endpoints for scheduler management, so that the frontend can create, retrieve, and apply schedules.

#### Acceptance Criteria

1. WHEN the frontend requests schedules for an application tag, THE Backend SHALL query DynamoDB and return all schedules for that tag
2. WHEN the frontend requests to apply a schedule to an instance, THE Backend SHALL store the association in DynamoDB
3. WHEN the frontend requests to create a new schedule, THE Backend SHALL validate the schedule configuration and store it in DynamoDB
4. WHEN a schedule is stored, THE Backend SHALL return the schedule with a unique identifier
5. WHEN a schedule retrieval fails, THE Backend SHALL return an error response with a descriptive error message
