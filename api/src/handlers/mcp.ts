import { authorizeMcpToken, McpTokenAuthError } from '../auth/mcpTokenAuth';
import type { Env } from '../env';
import { badRequest, jsonResponse, serverError, unauthorized } from '../http/response';
import type { McpTokenScope } from '../repositories/mcpTokens';
import type {
  RunningSessionCancelRequest,
  RunningSessionDraftPayload,
  RunningSessionStatePayload,
  RunningSessionStopRequest,
  TimeTrackerSessionListRequest,
  TimeTrackerSessionRecordRequest,
} from '../types';
import {
  cancelRunningSessionForUser,
  getRunningStateForUser,
  listSessionsForUser,
  recordSessionForUser,
  startRunningSessionForUser,
  stopRunningSessionForUser,
  updateRunningSessionForUser,
} from './timeTracker';
import {
  defineMetricForUser,
  deleteBudgetForUser,
  deleteMetricEntryForUser,
  deleteMetricForUser,
  listBudgetsForUser,
  listMetricDefinitionsForUser,
  listMetricEntriesForUser,
  recordMetricForUser,
  setBudgetForUser,
} from './budgetsMetrics';

const PROTOCOL_VERSION = '2025-11-25';

const TOOL_NAMES = {
  START: 'ForgeTimeTrackerStart',
  STATUS: 'ForgeTimeTrackerStatus',
  UPDATE: 'ForgeTimeTrackerUpdate',
  STOP: 'ForgeTimeTrackerStop',
  CANCEL: 'ForgeTimeTrackerCancel',
  LIST_SESSIONS: 'ForgeTimeTrackerListSessions',
  RECORD_SESSION: 'ForgeTimeTrackerRecordSession',
  BUDGET_LIST: 'ForgeBudgetList',
  BUDGET_SET: 'ForgeBudgetSet',
  BUDGET_DELETE: 'ForgeBudgetDelete',
  METRIC_DEF_LIST: 'ForgeDailyMetricListDefinitions',
  METRIC_DEFINE: 'ForgeDailyMetricDefine',
  METRIC_DELETE: 'ForgeDailyMetricDeleteDefinition',
  METRIC_RECORD: 'ForgeDailyMetricRecord',
  METRIC_ENTRIES: 'ForgeDailyMetricListEntries',
  METRIC_ENTRY_DELETE: 'ForgeDailyMetricDeleteEntry',
} as const;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

type ToolCallParams = {
  name?: string;
  arguments?: unknown;
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const parseJsonRpcRequest = async (request: Request): Promise<JsonRpcRequest> => {
  const parsed = await request.json();
  const value = asObject(parsed);
  if (!value) {
    throw new Error('JSON-RPC request object is required');
  }
  if (value.jsonrpc !== '2.0') {
    throw new Error('jsonrpc must be "2.0"');
  }
  if (typeof value.method !== 'string' || value.method.trim().length === 0) {
    throw new Error('method is required');
  }
  return value as JsonRpcRequest;
};

const jsonRpcResponse = (id: JsonRpcId | undefined, result: unknown): Response =>
  jsonResponse({
    jsonrpc: '2.0',
    id: id ?? null,
    result,
  });

const jsonRpcError = (
  id: JsonRpcId | undefined,
  code: number,
  message: string,
  status = 200,
): Response =>
  jsonResponse(
    {
      jsonrpc: '2.0',
      id: id ?? null,
      error: {
        code,
        message,
      },
    },
    status,
  );

const unauthorizedMcp = (message: string, status: number): Response => {
  const response =
    status === 401 ? unauthorized(message) : jsonResponse({ error: 'forbidden', message }, 403);
  response.headers.set('WWW-Authenticate', 'Bearer');
  return response;
};

const validateMcpMethodHeader = (request: Request, rpc: JsonRpcRequest): Response | null => {
  const methodHeader = request.headers.get('Mcp-Method');
  if (methodHeader && methodHeader !== rpc.method) {
    return badRequest('Mcp-Method header does not match JSON-RPC method');
  }
  if (rpc.method === 'tools/call') {
    const nameHeader = request.headers.get('Mcp-Name');
    const params = asObject(rpc.params) as ToolCallParams | null;
    if (nameHeader && nameHeader !== params?.name) {
      return badRequest('Mcp-Name header does not match JSON-RPC tool name');
    }
  }
  return null;
};

const toolRequiresScope = (rpc: JsonRpcRequest): McpTokenScope => {
  if (rpc.method !== 'tools/call') {
    return 'time-tracker:read';
  }

  const params = asObject(rpc.params) as ToolCallParams | null;
  switch (params?.name) {
    case TOOL_NAMES.START:
    case TOOL_NAMES.UPDATE:
    case TOOL_NAMES.STOP:
    case TOOL_NAMES.CANCEL:
    case TOOL_NAMES.RECORD_SESSION:
    case TOOL_NAMES.BUDGET_SET:
    case TOOL_NAMES.BUDGET_DELETE:
    case TOOL_NAMES.METRIC_DEFINE:
    case TOOL_NAMES.METRIC_DELETE:
    case TOOL_NAMES.METRIC_RECORD:
    case TOOL_NAMES.METRIC_ENTRY_DELETE:
      return 'time-tracker:write';
    default:
      return 'time-tracker:read';
  }
};

const listToolsResult = () => ({
  tools: [
    {
      name: TOOL_NAMES.START,
      description: 'Start a Forge time-tracker session.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          project: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
          skill: { type: 'string' },
          intensity: { type: 'string' },
          startedAt: { type: 'string' },
          id: { type: 'string' },
          draft: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.STATUS,
      description: 'Get the current Forge time-tracker running state.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.UPDATE,
      description: 'Update the current Forge time-tracker running session metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          startedAt: { type: 'string' },
          project: { type: 'string' },
          notes: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          skill: { type: 'string' },
          intensity: { type: 'string' },
          elapsedSeconds: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.STOP,
      description: 'Stop the current Forge time-tracker session.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          stoppedAt: { type: 'string' },
          title: { type: 'string' },
          project: { type: 'string' },
          notes: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          skill: { type: 'string' },
          intensity: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.CANCEL,
      description: 'Cancel the current Forge time-tracker session without recording it.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.LIST_SESSIONS,
      description: 'List recent completed Forge time-tracker sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 50 },
          from: { type: 'string' },
          to: { type: 'string' },
          query: { type: 'string' },
          project: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.RECORD_SESSION,
      description: 'Record a completed Forge time-tracker session for a past time range.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          startedAt: { type: 'string' },
          endedAt: { type: 'string' },
          project: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
          skill: { type: 'string' },
          intensity: { type: 'string' },
          dryRun: { type: 'boolean' },
        },
        required: ['title', 'startedAt', 'endedAt'],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.BUDGET_LIST,
      description: 'List the tag-based work-time budgets (with weekday schedules).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: TOOL_NAMES.BUDGET_SET,
      description:
        'Create or update a tag-based work-time budget. Provide weekdayHours (preferred) or weekdayMinutes as a length-7 array indexed Sunday..Saturday. Pass id to update an existing budget.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          tag: { type: 'string' },
          label: { type: 'string' },
          weekdayHours: { type: 'array', items: { type: 'number' }, minItems: 7, maxItems: 7 },
          weekdayMinutes: { type: 'array', items: { type: 'number' }, minItems: 7, maxItems: 7 },
          effectiveFrom: { type: 'string', description: 'YYYY-MM-DD' },
          effectiveTo: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['tag', 'effectiveFrom'],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.BUDGET_DELETE,
      description: 'Delete a work-time budget by id.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.METRIC_DEF_LIST,
      description: 'List the daily custom record definitions (checkbox/number/text/select).',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: TOOL_NAMES.METRIC_DEFINE,
      description:
        'Create or update a daily record definition. kind is one of boolean, number, text, single_select, multi_select. For select kinds pass options as [{value,label}]. Pass id to update.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          kind: {
            type: 'string',
            enum: ['boolean', 'number', 'text', 'single_select', 'multi_select'],
          },
          unit: { type: 'string' },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: { value: { type: 'string' }, label: { type: 'string' } },
            },
          },
          targetNumber: { type: 'number' },
          displayOrder: { type: 'number' },
        },
        required: ['name', 'kind'],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.METRIC_DELETE,
      description: 'Delete a daily record definition (and its entries) by id.',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.METRIC_RECORD,
      description:
        'Record (upsert) a daily value. Identify the metric by metricId or metricName. value type must match the metric kind (boolean/number/string/string[]). entryDate defaults to today (UTC) if omitted.',
      inputSchema: {
        type: 'object',
        properties: {
          metricId: { type: 'string' },
          metricName: { type: 'string' },
          entryDate: { type: 'string', description: 'YYYY-MM-DD (defaults to today)' },
          value: {},
        },
        required: ['value'],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.METRIC_ENTRIES,
      description: 'List daily record entries within a date range.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['from', 'to'],
        additionalProperties: false,
      },
    },
    {
      name: TOOL_NAMES.METRIC_ENTRY_DELETE,
      description: 'Delete a daily record entry by metricId and entryDate.',
      inputSchema: {
        type: 'object',
        properties: {
          metricId: { type: 'string' },
          entryDate: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['metricId', 'entryDate'],
        additionalProperties: false,
      },
    },
  ],
});

const toolResult = (value: unknown) => ({
  content: [
    {
      type: 'text',
      text: JSON.stringify(value, null, 2),
    },
  ],
  structuredContent: value,
});

const optionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const optionalNumber = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.floor(value);
};

const buildDraftFromArguments = (argumentsValue: unknown): RunningSessionDraftPayload => {
  const args = asObject(argumentsValue) ?? {};
  const draftArg = asObject(args.draft);
  if (draftArg) {
    return draftArg as RunningSessionDraftPayload;
  }

  const title = optionalString(args.title);
  if (!title) {
    throw new Error('title is required');
  }

  const draft: RunningSessionDraftPayload = {
    id: optionalString(args.id) ?? crypto.randomUUID(),
    title,
    startedAt: optionalString(args.startedAt) ?? new Date().toISOString(),
  };
  const project = optionalString(args.project);
  if (project) draft.project = project;
  const notes = optionalString(args.notes);
  if (notes) draft.notes = notes;
  const skill = optionalString(args.skill);
  if (skill) draft.skill = skill;
  const intensity = optionalString(args.intensity);
  if (intensity) draft.intensity = intensity;
  if (Array.isArray(args.tags)) {
    draft.tags = args.tags.filter((tag): tag is string => typeof tag === 'string');
  }
  return draft;
};

const buildRunningUpdateFromArguments = async (
  env: Env,
  userId: string,
  argumentsValue: unknown,
): Promise<{ draft: RunningSessionDraftPayload; elapsedSeconds: number }> => {
  const statusResult = await getRunningStateForUser(env, userId);
  const currentState = (statusResult.body as { state?: RunningSessionStatePayload }).state;
  if (!currentState || currentState.status !== 'running') {
    throw new Error('No running session exists');
  }

  const args = asObject(argumentsValue) ?? {};
  const id = optionalString(args.id);
  if (id && currentState.draft.id !== id) {
    throw new Error('Running session id does not match');
  }

  const draft: RunningSessionDraftPayload = { ...currentState.draft };
  const title = optionalString(args.title);
  if (title) draft.title = title;
  const startedAt = optionalString(args.startedAt);
  if (startedAt) draft.startedAt = startedAt;
  const project = optionalString(args.project);
  if (project) draft.project = project;
  const notes = optionalString(args.notes);
  if (notes) draft.notes = notes;
  const skill = optionalString(args.skill);
  if (skill) draft.skill = skill;
  const intensity = optionalString(args.intensity);
  if (intensity) draft.intensity = intensity;
  if (Array.isArray(args.tags)) {
    draft.tags = args.tags.filter((tag): tag is string => typeof tag === 'string');
  }

  const elapsedSeconds =
    optionalNumber(args.elapsedSeconds) ??
    Math.max(0, Math.floor((Date.now() - new Date(draft.startedAt).getTime()) / 1000));

  return { draft, elapsedSeconds };
};

const executeTool = async (
  env: Env,
  userId: string,
  name: string,
  argumentsValue: unknown,
): Promise<unknown> => {
  switch (name) {
    case TOOL_NAMES.START: {
      const result = await startRunningSessionForUser(env, userId, {
        draft: buildDraftFromArguments(argumentsValue),
      });
      return result.body;
    }
    case TOOL_NAMES.STATUS: {
      const result = await getRunningStateForUser(env, userId);
      return result.body;
    }
    case TOOL_NAMES.UPDATE: {
      const result = await updateRunningSessionForUser(
        env,
        userId,
        await buildRunningUpdateFromArguments(env, userId, argumentsValue),
      );
      return result.body;
    }
    case TOOL_NAMES.LIST_SESSIONS: {
      const args = (asObject(argumentsValue) ?? {}) as TimeTrackerSessionListRequest;
      const result = await listSessionsForUser(env, userId, args);
      return result.body;
    }
    case TOOL_NAMES.STOP: {
      const args = asObject(argumentsValue) ?? {};
      const payload: RunningSessionStopRequest = {};
      const id = optionalString(args.id);
      if (id) payload.id = id;
      const stoppedAt = optionalString(args.stoppedAt);
      if (stoppedAt) payload.stoppedAt = stoppedAt;
      const title = optionalString(args.title);
      if (title) payload.title = title;
      const project = optionalString(args.project);
      if (project) payload.project = project;
      const notes = optionalString(args.notes);
      if (notes) payload.notes = notes;
      const skill = optionalString(args.skill);
      if (skill) payload.skill = skill;
      const intensity = optionalString(args.intensity);
      if (intensity) payload.intensity = intensity;
      if (Array.isArray(args.tags)) {
        payload.tags = args.tags.filter((tag): tag is string => typeof tag === 'string');
      }
      const result = await stopRunningSessionForUser(env, userId, payload);
      return result.body;
    }
    case TOOL_NAMES.CANCEL: {
      const args = asObject(argumentsValue) ?? {};
      const payload: RunningSessionCancelRequest = {};
      const id = optionalString(args.id);
      if (id) payload.id = id;
      const result = await cancelRunningSessionForUser(env, userId, payload);
      return result.body;
    }
    case TOOL_NAMES.RECORD_SESSION: {
      const args = (asObject(argumentsValue) ?? {}) as TimeTrackerSessionRecordRequest;
      const result = await recordSessionForUser(env, userId, args);
      return result.body;
    }
    case TOOL_NAMES.BUDGET_LIST:
      return listBudgetsForUser(env, userId);
    case TOOL_NAMES.BUDGET_SET:
      return setBudgetForUser(env, userId, argumentsValue);
    case TOOL_NAMES.BUDGET_DELETE:
      return deleteBudgetForUser(env, userId, argumentsValue);
    case TOOL_NAMES.METRIC_DEF_LIST:
      return listMetricDefinitionsForUser(env, userId);
    case TOOL_NAMES.METRIC_DEFINE:
      return defineMetricForUser(env, userId, argumentsValue);
    case TOOL_NAMES.METRIC_DELETE:
      return deleteMetricForUser(env, userId, argumentsValue);
    case TOOL_NAMES.METRIC_RECORD:
      return recordMetricForUser(env, userId, argumentsValue);
    case TOOL_NAMES.METRIC_ENTRIES:
      return listMetricEntriesForUser(env, userId, argumentsValue);
    case TOOL_NAMES.METRIC_ENTRY_DELETE:
      return deleteMetricEntryForUser(env, userId, argumentsValue);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
};

const handleJsonRpc = async (
  request: Request,
  env: Env,
  rpc: JsonRpcRequest,
): Promise<Response> => {
  const headerError = validateMcpMethodHeader(request, rpc);
  if (headerError) return headerError;

  const requiredScope = toolRequiresScope(rpc);
  let auth;
  try {
    auth = await authorizeMcpToken(request, env, requiredScope);
  } catch (error) {
    if (error instanceof McpTokenAuthError) {
      return unauthorizedMcp(error.message, error.status);
    }
    if (error instanceof Error) {
      return serverError(error.message);
    }
    return serverError('Unknown error');
  }

  if (rpc.id === undefined) {
    return new Response(null, { status: 202 });
  }

  switch (rpc.method) {
    case 'initialize':
      return jsonRpcResponse(rpc.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: 'forge-time-tracker',
          version: '0.1.0',
        },
      });
    case 'tools/list':
      return jsonRpcResponse(rpc.id, listToolsResult());
    case 'tools/call': {
      const params = asObject(rpc.params) as ToolCallParams | null;
      if (!params || typeof params.name !== 'string') {
        return jsonRpcError(rpc.id, -32602, 'tools/call params.name is required');
      }
      try {
        const result = await executeTool(env, auth.userId, params.name, params.arguments);
        return jsonRpcResponse(rpc.id, toolResult(result));
      } catch (error) {
        return jsonRpcError(
          rpc.id,
          -32000,
          error instanceof Error ? error.message : 'Tool execution failed',
        );
      }
    }
    default:
      return jsonRpcError(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }
};

export const handleMcp = async (request: Request, env: Env): Promise<Response> => {
  let rpc: JsonRpcRequest;
  try {
    rpc = await parseJsonRpcRequest(request);
  } catch (error) {
    return jsonRpcError(null, -32700, error instanceof Error ? error.message : 'Parse error', 400);
  }

  return handleJsonRpc(request, env, rpc);
};
