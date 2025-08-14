'use client'

import { useState } from 'react'
import { invokeEdgeFunction, supabase } from '@/lib/supabase'

interface EdgeFunction {
  name: string
  displayName: string
  description: string
  requiresPayload?: boolean
}

const EDGE_FUNCTIONS: EdgeFunction[] = [
  {
    name: 'ingest-reddit',
    displayName: 'ingest-reddit',
    description: 'function will ingest reddit posts',
    requiresPayload: false
  },
  {
    name: 'enrich',
    displayName: 'enrich',
    description: 'function will enrich reddit posts',
    requiresPayload: false
  },
  {
    name: 'summarize-negatives',
    displayName: 'summarize-negatives',
    description: 'function will summarize negative reddit posts',
    requiresPayload: false
  },
  {
    name: 'ideas-from-summaries',
    displayName: 'ideas-from-summaries',
    description: 'function will generate ideas from reddit post summaries',
    requiresPayload: false
  }
]

export default function EdgeFunctions() {
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [results, setResults] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [payloads, setPayloads] = useState<Record<string, string>>({})

  const handleInvokeFunction = async (func: EdgeFunction) => {
    setLoadingStates(prev => ({ ...prev, [func.name]: true }))
    setErrors(prev => ({ ...prev, [func.name]: '' }))
    setResults(prev => ({ ...prev, [func.name]: null }))

    try {
      let payload = undefined
      if (func.requiresPayload && payloads[func.name]) {
        try {
          payload = JSON.parse(payloads[func.name])
        } catch (e) {
          throw new Error('Invalid JSON payload')
        }
      }

      console.log(`Invoking function: ${func.name}`, payload ? { payload } : {})
      const result = await invokeEdgeFunction(func.name, payload)
      console.log(`Function ${func.name} result:`, result)
      setResults(prev => ({ ...prev, [func.name]: result }))
    } catch (error: any) {
      console.error(`Function ${func.name} error:`, error)
      setErrors(prev => ({ 
        ...prev, 
        [func.name]: error.message || 'Failed to invoke function' 
      }))
    } finally {
      setLoadingStates(prev => ({ ...prev, [func.name]: false }))
    }
  }

  const testConnection = async () => {
    console.log('Testing Supabase connection...')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Auth session:', session ? 'Active' : 'None')
      
      const { data, error } = await supabase.from('saas_idea_items').select('count').limit(1)
      console.log('Database test result:', { data, error })
      
      alert('Check console for connection details')
    } catch (err) {
      console.error('Connection test failed:', err)
      alert('Connection test failed - check console')
    }
  }

  const updatePayload = (functionName: string, value: string) => {
    setPayloads(prev => ({ ...prev, [functionName]: value }))
  }

  return (
    <div className="bg-white shadow-sm rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Edge Functions</h2>
            <p className="text-sm text-gray-600 mt-1">Trigger your Supabase Edge Functions</p>
          </div>
          <button
            onClick={testConnection}
            className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded text-sm font-medium"
          >
            Test Connection
          </button>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EDGE_FUNCTIONS.map((func) => (
            <div key={func.name} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{func.displayName}</h3>
                  <p className="text-sm text-gray-600 mt-1">{func.description}</p>
                </div>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {func.name}
                </span>
              </div>

              {func.requiresPayload && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    JSON Payload (optional)
                  </label>
                  <textarea
                    rows={3}
                    value={payloads[func.name] || ''}
                    onChange={(e) => updatePayload(func.name, e.target.value)}
                    placeholder='{"key": "value"}'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white placeholder-gray-500 font-mono text-sm"
                  />
                </div>
              )}

              <button
                onClick={() => handleInvokeFunction(func)}
                disabled={loadingStates[func.name]}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
              >
                {loadingStates[func.name] ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Running...
                  </>
                ) : (
                  'Invoke Function'
                )}
              </button>

              {errors[func.name] && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{errors[func.name]}</p>
                </div>
              )}

              {results[func.name] && (
                <div className="mt-3">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Result:</h4>
                  <pre className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs overflow-x-auto text-gray-800">
                    {JSON.stringify(results[func.name], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}