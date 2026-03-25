import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Cloud, MoreVertical, Play, Square, Calendar, Send, MessageSquare, X } from 'lucide-react';
import { EC2ManagementDashboard } from './EC2ManagementDashboard';
import { ECSManagementDashboard } from './ECSManagementDashboard';
import {
  fetchEKSClusters,
} from '@/lib/mockData';
import { 
  EC2Instance, 
  EKSCluster, 
  ECSService, 
  CloudOpsChatMessage,
  ConversationContext 
} from '@/types';
import { toast } from 'sonner';

export function CloudOpsView() {
  const [eksClusters, setEksClusters] = useState<EKSCluster[]>([]);
  
  // Chat state
  const [messages, setMessages] = useState<CloudOpsChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your CloudOps Troubleshooting Assistant. I can help you diagnose issues with EC2, ECS, EKS, RDS, and Lambda resources by analyzing CloudWatch metrics and logs. How can I assist you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationContext, setConversationContext] = useState<ConversationContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const API_BASE = 'https://0azsdk6qbb.execute-api.ap-south-1.amazonaws.com/prod';
  const CONTEXT_KEY = 'cloudops_chat_context_v1';
  const CONTEXT_TTL_HOURS = 24;

  useEffect(() => {
    setEksClusters(fetchEKSClusters());
    loadConversationContext();
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversationContext = () => {
    try {
      const stored = localStorage.getItem(CONTEXT_KEY);
      if (stored) {
        const context: ConversationContext = JSON.parse(stored);
        const expiresAt = new Date(context.expiresAt);
        
        if (expiresAt > new Date()) {
          setConversationContext(context);
          // Restore messages from context
          const restoredMessages = context.messages.map((msg, idx) => ({
            id: `restored-${idx}`,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          }));
          if (restoredMessages.length > 0) {
            setMessages([messages[0], ...restoredMessages]);
          }
        } else {
          localStorage.removeItem(CONTEXT_KEY);
        }
      }
    } catch (err) {
      console.warn('Failed to load conversation context', err);
    }
  };

  const saveConversationContext = (newMessages: CloudOpsChatMessage[]) => {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CONTEXT_TTL_HOURS * 60 * 60 * 1000);
      
      const context: ConversationContext = {
        sessionId: conversationContext?.sessionId || `session-${Date.now()}`,
        messages: newMessages.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp.toISOString(),
        })),
        createdAt: conversationContext?.createdAt || now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
      setConversationContext(context);
    } catch (err) {
      console.warn('Failed to save conversation context', err);
    }
  };

  const clearChat = () => {
    setMessages([messages[0]]);
    localStorage.removeItem(CONTEXT_KEY);
    setConversationContext(null);
    toast.success('Chat cleared');
  };

  const handleSendMessage = async () => {
    const prompt = inputMessage.trim();
    if (!prompt) {
      toast.error('Please enter a message');
      return;
    }

    const userMessage: CloudOpsChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/cloudops-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          conversationContext: conversationContext || {
            sessionId: `session-${Date.now()}`,
            messages: [],
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      const assistantMessage: CloudOpsChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || 'No response from server',
        timestamp: new Date(),
        metrics: data.metrics,
        logs: data.logs,
        recommendations: data.recommendations,
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveConversationContext(finalMessages);
    } catch (err) {
      const errorMessage: CloudOpsChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Failed to get response: ${String(err)}. The CloudOps chat API may not be available yet.`,
        timestamp: new Date(),
      };
      setMessages([...updatedMessages, errorMessage]);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuspendCluster = (clusterId: string, suspend: boolean) => {
    setEksClusters((prev) =>
      prev.map((cluster) =>
        cluster.id === clusterId
          ? {
              ...cluster,
              status: suspend ? 'Suspended' : 'Active',
              nodeCount: suspend ? 0 : 6,
            }
          : cluster
      )
    );
    toast.success(
      suspend
        ? `Suspending cluster (setting node min/max to 0)`
        : `Activating cluster`
    );
  };

  return (
    <div className="flex h-full gap-6">
      {/* Left Column: Resource Management (60%) */}
      <div className="flex-1 space-y-6">
        <div className="flex items-center gap-2">
          <Cloud className="h-6 w-6" />
          <h1 className="text-3xl font-bold">CloudOps Dashboard</h1>
        </div>

        <Tabs defaultValue="ec2-manage" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="ec2-manage">EC2 Manage</TabsTrigger>
            <TabsTrigger value="ecs">ECS</TabsTrigger>
            <TabsTrigger value="eks">EKS</TabsTrigger>
          </TabsList>

          <TabsContent value="ec2-manage" className="mt-6">
            <EC2ManagementDashboard />
          </TabsContent>

          <TabsContent value="ecs" className="mt-6">
            <ECSManagementDashboard />
          </TabsContent>

          <TabsContent value="eks" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>EKS Clusters</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cluster Name</TableHead>
                      <TableHead>Region</TableHead>
                      <TableHead>Node Count</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Suspend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eksClusters.map((cluster) => (
                      <TableRow key={cluster.id}>
                        <TableCell className="font-medium">
                          {cluster.name}
                        </TableCell>
                        <TableCell>{cluster.region}</TableCell>
                        <TableCell>{cluster.nodeCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cluster.status === 'Active' ? 'default' : 'secondary'
                            }
                          >
                            {cluster.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm text-muted-foreground">
                              {cluster.status === 'Suspended'
                                ? 'Activate'
                                : 'Suspend'}
                            </span>
                            <Switch
                              checked={cluster.status === 'Suspended'}
                              onCheckedChange={(checked) =>
                                handleSuspendCluster(cluster.id, checked)
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Column: Troubleshooting Chat (40%) */}
      <div className="w-[40%] flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Troubleshooting Assistant
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              aria-label="Clear chat"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-4 py-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">
                        {message.content}
                      </div>
                      {message.metrics && message.metrics.length > 0 && (
                        <div className="mt-2 text-xs opacity-80">
                          <div className="font-medium">Metrics:</div>
                          {message.metrics.map((metric, idx) => (
                            <div key={idx}>
                              {metric.metricName}: {metric.anomalyDetected ? '⚠️ Anomaly detected' : '✓ Normal'}
                            </div>
                          ))}
                        </div>
                      )}
                      {message.logs && message.logs.length > 0 && (
                        <div className="mt-2 text-xs opacity-80">
                          <div className="font-medium">Logs:</div>
                          {message.logs.slice(0, 3).map((log, idx) => (
                            <div key={idx} className="font-mono">
                              [{log.level}] {log.message.substring(0, 50)}...
                            </div>
                          ))}
                        </div>
                      )}
                      {message.recommendations && message.recommendations.length > 0 && (
                        <div className="mt-2 text-xs opacity-80">
                          <div className="font-medium">Recommendations:</div>
                          {message.recommendations.map((rec, idx) => (
                            <div key={idx}>
                              • {rec.title}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-2">
                      <div className="text-sm">Analyzing...</div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask about your AWS resources..."
                  disabled={isLoading}
                  aria-label="Message input"
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={isLoading || !inputMessage.trim()}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
