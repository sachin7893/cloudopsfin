"""Configuration for CloudWatch metrics and logs"""

from typing import Dict, List

# Metric configurations by service type
METRIC_CONFIGS: Dict[str, Dict[str, any]] = {
    'EC2': {
        'namespace': 'AWS/EC2',
        'metrics': ['CPUUtilization', 'NetworkIn', 'NetworkOut', 'DiskReadBytes', 'DiskWriteBytes'],
        'dimension_name': 'InstanceId'
    },
    'ECS': {
        'namespace': 'AWS/ECS',
        'metrics': ['CPUUtilization', 'MemoryUtilization'],
        'dimension_name': 'ServiceName'
    },
    'EKS': {
        'namespace': 'ContainerInsights',
        'metrics': ['node_cpu_utilization', 'node_memory_utilization', 'pod_cpu_utilization'],
        'dimension_name': 'ClusterName'
    },
    'RDS': {
        'namespace': 'AWS/RDS',
        'metrics': ['CPUUtilization', 'DatabaseConnections', 'FreeableMemory', 'ReadLatency', 'WriteLatency'],
        'dimension_name': 'DBInstanceIdentifier'
    },
    'Lambda': {
        'namespace': 'AWS/Lambda',
        'metrics': ['Invocations', 'Errors', 'Duration', 'Throttles', 'ConcurrentExecutions'],
        'dimension_name': 'FunctionName'
    }
}

# Log group patterns by service type
LOG_GROUP_PATTERNS: Dict[str, str] = {
    'EC2': '/aws/ec2/',
    'ECS': '/aws/ecs/',
    'EKS': '/aws/eks/',
    'RDS': '/aws/rds/instance/',
    'Lambda': '/aws/lambda/'
}

# Constants
DEFAULT_TIME_RANGE_HOURS = 24
MAX_LOG_RESULTS = 50
ANOMALY_THRESHOLD_SIGMA = 2
TIMEOUT_MS = 10000
