"use client";

import { useState } from 'react';
import { supabase, invokeEdgeFunction } from '@/lib/supabase';
import {
  IconFunction,
  IconPlaylistX,
  IconDatabase,
  IconCheck,
  IconX,
  IconLoader,
  IconRefresh,
  IconCloud,
  IconCode,
  IconAlertCircle,
  IconExternalLink,
} from '@tabler/icons-react';

interface EdgeFunctionConfig {
  id: string;
  name: string;
  description: string;
  requiresPayload?: boolean;
  status: 'idle' | 'running' | 'success' | 'error';
  lastRun?: Date;
  result?: any;
  error?: string;
  icon: React.ReactNode;
  color: string;
}

const EDGE_FUNCTIONS: EdgeFunctionConfig[] = [
  {
    id: 'ingest-reddit',
    name: 'Ingest Reddit Data',
    description: 'Scrapes Reddit posts and comments from specified subreddits using the Reddit API',
    requiresPayload: false,
    status: 'idle',
    icon: <IconDatabase size={20} />,
    color: 'bg-blue-500'
  },
  {
    id: 'enrich',
    name: 'AI Enhancement',
    description: 'Analyzes raw Reddit data with AI to extract insights and opportunities',
    requiresPayload: false,
    status: 'idle',
    icon: <IconFunction size={20} />,
    color: 'bg-green-500'
  },
  {
    id: 'summarize-negatives',
    name: 'Negative Summary',
    description: 'Processes complaint posts to identify common pain points and frustrations',
    requiresPayload: false,
    status: 'idle',
    icon: <IconPlaylistX size={20} />,
    color: 'bg-orange-500'
  },
  {
    id: 'ideas-from-summaries',
    name: 'Generate SaaS Ideas',
    description: 'Transforms pain point summaries into actionable SaaS business opportunities',
    requiresPayload: false,
    status: 'idle',
    icon: <IconCode size={20} />,
    color: 'bg-purple-500'
  }
];

export default function EdgeFunctions() {
  const [functions, setFunctions] = useState<EdgeFunctionConfig[]>(EDGE_FUNCTIONS);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [payloads, setPayloads] = useState<Record<string, string>>({});

  const updateFunctionStatus = (id: string, updates: Partial<EdgeFunctionConfig>) => {
    setFunctions(prev => prev.map(fn => 
      fn.id === id ? { ...fn, ...updates } : fn
    ));
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus('idle');
    
    try {
      const { data, error } = await supabase.rpc('get_current_timestamp');
      
      if (error) {
        throw error;
      }
      
      setConnectionStatus('success');
    } catch (err) {
      console.error('Connection test failed:', err);
      setConnectionStatus('error');
    } finally {
      setTestingConnection(false);
    }
  };

  const runEdgeFunction = async (functionConfig: EdgeFunctionConfig) => {
    updateFunctionStatus(functionConfig.id, { 
      status: 'running', 
      error: undefined,
      result: undefined
    });

    try {
      let payload = undefined;
      if (functionConfig.requiresPayload && payloads[functionConfig.id]) {
        try {
          payload = JSON.parse(payloads[functionConfig.id]);
        } catch (e) {
          throw new Error('Invalid JSON payload');
        }
      }

      const { data, error } = await invokeEdgeFunction(functionConfig.id, payload);
      
      if (error) {
        throw new Error(error);
      }

      updateFunctionStatus(functionConfig.id, {
        status: 'success',
        lastRun: new Date(),
        result: data,
        error: undefined
      });

    } catch (err: any) {
      updateFunctionStatus(functionConfig.id, {
        status: 'error',
        error: err.message || 'Function execution failed',
        lastRun: new Date()
      });
    }
  };

  const getStatusColor = (status: EdgeFunctionConfig['status']) => {
    switch (status) {
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: EdgeFunctionConfig['status']) => {
    switch (status) {
      case 'running':
        return <IconLoader size={16} className="animate-spin text-blue-600" />;
      case 'success':
        return <IconCheck size={16} className="text-green-600" />;
      case 'error':
        return <IconX size={16} className="text-red-600" />;
      default:
        return null;
    }
  };

  const formatResult = (result: any) => {
    if (!result) return null;
    
    if (typeof result === 'string') {
      return result;
    }
    
    return JSON.stringify(result, null, 2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
              <IconCloud size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Edge Functions</h2>
              <p className="text-sm text-gray-600">Monitor and execute serverless functions</p>
            </div>
          </div>
          
          <button
            onClick={testConnection}
            disabled={testingConnection}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              connectionStatus === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200'
                : connectionStatus === 'error'
                ? 'bg-red-100 text-red-800 border border-red-200'
                : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
            }`}
          >
            {testingConnection ? (
              <IconLoader size={16} className="animate-spin" />
            ) : connectionStatus === 'success' ? (
              <IconCheck size={16} />
            ) : connectionStatus === 'error' ? (
              <IconX size={16} />
            ) : (
              <IconRefresh size={16} />
            )}
            {testingConnection ? 'Testing...' : connectionStatus === 'success' ? 'Connected' : connectionStatus === 'error' ? 'Failed' : 'Test Connection'}
          </button>
        </div>

        {connectionStatus === 'error' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <IconAlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-red-900 font-medium">Connection Failed</h4>
                <p className="text-red-700 text-sm mt-1">
                  Unable to connect to the database. Please check your connection and try again.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Functions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {functions.map((func) => (
          <div key={func.id} className="bg-white rounded-lg border border-gray-200 shadow-sm">
            {/* Function Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${func.color} rounded-lg flex items-center justify-center text-white`}>
                    {func.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{func.name}</h3>
                    <p className="text-sm text-gray-600">{func.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {getStatusIcon(func.status)}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(func.status)}`}>
                    {func.status === 'running' ? 'Running' : func.status === 'success' ? 'Success' : func.status === 'error' ? 'Error' : 'Idle'}
                  </span>
                </div>
              </div>

              {func.lastRun && (
                <p className="text-xs text-gray-500">
                  Last run: {func.lastRun.toLocaleString()}
                </p>
              )}
            </div>

            {/* Function Body */}
            <div className="p-6 space-y-4">
              {/* Payload Input (if required) */}
              {func.requiresPayload && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    JSON Payload
                  </label>
                  <textarea
                    value={payloads[func.id] || ''}
                    onChange={(e) => setPayloads(prev => ({
                      ...prev,
                      [func.id]: e.target.value
                    }))}
                    placeholder='{"key": "value"}'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
              )}

              {/* Run Button */}
              <button
                onClick={() => runEdgeFunction(func)}
                disabled={func.status === 'running'}
                className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-md font-medium transition-colors ${
                  func.status === 'running'
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {func.status === 'running' ? (
                  <>
                    <IconLoader size={16} className="animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <IconFunction size={16} />
                    Execute Function
                  </>
                )}
              </button>

              {/* Error Display */}
              {func.status === 'error' && func.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-start gap-2">
                    <IconX size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-red-900 text-sm font-medium">Execution Failed</h4>
                      <p className="text-red-700 text-sm mt-1">{func.error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Result */}
              {func.status === 'success' && func.result && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <IconCheck size={16} className="text-green-600" />
                      <h4 className="text-green-900 text-sm font-medium">Execution Result</h4>
                    </div>
                  </div>
                  
                  <div className="bg-white border border-green-200 rounded p-3 mt-2">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                      {formatResult(func.result)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <IconCloud size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-2">About Edge Functions</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                These serverless functions handle data processing, analysis, and integration tasks. 
                Each function is deployed to the edge for optimal performance and scalability.
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li><strong>Ingest Reddit:</strong> Collects raw data from Reddit API</li>
                <li><strong>AI Enhancement:</strong> Processes data with machine learning models</li>
                <li><strong>Negative Summary:</strong> Identifies common user pain points</li>
                <li><strong>Generate Ideas:</strong> Creates business opportunities from insights</li>
              </ul>
              <p className="mt-3">
                Functions can be triggered manually for testing or automatically via scheduled jobs.
                Results and errors are logged for monitoring and debugging purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}