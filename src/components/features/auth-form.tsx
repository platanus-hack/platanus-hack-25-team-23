"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSignUp, setIsSignUp] = useState(false)

  const supabase = createClient()

  const handleAnonLogin = async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
      toast.success("Signed in anonymously!")
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Failed to sign in anonymously")
    } finally {
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
        toast.success("Check your email to confirm sign up!")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast.success("Signed in successfully!")
      }
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || "Authentication failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to BrainFlow</CardTitle>
          <CardDescription>Sign in to start your learning journey</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleAnonLogin} 
            disabled={isLoading}
          >
            Continue as Guest (Anonymous)
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          </form>
          
          <div className="text-center text-sm">
            <button 
              type="button"
              className="text-blue-500 hover:underline"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
