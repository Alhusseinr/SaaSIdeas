import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export interface SaasIdeaItem {
  id: number
  run_id: number
  name: string
  score: number
  one_liner: string | null
  target_user: string | null
  core_features: string[] | null
  why_now: string | null
  pricing_hint: string | null
  rationale: string | null
  representative_post_ids: number[] | null
  payload: any
  created_at: string | null
}

export const invokeEdgeFunction = async (functionName: string, payload?: any) => {
  try {
    console.log(`Invoking function: ${functionName}`)
    console.log('Payload:', payload)
    
    // Try Supabase client first (handles CORS automatically), fallback to fetch
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload || {}
      })
      
      if (error) {
        console.warn('Supabase client failed, trying direct fetch:', error)
        throw new Error('Trying fetch fallback')
      }
      
      console.log('Function response (via Supabase client):', data)
      return data
    } catch (supabaseError) {
      console.log('Falling back to direct fetch due to:', supabaseError)
    }
    
    // Fallback to direct fetch
    const { data: { session } } = await supabase.auth.getSession()
    
    // Build the function URL
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${functionName}`
    console.log('POST request to:', functionUrl)
    
    // Create abort controller for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minutes timeout
    
    let response
    try {
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload || {}),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
    } catch (error: any) {
      clearTimeout(timeoutId)
      if (error.name === 'AbortError') {
        throw new Error('Function call timed out after 5 minutes')
      }
      throw error
    }
    
    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response')
      console.error('Function error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText
      })
      throw new Error(`HTTP ${response.status}: ${response.statusText}${errorText ? ` - ${errorText}` : ''}`)
    }
    
    // Try to parse as JSON, fallback to text
    let data
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }
    
    console.log('Function response:', data)
    return data
  } catch (err: any) {
    console.error('Function invocation failed:', err)
    
    // Check for specific error types
    if (err.message?.includes('401')) {
      throw new Error('Authentication required - please check your login status')
    }
    if (err.message?.includes('404')) {
      throw new Error(`Function '${functionName}' not found - check function name or deployment`)
    }
    if (err.message?.includes('405')) {
      throw new Error('Method not allowed - function may not support POST requests')
    }
    if (err.message?.includes('CORS') || err.message?.includes('access control')) {
      throw new Error('CORS error: Function needs to include proper CORS headers')
    }
    if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
      throw new Error('Network error: Unable to reach the function endpoint')
    }
    
    throw new Error(err.message || 'Failed to invoke edge function')
  }
}