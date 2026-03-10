"""Query parsing logic to extract service type, resource ID, and time range"""

import re
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from config import DEFAULT_TIME_RANGE_HOURS

SERVICE_KEYWORDS = {
    'EC2': ['ec2', 'instance', 'instances'],
    'ECS': ['ecs', 'container', 'service', 'task'],
    'EKS': ['eks', 'kubernetes', 'k8s', 'cluster'],
    'RDS': ['rds', 'database', 'db'],
    'Lambda': ['lambda', 'function']
}

RESOURCE_ID_PATTERNS = {
    'EC2': re.compile(r'i-[a-z0-9]{8,17}', re.IGNORECASE),
    'ECS': re.compile(r'arn:aws:ecs:[^:]+:[^:]+:(service|task)/[^\s]+', re.IGNORECASE),
    'EKS': re.compile(r'[a-zA-Z0-9][\w-]{0,99}'),
    'RDS': re.compile(r'[a-zA-Z][a-zA-Z0-9-]{0,62}'),
    'Lambda': re.compile(r'(?:arn:aws:lambda:[^:]+:[^:]+:function:)?([a-zA-Z0-9-_]{1,64})', re.IGNORECASE)
}

TIME_PATTERNS = [
    (re.compile(r'last\s+(\d+)\s+hour(s)?', re.IGNORECASE), 1),
    (re.compile(r'last\s+(\d+)\s+day(s)?', re.IGNORECASE), 24),
    (re.compile(r'past\s+(\d+)\s+hour(s)?', re.IGNORECASE), 1),
    (re.compile(r'past\s+(\d+)\s+day(s)?', re.IGNORECASE), 24),
    (re.compile(r'since\s+yesterday', re.IGNORECASE), 24)
]


def parse_query(query: str, conversation_context: Optional[Dict] = None) -> Dict:
    """Parse user query to extract service type, resource ID, and time range"""
    lower_query = query.lower()
    
    # Extract service type
    service_type = None
    for service, keywords in SERVICE_KEYWORDS.items():
        if any(keyword in lower_query for keyword in keywords):
            service_type = service
            break
    
    # Use context if service type not found in current query
    if not service_type and conversation_context:
        service_type = conversation_context.get('lastServiceType')
    
    # Extract resource ID
    resource_id = None
    if service_type:
        pattern = RESOURCE_ID_PATTERNS[service_type]
        match = pattern.search(query)
        if match:
            # For Lambda, extract function name from ARN or use direct name
            if service_type == 'Lambda' and match.lastindex and match.lastindex >= 1:
                resource_id = match.group(1)
            else:
                resource_id = match.group(0)
    
    # Use context if resource ID not found in current query
    if not resource_id and conversation_context:
        resource_id = conversation_context.get('lastResourceId')
    
    # Extract time range
    time_range = parse_time_range(query)
    
    return {
        'service_type': service_type,
        'resource_id': resource_id,
        'time_range': time_range,
        'raw_query': query
    }


def parse_time_range(query: str) -> Tuple[datetime, datetime]:
    """Parse time range from query string"""
    end_time = datetime.utcnow()
    hours = DEFAULT_TIME_RANGE_HOURS
    
    for pattern, multiplier in TIME_PATTERNS:
        match = pattern.search(query)
        if match:
            if 'yesterday' in pattern.pattern.lower():
                hours = 24
            else:
                hours = int(match.group(1)) * multiplier
            break
    
    start_time = end_time - timedelta(hours=hours)
    
    return start_time, end_time


def extract_service_and_resource(query: str) -> Dict[str, Optional[str]]:
    """Extract service type and resource ID from query"""
    parsed = parse_query(query)
    return {
        'service_type': parsed['service_type'],
        'resource_id': parsed['resource_id']
    }
