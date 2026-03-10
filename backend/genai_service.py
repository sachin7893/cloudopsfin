"""GenAI service for analyzing data and generating recommendations"""

import boto3
import json
import os
from typing import List, Dict, Optional, Tuple


class GenAIService:
    """Service for GenAI-powered analysis and recommendations"""
    
    def __init__(self, region: str = 'us-east-1'):
        self.client = boto3.client('bedrock-runtime', region_name=region)
        # Using Claude 3.5 Sonnet (latest active model) - can be overridden via env var
        self.model_id = os.environ.get(
            'BEDROCK_MODEL_ID',
            'anthropic.claude-3-5-sonnet-20241022-v2:0'
        )
    
    def analyze_and_recommend(
        self,
        query: str,
        metrics: List[Dict],
        logs: List[Dict],
        conversation_context: Optional[Dict] = None
    ) -> Tuple[str, List[Dict]]:
        """Analyze metrics and logs, generate recommendations"""
        prompt = self._construct_prompt(query, metrics, logs, conversation_context)
        
        try:
            response = self.client.invoke_model(
                modelId=self.model_id,
                contentType='application/json',
                accept='application/json',
                body=json.dumps({
                    'anthropic_version': 'bedrock-2023-05-31',
                    'max_tokens': 2000,
                    'messages': [
                        {
                            'role': 'user',
                            'content': prompt
                        }
                    ]
                })
            )
            
            response_body = json.loads(response['body'].read())
            analysis_text = response_body['content'][0]['text']
            
            return self._parse_response(analysis_text)
            
        except Exception as e:
            print(f'GenAI service error: {e}')
            print('Falling back to rule-based analysis')
            # Fallback to rule-based analysis
            return self._fallback_analysis(query, metrics, logs)
    
    def _construct_prompt(
        self,
        query: str,
        metrics: List[Dict],
        logs: List[Dict],
        conversation_context: Optional[Dict] = None
    ) -> str:
        """Construct prompt for GenAI analysis"""
        prompt = f"""You are an AWS CloudOps troubleshooting assistant. Analyze the following data and provide actionable recommendations.

User Query: {query}

"""
        
        if conversation_context and conversation_context.get('messages'):
            prompt += "Previous Conversation:\n"
            for msg in conversation_context['messages'][-3:]:
                prompt += f"{msg['role']}: {msg['content']}\n"
            prompt += "\n"
        
        if metrics:
            prompt += "CloudWatch Metrics:\n"
            for metric in metrics:
                prompt += f"- {metric['metricName']} ({metric['namespace']}): "
                if metric.get('anomalyDetected'):
                    prompt += "ANOMALY DETECTED"
                    if metric.get('thresholdBreached'):
                        threshold = metric['thresholdBreached']['threshold']
                        breached_at = metric['thresholdBreached']['breachedAt']
                        prompt += f" - Threshold {threshold:.2f} breached at {breached_at}"
                else:
                    if metric['values']:
                        avg_value = sum(v['value'] for v in metric['values']) / len(metric['values'])
                        prompt += f"Average: {avg_value:.2f}"
                prompt += "\n"
            prompt += "\n"
        
        if logs:
            prompt += "CloudWatch Logs (Recent Errors/Warnings):\n"
            for log in logs[:10]:
                message_preview = log['message'][:200]
                prompt += f"[{log['level']}] {log['timestamp']}: {message_preview}\n"
            prompt += "\n"
        
        prompt += """Please provide:
1. A clear analysis of the issue
2. Prioritized remediation steps (high/medium/low priority)
3. AWS CLI commands or console actions where applicable

Format your response as:
ANALYSIS: [your analysis]
RECOMMENDATIONS:
[priority] - [title]: [description]
Steps: [numbered steps]
CLI: [aws cli command if applicable]
"""
        
        return prompt
    
    def _parse_response(self, text: str) -> Tuple[str, List[Dict]]:
        """Parse GenAI response into message and recommendations"""
        recommendations = []
        
        # Extract analysis section
        import re
        analysis_match = re.search(r'ANALYSIS:(.*?)(?=RECOMMENDATIONS:|$)', text, re.DOTALL)
        message = analysis_match.group(1).strip() if analysis_match else text
        
        # Extract recommendations
        rec_pattern = re.compile(
            r'\[(high|medium|low)\]\s*-\s*([^:]+):\s*([^\n]+)(?:\s*Steps:\s*([^\n]+))?(?:\s*CLI:\s*([^\n]+))?',
            re.IGNORECASE
        )
        
        for match in rec_pattern.finditer(text):
            priority, title, description, steps_text, cli_command = match.groups()
            
            steps = []
            if steps_text:
                steps = [s.strip() for s in re.split(r'\d+\.', steps_text) if s.strip()]
            else:
                steps = [description]
            
            recommendation = {
                'priority': priority.lower(),
                'title': title.strip(),
                'description': description.strip(),
                'steps': steps
            }
            
            if cli_command:
                recommendation['awsCliCommand'] = cli_command.strip()
            
            recommendations.append(recommendation)
        
        return message, recommendations
    
    def _fallback_analysis(
        self,
        query: str,
        metrics: List[Dict],
        logs: List[Dict]
    ) -> Tuple[str, List[Dict]]:
        """Fallback rule-based analysis when GenAI is unavailable"""
        message = "Analysis based on CloudWatch data:\n\n"
        recommendations = []
        
        # Analyze metrics
        anomalies = [m for m in metrics if m.get('anomalyDetected')]
        if anomalies:
            message += f"Found {len(anomalies)} metric anomalies:\n"
            for metric in anomalies:
                message += f"- {metric['metricName']}: Unusual spike detected\n"
            
            recommendations.append({
                'priority': 'high',
                'title': 'Investigate Metric Anomalies',
                'description': 'Review the metrics showing unusual patterns',
                'steps': [
                    'Check CloudWatch dashboard for detailed metric trends',
                    'Compare with historical baseline',
                    'Investigate correlated events or deployments'
                ]
            })
        
        # Analyze logs
        error_logs = [log for log in logs if log['level'] == 'ERROR']
        if error_logs:
            message += f"\nFound {len(error_logs)} error log entries.\n"
            
            recommendations.append({
                'priority': 'high',
                'title': 'Review Error Logs',
                'description': 'Multiple errors detected in CloudWatch Logs',
                'steps': [
                    'Review error patterns in CloudWatch Logs Insights',
                    'Check for common error messages',
                    'Verify application health and dependencies'
                ]
            })
        
        if not recommendations:
            message += "No significant issues detected in the available data."
            recommendations.append({
                'priority': 'low',
                'title': 'Continue Monitoring',
                'description': 'No immediate issues found',
                'steps': [
                    'Continue monitoring CloudWatch metrics',
                    'Set up alarms for critical thresholds',
                    'Review logs periodically'
                ]
            })
        
        return message, recommendations
