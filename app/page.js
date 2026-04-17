"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, TreePine, Heart, Baby } from "lucide-react"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      router.push("/dashboard")
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TreePine className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Family Tree</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => router.push("/auth/login")}>
              Sign In
            </Button>
            <Button onClick={() => router.push("/auth/register")}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Build Your Family Tree, <span className="text-green-600">Fast</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Create, explore, and share your family history with our intuitive family tree builder. Connect generations
            and preserve your legacy for future generations.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <Button size="lg" onClick={() => router.push("/auth/register")}>
              Start Building
            </Button>
            <Button size="lg" variant="outline" onClick={() => router.push("/auth/login")}>
              Sign In
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="text-center">
            <CardHeader>
              <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <CardTitle>Easy to Use</CardTitle>
              <CardDescription>
                Intuitive interface makes building your family tree simple and enjoyable
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Heart className="h-12 w-12 text-pink-600 mx-auto mb-4" />
              <CardTitle>Rich Relationships</CardTitle>
              <CardDescription>Add spouses, children, parents, and siblings with detailed information</CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Baby className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <CardTitle>Multi-Generation</CardTitle>
              <CardDescription>Build comprehensive family trees spanning multiple generations</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Start Your Family Tree?</h3>
              <p className="text-gray-600 mb-6">
                Join thousands of families who have already started preserving their history
              </p>
              <Button size="lg" onClick={() => router.push("/auth/register")}>
                Create Your Tree Today
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
