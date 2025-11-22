import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function testStream() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Sign in anonymously to get a session
  const { data: { session }, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.error('Auth failed:', error)
    return
  }

  console.log('Authenticated as:', session?.user.id)

  // Construct cookie
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  // The structure expected by @supabase/ssr might vary, but usually it's the session string or token.
  // Let's try passing the access token as a bearer token in Authorization header AND the cookie.
  // But the server client looks for cookies.
  // Format: base64 or json?
  // Let's try to just use the access token in the cookie value, or the full session object stringified.
  const cookieValue = JSON.stringify(session)
  
  console.log('Testing generation...')
  
  try {
    const response = await fetch('http://localhost:3000/api/notes/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `${cookieName}=${encodeURIComponent(cookieValue)}`
      },
      body: JSON.stringify({ topic: 'Artificial Intelligence' }),
    })

    if (!response.ok) {
      console.error('API Error:', response.status, response.statusText)
      const text = await response.text()
      console.error('Response:', text)
      return
    }

    console.log('Response status:', response.status)
    const reader = response.body?.getReader()
    if (!reader) {
      console.error('No response body')
      return
    }

    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      console.log('Received chunk:', chunk)
    }
    console.log('Stream finished successfully')
  } catch (error) {
    console.error('Fetch error:', error)
  }
}

testStream()
