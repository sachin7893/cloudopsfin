import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { ChartContainer } from '@/components/ui/chart';
import { ChatMessage } from '@/types';
import { Send, DollarSign } from 'lucide-react';

export function FinOpsView() {
  // only keep the finops (yearly trend) data for now
  const [finopsData, setFinopsData] = useState<{ month: string; total_cost: number }[]>([]);
  // API may return top increases with two months and difference
  const [apiTopIncreases, setApiTopIncreases] = useState<
    { service_name: string; nov_2025_cost: number; dec_2025_cost: number; cost_difference: number }[]
  >([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        'Hello! I\'m your FinOps Copilot. I can help you analyze costs, identify savings opportunities, and optimize your cloud spending. How can I assist you today?',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  // Frontend memory store (short-term, per-session)
  type MemoryItem = {
    id: string;
    type: 'absence' | 'note';
    resource?: string;
    period?: string; // YYYY-MM
    text: string;
    resolved?: boolean;
    createdAt: string;
  };

  const [memories, setMemories] = useState<MemoryItem[]>([]);

  // interactive follow-up state: when the user prompt is missing info (e.g. year or resource)
  type Followup =
    | { kind: 'ask_period'; resource: string; originalPrompt: string }
    | { kind: 'ask_resource'; originalPrompt: string }
    | null;
  const [pendingFollowup, setPendingFollowup] = useState<Followup>(null);

  // Production memory strategy: prefer system (server-side) memory with localStorage fallback
  // The API exposes only `/chat`. Use `/chat` with actions to manage memories on the server.
  const USE_SYSTEM_MEMORY = false; // use server memory via /chat
  const MEM_KEY = 'finops_memories_v1';
  const MEM_TTL_DAYS = 30; // expire memories older than this
  const MAX_MEMORIES = 200; // keep at most this many recent memories

  const pruneMemories = (arr: MemoryItem[]) => {
    if (!Array.isArray(arr) || arr.length === 0) return [] as MemoryItem[];
    const ttlMs = MEM_TTL_DAYS * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - ttlMs;
    const filtered = arr.filter((m) => {
      if (!m || !m.createdAt) return false;
      const t = Date.parse(m.createdAt);
      if (isNaN(t)) return false;
      return t >= cutoff;
    });
    // sort by newest first and enforce max count
    const sorted = filtered.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return sorted.slice(0, MAX_MEMORIES);
  };

  // load memories from server (preferred) or localStorage
  useEffect(() => {
    const loadMemories = async () => {
      if (USE_SYSTEM_MEMORY) {
        try {
          // Request server memories via /chat action
          const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_memories' }),
          });
          if (res.ok) {
            const serverList = (await res.json()) as MemoryItem[];
            if (Array.isArray(serverList) && serverList.length) {
              setMemories(pruneMemories(serverList));
              return;
            }
          } else {
            console.warn('memories/chat:get_memories not ok', res.status);
          }
        } catch (err) {
          console.warn('memories via /chat failed, falling back to localStorage', err);
        }
      }

      // fallback to localStorage
      try {
        const raw = localStorage.getItem(MEM_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MemoryItem[];
          setMemories(Array.isArray(parsed) ? parsed : []);
        }
      } catch (err) {
        console.warn('Failed to load memories from localStorage', err);
      }
    };

    loadMemories();
  }, []);

  // persist local cache whenever memories change
  useEffect(() => {
    try {
      const pruned = pruneMemories(memories);
      const same = pruned.length === memories.length && pruned.every((m, i) => m.id === memories[i].id);
      if (!same) {
        // update local state with pruned list (this will re-run this effect once)
        setMemories(pruned);
        return;
      }
      localStorage.setItem(MEM_KEY, JSON.stringify(pruned));
    } catch (err) {
      console.warn('Failed to persist memories to localStorage', err);
    }
  }, [memories]);

  const addMemory = (m: Omit<MemoryItem, 'id' | 'createdAt'>, context?: { previousPrompt?: string; currentPrompt?: string }) => {
    const item: MemoryItem = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      createdAt: new Date().toISOString(),
      resolved: false,
      ...m,
    };
    // optimistically add locally and enforce TTL/max
    setMemories((prev) => pruneMemories([item, ...prev]));

    // attempt to persist to server, update id/createdAt if server returns
    // Always send add_memory when we have previousPrompt context (no-data flow),
    // even if USE_SYSTEM_MEMORY is disabled for general memory syncing.
    if (USE_SYSTEM_MEMORY || context?.previousPrompt) {
      (async () => {
        try {
          // Use /chat to add memory on server. Combine previous+current prompts into a single prompt string
          const combinedPrompt = context?.previousPrompt ? `${context.previousPrompt} ${context.currentPrompt ?? ''}`.trim() : (context?.currentPrompt ?? undefined);
          const body: any = { action: 'add_memory', memory: m };
          if (combinedPrompt) body.prompt = combinedPrompt;
          const res = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const saved = (await res.json()) as MemoryItem;
            // replace local optimistic item with server-provided one
            setMemories((prev) => pruneMemories(prev.map((it) => (it.id === item.id ? { ...saved } : it))));
          } else {
            console.warn('Failed to save memory via /chat', res.status);
          }
        } catch (err) {
          console.warn('Error saving memory via /chat', err);
        }
      })();
    }

    return item;
  };

  const resolveMemories = (predicate: (m: MemoryItem) => boolean) => {
    // mark locally and prune
    setMemories((prev) => pruneMemories(prev.map((m) => (predicate(m) ? { ...m, resolved: true } : m))));

    // also update server-side memories if available
    if (USE_SYSTEM_MEMORY) {
      const toResolve = memories.filter(predicate);
      toResolve.forEach((mem) => {
        if (!mem.id) return;
        (async () => {
          try {
            await fetch(`${API_BASE}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'resolve_memory', id: mem.id }),
            });
          } catch (err) {
            console.warn('Failed to resolve memory via /chat', mem.id, err);
          }
        })();
      });
    }
  };

  const normalizeMonthFromPrompt = (text: string): string | null => {
    // match YYYY-MM
    const ymd = text.match(/(20\d{2})[-/](0[1-9]|1[0-2])/);
    if (ymd) return `${ymd[1]}-${ymd[2]}`;

    // match month name + year e.g. May 2025
    const months = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    } as Record<string, string>;

    const m = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s,-]+(20\d{2})\b/i);
    if (m) {
      const mon = months[m[1].toLowerCase().slice(0, 3)];
      return `${m[2]}-${mon}`;
    }

    return null;
  };

  const detectResourceFromPrompt = (text: string): string | null => {
    const services = ['s3', 'ec2', 'rds', 'lambda', 'dynamodb', 'vpc', 'cloudwatch', 'elb', 'rds', 'efs'];
    const low = text.toLowerCase();
    for (const s of services) {
      const re = new RegExp(`\\b${s}\\b`, 'i');
      if (re.test(low)) return s.toUpperCase();
    }
    return null;
  };

  const findMemoriesForPrompt = (text: string) => {
    const period = normalizeMonthFromPrompt(text);
    const resource = detectResourceFromPrompt(text);
    return memories.filter((m) => !m.resolved && ((period && m.period === period) || (resource && m.resource && m.resource.toLowerCase() === resource.toLowerCase())));
  };

  const API_BASE = 'https://0azsdk6qbb.execute-api.ap-south-1.amazonaws.com/prod';

  useEffect(() => {
    const load = async () => {
      try {
        const [finopsRes, topIncRes] = await Promise.all([
          fetch(`${API_BASE}/finops`),
          fetch(`${API_BASE}/top-increase`),
        ]);

        if (finopsRes && finopsRes.ok) {
          const data = (await finopsRes.json()) as { month: string; total_cost: number }[];
          setFinopsData(Array.isArray(data) ? data : []);
          console.debug('finops data', data);
        } else {
          console.warn('finops response not ok', finopsRes && finopsRes.status);
          setFinopsData([]);
        }

        if (topIncRes && topIncRes.ok) {
          const inc = (await topIncRes.json()) as { service_name?: string; nov_2025_cost?: number; dec_2025_cost?: number; cost_difference?: number }[];
          // normalize into expected shape
          const list = (Array.isArray(inc) ? inc : [])
            .map((r) => ({
              service_name: String(r.service_name ?? ''),
              nov_2025_cost: Number(r.nov_2025_cost ?? 0),
              dec_2025_cost: Number(r.dec_2025_cost ?? 0),
              cost_difference: Number(r.cost_difference ?? (Number(r.dec_2025_cost ?? 0) - Number(r.nov_2025_cost ?? 0))),
            }));
          setApiTopIncreases(list);
          console.debug('top-increase data', list);
        } else {
          console.warn('top-increase response not ok', topIncRes && topIncRes.status);
          setApiTopIncreases([]);
        }
      } catch (err) {
        console.error('Failed to load finops/top-increase data', err);
      }
    };

    load();
  }, []);


  const handleSendMessage = async () => {
    const prompt = inputMessage.trim();
    if (!prompt) return;

    // capture previous user prompt (if any) before we optimistically add current
    const prevUserPrompt = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') return messages[i].content;
      }
      return undefined as string | undefined;
    })();

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    // Optimistically add user message and clear input
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    // attach relevant unresolved memories as context
    const relevantMemories = findMemoriesForPrompt(prompt);
    console.debug('memories (all)', memories);
    console.debug('relevantMemories (for prompt)', relevantMemories);

    // Interactive follow-up: if we're waiting for a follow-up answer (resource or period),
    // treat this user message as the follow-up answer and combine with original prompt.
    if (pendingFollowup) {
      const answerText = prompt; // user's most recent message
      let combinedPrompt = pendingFollowup.originalPrompt;
      if (pendingFollowup.kind === 'ask_period') {
        combinedPrompt = `${pendingFollowup.originalPrompt} ${answerText}`.trim();
      } else if (pendingFollowup.kind === 'ask_resource') {
        combinedPrompt = `${pendingFollowup.originalPrompt} ${answerText}`.trim();
      }
      // clear followup and proceed to send combinedPrompt
      setPendingFollowup(null);

      const relevantMemoriesAfter = findMemoriesForPrompt(combinedPrompt);
      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: combinedPrompt, previousPrompt: prevUserPrompt ?? '', memories: relevantMemoriesAfter }),
        });

        if (!res.ok) {
          const text = await res.text();
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Chat API error: ${res.status} ${res.statusText} ${text}`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMessage]);
          return;
        }

        let parsed: any = null;
        const body = await res.json();
          const answer = body.answer ?? '';
          const match = answer.match(/\\{[\\s\\S]*\\}/);
          if (match) {
              // convert single quotes to double quotes and parse
              const jsonText = match[0].replace(/'/g, '"');
              try {
                  parsed = JSON.parse(jsonText);
                  // coerce numeric-like strings into numbers
                  const coerceNumbers = (v: any): any => {
                      if (v === null || v === undefined) return v;
                      if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
                      if (Array.isArray(v)) return v.map(coerceNumbers);
                      if (typeof v === 'object') {
                          const out: any = {};
                          Object.entries(v).forEach(([k, val]) => { out[k] = coerceNumbers(val); });
                          return out;
                      }
                      return v;
                  };
                  parsed = coerceNumbers(parsed);
                  console.log(JSON.stringify(parsed, null, 2));
              } catch (e) {
                  console.error('Failed to parse extracted object', e);
                  parsed = null;
                  console.log('Raw answer:', answer);
              }
          } else {

              console.log('Answer:', answer);

          }

        let replyText = '';
        console.log('Body:', typeof body)
        console.log('Body', body)
        // prefer parsed structured object when available (extract from answer)
        if (parsed) {
            replyText = JSON.stringify(parsed);
        } else if (typeof body === 'string') replyText = body;
        else if (body.reply) replyText = String(body.reply);
        else if (body.content) replyText = String(body.content);
        else if (body.message) replyText = String(body.message);
        else if (answer) replyText = String(answer);
        else replyText = JSON.stringify(body);

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: replyText,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      } catch (err) {
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Failed to call chat API: ${String(err)}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        return;
      }
    }

    // If the prompt misses resource or period, ask follow-up
    const detectedResource = detectResourceFromPrompt(prompt);
    const detectedPeriod = normalizeMonthFromPrompt(prompt);
    if (!detectedResource) {
      const followUpText = `Which AWS service or resource do you mean? (e.g. s3, ec2, or a resource id)`;
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: followUpText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setPendingFollowup({ kind: 'ask_resource', originalPrompt: prompt });
      return;
    }

    if (detectedResource && !detectedPeriod) {
      // Ask user for month+year
      const followUpText = `Which month and year do you mean for ${detectedResource}? (e.g. May 2025)`;
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: followUpText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setPendingFollowup({ kind: 'ask_period', resource: detectedResource, originalPrompt: prompt });
      return;
    }

      try {
          // Send request to /chat with the shape { prompt, previousPrompt, memories }
          // previousPrompt will be empty string if none
          const res = await fetch(`${API_BASE}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt, previousPrompt: prevUserPrompt ?? '', memories: relevantMemories }),
          });

          if (!res.ok) {
              const text = await res.text();
              const assistantMessage: ChatMessage = {
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: `Chat API error: ${res.status} ${res.statusText} ${text}`,
                  timestamp: new Date(),
              };
              setMessages((prev) => [...prev, assistantMessage]);
              return;
          }
          let parsed: any = null;
          const body = await res.json();
          const answer = body.answer ?? '';
          const match = answer.match(/\\{[\\s\\S]*\\}/);
          if (match) {
              // convert single quotes to double quotes and parse
              const jsonText = match[0].replace(/'/g, '"');
              try {
                  parsed = JSON.parse(jsonText);
                  // coerce numeric-like strings into numbers
                  const coerceNumbers = (v: any): any => {
                    if (v === null || v === undefined) return v;
                    if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v)) return Number(v);
                    if (Array.isArray(v)) return v.map(coerceNumbers);
                    if (typeof v === 'object') {
                      const out: any = {};
                      Object.entries(v).forEach(([k, val]) => { out[k] = coerceNumbers(val); });
                      return out;
                    }
                    return v;
                  };
                  parsed = coerceNumbers(parsed);
                  console.log(JSON.stringify(parsed, null, 2));
              } catch (e) {
                  console.error('Failed to parse extracted object', e);
                  parsed = null;
                  console.log('Raw answer:', answer);
              }
          } else {

              console.log('Answer:', answer);

          }

          // support response shapes: { reply: string } or { content: string } or plain string
          // If we successfully extracted a JSON-like object from body.answer, use that
          let replyText = '';
          console.log('Body:', typeof body)
          console.log('Body', body)
          // prefer parsed structured object when available (extract from answer)
          if (parsed) {
            replyText = JSON.stringify(parsed);
          } else if (typeof body === 'string') replyText = body;
          else if (body.reply) replyText = String(body.reply);
          else if (body.content) replyText = String(body.content);
          else if (body.message) replyText = String(body.message);
          else if (answer) replyText = String(answer);
          else replyText = JSON.stringify(body);
      

      // exact server no-data signal: { answer: "No data found." }
      const isExactNoData = typeof body === 'object' && body !== null && (body as any).answer === 'No data found.';

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: replyText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // If assistant indicates no data, store an absence memory for the resource/period
      const noDataMatch = /no data|not found|no results|nothing found|no records/i.test(replyText);
      const foundMatch = /found|available|here is|returned|showing/i.test(replyText);
      const period = normalizeMonthFromPrompt(prompt);
          const resource = detectResourceFromPrompt(prompt);

      console.log('noDataMatch', noDataMatch,period,resource);

      // Determine what previousPrompt to send with the memory. Default to blank.
      let prevForMemory = '';
      if (noDataMatch) {
        // include previous prompt only when server returned the exact no-data object
        if (isExactNoData) prevForMemory = prevUserPrompt ?? '';
        else prevForMemory = '';
      } else {
        // explicitly set blank when there was not a no-data result
        prevForMemory = '';
      }

      if (noDataMatch && Boolean(period || resource)) {
        const memText = resource && period
          ? `${resource} spike in ${period} – no data found`
          : period
          ? `No data found for ${period}`
          : `No data found for ${resource}`;
        addMemory(
          { type: 'absence', resource: resource ?? undefined, period: period ?? undefined, text: memText },
          { previousPrompt: prevForMemory, currentPrompt: prompt }
        );
      }

      // If assistant returned data, resolve any matching absence memories
      if (foundMatch && Boolean(period || resource)) {
        resolveMemories((m) =>
          !m.resolved && (
            (period ? m.period === period : false) ||
            (resource ? (m.resource ? m.resource.toLowerCase() === resource.toLowerCase() : false) : false)
          )
        );
      }
    } catch (err) {
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Failed to call chat API: ${String(err)}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  const chartConfig = {
    total: {
      label: 'Total Cost',
      color: 'hsl(var(--chart-1))',
    },
  };

  // Config for the bar chart (Nov vs Dec)
  const barChartConfig = {
    nov: { label: 'Nov 2025', color: '#8884d8' },
    dec: { label: 'Dec 2025', color: '#82ca9d' },
  };

  // Map /finops response into chart shape (yearly trend)
  const yearlyTrend = (() => {
    if (!finopsData || !finopsData.length) return [] as { key: string; label: string; total: number }[];
    return finopsData
      .slice()
      .filter((d) => d && typeof d.month === 'string')
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((d) => {
        const parts = (d.month || '').split('-');
        const year = parts[0] ?? '';
        const month = parts[1] ?? '01';
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleString(undefined, {
          month: 'short',
          year: 'numeric',
        });
        const total = Number(d.total_cost || 0);
        return { key: String(d.month), label, total: Math.round(total) };
      });
  })();

  // If API returns top resources, use them; otherwise compute month-over-month top increases
  //const topResources = apiTopIncreases && apiTopIncreases.length ? apiTopIncreases.slice(0, 10) : [];

  //const computedTopDiffs = (() => {
  //  const res: { from: string; to: string; diff: number }[] = [];
  //  for (let i = 1; i < yearlyTrend.length; i++) {
  //    const prev = yearlyTrend[i - 1];
  //    const cur = yearlyTrend[i];
  //    res.push({ from: prev.label, to: cur.label, diff: cur.total - prev.total });
  //  }
  //  return res.sort((a, b) => b.diff - a.diff).slice(0, 3);
  //})();

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Yearly Cost Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="font-medium">{payload[0].payload.label}</div>
                              <div className="font-bold text-right">${payload[0].value?.toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Increases (Month-over-month)</CardTitle>
          </CardHeader>
          <CardContent>
            {apiTopIncreases && apiTopIncreases.length ? (
              <>
                <ChartContainer config={barChartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={apiTopIncreases} margin={{ top: 10, right: 20, left: 0, bottom: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      {/* Show all service names on the horizontal axis. Rotate labels to avoid overlap. */}
                      <XAxis
                        dataKey="service_name"
                        type="category"
                        interval={0}
                        tick={{ fontSize: 12 }}
                        angle={-40}
                        textAnchor="end"
                        height={80}
                      />
                      {/* Costs on vertical axis, formatted with $ */}
                      <YAxis tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                      <Tooltip formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Cost']} />
                      <Legend />
                      <Bar dataKey="nov_2025_cost" name="Nov 2025" fill="#8884d8" maxBarSize={40} />
                      <Bar dataKey="dec_2025_cost" name="Dec 2025" fill="#82ca9d" maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>

                <div className="mt-3 space-y-2 text-sm">
                  {apiTopIncreases.map((r) => (
                    <div key={r.service_name} className="flex justify-between items-center">
                      <div className="truncate">{r.service_name}</div>
                      <div className="font-medium">Δ ${Number(r.cost_difference).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Not enough data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memory (debug)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {memories.length ? (
                memories.map((m) => (
                  <div key={m.id} className={`flex justify-between items-center ${m.resolved ? 'opacity-50' : ''}`}>
                    <div>
                      <div className="font-medium">{m.text}</div>
                      <div className="text-xs opacity-70">{m.type} {m.period ? `• ${m.period}` : ''} {m.resource ? `• ${m.resource}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!m.resolved && (
                        <Button size="sm" onClick={() => resolveMemories((it) => it.id === m.id)}>Resolve</Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No memories</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/*
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Monthly Costs (Year)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTotals}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="font-medium">{payload[0].payload.label}</div>
                              <div className="font-bold text-right">${payload[0].value?.toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
        */}
      </div>

      <Card className="w-[400px] flex flex-col">
        <CardHeader>
          <CardTitle>FinOps Copilot</CardTitle>
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
                    className={`rounded-lg px-4 py-2 max-w-[85%] ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="p-4 border-t flex gap-2">
            <Input
              placeholder="Ask about your costs..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
            />
            <Button size="icon" onClick={handleSendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
