// GenAI service for analyzing data and generating recommendations

import {
  BedrockRuntimeClient,
  InvokeModelCommand
} from '@aws-sdk/client-bedrock-runtime';
import { MetricAnalysis, LogExcerpt, Remediation } from './types.js';

export class GenAIService {
  private client: BedrockRuntimeClient;
  private modelId: string;
  
  constructor(region: string = 'us-east-1') {
    this.client = new BedrockRuntimeClient({ region });
    // Using Claude 3 Sonnet as default
    this.modelId = 'anthropic.claude-3-sonnet-20240229-v1:0';
  }
  
  async analyzeAndRecommend(
    query: string,
    metrics: MetricAnalysis[],
    logs: LogExcerpt[],
    conversationContext?: any
  ): Promise<{
    message: string;
    recommendations: Remediation[];
  }> {
    const prompt = this.constructPrompt(query, metrics, logs, conversationContext);
    
    try {
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });
      
      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      
      const analysisText = responseBody.content[0].text;
      
      return this.parseResponse(analysisText);
    } catch (error: any) {
      console.error('GenAI service error:', error);
      
      // Fallback to rule-based analysis
      return this.fallbackAnalysis(query, metrics, logs);
    }
  }
  
  private constructPrompt(
    query: string,
    metrics: MetricAnalysis[],
    logs: LogExcerpt[],
    conversationContext?: any
  ): string {
    let prompt = `You are an AWS CloudOps troubleshooting assistant. Analyze the following data and provide actionable recommendations.

User Query: ${query}

`;
    
    if (conversationContext?.messages?.length > 0) {
      prompt += `Previous Conversation:\n`;
      conversationContext.messages.slice(-3).forEach((msg: any) => {
        prompt += `${msg.role}: ${msg.content}\n`;
      });
      prompt += '\n';
    }
    
    if (metrics.length > 0) {
      prompt += `CloudWatch Metrics:\n`;
      metrics.forEach(metric => {
        prompt += `- ${metric.metricName} (${metric.namespace}): `;
        if (metric.anomalyDetected) {
          prompt += `ANOMALY DETECTED`;
          if (metric.thresholdBreached) {
            prompt += ` - Threshold ${metric.thresholdBreached.threshold.toFixed(2)} breached at ${metric.thresholdBreached.breachedAt}`;
          }
        } else {
          const avgValue = metric.values.reduce((sum, v) => sum + v.value, 0) / metric.values.length;
          prompt += `Average: ${avgValue.toFixed(2)}`;
        }
        prompt += '\n';
      });
      prompt += '\n';
    }
    
    if (logs.length > 0) {
      prompt += `CloudWatch Logs (Recent Errors/Warnings):\n`;
      logs.slice(0, 10).forEach(log => {
        prompt += `[${log.level}] ${log.timestamp}: ${log.message.substring(0, 200)}\n`;
      });
      prompt += '\n';
    }
    
    prompt += `Please provide:
1. A clear analysis of the issue
2. Prioritized remediation steps (high/medium/low priority)
3. AWS CLI commands or console actions where applicable

Format your response as:
ANALYSIS: [your analysis]
RECOMMENDATIONS:
[priority] - [title]: [description]
Steps: [numbered steps]
CLI: [aws cli command if applicable]
`;
    
    return prompt;
  }
  
  private parseResponse(text: string): {
    message: string;
    recommendations: Remediation[];
  } {
    const recommendations: Remediation[] = [];
    
    // Extract analysis section
    const analysisMatch = text.match(/ANALYSIS:(.*?)(?=RECOMMENDATIONS:|$)/s);
    const message = analysisMatch ? analysisMatch[1].trim() : text;
    
    // Extract recommendations
    const recPattern = /\[(high|medium|low)\]\s*-\s*([^:]+):\s*([^\n]+)(?:\s*Steps:\s*([^\n]+))?(?:\s*CLI:\s*([^\n]+))?/gi;
    let match;
    
    while ((match = recPattern.exec(text)) !== null) {
      const [, priority, title, description, stepsText, cliCommand] = match;
      
      const steps = stepsText
        ? stepsText.split(/\d+\./).filter(s => s.trim()).map(s => s.trim())
        : [description];
      
      recommendations.push({
        priority: priority as 'high' | 'medium' | 'low',
        title: title.trim(),
        description: description.trim(),
        steps,
        awsCliCommand: cliCommand?.trim()
      });
    }
    
    return { message, recommendations };
  }
  
  private fallbackAnalysis(
    query: string,
    metrics: MetricAnalysis[],
    logs: LogExcerpt[]
  ): {
    message: string;
    recommendations: Remediation[];
  } {
    let message = 'Analysis based on CloudWatch data:\n\n';
    const recommendations: Remediation[] = [];
    
    // Analyze metrics
    const anomalies = metrics.filter(m => m.anomalyDetected);
    if (anomalies.length > 0) {
      message += `Found ${anomalies.length} metric anomalies:\n`;
      anomalies.forEach(m => {
        message += `- ${m.metricName}: Unusual spike detected\n`;
      });
      
      recommendations.push({
        priority: 'high',
        title: 'Investigate Metric Anomalies',
        description: 'Review the metrics showing unusual patterns',
        steps: [
          'Check CloudWatch dashboard for detailed metric trends',
          'Compare with historical baseline',
          'Investigate correlated events or deployments'
        ]
      });
    }
    
    // Analyze logs
    const errorLogs = logs.filter(l => l.level === 'ERROR');
    if (errorLogs.length > 0) {
      message += `\nFound ${errorLogs.length} error log entries.\n`;
      
      recommendations.push({
        priority: 'high',
        title: 'Review Error Logs',
        description: 'Multiple errors detected in CloudWatch Logs',
        steps: [
          'Review error patterns in CloudWatch Logs Insights',
          'Check for common error messages',
          'Verify application health and dependencies'
        ]
      });
    }
    
    if (recommendations.length === 0) {
      message += 'No significant issues detected in the available data.';
      recommendations.push({
        priority: 'low',
        title: 'Continue Monitoring',
        description: 'No immediate issues found',
        steps: [
          'Continue monitoring CloudWatch metrics',
          'Set up alarms for critical thresholds',
          'Review logs periodically'
        ]
      });
    }
    
    return { message, recommendations };
  }
}
