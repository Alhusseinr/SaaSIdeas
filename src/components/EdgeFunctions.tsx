'use client'

import { useState } from 'react'
import {
  Container,
  Card,
  Title,
  Text,
  Button,
  Stack,
  Group,
  Badge,
  Grid,
  ThemeIcon,
  Alert,
  Loader,
  Code,
  JsonInput
} from '@mantine/core'
import {
  IconFunction,
  IconPlaylistX,
  IconDatabase,
  IconCheck,
  IconX
} from '@tabler/icons-react'
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
    <Container size="xl">
      <Stack gap="xl">
        {/* Header */}
        <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
          <Group justify="space-between">
            <Group>
              <ThemeIcon size="lg" radius="md" style={{ backgroundColor: '#006B3C', color: '#F5F5F5' }}>
                <IconFunction size={20} />
              </ThemeIcon>
              <div>
                <Title order={2} c="#F5F5F5">Edge Functions</Title>
                <Text c="#CCCCCC" size="sm">Trigger your Supabase Edge Functions</Text>
              </div>
            </Group>
            <Button
              onClick={testConnection}
              leftSection={<IconDatabase size={16} />}
              style={{
                backgroundColor: '#2A2A2A',
                color: '#E5E5E5',
                borderColor: '#404040'
              }}
            >
              Test Connection
            </Button>
          </Group>
        </Card>

        {/* Functions Grid */}
        <Grid>
          {EDGE_FUNCTIONS.map((func) => (
            <Grid.Col key={func.name} span={{ base: 12, md: 6 }}>
              <Card radius="xl" withBorder style={{ backgroundColor: '#1A1A1A', borderColor: '#404040' }}>
                {/* Function Header */}
                <Group justify="space-between" mb="md">
                  <div>
                    <Title order={4} c="#F5F5F5">{func.displayName}</Title>
                    <Text c="#CCCCCC" size="sm" mt="xs">{func.description}</Text>
                  </div>
                  <Badge
                    style={{
                      backgroundColor: '#006B3C',
                      color: '#F5F5F5'
                    }}
                    size="sm"
                  >
                    {func.name}
                  </Badge>
                </Group>

                {/* Payload Input */}
                {func.requiresPayload && (
                  <Stack gap="xs" mb="md">
                    <Text size="sm" fw={500} c="#F5F5F5">
                      JSON Payload (optional)
                    </Text>
                    <JsonInput
                      placeholder='{"key": "value"}'
                      value={payloads[func.name] || ''}
                      onChange={(value) => updatePayload(func.name, value)}
                      rows={3}
                      styles={{
                        input: { 
                          backgroundColor: '#2A2A2A', 
                          borderColor: '#404040', 
                          color: '#F5F5F5',
                          fontFamily: 'monospace'
                        },
                        label: { color: '#F5F5F5' }
                      }}
                    />
                  </Stack>
                )}

                {/* Invoke Button */}
                <Button
                  onClick={() => handleInvokeFunction(func)}
                  disabled={loadingStates[func.name]}
                  fullWidth
                  size="md"
                  radius="md"
                  style={{
                    background: 'linear-gradient(135deg, #006B3C 0%, #0F4C3A 100%)',
                    color: '#F5F5F5',
                    border: 'none'
                  }}
                  leftSection={
                    loadingStates[func.name] ? (
                      <Loader size="sm" color="#F5F5F5" />
                    ) : (
                      <IconPlaylistX size={16} />
                    )
                  }
                >
                  {loadingStates[func.name] ? 'Running...' : 'Invoke Function'}
                </Button>

                {/* Error Display */}
                {errors[func.name] && (
                  <Alert
                    icon={<IconX size={16} />}
                    title="Error"
                    color="red"
                    radius="md"
                    mt="md"
                    style={{
                      backgroundColor: '#2A2A2A',
                      borderColor: '#FF6B6B',
                      color: '#F5F5F5'
                    }}
                  >
                    <Text c="#FF6B6B" size="sm">{errors[func.name]}</Text>
                  </Alert>
                )}

                {/* Results Display */}
                {results[func.name] && (
                  <Stack gap="xs" mt="md">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconCheck size={16} color="#006B3C" />
                        <Text size="sm" fw={500} c="#F5F5F5">Result:</Text>
                      </Group>
                      {results[func.name]?.function_info && (
                        <Text size="xs" c="#666666">
                          v{results[func.name].function_info.version} • Updated {new Date(results[func.name].function_info.last_updated).toLocaleDateString()}
                        </Text>
                      )}
                    </Group>
                    <Code
                      block
                      style={{
                        backgroundColor: '#2A2A2A',
                        borderColor: '#404040',
                        color: '#E5E5E5',
                        maxHeight: '300px',
                        overflow: 'auto'
                      }}
                    >
                      {JSON.stringify(results[func.name], null, 2)}
                    </Code>
                  </Stack>
                )}
              </Card>
            </Grid.Col>
          ))}
        </Grid>
      </Stack>
    </Container>
  )
}